import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Split&Go',
  description: 'Divisão de despesas em grupo com o mínimo de transferências',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-page py-6">{children}</main>
      </body>
    </html>
  );
}
