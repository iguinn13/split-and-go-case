import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/header';
import { Toaster } from '@/components/ui/toast';
import './globals.css';

export const metadata: Metadata = {
    title: 'Split&Go',
    description: 'Divisão de despesas em grupo com o mínimo de transferências',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#0b7a54',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="pt-BR">
            <body className="min-h-screen font-sans antialiased">
                <a
                    href="#conteudo"
                    className="fixed left-2 top-2 z-50 -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:translate-y-0"
                >
                    Pular para o conteúdo
                </a>
                <Header />
                <main
                    id="conteudo"
                    tabIndex={-1}
                    className="mx-auto w-full max-w-3xl px-page py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] focus:outline-none"
                >
                    {children}
                </main>
                <Toaster />
            </body>
        </html>
    );
}
