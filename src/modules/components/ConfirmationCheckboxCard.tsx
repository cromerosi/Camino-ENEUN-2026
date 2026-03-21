type ConfirmationCheckboxCardProps = {
  checked: boolean;
  label: string;
  onToggle: () => void;
};

export function ConfirmationCheckboxCard({
  checked,
  label,
  onToggle,
}: ConfirmationCheckboxCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
        checked
          ? 'border-fuchsia-300/60 bg-fuchsia-500/15'
          : 'border-white/15 bg-slate-900/45 hover:border-fuchsia-300/50'
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
          checked
            ? 'border-fuchsia-300/80 bg-fuchsia-400 text-fuchsia-950'
            : 'border-slate-500 text-transparent'
        }`}
      >
        ✓
      </span>

      <span className="text-sm text-slate-200">{label}</span>
    </button>
  );
}
