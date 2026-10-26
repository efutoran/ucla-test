"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Settings, Team, Vote } from "@/lib/types";

type Particle = { id: number; left: number; emoji: string; drift: number; duration: number; size: number; delay: number };
type Toast = { teamId: string; name: string; count: number; key: number };

const EMOJI = ["👍", "👍", "👍", "🔥", "🚀", "⭐", "🎉"];
const MAX_PARTICLES = 60; // keeps a burst of simultaneous votes from melting phones
const TOAST_MS = 2500;

let nextId = 0;

/**
 * Mounted once in the root layout, so it plays on every screen. Each thumbs-up for the
 * "now presenting" team (or any team if none is set) sends emojis up the screen and
 * pops a "+N" toast for that team. Voter names are never shown.
 */
export default function VoteCelebration() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pops, setPops] = useState<number[]>([]);
  const teams = useRef<Map<string, Team>>(new Map());
  const currentTeam = useRef<string | null>(null);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const load = async () => {
      const [t, s] = await Promise.all([
        supabase.from("teams").select("*"),
        supabase.from("settings").select("*").eq("id", 1).single(),
      ]);
      if (t.data) teams.current = new Map((t.data as Team[]).map((x) => [x.id, x]));
      if (s.data) currentTeam.current = (s.data as Settings).current_team_id;
    };

    const celebrate = (team: Team) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!reduced) {
        const burst: Particle[] = Array.from({ length: 8 }, () => ({
          id: nextId++,
          left: 5 + Math.random() * 90,
          emoji: EMOJI[Math.floor(Math.random() * EMOJI.length)],
          drift: (Math.random() - 0.5) * 160,
          duration: 1800 + Math.random() * 1200,
          size: 24 + Math.random() * 24,
          delay: Math.random() * 250,
        }));
        setParticles((prev) => [...prev, ...burst].slice(-MAX_PARTICLES));
        setTimeout(() => {
          const ids = new Set(burst.map((b) => b.id));
          setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
        }, 3300);

        const popId = nextId++;
        setPops((prev) => [...prev.slice(-2), popId]);
        setTimeout(() => setPops((prev) => prev.filter((p) => p !== popId)), 900);
      }

      // One toast per team; rapid votes bump its +N instead of stacking
      setToasts((prev) => {
        const existing = prev.find((t) => t.teamId === team.id);
        const rest = prev.filter((t) => t.teamId !== team.id);
        return [...rest, { teamId: team.id, name: team.name, count: (existing?.count ?? 0) + 1, key: nextId++ }].slice(-3);
      });
      clearTimeout(toastTimers.current.get(team.id));
      toastTimers.current.set(
        team.id,
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.teamId !== team.id)), TOAST_MS),
      );
    };

    load();
    const channel = supabase
      .channel("vote-celebration")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes" }, (p) => {
        const team = teams.current.get((p.new as Vote).team_id);
        if (!team) {
          load(); // roster may have just been reloaded
          return;
        }
        if (currentTeam.current && team.id !== currentTeam.current) return;
        celebrate(team);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (p) => {
        currentTeam.current = (p.new as Settings).current_team_id;
        load();
      })
      .subscribe();

    const timers = toastTimers.current;
    return () => {
      supabase.removeChannel(channel);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-live="polite">
      {pops.map((id) => (
        <div key={id} className="vote-pop absolute left-1/2 top-1/2 text-8xl">
          👍
        </div>
      ))}

      {particles.map((p) => (
        <span
          key={p.id}
          className="vote-float absolute bottom-0"
          style={
            {
              left: `${p.left}%`,
              fontSize: p.size,
              animationDuration: `${p.duration}ms`,
              animationDelay: `${p.delay}ms`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}

      <div className="absolute inset-x-0 top-16 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.key}
            className="vote-toast flex max-w-full items-center gap-2 rounded-full bg-orange-500 px-4 py-2 font-semibold text-white shadow-xl shadow-orange-500/40"
          >
            <span className="text-xl">👍</span>
            <span className="truncate">{t.name}</span>
            <span className="rounded-full bg-white/25 px-2 text-sm tabular-nums">+{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
