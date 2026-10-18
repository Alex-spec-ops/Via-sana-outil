import "server-only";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { all, get, run } from "./db";
import { signValue, verifySignedValue } from "./auth";
import { DEMO_PASSWORD } from "./passwords";
import type { SpaceSlug, UserType } from "./spaces";

// Login in two factors, both checked by Supabase Auth:
// 1. the password (signInWithPassword);
// 2. a 6-digit code sent by email (signInWithOtp), checked with verifyOtp.
// Only then does the app open its own session. Everything runs on the server:
// no Supabase key reaches the browser, and the database stays closed to the
// public API.
// Demo accounts have fictional addresses, so nothing is ever emailed to them:
// Supabase generates their code without sending it (generateLink) and the
// verification page shows it in a demo mailbox. Supabase still checks it.

const APP = "via-sana";
export const MFA_COOKIE = "vs_mfa";
export const STEP_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_RESENDS = 3;

function projectUrl() {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  // Derived from the pooler login "postgres.<project-ref>".
  const ref = process.env.DATABASE_URL?.match(/\/\/postgres\.([a-z0-9]{20})[:@]/)?.[1];
  return ref ? `https://${ref}.supabase.co` : null;
}

/** Server-side secret key of the Supabase project (either name is accepted). */
function secretKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SECRET_KEY_SUPABASE;
}

export function supabaseAuthReady() {
  return Boolean(projectUrl() && secretKey());
}

/** A fresh server-side client (no session kept between calls). */
function supabase(): SupabaseClient {
  const url = projectUrl();
  const key = secretKey();
  if (!url || !key) throw new Error("Supabase Auth n'est pas configuré : clé secrète manquante.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

// ------------------------------------------------------------------ Accounts

type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };

async function listAppUsers() {
  const users: AuthUser[] = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await supabase().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

/** Creates the Supabase Auth user of a new account (replacing one left behind by a demo reset). */
export async function createAuthUser(email: string, password: string) {
  const client = supabase();
  const create = () => client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { app: APP } });
  let { data, error } = await create();
  if (error && /already|registered|exists/i.test(error.message)) {
    const orphan = (await listAppUsers()).find((u) => u.email?.toLowerCase() === email && u.user_metadata?.app === APP);
    const linked = await get("SELECT 1 AS ok FROM credentials WHERE email = ?", email);
    if (!orphan || linked) throw new Error("Un compte existe déjà avec cet email.");
    await client.auth.admin.deleteUser(orphan.id);
    ({ data, error } = await create());
  }
  if (error || !data.user) throw error ?? new Error("Création du compte impossible.");
  return data.user.id;
}

/**
 * Brings Supabase Auth in line with the app's accounts (after the demo data is
 * created or reset): each account gets its Supabase user, demo accounts get the
 * demo password back, users of accounts that no longer exist are removed.
 */
export async function syncAuthUsers() {
  if (!supabaseAuthReady()) return;
  const client = supabase();
  const users = await listAppUsers();
  const byEmail = new Map(users.map((u) => [u.email?.toLowerCase(), u]));
  const accounts = await all<{ email: string; demo: number }>("SELECT email, demo FROM credentials");
  for (const account of accounts) {
    const existing = byEmail.get(account.email);
    let id = existing?.id;
    if (!id) {
      const { data, error } = await client.auth.admin.createUser({
        email: account.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { app: APP },
      });
      if (error) throw error;
      id = data.user.id;
    } else if (account.demo) {
      await client.auth.admin.updateUserById(id, { password: DEMO_PASSWORD });
    }
    await run("UPDATE credentials SET auth_user_id = ? WHERE email = ?", id, account.email);
  }
  const known = new Set(accounts.map((a) => a.email));
  for (const user of users) {
    if (user.user_metadata?.app === APP && user.email && !known.has(user.email.toLowerCase())) {
      await client.auth.admin.deleteUser(user.id);
    }
  }
}

// ------------------------------------------------------------------ Login

