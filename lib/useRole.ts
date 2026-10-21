"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "./identity";
import type { Identity } from "./types";

/**
 * Sends the user to sign-in if they aren't signed in with the given role, or if their
 * investor/team record no longer exists (e.g. after the admin re-uploaded the CSV).
 */
export function useRole<R extends Identity["role"]>(role: R, validIds: string[] | null) {
  const { identity, setIdentity, loaded } = useIdentity();
  const router = useRouter();

  useEffect(() => {
    if (!loaded) return;
    if (identity?.role !== role) {
      router.replace("/");
      return;
    }
    if (validIds && "id" in identity && !validIds.includes(identity.id)) {
      setIdentity(null);
      router.replace("/");
    }
  }, [loaded, identity, role, validIds, router, setIdentity]);

  return identity?.role === role ? (identity as Extract<Identity, { role: R }>) : null;
}
