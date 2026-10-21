import type { Slot } from "@/lib/types";

export default function SlotTabs({
  slots,
  value,
  onChange,
  currentSlotId,
  allLabel,
}: {
  slots: Slot[];
  value: string | null;
  onChange: (id: string | null) => void;
  currentSlotId?: string | null;
  allLabel?: string;
}) {
  const tab = (id: string | null, label: string) => (
    <button
      key={id ?? "all"}
      onClick={() => onChange(id)}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
        value === id
          ? "border-orange-500 bg-orange-500 text-white"
          : "border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      }`}
    >
      {label}
      {id && id === currentSlotId && <span className="ml-1.5 text-xs">● now</span>}
    </button>
  );

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
      {allLabel && tab(null, allLabel)}
      {slots.map((s) => tab(s.id, s.label))}
    </div>
  );
}
