import Head from 'next/head';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title = 'ENEUN 2026 - Manizales' }: LayoutProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
      </Head>
      <div className="flex min-h-full flex-col">
        <div className="flex-1">{children}</div>
      </div>
    </>
  );
}
