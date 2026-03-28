import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '../layouts/Layout';
import { type EneunNodeStatus, type EneunJourneyStepState } from '../lib/eneun-schema';
import { getAdminSessionCookieName, verifyAdminSessionToken } from '../lib/admin-auth';
import { getSessionCookieName, verifySignedSessionToken } from '../lib/auth';
import { getSql } from '../lib/db';
import {
  getAttendanceSummaryByEmail,
  getJourneyStepsByEmail,
  getParticipantByEmail,
  type AttendanceSummary,
  type ParticipantViewModel,
} from '../lib/participant';

const ATTENDANCE_DAY_LABELS: Record<string, string> = {
  '2026-03-27': '27 de marzo',
  '2026-03-28': '28 de marzo',
  '2026-03-29': '29 de marzo',
};

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

const HEALTH_CONDITION_LABELS: Record<string, string> = {
  NONE: 'Ninguna',
  PREFER_NOT_TO_ANSWER: 'Prefiere no responder',
};

const normalizeStringValue = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const toYesNoText = (value: unknown): string => {
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }

  const normalized = normalizeStringValue(value).toLowerCase();
  if (['si', 'sí', 'yes', 'true'].includes(normalized)) {
    return 'Sí';
  }
  if (['no', 'false'].includes(normalized)) {
    return 'No';
  }

  return 'Sin dato';
};

const formatSimpleValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'Sin dato';
  }

  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : 'Sin dato';
  }

  return 'Sin dato';
};

const formatHealthDetails = (healthDetails: unknown, attendeeData: Record<string, unknown>): string => {
  const health =
    healthDetails && typeof healthDetails === 'object' && !Array.isArray(healthDetails)
      ? (healthDetails as Record<string, unknown>)
      : {};

  const eps = formatSimpleValue(health.eps_id ?? attendeeData.eps_id);
  const bloodType = formatSimpleValue(health.blood_type_id ?? attendeeData.blood_type_id);
  const consent = toYesNoText(health.consent_health_data ?? attendeeData.consent_health_data);

  const rawCodes =
    Array.isArray(health.health_condition_codes) && health.health_condition_codes.length > 0
      ? health.health_condition_codes
      : Array.isArray(attendeeData.health_condition_codes)
        ? attendeeData.health_condition_codes
        : [];

  const codes = rawCodes
    .map((code) => normalizeStringValue(code))
    .filter((code) => code)
    .map((code) => HEALTH_CONDITION_LABELS[code] ?? code.replace(/_/g, ' ').toLowerCase())
    .join(', ');

  const conditionDetails =
    health.condition_details && typeof health.condition_details === 'object' && !Array.isArray(health.condition_details)
      ? (health.condition_details as Record<string, unknown>)
      : {};

  const conditionDetailsText = Object.values(conditionDetails)
    .map((detail) => formatSimpleValue(detail))
    .filter((detail) => detail !== 'Sin dato')
    .join(', ');

  return [
    `EPS: ${eps}`,
    `Tipo de sangre: ${bloodType}`,
    `Autorización de datos de salud: ${consent}`,
    `Condiciones reportadas: ${codes || 'Ninguna'}`,
    `Detalle adicional: ${conditionDetailsText || 'Ninguno'}`,
  ].join('\n');
};

type AttendeeDisplayEntry = {
  label: string;
  value: string;
};

