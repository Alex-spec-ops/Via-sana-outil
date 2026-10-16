import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Password storage and policy, following the CNIL recommendation n° 2022-100
// (21 July 2022) on passwords:
// - never stored in clear: scrypt (slow, memory-hard), a random 128-bit salt per
//   account, cost parameters stored with the hash (§ 3.3);
// - "case n° 1" strength (≥ 80 bits of entropy): ≥ 14 characters with upper and
//   lower case letters and digits, or ≥ 12 characters adding a special character;
//   common passwords refused; maximum length ≥ 50 (§ 3.2);
// - plus a restriction after failed attempts (see actions.ts: 5 failures → 15 min).

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_POLICY =
  "Au moins 14 caractères avec majuscules, minuscules et chiffres — ou au moins 12 caractères si vous ajoutez un caractère spécial. Une phrase de passe fonctionne très bien.";

// A short list for the prototype; production would use a larger breached-passwords list.
const COMMON = new Set([
  "motdepasse123", "azertyuiop123", "password1234", "123456789abc", "qwertyuiop123", "bonjour123456",
  "marathon2026!", "prepamarathon1", "viasana123456", "azerty123456789", "motdepasse2026",
]);

/** Returns why a new password is refused, or null when it meets the policy. */
export function passwordProblem(password: string, personal: string[] = []): string | null {
  if (password.length > PASSWORD_MAX_LENGTH) return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`;
  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const digit = /\d/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);
  const strongLong = password.length >= 14 && lower && upper && digit;
  const strongShort = password.length >= 12 && lower && upper && digit && special;
  if (!strongLong && !strongShort) return `Mot de passe trop faible. ${PASSWORD_POLICY}`;
  if (COMMON.has(password.toLowerCase())) return "Ce mot de passe est trop courant : choisissez-en un autre.";
  const lowered = password.toLowerCase();
  if (personal.some((p) => p.length >= 3 && lowered.includes(p.toLowerCase()))) {
    return "Évitez d'utiliser votre nom, votre prénom ou votre email dans le mot de passe.";
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16); // 128 bits
  const key = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password.slice(0, PASSWORD_MAX_LENGTH), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Verifying against this when the email is unknown keeps the response time the
// same, so timing does not reveal which accounts exist.
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash() {
  dummyHash ??= hashPassword(randomBytes(24).toString("base64"));
  return dummyHash;
}

/** Shared password of the fictional demo accounts — demo only, displayed on the login page. */
export const DEMO_PASSWORD = "Demo-ViaSana-2026";
