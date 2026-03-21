import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../styles/global.css';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col bg-slate-950">
        <div className="flex-1">
          <Component {...pageProps} />
        </div>
        <footer className="border-t border-white/10 bg-slate-950/85 px-6 py-4 text-center text-xs tracking-[0.08em] text-slate-200/90 backdrop-blur">
          Creado por: Carlos Romero · cromerosi@unal.edu.co | Jonathan Ramírez · jonramirez@unal.edu.co <br />
          Ayuda, soporte y preguntas: Jose	Fernando Lopez Ramirez · jlopezra@unal.edu.co
        </footer>
      </div>
    </QueryClientProvider>
  );
}
