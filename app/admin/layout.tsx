import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";

// Server-side gate: /admin only renders with a valid admin cookie.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/?admin=1");
  return children;
}
