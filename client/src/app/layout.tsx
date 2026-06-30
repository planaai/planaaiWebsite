import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/ui/Navbar';
import { AlertProvider } from '@/contexts/AlertContext';

export const metadata: Metadata = {
  title: 'PLANA.AI',
  description: 'Personal Blue Archive progression tracker',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans min-h-screen selection:bg-[var(--plana-primary-light)]">
        <AlertProvider>
          <Navbar />
          <div className="flex flex-col min-h-screen pt-16">
            <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </AlertProvider>
      </body>
    </html>
  );
}
