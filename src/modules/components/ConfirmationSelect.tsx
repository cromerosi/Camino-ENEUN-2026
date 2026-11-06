import { useId } from 'react';
import { ConfirmationFieldError } from './ConfirmationFieldError';

type ConfirmationSelectOption = {
  value: string;
  label: string;
};

type ConfirmationSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ConfirmationSelectOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
};

export function ConfirmationSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Selecciona una opción',
  required = false,
  error,
  disabled = false,
}: ConfirmationSelectProps) {
  const selectId = useId();
  const errorId = `${selectId}-error`;
  const selectClassName = error
    ? 'w-full rounded-2xl border border-rose-400/70 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-300/30 disabled:bg-slate-900/40 disabled:text-slate-500'
    : 'w-full rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-300/70 focus:ring-2 focus:ring-fuchsia-300/25 disabled:bg-slate-900/40 disabled:text-slate-500';

  return (
    <div>
      <label htmlFor={selectId} className="mb-2 block text-sm font-semibold text-slate-200">
        {label}
        {required ? <span className="ml-1 text-amber-300">*</span> : null}
      </label>

      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={selectClassName}
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ConfirmationFieldError id={errorId} message={error} />
    </div>
  );
}
