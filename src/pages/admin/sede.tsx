import { GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { verifyAdminSessionToken, getAdminSessionCookieName } from '../../lib/admin-auth';

interface AdminSedeProps {
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
  document_number: string;
  validations: StudentValidation[];
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
      adminName: session.name,
      adminCampus: session.campus,
    },
  };
};

export default function SedeAdminPanel({ adminName, adminCampus }: AdminSedeProps) {
  const [validations, setValidations] = useState<Validation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [newValName, setNewValName] = useState('');
  const [loading, setLoading] = useState(true);
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

  const columnCount = Math.max(4, validations.length + 2);

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
        </section>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-700 border-t-violet-400"></div>
          </div>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            <div className="w-full overflow-x-auto overflow-y-auto max-h-[68vh]">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900/95 text-violet-100 shadow-md backdrop-blur">
                <tr>
                  <th className="w-1/4 border-b border-white/15 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em]">Lista de estudiantes</th>
                  {validations.map((val) => (
                    <th key={val.id} className="border-b border-white/15 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.14em]">
                      <div className="mx-auto max-w-[140px] truncate text-white" title={val.name}>{val.name}</div>
                    </th>
                  ))}
                  {Array.from({ length: Math.max(0, 3 - validations.length) }).map((_, i) => (
                     <th key={`empty-${i}`} className="border-b border-white/15 px-4 py-4 text-center text-transparent">V</th>
                  ))}
                  <th className="w-36 border-b border-white/15 px-6 py-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white">Cumple</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950/45">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-6 py-12 text-center text-sm font-medium text-slate-300">
                      No hay estudiantes confirmados en esta sede aún o las tablas no han sido creadas.
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => {
                    const isCumple = getStudentStatus(student);
                    return (
                      <tr key={student.registration_id} className={`${idx % 2 === 0 ? 'bg-white/0' : 'bg-white/5'} transition-colors hover:bg-violet-500/10`}>
                        <td className="border-b border-white/10 px-6 py-5 font-semibold uppercase tracking-[0.08em] text-white">
                          {student.first_name} {student.last_name}
                        </td>
                        
                        {validations.map((val) => {
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

                        {Array.from({ length: Math.max(0, 3 - validations.length) }).map((_, i) => (
                           <td key={`empty-cell-${i}`} className="border-b border-white/10 px-4 py-4 text-center"></td>
                        ))}
                        
                        <td className="border-b border-white/10 px-6 py-4 text-center">
                          {validations.length > 0 && isCumple ? (
                            <div className="mx-auto h-6 w-14 rounded-md border-2 border-emerald-300/60 bg-emerald-400/50"></div>
                          ) : (
                            <div className="mx-auto h-6 w-14 rounded-md border-2 border-slate-500 bg-slate-900"></div>
                          )}
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
      </main>
    </div>
  );
}
