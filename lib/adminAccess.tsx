"use client";

import { createContext, useContext } from "react";
import type { AdminAccess } from "./types";

const AdminAccessContext = createContext<AdminAccess>("view");

/** Set by the /admin server layout from the login cookie, so it can't be changed in the browser. */
export function AdminAccessProvider({ access, children }: { access: AdminAccess; children: React.ReactNode }) {
  return <AdminAccessContext.Provider value={access}>{children}</AdminAccessContext.Provider>;
}

export const useAdminAccess = () => useContext(AdminAccessContext);
