import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        router.push('/admin/sede');
      } else {
        const data = await res.json();
        setError(data.error || 'Autenticación fallida');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Head>
        <title>Login Administrador de Sede | ENEUN 2026</title>
      </Head>
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-12 h-72 w-72 rounded-full bg-emerald-500/10 blur-[130px]"></div>
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-[170px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
        <h1 className="text-2xl font-semibold text-white text-center mb-2">Administrador de Sede</h1>
        <p className="text-sm text-slate-400 text-center mb-8">Ingresa tus credenciales para administrar las validaciones de tu sede.</p>
        
        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Usuario</label>
            <input
              type="text"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:bg-slate-800"
              placeholder="Ej. admin_bogota"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Contraseña</label>
            <input
              type="password"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:bg-slate-800"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-emerald-950 uppercase tracking-widest shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Verificando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
