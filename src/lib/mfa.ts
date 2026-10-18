import "server-only";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { all, get, run } from "./db";
import { hmac, signValue, verifySignedValue } from "./auth";
import type { SpaceSlug, UserType } from "./spaces";

// Second factor: after a correct password, a 6-digit single-use code is "sent"
// to the account's email. The session only starts once the code is entered.
// - valid 10 minutes, 5 attempts, 3 resends;
// - only an HMAC of the code is stored;
// - the pending step is carried by a signed, httpOnly cookie (no session yet).
// In this prototype every address is fictional, so the email provider is
// replaced by a demo outbox shown on the verification page.

export const MFA_COOKIE = "vs_mfa";
export const CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_RESENDS = 3;

export type Challenge = {
  id: string;
  user_type: UserType;
  user_id: string;
  email: string;
  space: SpaceSlug;
  code_hash: string;
  expires_at: string;
  attempts: number;
  resends: number;
};

export type OutboxMessage = { recipient: string; subject: string; body: string; created_at: string };

const codeHash = (challengeId: string, code: string) => hmac(`mfa:${challengeId}:${code}`);

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}${"•".repeat(Math.max(3, user.length - 1))}@${domain}`;
}

/** Draws a new code for the challenge and "emails" it (demo outbox). */
async function sendCode(challenge: Pick<Challenge, "id" | "email">) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  await run(
    "UPDATE login_challenges SET code_hash = ?, expires_at = ?, attempts = 0 WHERE id = ?",
    codeHash(challenge.id, code), new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString(), challenge.id,
  );
  await run(
    "INSERT INTO demo_outbox (challenge_id, recipient, subject, body, created_at) VALUES (?, ?, ?, ?, ?)",
    challenge.id, challenge.email, "Votre code de connexion PrépaMarathon",
    `Votre code de connexion : ${code}\nIl est valable ${CODE_TTL_MINUTES} minutes.\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message et changez votre mot de passe.`,
    now.toISOString(),
  );
}

async function setCookie(id: string | null) {
  const store = await cookies();
  if (!id) return store.delete(MFA_COOKIE);
  store.set(MFA_COOKIE, signValue(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CODE_TTL_MINUTES * 60,
  });
}

/** Called once the password is right: opens the second step. */
export async function startChallenge(user: { user_type: UserType; user_id: string; email: string }, space: SpaceSlug) {
  const now = new Date().toISOString();
  // One pending step per account; stale ones are dropped.
  await run("DELETE FROM demo_outbox WHERE challenge_id IN (SELECT id FROM login_challenges WHERE user_id = ? OR expires_at < ?)", user.user_id, now);
  await run("DELETE FROM login_challenges WHERE user_id = ? OR expires_at < ?", user.user_id, now);
  const id = randomBytes(24).toString("base64url");
  await run(
    `INSERT INTO login_challenges (id, user_type, user_id, email, space, code_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, '', ?, ?)`,
    id, user.user_type, user.user_id, user.email, space, now, now,
  );
  await sendCode({ id, email: user.email });
  await setCookie(id);
}

/** The pending step of this browser, if still valid. */
export async function currentChallenge() {
  const store = await cookies();
  const id = verifySignedValue(store.get(MFA_COOKIE)?.value);
  if (!id) return null;
  const challenge = await get<Challenge>("SELECT * FROM login_challenges WHERE id = ?", id);
  if (!challenge || challenge.expires_at < new Date().toISOString()) return null;
  return challenge;
}

export function codeMatches(challenge: Challenge, code: string) {
  const expected = Buffer.from(challenge.code_hash);
  const actual = Buffer.from(codeHash(challenge.id, code));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function recordWrongCode(challenge: Challenge) {
  await run("UPDATE login_challenges SET attempts = attempts + 1 WHERE id = ?", challenge.id);
  return challenge.attempts + 1;
}

export async function resendCode(challenge: Challenge) {
  if (challenge.resends >= MAX_RESENDS) return false;
  await run("UPDATE login_challenges SET resends = resends + 1 WHERE id = ?", challenge.id);
  await sendCode(challenge);
  return true;
}

/** Ends the second step (success, too many attempts or cancel). */
export async function closeChallenge(id: string) {
  await run("DELETE FROM demo_outbox WHERE challenge_id = ?", id);
  await run("DELETE FROM login_challenges WHERE id = ?", id);
  await setCookie(null);
}

/** Demo only: the last message "sent" for this step, as a mailbox would show it. */
export async function latestMessage(challengeId: string) {
  const rows = await all<OutboxMessage>(
    "SELECT recipient, subject, body, created_at FROM demo_outbox WHERE challenge_id = ? ORDER BY id DESC LIMIT 1",
    challengeId,
  );
  return rows[0] ?? null;
}
