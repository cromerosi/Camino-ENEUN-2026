import { ConfirmationFieldError } from './ConfirmationFieldError';

type ConfirmationTextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
};

export function ConfirmationTextInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  disabled = false,
}: ConfirmationTextInputProps) {
  const inputClassName = error
    ? 'w-full rounded-2xl border border-rose-400/70 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-300 focus:ring-2 focus:ring-rose-300/30 disabled:bg-slate-900/40 disabled:text-slate-500'
    : 'w-full rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/70 focus:ring-2 focus:ring-fuchsia-300/25 disabled:bg-slate-900/40 disabled:text-slate-500';

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-200">
        {label}
        {required ? <span className="ml-1 text-amber-300">*</span> : null}
      </label>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName}
      />

      <ConfirmationFieldError message={error} />
    </div>
  );
}