const buildFriendlyAttendeeEntries = (attendeeData: Record<string, unknown> | null): AttendeeDisplayEntry[] => {
  if (!attendeeData) {
    return [];
  }

  const entries: AttendeeDisplayEntry[] = [];
  const maybePush = (label: string, value: unknown) => {
    const formatted = formatSimpleValue(value);
    if (formatted !== 'Sin dato') {
      entries.push({ label, value: formatted });
    }
  };

  maybePush('Nombre en escarapela', attendeeData.badge_name);
  maybePush('Pronombre', attendeeData.pronoun);
  entries.push({
    label: 'Detalle de salud',
    value: formatHealthDetails(attendeeData.health_details, attendeeData),
  });
  maybePush('Nombre de contacto de emergencia', attendeeData.emergency_contact_name);
  maybePush('Parentesco del contacto de emergencia', attendeeData.emergency_contact_relationship);
  maybePush('Teléfono del contacto de emergencia', attendeeData.emergency_contact_phone);
  maybePush('Elección de hospedaje', attendeeData.lodging_choice);
  maybePush('Dirección de hospedaje', attendeeData.lodging_address);
  maybePush('Confirmación de acampada', attendeeData.camping_confirmation);
  maybePush('Transporte', attendeeData.transport);

  return entries;
};

interface DashboardPageProps {
  authEmail: string;
  participant: ParticipantViewModel;
  journeySteps: EneunJourneyStepState[];
  progressPercent: number;
  campingCopy: string;
  isAdminPreview: boolean;
  previewEmail: string | null;
  finalFormUrl: string | null;
  showFinalFormSubmittedAlert: boolean;
  showPreconfirmationRequiredAlert: boolean;
  showFinalFormClosedAlert: boolean;
  attendeeData: Record<string, unknown> | null;
  attendanceSummary: AttendanceSummary;
}

