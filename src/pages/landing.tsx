import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Layout from '../layouts/Layout';

const errorMessages: Record<string, string> = {
  missing_fields: 'Debes ingresar usuario y documento para continuar.',
  invalid_credentials: 'Usuario o documento incorrecto. Intenta nuevamente.',
  auth_failed: 'No fue posible completar la autenticación. Intenta de nuevo.',
  auth_disabled: 'La autenticación con Auth0 está deshabilitada temporalmente.',
};

interface LandingProps {
  errorMessage: string | null;
}

export default function LandingPage({
  errorMessage,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <Layout>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16 lg:px-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-12 h-72 w-72 rounded-full bg-emerald-500/20 blur-[130px]"></div>
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-[170px]"></div>
        </div>

        <section className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950/65 p-10 text-center shadow-[0_30px_90px_-45px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.5em] text-emerald-300">ENEUN 2026</p>
          <h1 className="mt-5 text-4xl font-semibold text-white sm:text-5xl">Landing de acceso</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300">
            Ingresa con tu usuario institucional para visualizar tu proceso.
            Usuario: solo la parte antes de @unal.edu.co. Contraseña: tu número de documento.
          </p>

          {errorMessage && (
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
              {errorMessage}
            </div>
          )}

          <form method="POST" action="/api/auth/login" className="mx-auto mt-10 w-full max-w-xl space-y-4 text-left">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Usuario</span>
              <div className="relative">
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="Usuario institucional"
                  required
                  className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 pr-36 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/60"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                  @unal.edu.co
                </span>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Contraseña</span>
              <input
                type="password"
                name="document"
                autoComplete="current-password"
                placeholder="Número de documento"
                required
                className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/60"
              />
            </label>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-950 transition hover:bg-emerald-300"
            >
              Iniciar sesión
            </button>

            <p className="text-center text-xs uppercase tracking-[0.2em] text-slate-500">Solo dominio @unal.edu.co</p>
          </form>
        </section>
      </main>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<LandingProps> = async (context) => {
  const error = typeof context.query.error === 'string' ? context.query.error : null;
  return {
    props: {
      errorMessage: error ? errorMessages[error] ?? 'Error inesperado de autenticación.' : null,
    },
  };
};
