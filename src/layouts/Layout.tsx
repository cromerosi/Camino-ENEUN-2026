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
      <div className="flex min-h-full flex-col">
        <div className="flex-1">{children}</div>
      </div>
    </>
  );
}
