import { useId } from 'react';
import { ConfirmationFieldError } from './ConfirmationFieldError';

type ConfirmationTextareaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
};

export function ConfirmationTextarea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  maxLength = 500,
}: ConfirmationTextareaProps) {
  const textareaId = useId();
  const errorId = `${textareaId}-error`;
  const textareaClassName = error
    ? 'w-full rounded-2xl border border-rose-400/70 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-300 focus:ring-2 focus:ring-rose-300/30'
    : 'w-full rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/70 focus:ring-2 focus:ring-fuchsia-300/25';

  return (
    <div>
      <label htmlFor={textareaId} className="mb-2 block text-sm font-semibold text-slate-200">
        {label}
        {required ? <span className="ml-1 text-amber-300">*</span> : null}
      </label>

      <textarea
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={textareaClassName}
      />

      <ConfirmationFieldError id={errorId} message={error} />
    </div>
  );
}
