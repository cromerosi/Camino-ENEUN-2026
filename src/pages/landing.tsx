import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { FormEvent, useState } from 'react';
import Layout from '../layouts/Layout';

const errorMessages: Record<string, string> = {
  auth_failed: 'No fue posible completar la autenticación. Intenta de nuevo.',
  auth_disabled: 'La autenticación con Auth0 está deshabilitada temporalmente.',
  forbidden_email_domain: 'Solo se permiten correos institucionales @unal.edu.co.',
  auth0_session_missing:
    'No se encontró la sesión de autenticación. Esto puede pasar si se abre más de un diálogo de login, se refresca la pantalla durante el ingreso o se cambia entre modo escritorio y modo normal en Chrome. Intenta de nuevo desde la aplicación.',
};

interface LandingProps {
  errorMessage: string | null;
}

export default function LandingPage({
  errorMessage,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    if (isSubmitting) {
      event.preventDefault();
      return;
    }
    setIsSubmitting(true);
  }

  return (
    <Layout>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16 lg:px-12">
        <div className="absolute top-6 right-6 z-50">
          <a
            href="/admin/login"
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Administrador Sede
          </a>
        </div>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-12 h-72 w-72 rounded-full bg-emerald-500/20 blur-[130px]"></div>
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-[170px]"></div>
        </div>

        <section className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950/65 p-10 text-center shadow-[0_30px_90px_-45px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.5em] text-emerald-300">ENEUN 2026</p>
          <h1 className="mt-5 text-4xl font-semibold text-white sm:text-5xl">Landing de acceso</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300">
            Inicia sesión con Auth0 para visualizar tu proceso.
            Solo se permiten cuentas institucionales con dominio @unal.edu.co.
          </p>

          {errorMessage && (
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
              {errorMessage}
            </div>
          )}

          <div className="mx-auto mt-10 w-full max-w-xl">
            <form action="/api/auth/login" method="get" onSubmit={handleLoginSubmit}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                aria-disabled={isSubmitting}
              >
                {isSubmitting ? 'Redirigiendo...' : 'Continuar con Auth0'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs uppercase tracking-[0.2em] text-slate-500">Solo dominio @unal.edu.co</p>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<LandingProps> = async (context) => {
  context.res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
  context.res.setHeader('Pragma', 'no-cache');

  const error = typeof context.query.error === 'string' ? context.query.error : null;
  return {
    props: {
      errorMessage: error ? errorMessages[error] ?? 'Error inesperado de autenticación.' : null,
    },
  };
};