export type PendingStep = {
  id: string;
  email: string;
  userType: UserType;
  userId: string;
  space: SpaceSlug;
  demo: boolean;
  attempts: number;
  resends: number;
  exp: number;
};

/** First factor: Supabase checks the password. */
export async function checkPassword(email: string, password: string) {
  const client = supabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await client.auth.signOut({ scope: "local" }); // only the proof is needed: the session opens after the code
  return true;
}

/** Second factor: Supabase emails a code (or, for a demo account, generates it for the demo mailbox). */
async function sendCode(step: PendingStep) {
  const client = supabase();
  if (step.demo) {
    const { data, error } = await client.auth.admin.generateLink({ type: "magiclink", email: step.email });
    if (error || !data.properties?.email_otp) throw error ?? new Error("Code non généré.");
    await run("DELETE FROM demo_outbox WHERE challenge_id = ?", step.id);
    await run(
      "INSERT INTO demo_outbox (challenge_id, recipient, subject, body, created_at) VALUES (?, ?, ?, ?, ?)",
      step.id, step.email, "Votre code de connexion PrépaMarathon",
      `Votre code de connexion : ${data.properties.email_otp}\nIl est valable ${STEP_MINUTES} minutes.\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message et changez votre mot de passe.`,
      new Date().toISOString(),
    );
    return;
  }
  const { error } = await client.auth.signInWithOtp({ email: step.email, options: { shouldCreateUser: false } });
  if (error) throw error;
}

async function saveStep(step: PendingStep | null) {
  const store = await cookies();
  if (!step) return store.delete(MFA_COOKIE);
  store.set(MFA_COOKIE, signValue(Buffer.from(JSON.stringify(step)).toString("base64url")), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: STEP_MINUTES * 60,
  });
}

/** Right password: starts the email step. */
export async function startEmailStep(account: Omit<PendingStep, "id" | "attempts" | "resends" | "exp">) {
  const step: PendingStep = { ...account, id: randomBytes(16).toString("base64url"), attempts: 0, resends: 0, exp: Date.now() + STEP_MINUTES * 60_000 };
  await sendCode(step);
  await saveStep(step);
}

/** The pending email step of this browser, if still valid. */
export async function currentStep(): Promise<PendingStep | null> {
  const store = await cookies();
  const payload = verifySignedValue(store.get(MFA_COOKIE)?.value);
  if (!payload) return null;
  try {
    const step = JSON.parse(Buffer.from(payload, "base64url").toString()) as PendingStep;
    return step.exp > Date.now() ? step : null;
  } catch {
    return null;
  }
}

/** Supabase checks the code. */
export async function verifyCode(step: PendingStep, code: string) {
  const client = supabase();
  for (const type of ["email", "magiclink"] as const) {
    const { data, error } = await client.auth.verifyOtp({ email: step.email, token: code, type });
    if (!error && data.session) {
      await client.auth.signOut({ scope: "local" }); // the app opens its own session
      return true;
    }
  }
  return false;
}

export async function recordWrongCode(step: PendingStep) {
  await saveStep({ ...step, attempts: step.attempts + 1 });
  return step.attempts + 1;
}

export async function resendCode(step: PendingStep) {
  if (step.resends >= MAX_RESENDS) return false;
  const next = { ...step, resends: step.resends + 1, attempts: 0, exp: Date.now() + STEP_MINUTES * 60_000 };
  await sendCode(next);
  await saveStep(next);
  return true;
}

export async function endStep(step: PendingStep | null) {
  if (step) await run("DELETE FROM demo_outbox WHERE challenge_id = ?", step.id);
  await saveStep(null);
}

/** Demo only: the last message "sent" to a demo account for this step. */
export async function demoMessage(step: PendingStep) {
  if (!step.demo) return null;
  return (await get<{ recipient: string; subject: string; body: string; created_at: string }>(
    "SELECT recipient, subject, body, created_at FROM demo_outbox WHERE challenge_id = ? ORDER BY id DESC LIMIT 1",
    step.id,
  )) ?? null;
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}${"•".repeat(Math.max(3, user.length - 1))}@${domain}`;
}
