import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/ui/Navbar';
import { AlertProvider } from '@/contexts/AlertContext';
import { BetaNotice } from '@/components/ui/BetaNotice';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Plana.AI',
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
            <BetaNotice />
            <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
              <Toaster position="bottom-right" richColors closeButton />
              {children}
            </main>
            <footer className="w-full text-center py-8 text-xs text-gray-500 border-t border-gray-200 mt-auto">
              <p>본 사이트는 비상업적 목적을 지닌 비공식 팬메이드 사이트입니다.</p>
              <p className="mt-1">"블루 아카이브"와 모든 관련 지적재산권은 넥슨 및 넥슨게임즈에 있습니다.</p>
              <p className="mt-1">본 사이트에는 경기도에서 제공한 경기천년체가 적용되어 있습니다.</p>
              <p className="mt-3 text-[10px] text-gray-400">&copy; 2026 Plana.AI All Rights Reserved.</p>
            </footer>
          </div>
        </AlertProvider>
      </body>
    </html>
  );
}
