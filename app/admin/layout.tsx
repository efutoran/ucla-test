import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/adminAuth";
import { AdminAccessProvider } from "@/lib/adminAccess";

// Server-side gate: /admin only renders with a valid admin (full) or viewer (view-only) cookie.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAdminAccess();
  if (!access) redirect("/?admin=1");
  return <AdminAccessProvider access={access}>{children}</AdminAccessProvider>;
}
