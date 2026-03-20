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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-emerald-500/30">
      <Head>
        <title>Panel Sede {adminCampus} | ENEUN 2026</title>
      </Head>

      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">VALIDACIONES DE SEDE</h1>
            <p className="text-xs text-emerald-400 font-medium uppercase tracking-[0.2em]">Sede {adminCampus}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-slate-400 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
              Administrador: {adminName}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Crear nueva validación</h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Nombre de validación..."
                value={newValName}
                onChange={(e) => setNewValName(e.target.value)}
                disabled={validations.length >= 7}
                className="w-64 rounded bg-slate-900 border-2 border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-500 disabled:opacity-50"
              />
              <button
                onClick={handleCreateValidation}
                disabled={!newValName.trim() || validations.length >= 7}
                className="rounded bg-slate-800 border-2 border-slate-700 px-4 py-2 text-sm font-bold text-rose-400 transition hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider whitespace-nowrap"
              >
                CREAR VALIDACIÓN
              </button>
            </div>
            {validations.length >= 7 && (
              <p className="text-rose-400 text-xs mt-2">Límite máximo de validaciones (7) alcanzado.</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500"></div>
          </div>
        ) : (
          <div className="w-full overflow-x-auto overflow-y-auto max-h-[65vh] rounded border-2 border-rose-900/50 bg-slate-900 shadow-xl relative">
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
              <thead className="bg-[#570000] text-rose-100 font-semibold uppercase text-xs sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="px-6 py-4 border-2 border-rose-900 w-1/4 bg-[#570000]">Lista de estudiantes</th>
                  {validations.map((val) => (
                    <th key={val.id} className="px-4 py-4 border-2 border-rose-900 text-center bg-[#570000]">
                      <div className="truncate max-w-[120px] mx-auto text-white" title={val.name}>{val.name}</div>
                    </th>
                  ))}
                  {/* Empty cells up to 7 as per design to maintain consistent look if needed, but dynamically mapping validations is cleaner */}
                  {Array.from({ length: Math.max(0, 3 - validations.length) }).map((_, i) => (
                     <th key={`empty-${i}`} className="px-4 py-4 border-2 border-rose-900 text-center text-transparent bg-[#570000]">VALID</th>
                  ))}
                  <th className="px-6 py-4 border-2 border-rose-900 text-center font-bold text-white w-32 bg-[#420000]">CUMPLE?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-900 bg-white">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(4, validations.length + 2)} className="px-6 py-12 text-center text-rose-900 font-medium">
                      No hay estudiantes confirmados en esta sede aún o las tablas no han sido creadas.
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => {
                    const isCumple = getStudentStatus(student);
                    return (
                      <tr key={student.registration_id} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-5 font-bold text-rose-900 border-2 border-rose-900 uppercase">
                          {student.first_name} {student.last_name}
                        </td>
                        
                        {validations.map((val) => {
                          const studentVal = student.validations.find(v => v.validation_id === val.id);
                          const isChecked = studentVal ? studentVal.is_completed : false;
                          
                          return (
                            <td key={val.id} className="px-4 py-4 border-2 border-rose-900 text-center">
                              <label className="inline-flex items-center cursor-pointer p-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleValidation(student.registration_id, val.id, isChecked)}
                                  className="peer sr-only"
                                />
                                <div className="w-8 h-8 rounded-sm flex flex-shrink-0 items-center justify-center transition-all duration-200 border-4 border-rose-900 bg-white peer-checked:bg-white relative">
                                  {isChecked && (
                                    <div className="absolute inset-1 bg-rose-900 rounded-sm"></div>
                                  )}
                                </div>
                              </label>
                            </td>
                          );
                        })}

                        {Array.from({ length: Math.max(0, 3 - validations.length) }).map((_, i) => (
                           <td key={`empty-cell-${i}`} className="px-4 py-4 border-2 border-rose-900 text-center bg-slate-50"></td>
                        ))}
                        
                        <td className="px-6 py-4 border-2 border-rose-900 text-center bg-white">
                          {validations.length > 0 && isCumple ? (
                            <div className="w-12 h-6 border-4 border-rose-900 mx-auto bg-rose-900"></div>
                          ) : (
                            <div className="w-12 h-6 border-4 border-rose-900 mx-auto bg-white"></div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
