import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "./db";
import type { Profession } from "./domain";
import { LOGIN } from "./spaces";

// Authentication in two factors, both checked by Supabase Auth
// (supabase-auth.ts): the password, then a code sent by email. Only then does
// the app open its own HMAC-signed, httpOnly session cookie. In production,
// practitioners would use Pro Santé Connect / e-CPS — the authorisation layer
// in queries.ts stays the same.

export const SESSION_COOKIE = "vs_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

export type Session =
  | { type: "practitioner"; id: string }
  | { type: "patient"; id: string }
  | { type: "coordinator"; id: string };

export type CoordinatorUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export type PractitionerUser = {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  profession: Profession;
  specialty: string;
  location: string;
  email: string;
};

export type PatientUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "via-sana-demo-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** HMAC of a value with the session secret (second-factor codes). */
export function hmac(value: string) {
  return sign(value);
}

/** "value.signature" — for short-lived cookies that only carry an identifier. */
export function signValue(value: string) {
  return `${value}.${sign(value)}`;
}

export function verifySignedValue(token: string | undefined) {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const value = token.slice(0, dot);
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(token.slice(dot + 1));
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? value : null;
}

export function encodeSession(session: Session) {
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (["practitioner", "patient", "coordinator"].includes(data.type) && typeof data.id === "string") {
      return { type: data.type, id: data.id };
    }
  } catch {
    return null;
  }
  return null;
}

const SESSION_TABLE = { practitioner: "practitioners", patient: "patients", coordinator: "coordinators" } as const;

/** The current session, or null — also when its user no longer exists (e.g. after a demo reset). */
export async function getSession() {
  const store = await cookies();
  const session = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return await get(`SELECT 1 AS ok FROM ${SESSION_TABLE[session.type]} WHERE id = ?`, session.id) ? session : null;
}

export async function startSession(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function requirePractitioner(): Promise<PractitionerUser> {
  const session = await getSession();
  if (session?.type !== "practitioner") redirect(LOGIN.practitioner);
  const user = await get<PractitionerUser>("SELECT * FROM practitioners WHERE id = ?", session.id);
  if (!user) redirect(LOGIN.practitioner);
  return user;
}

export async function requireCoordinator(): Promise<CoordinatorUser> {
  const session = await getSession();
  if (session?.type !== "coordinator") redirect(LOGIN.coordinator);
  const user = await get<CoordinatorUser>("SELECT * FROM coordinators WHERE id = ?", session.id);
  if (!user) redirect(LOGIN.coordinator);
  return user;
}

export async function requirePatient(): Promise<PatientUser> {
  const session = await getSession();
  if (session?.type !== "patient") redirect(LOGIN.patient);
  const user = await get<PatientUser>("SELECT id, first_name, last_name, email FROM patients WHERE id = ?", session.id);
  if (!user) redirect(LOGIN.patient);
  return user;
}
