import Layout from '../layouts/Layout';

export default function MantenimientoPage() {
  return (
    <Layout>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16 lg:px-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-12 h-72 w-72 rounded-full bg-amber-500/20 blur-[130px]"></div>
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-orange-500/20 blur-[170px]"></div>
        </div>

        <section className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/70 p-10 text-center shadow-[0_30px_90px_-45px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.45em] text-amber-300">ENEUN 2026</p>
          <h1 className="mt-5 text-4xl font-semibold text-white sm:text-5xl">Pagina en mantenimiento</h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-slate-300">
            Estamos realizando ajustes para mejorar la plataforma. El acceso esta temporalmente
            deshabilitado para participantes y administradores.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm uppercase tracking-[0.2em] text-slate-500">
            Intenta nuevamente mas tarde
          </p>
        </section>
      </main>
    </Layout>
  );
}
