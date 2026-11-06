import type { GetServerSideProps } from 'next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getAdminSessionCookieName,
  hasMultipleCampusScope,
  isSupremeAdminSession,
  verifyAdminSessionToken,
} from '../../lib/admin-auth';
import { isSameCampus, normalizeCampusName, uniqueCampuses } from '../../lib/campus';

const MAX_VALIDATIONS_PER_CAMPUS = 7;
const MIN_VALIDATION_COLUMNS = 3;
const BULK_RESULT_VISIBLE_MS = 15000;

interface AdminSedeProps {
  adminName: string;
  adminCampus: string;
  adminCampuses: string[];
  hasMultipleCampuses: boolean;
  canManageFinalFormAccess: boolean;
}

interface Validation {
  id: number;
  name: string;
  campus: string | null;
}

interface StudentValidation {
  validation_id: number;
  is_completed: boolean;
}

interface Student {
  registration_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  document_number: string | null;
  campus: string | null;
  validations: StudentValidation[];
}

interface FinalFormAllowedUser {
  email: string;
  updated_at: string;
}

interface StudentProgress {
  applicable: number;
  completed: number;
  percent: number;
  isCompleted: boolean;
}

type StatusFilter = 'all' | 'completed' | 'pending';

const STATUS_FILTER_OPTIONS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'completed', label: 'Cumple' },
  { id: 'pending', label: 'No Cumple' },
];

export const getServerSideProps: GetServerSideProps<AdminSedeProps> = async (context) => {
  const session = await verifyAdminSessionToken(context.req.cookies[getAdminSessionCookieName()]);

  if (!session) {
    return {
      redirect: {
        destination: '/admin/login',
        permanent: false,
      },
    };
  }

  return {
    props: {
      adminName: session.name,
      adminCampus: session.campus,
      adminCampuses: session.campuses,
      hasMultipleCampuses: hasMultipleCampusScope(session),
      canManageFinalFormAccess: isSupremeAdminSession(session),
    },
  };
};

/** Minúsculas y sin tildes, para comparar nombres pegados desde Excel. */
function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae el correo de la línea o la limpia de caracteres no imprimibles. */
function cleanBulkLine(rawLine: string): string {
  const trimmed = rawLine.trim().toLowerCase();
  const emailMatch = trimmed.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  if (emailMatch) return emailMatch[0];
  return trimmed.replace(/[^\w\s@.\-áéíóúüñ]/g, '').trim();
}

/** Números presentes en la línea (se ignoran puntos de miles: 1.020.304 → 1020304). */
function extractNumberTokens(line: string): Set<string> {
  const tokens = line.match(/\d[\d.]*/g) ?? [];
  return new Set(tokens.map((token) => token.replace(/\./g, '')).filter(Boolean));
}

function studentMatchesLine(student: Student, line: string, normalizedLine: string, numberTokens: Set<string>): boolean {
  const doc = (student.document_number ?? '').trim().toLowerCase();
  if (doc) {
    const docDigits = doc.replace(/\D/g, '');
    const isNumericDoc = docDigits.length > 0 && docDigits === doc.replace(/[\s.]/g, '');
    if (isNumericDoc ? numberTokens.has(docDigits) : line.includes(doc)) {
      return true;
    }
  }

  const email = (student.email ?? '').trim().toLowerCase();
  if (email && line.includes(email)) {
    return true;
  }

  const firstName = normalizeSearchText(student.first_name);
  const lastName = normalizeSearchText(student.last_name);
  if (!firstName || !lastName) {
    return false;
  }

  return (
    normalizedLine.includes(`${firstName} ${lastName}`) ||
    (normalizedLine.includes(firstName) && normalizedLine.includes(lastName))
  );
}

