"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "demo-day-admin";

/** Cookie value proving the admin password was entered; changes if the password changes. */
function token(password: string) {
  return createHash("sha256").update(`demo-day-admin:${password}`).digest("hex");
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function adminLogin(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { ok: false, error: "ADMIN_PASSWORD isn't set on the server (Vercel → Settings → Environment Variables)." };
  if (!same(password, expected)) return { ok: false, error: "Wrong password" };
  (await cookies()).set(COOKIE, token(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}

export async function adminLogout() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  const expected = process.env.ADMIN_PASSWORD;
  const value = (await cookies()).get(COOKIE)?.value;
  return !!expected && !!value && same(value, token(expected));
}
