export default function ThumbButton({
  on,
  onClick,
  disabled = false,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={on ? "Remove thumbs up" : "Thumbs up"}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 text-2xl transition active:scale-90 disabled:opacity-40 disabled:active:scale-100 ${
        on
          ? "border-orange-500 bg-orange-500 shadow-lg shadow-orange-500/30"
          : "border-zinc-300 bg-white grayscale dark:border-zinc-700 dark:bg-zinc-900"
      }`}
    >
      👍
    </button>
  );
}