function getStudentFullName(student: Student): string {
  return [student.first_name, student.last_name].filter(Boolean).join(' ');
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

export default function SedeAdminPanel({
  adminName,
  adminCampus,
  adminCampuses,
  hasMultipleCampuses,
  canManageFinalFormAccess,
}: AdminSedeProps) {
  const [validations, setValidations] = useState<Validation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [newValName, setNewValName] = useState('');
  const [newValCampus, setNewValCampus] = useState('');
  const [isCreatingValidation, setIsCreatingValidation] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingValidationId, setDeletingValidationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Validación masiva
  const [scrapText, setScrapText] = useState('');
  const [scrapValidationId, setScrapValidationId] = useState<number | ''>('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; unmatched: string[] } | null>(null);

  // Control del formulario final (solo Admin Supremo)
  const [finalFormOpen, setFinalFormOpen] = useState(false);
  const [finalFormLoading, setFinalFormLoading] = useState(false);
  const [finalFormEmail, setFinalFormEmail] = useState('');
  const [allowedUsers, setAllowedUsers] = useState<FinalFormAllowedUser[]>([]);
  const [finalFormStatusMessage, setFinalFormStatusMessage] = useState('');

  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      await router.push('/landing');
    }
  };

  /** Recarga validaciones y estudiantes. Con `silent` no se muestra el spinner. */
  const fetchData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [valRes, stuRes] = await Promise.all([
        fetch('/api/admin/sede-validations'),
        fetch('/api/admin/students'),
      ]);
      if (valRes.ok) {
        const valData = (await valRes.json()) as { validations?: Validation[] };
        setValidations(valData.validations ?? []);
      }
      if (stuRes.ok) {
        const stuData = (await stuRes.json()) as { students?: Student[] };
        setStudents(stuData.students ?? []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const applyFinalFormData = (data: { isOpen?: boolean; allowedUsers?: FinalFormAllowedUser[] }) => {
    setFinalFormOpen(Boolean(data.isOpen));
    setAllowedUsers(Array.isArray(data.allowedUsers) ? data.allowedUsers : []);
  };

  const fetchFinalFormAccess = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/final-form-access');
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { isOpen?: boolean; allowedUsers?: FinalFormAllowedUser[] };
      setFinalFormOpen(Boolean(data.isOpen));
      setAllowedUsers(Array.isArray(data.allowedUsers) ? data.allowedUsers : []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    if (canManageFinalFormAccess) {
      void fetchFinalFormAccess();
    }
  }, [canManageFinalFormAccess, fetchData, fetchFinalFormAccess]);

  useEffect(() => {
    if (!bulkResult) return;
    const timeout = window.setTimeout(() => setBulkResult(null), BULK_RESULT_VISIBLE_MS);
    return () => window.clearTimeout(timeout);
  }, [bulkResult]);

  // Sedes disponibles para crear validaciones (solo admins multisede o globales).
  const campusOptions = useMemo(() => {
    if (!hasMultipleCampuses) return [];
    const options = uniqueCampuses([
      ...students.map((student) => student.campus),
      ...validations.map((validation) => validation.campus),
      ...adminCampuses,
    ]);
    return options.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [adminCampuses, hasMultipleCampuses, students, validations]);

  const validationsInTargetCampus = useMemo(() => {
    if (!hasMultipleCampuses) return validations.length;
    if (!newValCampus) return 0;
    return validations.filter((validation) => isSameCampus(validation.campus, newValCampus)).length;
  }, [hasMultipleCampuses, newValCampus, validations]);

  const isValidationLimitReached = validationsInTargetCampus >= MAX_VALIDATIONS_PER_CAMPUS;
  const canCreateValidation =
    Boolean(newValName.trim()) &&
    !isValidationLimitReached &&
    !isCreatingValidation &&
    (!hasMultipleCampuses || Boolean(newValCampus));

  const handleSetGlobalFinalFormState = async (nextState: boolean) => {
    setFinalFormLoading(true);
    setFinalFormStatusMessage('');

    try {
      const response = await fetch('/api/admin/final-form-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: nextState }),
      });

      if (!response.ok) {
        setFinalFormStatusMessage(await readErrorMessage(response, 'No se pudo actualizar el estado global'));
        return;
      }

      applyFinalFormData(await response.json());
      setFinalFormStatusMessage(nextState ? 'Formulario final abierto globalmente.' : 'Formulario final cerrado globalmente.');
    } catch (error) {
      console.error(error);
      setFinalFormStatusMessage('Error de red al actualizar el estado global.');
    } finally {
      setFinalFormLoading(false);
    }
  };

  const handleSetUserFinalFormAccess = async (allow: boolean, emailOverride?: string) => {
    const email = (emailOverride ?? finalFormEmail).trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setFinalFormStatusMessage('Debes ingresar un correo válido.');
      return;
    }

    setFinalFormLoading(true);
    setFinalFormStatusMessage('');

    try {
      const response = await fetch('/api/admin/final-form-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, allow }),
      });

      if (!response.ok) {
        setFinalFormStatusMessage(await readErrorMessage(response, 'No se pudo actualizar el permiso del usuario'));
        return;
      }

      applyFinalFormData(await response.json());
      setFinalFormStatusMessage(
        allow
          ? `Usuario habilitado mientras el formulario esté cerrado: ${email}`
          : `Permiso removido para: ${email}`,
      );
      if (!emailOverride) {
        setFinalFormEmail('');
      }
    } catch (error) {
      console.error(error);
      setFinalFormStatusMessage('Error de red al actualizar el permiso del usuario.');
    } finally {
      setFinalFormLoading(false);
    }
  };

  const handleCreateValidation = async () => {
    if (!canCreateValidation) return;

    setIsCreatingValidation(true);
    try {
      const query = hasMultipleCampuses ? `?campus=${encodeURIComponent(newValCampus)}` : '';
      const res = await fetch(`/api/admin/sede-validations${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newValName.trim() }),
      });
      if (res.ok) {
        setNewValName('');
        await fetchData({ silent: true });
      } else {
        alert(await readErrorMessage(res, 'Error al crear validación'));
      }
    } catch (error) {
      console.error(error);
      alert('Error de red al crear la validación.');
    } finally {
      setIsCreatingValidation(false);
    }
  };

  const validationsById = useMemo(
    () => new Map(validations.map((validation) => [validation.id, validation])),
    [validations],
  );

  const handleBulkValidate = async () => {
    const targetValidation = scrapValidationId ? validationsById.get(scrapValidationId) : undefined;
    if (!scrapText.trim() || !targetValidation) {
      alert('Ingresa texto y selecciona una validación');
      return;
    }

    setBulkLoading(true);
    setBulkResult(null);

    try {
      // Solo se buscan estudiantes de la sede a la que pertenece la validación.
      const candidates = students.filter((student) => isSameCampus(student.campus, targetValidation.campus));
      const lines = scrapText.split(/\r?\n/).map(cleanBulkLine).filter(Boolean);
      const matchedIds = new Set<number>();
      const unmatchedLines: string[] = [];

      for (const line of lines) {
        const normalizedLine = normalizeSearchText(line);
        const numberTokens = extractNumberTokens(line);
        const matched = candidates.find((student) => studentMatchesLine(student, line, normalizedLine, numberTokens));
        if (matched) {
          matchedIds.add(matched.registration_id);
        } else {
          unmatchedLines.push(line);
        }
      }

      const registrationIds = Array.from(matchedIds);
      if (registrationIds.length === 0) {
        alert('No se encontraron coincidencias (por nombre, correo ni documento) en los datos ingresados.');
        return;
      }

      const res = await fetch('/api/admin/bulk-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_ids: registrationIds,
          validation_id: targetValidation.id,
          is_completed: true,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { count?: number };
        setScrapText('');
        setBulkResult({ success: data.count ?? 0, unmatched: unmatchedLines });
        await fetchData({ silent: true });
      } else {
        alert(await readErrorMessage(res, 'Error al validar masivamente'));
      }
    } catch (error) {
      console.error(error);
      alert('Error de red al validar masivamente');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggleValidation = async (registrationId: number, validationId: number, currentStatus: boolean) => {
    const nextStatus = !currentStatus;

    // Actualización optimista: la tabla no se recarga si el guardado funciona.
    setStudents((prev) =>
      prev.map((student) => {
        if (student.registration_id !== registrationId) return student;
        const exists = student.validations.some((v) => v.validation_id === validationId);
        const nextValidations = exists
          ? student.validations.map((v) => (v.validation_id === validationId ? { ...v, is_completed: nextStatus } : v))
          : [...student.validations, { validation_id: validationId, is_completed: nextStatus }];
        return { ...student, validations: nextValidations };
      }),
    );

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: registrationId,
          validation_id: validationId,
          is_completed: nextStatus,
        }),
      });
      if (!res.ok) {
        await fetchData({ silent: true });
        alert(
          `${await readErrorMessage(res, 'Error al guardar el estado en la base de datos.')} Se descartaron los cambios manuales.`,
        );
      }
    } catch (error) {
      console.error(error);
      await fetchData({ silent: true });
      alert('Error de red al guardar el estado. Se descartaron los cambios manuales.');
    }
  };

  const sortedValidations = useMemo(
    () => [...validations].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [validations],
  );

  // Cada estudiante solo cuenta las validaciones de su propia sede.
  const progressByStudent = useMemo(() => {
    const progress = new Map<Student, StudentProgress>();

    for (const student of students) {
      const applicable = validations.filter((validation) => isSameCampus(validation.campus, student.campus));
      const completedIds = new Set(
        student.validations.filter((v) => v.is_completed).map((v) => v.validation_id),
      );
      const completed = applicable.filter((validation) => completedIds.has(validation.id)).length;

      progress.set(student, {
        applicable: applicable.length,
        completed,
        percent: applicable.length > 0 ? Math.round((completed / applicable.length) * 100) : 0,
        isCompleted: applicable.length > 0 && completed === applicable.length,
      });
    }

    return progress;
  }, [students, validations]);

  const filteredStudents = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    let source = !term
      ? students
      : students.filter((student) => {
          const fullName = normalizeSearchText(getStudentFullName(student));
          const doc = (student.document_number ?? '').toLowerCase();
          const email = (student.email ?? '').toLowerCase();
          return fullName.includes(term) || doc.includes(term) || email.includes(term);
        });

    if (statusFilter !== 'all') {
      source = source.filter((student) => {
        const isCompleted = progressByStudent.get(student)?.isCompleted ?? false;
        return statusFilter === 'completed' ? isCompleted : !isCompleted;
      });
    }

    return [...source].sort((a, b) => {
      const aName = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim();
      const bName = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim();
      return aName.localeCompare(bName, 'es', { sensitivity: 'base' });
    });
  }, [students, searchTerm, statusFilter, progressByStudent]);

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  const handleOpenParticipantPanel = (email: string | null) => {
    if (!email) return;
    void router.push(`/?previewEmail=${encodeURIComponent(email)}`);
  };

  const handleDeleteValidation = async (validationId: number, validationName: string) => {
    const accepted = window.confirm(
      `¿Eliminar la validación "${validationName}"? Esta acción también borrará su estado en todos los estudiantes.`,
    );
    if (!accepted) return;

    setDeletingValidationId(validationId);
    try {
      const res = await fetch(`/api/admin/sede-validations?id=${validationId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        alert(await readErrorMessage(res, 'No se pudo eliminar la validación'));
        return;
      }

      if (scrapValidationId === validationId) {
        setScrapValidationId('');
      }
      await fetchData({ silent: true });
    } catch (error) {
      console.error(error);
      alert('Error de red al eliminar la validación.');
    } finally {
      setDeletingValidationId(null);
    }
  };

  const placeholderColumns = Math.max(0, MIN_VALIDATION_COLUMNS - sortedValidations.length);
  // Nombre + validaciones (o columnas vacías) + % avance + Cumple + Panel.
  const columnCount = 1 + sortedValidations.length + placeholderColumns + 3;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-violet-500/30">
      <Head>
        <title>{`Panel Sede ${adminCampus} | ENEUN 2026`}</title>
      </Head>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-6 h-80 w-80 rounded-full bg-violet-500/20 blur-[145px]"></div>
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-500/15 blur-[170px]"></div>
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.35em] text-violet-300">Panel administrativo</p>
            <h1 className="mt-2 text-xl font-semibold tracking-wide text-white sm:text-2xl">Validaciones de sede</h1>
            <p className="mt-1 text-sm text-slate-400">Sede {adminCampus}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 sm:text-sm sm:tracking-[0.28em]">
              Admin: {adminName.toLowerCase()}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-violet-200 transition hover:border-violet-300/60 hover:text-violet-100"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {canManageFinalFormAccess && (
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Formulario final</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Control de apertura</h2>
              <p className="mt-1 text-sm text-slate-400">Define si el formulario final está abierto para todos o solo para usuarios habilitados.</p>
              <p className="mt-3 inline-flex rounded-full border border-white/15 bg-slate-900/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
                Estado actual: {finalFormOpen ? 'Abierto' : 'Cerrado'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSetGlobalFinalFormState(true)}
                disabled={finalFormLoading || finalFormOpen}
                className="rounded-2xl border border-emerald-300/30 bg-emerald-400/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100 transition hover:bg-emerald-400/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Abrir global
              </button>
              <button
                type="button"
                onClick={() => handleSetGlobalFinalFormState(false)}
                disabled={finalFormLoading || !finalFormOpen}
                className="rounded-2xl border border-rose-300/30 bg-rose-400/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-400/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cerrar global
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Permitir usuario cuando esté cerrado</p>
              <form
                className="mt-3 flex flex-col gap-3 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSetUserFinalFormAccess(true);
                }}
              >
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  aria-label="Correo a habilitar"
                  value={finalFormEmail}
                  onChange={(e) => setFinalFormEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400"
                />
                <button
                  type="submit"
                  disabled={finalFormLoading}
                  className="rounded-2xl border border-violet-300/30 bg-violet-400/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-violet-100 transition hover:bg-violet-400/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Habilitar correo
                </button>
              </form>

              {finalFormStatusMessage && (
                <p role="status" className="mt-3 text-sm text-slate-300">{finalFormStatusMessage}</p>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Correos habilitados ({allowedUsers.length})</p>
              <div className="mt-3 max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/50 p-3">
                {allowedUsers.length === 0 ? (
                  <p className="text-sm text-slate-400">No hay correos habilitados.</p>
                ) : (
                  <ul className="space-y-2">
                    {allowedUsers.map((user) => (
                      <li key={user.email} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                        <span className="truncate">{user.email}</span>
                        <button
                          type="button"
                          onClick={() => handleSetUserFinalFormAccess(false, user.email)}
                          disabled={finalFormLoading}
                          className="rounded-lg border border-rose-300/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
        )}

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Gestión</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Crear nueva validación</h2>
              <p className="mt-1 text-sm text-slate-400">
                Puedes crear hasta {MAX_VALIDATIONS_PER_CAMPUS} validaciones{hasMultipleCampuses ? ' por sede' : ''} para marcar el cumplimiento de cada estudiante.
              </p>
            </div>
            <form
              className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateValidation();
              }}
            >
              {hasMultipleCampuses && (
                <select
                  aria-label="Sede de la validación"
                  value={newValCampus}
                  onChange={(e) => setNewValCampus(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400 sm:max-w-[200px]"
                >
                  <option value="">-- Sede --</option>
                  {campusOptions.map((campus) => (
                    <option key={normalizeCampusName(campus)} value={campus}>{campus}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="Nombre de validación..."
                aria-label="Nombre de la validación"
                value={newValName}
                onChange={(e) => setNewValName(e.target.value)}
                maxLength={120}
                disabled={isValidationLimitReached}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!canCreateValidation}
                className="rounded-2xl border border-violet-300/30 bg-violet-400/20 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-violet-100 transition hover:bg-violet-400/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreatingValidation ? 'Creando...' : 'Crear validación'}
              </button>
            </form>
          </div>
          {isValidationLimitReached && (
            <p className="mt-3 text-xs text-rose-300">
              Límite máximo de validaciones ({MAX_VALIDATIONS_PER_CAMPUS}) alcanzado{hasMultipleCampuses ? ' para esta sede' : ''}.
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Buscar por nombre, documento o correo..."
              aria-label="Buscar estudiantes"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-violet-100 transition hover:border-violet-300/60 hover:bg-violet-500/15"
            >
              Buscar
            </button>

            <div className="flex rounded-2xl border border-slate-700 bg-slate-900/40 p-1 shadow-inner backdrop-blur-sm" role="group" aria-label="Filtrar por estado">
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setStatusFilter(opt.id)}
                  aria-pressed={statusFilter === opt.id}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl transition duration-300 ${
                    statusFilter === opt.id
                      ? 'bg-violet-500/20 text-violet-200 border border-violet-400/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-400 sm:ml-auto">
              Mostrando {filteredStudents.length} de {students.length}
            </p>
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-20" role="status" aria-label="Cargando">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-700 border-t-violet-400"></div>
          </div>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            <div className="w-full overflow-x-auto overflow-y-auto max-h-[68vh]">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900/95 text-violet-100 shadow-md backdrop-blur">
                <tr>
                  <th className="w-1/4 border-b border-white/15 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em]">Lista de estudiantes</th>
                  {sortedValidations.map((val) => (
                    <th key={val.id} className="border-b border-white/15 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.14em]">
                      <div className="mx-auto flex max-w-[180px] items-center justify-center gap-2" title={val.name}>
                        <span className="truncate text-white">{val.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteValidation(val.id, val.name)}
                          disabled={deletingValidationId === val.id}
                          aria-label={`Eliminar validación ${val.name}`}
                          className="rounded border border-rose-300/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingValidationId === val.id ? '...' : 'X'}
                        </button>
                      </div>
                      {hasMultipleCampuses && val.campus && (
                        <p className="mt-1 truncate text-[10px] font-normal normal-case tracking-normal text-slate-400">{val.campus}</p>
                      )}
                    </th>
                  ))}
                  {Array.from({ length: placeholderColumns }).map((_, i) => (
                    <th key={`empty-${i}`} className="border-b border-white/15 px-4 py-4 text-center text-transparent">V</th>
                  ))}
                  <th className="w-28 border-b border-white/15 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white">% avance</th>
                  <th className="w-36 border-b border-white/15 px-6 py-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white">Cumple</th>
                  <th className="w-40 border-b border-white/15 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white">Panel</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950/45">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-6 py-12 text-center text-sm font-medium text-slate-300">
                      {students.length === 0
                        ? 'No hay estudiantes confirmados en esta sede aún o las tablas no han sido creadas.'
                        : 'No se encontraron estudiantes con ese criterio de búsqueda.'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, idx) => {
                    const progress = progressByStudent.get(student);
                    const fullName = getStudentFullName(student);
                    return (
                      <tr
                        key={`${student.registration_id}-${student.campus ?? ''}`}
                        className={`${idx % 2 === 0 ? 'bg-white/0' : 'bg-white/5'} transition-colors hover:bg-violet-500/10`}
                      >
                        <td className="border-b border-white/10 px-6 py-5 font-semibold uppercase tracking-[0.08em] text-white">
                          {fullName}
                          <p className="mt-1 normal-case tracking-normal text-xs text-slate-400">{student.document_number}</p>
                          {hasMultipleCampuses && student.campus && (
                            <p className="mt-0.5 normal-case tracking-normal text-[11px] text-slate-500">{student.campus}</p>
                          )}
                        </td>

                        {sortedValidations.map((val) => {
                          if (!isSameCampus(val.campus, student.campus)) {
                            return (
                              <td key={val.id} className="border-b border-white/10 px-4 py-4 text-center text-slate-600" title="Esta validación es de otra sede">
                                —
                              </td>
                            );
                          }

                          const isChecked = student.validations.some((v) => v.validation_id === val.id && v.is_completed);

                          return (
                            <td key={val.id} className="border-b border-white/10 px-4 py-4 text-center">
                              <label className="inline-flex items-center cursor-pointer p-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleValidation(student.registration_id, val.id, isChecked)}
                                  aria-label={`${val.name}: ${fullName}`}
                                  className="peer sr-only"
                                />
                                <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border-2 border-violet-300/60 bg-slate-900 transition-all duration-200 peer-checked:border-violet-200 peer-checked:bg-violet-500/20 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-300">
                                  {isChecked && (
                                    <div className="absolute inset-1 rounded-sm bg-violet-300"></div>
                                  )}
                                </div>
                              </label>
                            </td>
                          );
                        })}

                        {Array.from({ length: placeholderColumns }).map((_, i) => (
                          <td key={`empty-cell-${i}`} className="border-b border-white/10 px-4 py-4 text-center"></td>
                        ))}

                        <td className="border-b border-white/10 px-4 py-4 text-center">
                          <span className="inline-flex items-center rounded-full border border-violet-300/40 bg-violet-400/15 px-3 py-1 text-xs font-semibold text-violet-100">
                            {progress?.percent ?? 0}%
                          </span>
                        </td>

                        <td className="border-b border-white/10 px-6 py-4 text-center">
                          {progress?.isCompleted ? (
                            <div className="mx-auto h-6 w-14 rounded-md border-2 border-emerald-300/60 bg-emerald-400/50" aria-label="Cumple"></div>
                          ) : (
                            <div className="mx-auto h-6 w-14 rounded-md border-2 border-slate-500 bg-slate-900" aria-label="No cumple"></div>
                          )}
                        </td>

                        <td className="border-b border-white/10 px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenParticipantPanel(student.email)}
                            disabled={!student.email}
                            className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-violet-300/60 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Ver index
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {/* ── Validación Masiva (Scrap) ── */}
        {!loading && validations.length > 0 && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Herramienta</p>
              <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
                <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Validación Masiva
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Copia y pega desde Excel (nombre completo, correo institucional o número de documento). Selecciona la validación y haz clic en &quot;Validar&quot;.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <textarea
                  className="h-48 w-full resize-none rounded-2xl border border-slate-700 bg-slate-900/70 p-4 font-mono text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 disabled:opacity-50"
                  placeholder={"Ejemplo:\n12345678\njuan.perez@unal.edu.co\nJuan Pérez..."}
                  aria-label="Datos para la validación masiva"
                  value={scrapText}
                  onChange={(e) => setScrapText(e.target.value)}
                  disabled={bulkLoading}
                />
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="bulk-validation" className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Tipo de validación
                  </label>
                  <select
                    id="bulk-validation"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400 disabled:opacity-50"
                    value={scrapValidationId}
                    onChange={(e) => setScrapValidationId(e.target.value ? Number(e.target.value) : '')}
                    disabled={bulkLoading}
                  >
                    <option value="">-- Seleccionar --</option>
                    {sortedValidations.map((v) => (
                      <option key={v.id} value={v.id}>
                        {hasMultipleCampuses && v.campus ? `${v.name} · ${v.campus}` : v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleBulkValidate}
                  disabled={bulkLoading || !scrapText.trim() || !scrapValidationId}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-300/30 bg-violet-400/20 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-violet-100 transition hover:bg-violet-400/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-100 border-t-transparent" />
                      Procesando...
                    </>
                  ) : (
                    'Validar estudiantes'
                  )}
                </button>

                {bulkResult && (
                  <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4" role="status">
                    <p className="text-sm font-semibold text-emerald-300">
                      ✓ {bulkResult.success} {bulkResult.success === 1 ? 'estudiante validado' : 'estudiantes validados'}
                    </p>
                    {bulkResult.unmatched.length > 0 && (
                      <div className="mt-2 text-xs leading-relaxed text-rose-300">
                        <p className="font-medium underline decoration-rose-400/50 underline-offset-2">
                          ⚠ {bulkResult.unmatched.length} líneas no coincidieron:
                        </p>
                        <ul className="mt-1 max-h-32 overflow-y-auto space-y-0.5 pr-2">
                          {bulkResult.unmatched.slice(0, 50).map((line, idx) => (
                            <li key={idx} className="font-mono bg-rose-900/20 px-1 rounded truncate">
                              • {line}
                            </li>
                          ))}
                          {bulkResult.unmatched.length > 50 && (
                            <li className="italic opacity-70">
                              ... y {bulkResult.unmatched.length - 50} más.
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
