import Head from 'next/head';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ENEUN 2026 - Manizales</title>
      </Head>
      <div className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <footer className="px-6 pb-6 pt-2 text-center text-xs tracking-[0.08em] text-slate-400/80">
          Creado por: Carlos Romero · cromerosi@unal.edu.co | Jonathan Ramírez · jonramirez@unal.edu.co
        </footer>
      </div>
    </>
  );
}
