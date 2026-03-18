import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <link rel="icon" type="image/svg+xml" href="/eneun.svg?v=3" sizes="any" />
        <link rel="icon" type="image/x-icon" href="/eneun.ico?v=3" />
        <link rel="shortcut icon" href="/eneun.ico?v=3" />
        <link rel="apple-touch-icon" href="/eneun.svg?v=3" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
        />
      </Head>
      <body className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
