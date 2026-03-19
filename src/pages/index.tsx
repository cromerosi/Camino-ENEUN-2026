import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Layout from '../layouts/Layout';
import { type EneunNodeStatus, type EneunJourneyStepState } from '../lib/eneun-schema';
import { getSessionCookieName, verifySignedSessionToken } from '../lib/auth';
import {
  getJourneyStepsByEmail,
  getParticipantByEmail,
  type ParticipantViewModel,
} from '../lib/participant';

const STEP_LABELS: Record<string, string> = {
  Preinscripcion: 'Preinscripción',
  Preconfirmacion: 'Preconfirmación',
  'Validacion de sede de origen': 'Validación de sede de origen',
  'Capacitaciones de la plataforma': 'Capacitaciones de la plataforma',
  'Formulario final': 'Formulario final',
};

const STATUS_STYLES = {
  gray: {
    node: 'bg-slate-800 text-slate-200 ring-1 ring-white/10 shadow-inner shadow-black/40',
    label: 'text-slate-400',
    detail: 'text-slate-500',
    legend: 'bg-slate-500/70',
  },
  green: {
    node: 'bg-emerald-400 text-emerald-950 ring-4 ring-emerald-300/40 shadow-emerald-500/30 shadow-lg',
    label: 'text-emerald-200',
    detail: 'text-emerald-300',
    legend: 'bg-emerald-400',
  },
  purple: {
    node: 'bg-fuchsia-400 text-fuchsia-950 ring-4 ring-fuchsia-200/50 shadow-fuchsia-500/40 shadow-lg',
    label: 'text-fuchsia-200',
    detail: 'text-fuchsia-300',
    legend: 'bg-fuchsia-400',
  },
  red: {
    node: 'bg-rose-500 text-rose-50 ring-4 ring-rose-200/40 shadow-rose-500/40 shadow-lg',
    label: 'text-rose-200',
    detail: 'text-rose-300',
    legend: 'bg-rose-500',
  },
} as const;

const getStatusStyle = (status: EneunNodeStatus) =>
  STATUS_STYLES[status] ?? STATUS_STYLES.gray;

interface DashboardPageProps {
  authEmail: string;
  participant: ParticipantViewModel;
  journeySteps: EneunJourneyStepState[];
  progressPercent: number;
  campingCopy: string;
}

export default function DashboardPage({
  authEmail,
  participant,
  journeySteps,
  progressPercent,
  campingCopy,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const legend = [
    { name: 'Sin iniciar', color: 'gray', description: 'Etapa aún bloqueada.' },
    { name: 'Completado', color: 'green', description: 'Revisión aprobada.' },
    { name: 'En curso', color: 'purple', description: 'Actividad activa.' },
    { name: 'Atención', color: 'red', description: 'Acción requerida.' },
  ] as const;

  return (
    <Layout>
      <main className="relative overflow-x-hidden px-4 py-12 sm:px-6 sm:py-16 lg:px-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 right-4 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-[140px]"></div>
          <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-500/20 blur-[160px]"></div>
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col gap-12">
          <header className="text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">¡Tú camino a Manizales! · ENEUN 2026</p>
            <h1 className="mt-5 text-3xl font-semibold text-white sm:text-5xl">Panel de visualización del participante</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">
              En esta página podrás visualizar tu progreso y estado como participante en el evento ENEUN 2026. Recuerda que si no cumples todos los pasos requeridos, no podrás asistir al evento. ¡Sigue avanzando para asegurar tu participación en el ENEUN 2026 · Manizales!
            </p>
          </header>
          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.9fr]">
            <article className="flex h-full min-w-0 flex-col rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.5em] text-slate-400">Participante</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">{participant.fullName}</h2>
                </div>
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-emerald-200 sm:text-xs sm:tracking-[0.4em]">
                  <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="5" r="5" />
                  </svg>
                  <span className="break-all">{authEmail}</span>
                </span>
              </div>
              <dl className="mt-10 grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Tipo de documento</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{participant.documentType}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Número de documento</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{participant.documentNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Sede</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{participant.site}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Facultad</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{participant.faculty}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Acampamiento</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{campingCopy}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Comité donde apoya</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{participant.committee}</dd>
                </div>
              </dl>
              <div className="mt-8">
                <a
                  href="/api/auth/logout"
                  className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/50 hover:text-white"
                >
                  Cerrar sesión
                </a>
              </div>
              <p className="mt-auto break-all pt-8 text-center text-[11px] tracking-[0.10em] text-slate-500">
                UUID: <span className="font-mono lowercase text-slate-400">{participant.uuid}</span>
              </p>
            </article>
            <article className="min-w-0 rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Camino ENEUN</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Línea de progreso</h2>
                </div>
                <span className="text-4xl font-semibold text-emerald-300">{progressPercent}%</span>
              </div>
              <div className="mt-6 h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-fuchsia-400 to-rose-400"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="relative mt-10">
                <ol className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-between">
                  {journeySteps.map((step, index) => {
                    const style = getStatusStyle(step.status);
                    return (
                      <li className="flex min-w-0 flex-col items-center text-center lg:min-w-[120px] lg:flex-1" key={step.label}>
                        <div
                          className={`flex h-16 w-16 items-center justify-center rounded-full text-sm font-semibold uppercase tracking-[0.2em] ${style.node}`}
                        >
                          {index + 1}
                        </div>
                        <p className={`mt-4 break-words text-xs font-semibold tracking-[0.2em] ${style.label}`}>
                          {STEP_LABELS[step.label] ?? step.label}
                        </p>
                        <p className={`mt-1 text-sm ${style.detail}`}>{step.detail}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {legend.map((item) => {
                  const style = getStatusStyle(item.color as keyof typeof STATUS_STYLES);
                  return (
                    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3" key={item.name}>
                      <span className={`h-3 w-3 rounded-full ${style.legend}`}></span>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        </div>
      </main>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<DashboardPageProps> = async (context) => {
  const sessionToken = context.req.cookies[getSessionCookieName()];
  const authUser = await verifySignedSessionToken(sessionToken);

  if (!authUser) {
    return {
      redirect: {
        destination: '/landing',
        permanent: false,
      },
    };
  }

  const participant = await getParticipantByEmail(authUser.email);
  const journeySteps = await getJourneyStepsByEmail(authUser.email);
  const progressPercent = Math.round(
    (journeySteps.filter((step) => step.status === 'green').length / journeySteps.length) * 100,
  );

  return {
    props: {
      authEmail: authUser.email,
      participant,
      journeySteps,
      progressPercent,
      campingCopy: participant.camping ? 'Acampa' : 'No acampa',
    },
  };
};
