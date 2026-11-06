import type { AppProps } from 'next/app';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../styles/global.css';

export default function App({ Component, pageProps }: AppProps) {
  // Un QueryClient por instancia de la app: evita compartir caché entre
  // usuarios durante el renderizado en el servidor.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col bg-slate-950">
        <div className="flex-1">
          <Component {...pageProps} />
        </div>
        <footer className="border-t border-white/10 bg-slate-950/85 px-6 py-4 text-center text-xs tracking-[0.08em] text-slate-200/90 backdrop-blur">
          Creado por: Carlos Romero · cromerosi@unal.edu.co | Jonathan Ramírez · jonramirez@unal.edu.co <br />
          Ayuda, soporte y preguntas: Jose Fernando Lopez Ramirez · jlopezra@unal.edu.co
        </footer>
      </div>
    </QueryClientProvider>
  );
}
