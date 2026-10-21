"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useIdentity } from "@/lib/identity";

export default function Nav() {
  const { identity, setIdentity } = useIdentity();
  const pathname = usePathname();
  const router = useRouter();

  const links: { href: string; label: string }[] = [];
  if (identity?.role === "investor") links.push({ href: "/vote", label: "Vote" });
  if (identity?.role === "team") links.push({ href: "/team", label: "My team" });
  if (identity?.role === "admin") links.push({ href: "/admin", label: "Admin" });
  links.push({ href: "/leaderboard", label: "Leaderboard" });

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-auto font-semibold tracking-tight">
          Demo Day <span className="text-orange-500">▲</span>
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              pathname === l.href
                ? "bg-orange-500 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {l.label}
          </Link>
        ))}
        {identity && (
          <button
            onClick={() => {
              setIdentity(null);
              router.push("/");
            }}
            className="rounded-full px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Sign out"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
