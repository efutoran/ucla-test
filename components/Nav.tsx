"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useIdentity } from "@/lib/identity";
import { adminLogout } from "@/lib/adminAuth";

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
      <div className="mx-auto flex max-w-3xl items-center gap-1.5 px-4 py-3">
        <Link href="/" className="mr-auto truncate whitespace-nowrap text-sm font-semibold tracking-tight sm:text-base">
          &lsquo;Real&rsquo; Pitch Event <span className="hidden text-orange-500 sm:inline">▲</span>
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-medium sm:text-sm ${
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
            onClick={async () => {
              if (identity.role === "admin") await adminLogout();
              setIdentity(null);
              router.push("/");
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 sm:w-auto sm:px-2 dark:hover:bg-zinc-800"
            title="Sign out"
            aria-label="Sign out"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span className="hidden text-xs sm:inline">Sign out</span>
          </button>
        )}
      </div>
    </header>
  );
}
