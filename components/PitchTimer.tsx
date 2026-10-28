"use client";

import { useEffect, useState } from "react";

const PITCH_MS = 150_000; // 2:30

const format = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** A 2:30 pitch countdown for the admin. Local to this screen; it doesn't change any data. */
export default function PitchTimer() {
  // Running: endsAt is set. Paused/idle: remaining holds the time left.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(PITCH_MS);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [endsAt]);

  const left = endsAt === null ? remaining : Math.max(0, endsAt - now);
  const running = endsAt !== null && left > 0;
  const done = left === 0;
  const warning = !done && left <= 30_000;

  // Stop ticking once it hits zero
  useEffect(() => {
    if (endsAt !== null && left === 0) {
      setEndsAt(null);
      setRemaining(0);
    }
  }, [endsAt, left]);

  const start = () => {
    const from = remaining > 0 ? remaining : PITCH_MS;
    setNow(Date.now());
    setEndsAt(Date.now() + from);
  };
  const pause = () => {
    setRemaining(left);
    setEndsAt(null);
  };
  const reset = () => {
    setEndsAt(null);
    setRemaining(PITCH_MS);
  };

  return (
    <div
      className={`mt-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${
        done
          ? "animate-pulse border-red-500 bg-red-50 dark:bg-red-950"
          : warning
            ? "border-amber-400 bg-amber-50 dark:bg-amber-950"
            : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold ${done ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
          {done ? "Time's up!" : "Pitch timer"}
        </p>
        <p
          className={`text-4xl font-black tabular-nums ${
            done ? "text-red-600 dark:text-red-400" : warning ? "text-amber-600 dark:text-amber-400" : ""
          }`}
          aria-live="polite"
        >
          {format(left)}
        </p>
      </div>
      {running ? (
        <button onClick={pause} className="rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white dark:bg-white dark:text-zinc-900">
          Pause
        </button>
      ) : (
        <button onClick={start} className="rounded-xl bg-green-600 px-4 py-3 font-semibold text-white active:bg-green-700">
          {done || remaining === PITCH_MS ? "Start" : "Resume"}
        </button>
      )}
      <button
        onClick={reset}
        disabled={!running && remaining === PITCH_MS}
        className="rounded-xl border border-zinc-300 px-3 py-3 text-sm font-medium disabled:opacity-40 dark:border-zinc-700"
      >
        Reset
      </button>
    </div>
  );
}
