import { GetServerSideProps } from 'next';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { verifyAdminSessionToken, getAdminSessionCookieName } from '../../lib/admin-auth';

interface AdminSedeProps {
  adminUsername: string;
  adminName: string;
  adminCampus: string;
}

interface Validation {
  id: number;
  name: string;
}

interface StudentValidation {
  validation_id: number;
  is_completed: boolean;
}

interface Student {
  registration_id: number;
  first_name: string;
  last_name: string;
  email: string;
  document_number: string;
  validations: StudentValidation[];
}

interface FinalFormAllowedUser {
  email: string;
  updated_at: string;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies[getAdminSessionCookieName()];
  const session = await verifyAdminSessionToken(token);

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
      adminUsername: session.username,
      adminName: session.name,
      adminCampus: session.campus,
    },
  };
};

export default function SedeAdminPanel({ adminUsername, adminName, adminCampus }: AdminSedeProps) {
  const normalizedUsername = adminUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedName = adminName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const combinedIdentity = `${normalizedUsername}${normalizedName}`;
  const isSpnAdmin =
    normalizedUsername === 'spn' ||
    normalizedName === 'spn' ||
    combinedIdentity === 'adminspn' ||
    combinedIdentity === 'spnadmin';
  const [validations, setValidations] = useState<Validation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [newValName, setNewValName] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingValidationId, setDeletingValidationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');

  // Bulk validation state
  const [scrapText, setScrapText] = useState('');
  const [scrapValidationId, setScrapValidationId] = useState<number | ''>('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; unmatched: string[] } | null>(null);
  const [finalFormOpen, setFinalFormOpen] = useState(false);
  const [finalFormLoading, setFinalFormLoading] = useState(false);
  const [finalFormEmail, setFinalFormEmail] = useState('');
  const [allowedUsers, setAllowedUsers] = useState<FinalFormAllowedUser[]>([]);
  const [finalFormStatusMessage, setFinalFormStatusMessage] = useState('');

  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/landing');
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  useEffect(() => {
    fetchData();
    if (isSpnAdmin) {
      fetchFinalFormAccess();
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [valRes, stuRes] = await Promise.all([
        fetch('/api/admin/sede-validations'),
        fetch('/api/admin/students')
      ]);
      if (valRes.ok) {
        const valData = await valRes.json();
        setValidations(valData.validations || []);
      }
      if (stuRes.ok) {
        const stuData = await stuRes.json();
        setStudents(stuData.students || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinalFormAccess = async () => {
    try {
      const response = await fetch('/api/admin/final-form-access');
      if (!response.ok) {
        return;
      }

      const data = await response.json() as {
        isOpen?: boolean;
        allowedUsers?: FinalFormAllowedUser[];
      };

      setFinalFormOpen(Boolean(data.isOpen));
      setAllowedUsers(Array.isArray(data.allowedUsers) ? data.allowedUsers : []);
    } catch (error) {
      console.error(error);
    }
  };

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
        const errorData = await response.json().catch(() => ({ error: 'No se pudo actualizar el estado global' }));
        setFinalFormStatusMessage(errorData.error || 'No se pudo actualizar el estado global');
        return;
      }

      const data = await response.json() as { isOpen?: boolean; allowedUsers?: FinalFormAllowedUser[] };
      setFinalFormOpen(Boolean(data.isOpen));
      setAllowedUsers(Array.isArray(data.allowedUsers) ? data.allowedUsers : []);
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
    if (!email) {
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
        const errorData = await response.json().catch(() => ({ error: 'No se pudo actualizar el permiso del usuario' }));
        setFinalFormStatusMessage(errorData.error || 'No se pudo actualizar el permiso del usuario');
        return;
      }

      const data = await response.json() as { isOpen?: boolean; allowedUsers?: FinalFormAllowedUser[] };
      setFinalFormOpen(Boolean(data.isOpen));
      setAllowedUsers(Array.isArray(data.allowedUsers) ? data.allowedUsers : []);
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
    if (!newValName.trim() || validations.length >= 7) return;
    try {
      const res = await fetch('/api/admin/sede-validations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newValName })
      });
      if (res.ok) {
        setNewValName('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al crear validación');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkValidate = async () => {
    if (!scrapText.trim() || !scrapValidationId) {
      alert('Ingresa texto y selecciona una validación');
      return;
    }

    setBulkLoading(true);
    setBulkResult(null);

    // Clean each line: extract email if present, otherwise strip non-printable/junk chars
    const rawLines = scrapText
      .split(/\r?\n/)
      .map((l) => {
        const trimmed = l.trim().toLowerCase();
        // Try to extract a clean email from the line
        const emailMatch = trimmed.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/);
        if (emailMatch) return emailMatch[0];
        // Otherwise strip non-printable characters and keep alphanumeric + spaces
        return trimmed.replace(/[^\w\s@.\-áéíóúüñ]/g, '').trim();
      })
      .filter(Boolean);
    const matchedIds = new Set<number>();
    const unmatchedLines: string[] = [];

    rawLines.forEach((line) => {
      const matched = students.find((s) => {
        const doc = (s.document_number ?? '').toLowerCase();
        const email = (s.email ?? '').toLowerCase();
        const fName = s.first_name.toLowerCase();
        const lName = s.last_name.toLowerCase();
        const fullName = `${fName} ${lName}`;
        return (
          (doc && line.includes(doc)) ||
          (email && line.includes(email)) ||
          (fullName && line.includes(fullName)) ||
          (line.includes(fName) && line.includes(lName))
        );
      });
      if (matched) {
        matchedIds.add(matched.registration_id);
      } else {
        unmatchedLines.push(line);
      }
    });

    const registration_ids = Array.from(matchedIds);

    if (registration_ids.length === 0) {
      alert('No se encontraron coincidencias (por nombre, correo ni documento) en los datos ingresados.');
      setBulkLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/bulk-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_ids,
          validation_id: Number(scrapValidationId),
          is_completed: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setScrapText('');
        setBulkResult({ success: data.count, unmatched: unmatchedLines });
        fetchData();
        setTimeout(() => setBulkResult(null), 15000);
      } else {
        const err = await res.json();
        alert(err.error || 'Error al validar masivamente');
      }
    } catch (error) {
      console.error(error);
      alert('Error de red al validar masivamente');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggleValidation = async (registrationId: number, validationId: number, currentStatus: boolean) => {

    // Optimistic UI update
    setStudents(prev => prev.map(s => {
      if (s.registration_id === registrationId) {
        const hasVal = s.validations.find(v => v.validation_id === validationId);
        let newVal;
        if (hasVal) {
          newVal = s.validations.map(v => v.validation_id === validationId ? { ...v, is_completed: !currentStatus } : v);
        } else {
          newVal = [...s.validations, { validation_id: validationId, is_completed: !currentStatus }];
        }
        return { ...s, validations: newVal };
      }
      return s;
    }));

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: registrationId,
          validation_id: validationId,
          is_completed: !currentStatus
        })
      });
      if (!res.ok) {
        // Revert on failure by refetching
        fetchData();
        alert('Error al guardar el estado en la base de datos (quizás la tabla no existe aún). Se descartaron los cambios manuales.');
      } else {
        // Confirm state is in sync with DB
        fetchData();
      }
    } catch (error) {
       console.error(error);
       fetchData();
    }
  };

  const getStudentStatus = (student: Student) => {
    if (validations.length === 0) return false;
    // Check if every validation exists and is completed
    const completedIds = new Set(
      student.validations.filter(v => v.is_completed).map(v => v.validation_id)
    );
    return validations.every(v => completedIds.has(v.id));
  };

  const getStudentProgressPercent = (student: Student) => {
    if (validations.length === 0) return 0;
    const completedIds = new Set(
      student.validations.filter(v => v.is_completed).map(v => v.validation_id)
    );
    const completedCount = validations.filter(v => completedIds.has(v.id)).length;
    return Math.round((completedCount / validations.length) * 100);
  };

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let source = !term
      ? students
      : students.filter((student) => {
          const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
          const doc = (student.document_number ?? '').toLowerCase();
          const email = (student.email ?? '').toLowerCase();
          return fullName.includes(term) || doc.includes(term) || email.includes(term);
        });

    if (statusFilter !== 'all') {
      source = source.filter(s => {
        const isCompleted = getStudentStatus(s);
        return statusFilter === 'completed' ? isCompleted : !isCompleted;
      });
    }
    
    return [...source].sort((a, b) => {
      const aName = `${a.last_name} ${a.first_name}`.trim();
      const bName = `${b.last_name} ${b.first_name}`.trim();
      return aName.localeCompare(bName, 'es', { sensitivity: 'base' });
    });
  }, [students, searchTerm, statusFilter, validations]);

  const sortedValidations = useMemo(() => {
    return [...validations].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
    );
  }, [validations]);

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  const handleOpenParticipantPanel = (email: string) => {
    if (!email) return;
    router.push(`/?previewEmail=${encodeURIComponent(email)}`);
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
        const err = await res.json().catch(() => ({ error: 'No se pudo eliminar la validación' }));
        alert(err.error || 'No se pudo eliminar la validación');
        return;
      }

      await fetchData();
    } catch (error) {
      console.error(error);
      alert('Error de red al eliminar la validación.');
    } finally {
      setDeletingValidationId(null);
    }
  };

  const columnCount = Math.max(6, sortedValidations.length + 4);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-violet-500/30">
      <Head>
        <title>Panel Sede {adminCampus} | ENEUN 2026</title>
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
              Admin: {adminName}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-violet-200 transition hover:border-violet-300/60 hover:text-violet-100"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isSpnAdmin && (
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
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={finalFormEmail}
                  onChange={(e) => setFinalFormEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400"
                />
                <button
                  type="button"
                  onClick={() => handleSetUserFinalFormAccess(true)}
                  disabled={finalFormLoading}
                  className="rounded-2xl border border-violet-300/30 bg-violet-400/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-violet-100 transition hover:bg-violet-400/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Habilitar correo
                </button>
              </div>

              {finalFormStatusMessage && (
                <p className="mt-3 text-sm text-slate-300">{finalFormStatusMessage}</p>
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
              <p className="mt-1 text-sm text-slate-400">Puedes crear hasta 7 validaciones para marcar el cumplimiento de cada estudiante.</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl">
              <input
                type="text"
                placeholder="Nombre de validación..."
                value={newValName}
                onChange={(e) => setNewValName(e.target.value)}
                disabled={validations.length >= 7}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                onClick={handleCreateValidation}
                disabled={!newValName.trim() || validations.length >= 7}
                className="rounded-2xl border border-violet-300/30 bg-violet-400/20 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-violet-100 transition hover:bg-violet-400/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Crear validación
              </button>
            </div>
          </div>
          {validations.length >= 7 && (
            <p className="mt-3 text-xs text-rose-300">Límite máximo de validaciones (7) alcanzado.</p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Buscar por nombre, documento o correo..."
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
               onClick={handleSearch}
               className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-violet-100 transition hover:border-violet-300/60 hover:bg-violet-500/15"
             >
               Buscar
             </button>

            <div className="flex rounded-2xl border border-slate-700 bg-slate-900/40 p-1 shadow-inner backdrop-blur-sm">
               {[
                 { id: 'all', label: 'Todos' },
                 { id: 'completed', label: 'Cumple' },
                 { id: 'pending', label: 'No Cumple' }
               ].map((opt) => (
                 <button
                   key={opt.id}
                   onClick={() => setStatusFilter(opt.id as any)}
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
          <div className="flex justify-center py-20">
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
                          className="rounded border border-rose-300/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingValidationId === val.id ? '...' : 'X'}
                        </button>
                      </div>
                    </th>
                  ))}
                  {Array.from({ length: Math.max(0, 3 - sortedValidations.length) }).map((_, i) => (
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
                    const isCumple = getStudentStatus(student);
                    const progressPercent = getStudentProgressPercent(student);
                    return (
                      <tr key={student.registration_id} className={`${idx % 2 === 0 ? 'bg-white/0' : 'bg-white/5'} transition-colors hover:bg-violet-500/10`}>
                        <td className="border-b border-white/10 px-6 py-5 font-semibold uppercase tracking-[0.08em] text-white">
                          {student.first_name} {student.last_name}
                          <p className="mt-1 normal-case tracking-normal text-xs text-slate-400">{student.document_number}</p>
                        </td>
                        
                        {sortedValidations.map((val) => {
                          const studentVal = student.validations.find(v => v.validation_id === val.id);
                          const isChecked = studentVal ? studentVal.is_completed : false;
                          
                          return (
                            <td key={val.id} className="border-b border-white/10 px-4 py-4 text-center">
                              <label className="inline-flex items-center cursor-pointer p-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleValidation(student.registration_id, val.id, isChecked)}
                                  className="peer sr-only"
                                />
                                <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border-2 border-violet-300/60 bg-slate-900 transition-all duration-200 peer-checked:border-violet-200 peer-checked:bg-violet-500/20">
                                  {isChecked && (
                                    <div className="absolute inset-1 rounded-sm bg-violet-300"></div>
                                  )}
                                </div>
                              </label>
                            </td>
                          );
                        })}

                        {Array.from({ length: Math.max(0, 3 - sortedValidations.length) }).map((_, i) => (
                           <td key={`empty-cell-${i}`} className="border-b border-white/10 px-4 py-4 text-center"></td>
                        ))}

                        <td className="border-b border-white/10 px-4 py-4 text-center">
                          <span className="inline-flex items-center rounded-full border border-violet-300/40 bg-violet-400/15 px-3 py-1 text-xs font-semibold text-violet-100">
                            {progressPercent}%
                          </span>
                        </td>
                        
                        <td className="border-b border-white/10 px-6 py-4 text-center">
                          {validations.length > 0 && isCumple ? (
                            <div className="mx-auto h-6 w-14 rounded-md border-2 border-emerald-300/60 bg-emerald-400/50"></div>
                          ) : (
                            <div className="mx-auto h-6 w-14 rounded-md border-2 border-slate-500 bg-slate-900"></div>
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
                <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  value={scrapText}
                  onChange={(e) => setScrapText(e.target.value)}
                  disabled={bulkLoading}
                />
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Tipo de validación
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400 disabled:opacity-50"
                    value={scrapValidationId}
                    onChange={(e) => setScrapValidationId(Number(e.target.value))}
                    disabled={bulkLoading}
                  >
                    <option value="">-- Seleccionar --</option>
                    {validations.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <button
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
                  <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
                    <p className="text-sm font-semibold text-emerald-300">
                      ✓ {bulkResult.success} {bulkResult.success === 1 ? 'estudiante validado' : 'estudiantes validados'}
                    </p>
                    {bulkResult.unmatched.length > 0 && (
                      <div className="mt-2 text-xs leading-relaxed text-rose-300">
                        <p className="font-medium underline decoration-rose-400/50 underline-offset-2">
                          ⚠ {bulkResult.unmatched.length} líneas no coincidieron:
                        </p>
                        <ul className="mt-1 max-h-32 overflow-y-auto space-y-0.5 pr-2 custom-scrollbar">
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
