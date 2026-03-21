import type { ReactNode } from 'react';

type ConfirmationSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ConfirmationSection({
  title,
  subtitle,
  children,
}: ConfirmationSectionProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
        ) : null}
      </div>

      <div className="space-y-5">{children}</div>
    </section>
  );
}
