"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { AdminAccess } from "./types";

const COOKIE = "demo-day-admin";

/** Cookie value proving which password was entered; changes if that password changes. */
function token(access: AdminAccess, password: string) {
  const kind = access === "full" ? "admin" : "viewer";
  return createHash("sha256").update(`demo-day-${kind}:${password}`).digest("hex");
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** ADMIN_PASSWORD gives full access; VIEWER_PASSWORD gives a view-only admin console. */
export async function adminLogin(
  password: string,
): Promise<{ ok: true; access: AdminAccess } | { ok: false; error: string }> {
  const admin = process.env.ADMIN_PASSWORD;
  const viewer = process.env.VIEWER_PASSWORD;
  if (!admin && !viewer)
    return { ok: false, error: "ADMIN_PASSWORD isn't set on the server (Vercel → Settings → Environment Variables)." };

  const access: AdminAccess | null =
    admin && same(password, admin) ? "full" : viewer && same(password, viewer) ? "view" : null;
  if (!access) return { ok: false, error: "Wrong password" };

  (await cookies()).set(COOKIE, token(access, access === "full" ? admin! : viewer!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true, access };
}

export async function adminLogout() {
  (await cookies()).delete(COOKIE);
}

export async function getAdminAccess(): Promise<AdminAccess | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const admin = process.env.ADMIN_PASSWORD;
  const viewer = process.env.VIEWER_PASSWORD;
  if (admin && same(value, token("full", admin))) return "full";
  if (viewer && same(value, token("view", viewer))) return "view";
  return null;
}