export default function DashboardPage({
  authEmail,
  participant,
  journeySteps,
  progressPercent,
  campingCopy,
  isAdminPreview,
  previewEmail,
  finalFormUrl,
  showFinalFormSubmittedAlert,
  showPreconfirmationRequiredAlert,
  showFinalFormClosedAlert,
  attendeeData,
  attendanceSummary,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { data: journeyData } = useQuery({
    queryKey: ['journeyStatus', authEmail],
    queryFn: async () => {
      const res = await fetch('/api/journey-status');
      if (!res.ok) {
        throw new Error('Error al obtener el estado');
      }
      return res.json() as Promise<{ journeySteps: EneunJourneyStepState[] }>;
    },
    initialData: { journeySteps },
    refetchInterval: 10000,
    enabled: !isAdminPreview,
  });

  const currentJourneySteps = journeyData?.journeySteps ?? journeySteps;
  const currentProgressPercent = Math.round(
    (currentJourneySteps.filter((step: EneunJourneyStepState) => step.status === 'green').length / currentJourneySteps.length) * 100,
  );

  const [showAttendeeDetails, setShowAttendeeDetails] = useState(false);
  const attendeeEntries = buildFriendlyAttendeeEntries(attendeeData);

  const { data: attendanceData } = useQuery({
    queryKey: ['attendanceStatus', authEmail],
    queryFn: async () => {
      const res = await fetch('/api/attendance-status');
      if (!res.ok) {
        throw new Error('Error al obtener asistencias');
      }
      return res.json() as Promise<{ attendance: AttendanceSummary }>;
    },
    initialData: { attendance: attendanceSummary },
    refetchInterval: 5000,
    enabled: !isAdminPreview,
  });

  const currentAttendance = attendanceData?.attendance ?? attendanceSummary;

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
            {isAdminPreview && (
              <p className="mx-auto mt-4 inline-flex max-w-max items-center rounded-full border border-violet-300/30 bg-violet-500/15 px-4 py-2 text-xs uppercase tracking-[0.2em] text-violet-100">
                Vista previa admin · {previewEmail}
              </p>
            )}

            {showFinalFormSubmittedAlert && (
              <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-fuchsia-300/35 bg-fuchsia-500/15 px-5 py-3 text-sm text-fuchsia-100">
                El formulario final ya fue llenado. No es necesario volver a enviarlo.
              </div>
            )}

            {showPreconfirmationRequiredAlert && (
              <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-rose-300/35 bg-rose-500/15 px-5 py-3 text-sm text-rose-100">
                Debes completar primero la preconfirmación para poder acceder al formulario final.
              </div>
            )}

            {showFinalFormClosedAlert && (
              <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-amber-300/35 bg-amber-500/15 px-5 py-3 text-sm text-amber-100">
                El formulario final está cerrado en este momento. Si necesitas habilitación, contacta a tu equipo organizador.
              </div>
            )}
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
                  <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Acampada</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{campingCopy}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">Comité donde apoya</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{participant.committee}</dd>
                </div>
              </dl>
              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowAttendeeDetails((current) => !current)}
                  className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-200/60 hover:bg-emerald-500/20"
                >
                  {showAttendeeDetails ? 'Mostrar menos' : 'Mostrar más'}
                </button>
                <a
                  href="/api/auth/logout"
                  className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/50 hover:text-white"
                >
                  Cerrar sesión
                </a>
              </div>
              {showAttendeeDetails && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/45 p-4 sm:p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Datos adicionales del formulario final</p>
                  {attendeeEntries.length > 0 ? (
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      {attendeeEntries.map((entry) => (
                        <div key={entry.label}>
                          <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{entry.label}</dt>
                          <dd className="mt-2 whitespace-pre-wrap break-words text-sm font-medium text-white">
                            {entry.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-4 text-sm text-slate-300">No se encontraron datos del formulario final en la tabla attendees.</p>
                  )}
                </div>
              )}
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
                <span className="text-4xl font-semibold text-emerald-300">{currentProgressPercent}%</span>
              </div>
              <div className="mt-6 h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-fuchsia-400 to-rose-400"
                  style={{ width: `${currentProgressPercent}%` }}
                ></div>
              </div>
              <div className="relative mt-10">
                <ol className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-between">
                  {currentJourneySteps.map((step: EneunJourneyStepState, index: number) => {
                    const isTrainingStep = step.label === 'Capacitaciones de la plataforma';
                    const style = isTrainingStep && step.status !== 'green' ? STATUS_STYLES.purple : getStatusStyle(step.status);

                    if (isTrainingStep) {
                      return (
                        <li className="flex min-w-0 flex-col items-center text-center lg:min-w-[120px] lg:flex-1" key={step.label}>
                          <a
                            href="https://capacitacioneseneun.vercel.app/login"
                            target="_blank"
                            rel="noreferrer"
                            className="group flex min-w-0 flex-col items-center text-center"
                          >
                            <div
                              className={`flex h-16 w-16 items-center justify-center rounded-full text-sm font-semibold uppercase tracking-[0.2em] ${style.node} transition duration-200 group-hover:scale-105 group-hover:brightness-110`}
                            >
                              {index + 1}
                            </div>
                            <p className={`mt-4 break-words text-xs font-semibold tracking-[0.2em] ${style.label} underline decoration-fuchsia-300/50 underline-offset-4`}>
                              {STEP_LABELS[step.label] ?? step.label}
                            </p>
                            <p className={`mt-1 text-sm underline decoration-fuchsia-300/50 underline-offset-4 ${style.detail}`}>
                              {step.detail}
                            </p>
                          </a>
                        </li>
                      );
                    }

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
              <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Asistencias ENEUN</p>
                  <span className="inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">
                    Total: {currentAttendance.totalCompleted}/{currentAttendance.totalExpected}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Actualización automática cada 5 segundos.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {currentAttendance.days.map((day) => {
                    const percentage = day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0;
                    return (
                      <div key={day.date} className="rounded-xl border border-white/10 bg-slate-900/55 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                          {ATTENDANCE_DAY_LABELS[day.date] ?? day.date}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {day.completed}
                          <span className="ml-1 text-sm font-medium text-slate-400">/ {day.total}</span>
                        </p>
                        <div className="mt-3 h-2 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-fuchsia-400 to-rose-400"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Paso final</p>
                {finalFormUrl ? (
                  <a
                    href={finalFormUrl}
                    className="mt-4 inline-flex items-center rounded-full bg-gradient-to-r from-emerald-400 via-fuchsia-400 to-rose-400 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:brightness-110"
                  >
                    Ir al formulario final
                  </a>
                ) : (
                  <span className="mt-4 block text-xs text-slate-400">Sin enlace disponible.</span>
                )}
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
  const rawPreviewEmail = context.query.previewEmail;
  const previewEmail = typeof rawPreviewEmail === 'string' ? rawPreviewEmail.trim() : '';
  const rawFinalFormStatus = context.query.finalFormStatus;
  const finalFormStatus = typeof rawFinalFormStatus === 'string' ? rawFinalFormStatus.trim() : '';

  let targetEmail = authUser?.email ?? '';
  let isAdminPreview = false;

  if (!targetEmail && previewEmail) {
    const adminToken = context.req.cookies[getAdminSessionCookieName()];
    const adminSession = await verifyAdminSessionToken(adminToken);
    if (adminSession) {
      targetEmail = previewEmail;
      isAdminPreview = true;
    }
  }

  if (!targetEmail) {
    return {
      redirect: {
        destination: '/landing',
        permanent: false,
      },
    };
  }

  if (!isAdminPreview) {
    try {
      const sql = getSql();
      const registrations = (await sql`
        SELECT 1
        FROM registrations
        WHERE lower(trim(email)) = lower(trim(${targetEmail}))
        LIMIT 1
      `) as Array<{ '?column?': number }>;

      if (registrations.length === 0) {
        const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
        context.res.setHeader(
          'Set-Cookie',
          `${getSessionCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
        );
        return {
          redirect: {
            destination: '/landing?error=not_registered',
            permanent: false,
          },
        };
      }
    } catch {
      return {
        redirect: {
          destination: '/landing?error=not_registered',
          permanent: false,
        },
      };
    }
  }

  const participant = await getParticipantByEmail(targetEmail);
  const journeySteps = await getJourneyStepsByEmail(targetEmail);
  const attendanceSummary = await getAttendanceSummaryByEmail(targetEmail);
  let attendeeData: Record<string, unknown> | null = null;

  try {
    const sql = getSql();
    const attendeeRows = (await sql`
      SELECT payload
      FROM attendees
      WHERE
        lower(trim(coalesce(email, ''))) = lower(trim(${targetEmail}))
        OR uuid::text = ${participant.uuid || ''}
      ORDER BY updated_at DESC
      LIMIT 1
    `) as Array<{ payload: unknown }>;

    const rawPayload = attendeeRows[0]?.payload;
    if (rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
      attendeeData = rawPayload as Record<string, unknown>;
    }
  } catch {
    attendeeData = null;
  }

  const finalFormBaseUrl =
    process.env.FINAL_FORM_URL?.trim() || process.env.NEXT_PUBLIC_FINAL_FORM_URL?.trim() || '';
  const internalFinalFormUrl = '/formulario-final';

  let finalFormUrl: string | null = null;
  if (finalFormBaseUrl) {
    try {
      const url = new URL(finalFormBaseUrl);
      url.searchParams.set('email', targetEmail);
      finalFormUrl = url.toString();
    } catch {
      const separator = finalFormBaseUrl.includes('?') ? '&' : '?';
      finalFormUrl = `${finalFormBaseUrl}${separator}email=${encodeURIComponent(targetEmail)}`;
    }
  } else {
    finalFormUrl = internalFinalFormUrl;
  }

  const progressPercent = Math.round(
    (journeySteps.filter((step) => step.status === 'green').length / journeySteps.length) * 100,
  );

  return {
    props: {
      authEmail: targetEmail,
      participant,
      journeySteps,
      progressPercent,
      campingCopy: participant.camping ? 'Acampa' : 'No acampa',
      isAdminPreview,
      previewEmail: isAdminPreview ? targetEmail : null,
      finalFormUrl,
      showFinalFormSubmittedAlert: finalFormStatus === 'already-submitted',
      showPreconfirmationRequiredAlert: finalFormStatus === 'preconfirmation-required',
      showFinalFormClosedAlert: finalFormStatus === 'closed',
      attendeeData,
      attendanceSummary,
    },
  };
};
