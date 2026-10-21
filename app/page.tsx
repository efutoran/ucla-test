"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/lib/identity";
import { useEventData } from "@/lib/useEventData";
import { Empty, ErrorBox, Loading } from "@/components/Status";

type Tab = "investor" | "team" | "admin";
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "";

export default function SignIn() {
  const router = useRouter();
  const { identity, setIdentity, loaded } = useIdentity();
  const { slots, teams, investors, loading, error } = useEventData();
  const [tab, setTab] = useState<Tab>("investor");
  const [query, setQuery] = useState("");
  const [pin, setPin] = useState("");

  // Already signed in → go straight to your screen
  useEffect(() => {
    if (!loaded || !identity) return;
    router.replace(identity.role === "investor" ? "/vote" : identity.role === "team" ? "/team" : "/admin");
  }, [loaded, identity, router]);

  const filteredInvestors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? investors.filter((i) => i.name.toLowerCase().includes(q)) : investors;
  }, [investors, query]);

  if (!loaded || identity) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="pt-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to Demo Day</h1>
        <p className="mt-1 text-zinc-500">Who are you?</p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-200 p-1 dark:bg-zinc-800">
        {(["investor", "team", "admin"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-semibold capitalize ${
              tab === t ? "bg-white shadow dark:bg-zinc-950" : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}
      {loading && !error && <Loading />}

      {!loading && tab === "investor" && (
        <div className="space-y-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your name"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {investors.length === 0 ? (
            <Empty>No investors loaded yet. The admin needs to upload the roster.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {filteredInvestors.map((i) => (
                <li key={i.id}>
                  <button
                    onClick={() => setIdentity({ role: "investor", id: i.id, name: i.name })}
                    className="w-full px-4 py-3 text-left text-base hover:bg-orange-50 active:bg-orange-100 dark:hover:bg-zinc-800"
                  >
                    {i.name}
                  </button>
                </li>
              ))}
              {filteredInvestors.length === 0 && <li className="px-4 py-3 text-zinc-500">No match</li>}
            </ul>
          )}
        </div>
      )}

      {!loading && tab === "team" && (
        <div className="space-y-4">
          {teams.length === 0 && <Empty>No teams loaded yet. The admin needs to upload the roster.</Empty>}
          {slots.map((s) => {
            const slotTeams = teams.filter((t) => t.slot_id === s.id);
            if (!slotTeams.length) return null;
            return (
              <section key={s.id}>
                <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">{s.label}</h2>
                <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                  {slotTeams.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => setIdentity({ role: "team", id: t.id, name: t.name })}
                        className="w-full px-4 py-3 text-left text-base hover:bg-orange-50 active:bg-orange-100 dark:hover:bg-zinc-800"
                      >
                        {t.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {tab === "admin" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (ADMIN_PIN && pin !== ADMIN_PIN) {
              alert("Wrong PIN");
              return;
            }
            setIdentity({ role: "admin" });
          }}
        >
          {ADMIN_PIN && (
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              type="password"
              inputMode="numeric"
              placeholder="Admin PIN"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
          <button className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white active:bg-orange-600">
            Continue as admin
          </button>
        </form>
      )}
    </div>
  );
}
