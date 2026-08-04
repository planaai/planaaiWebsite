'use client';

import Link from 'next/link';
import { Settings, LogOut, LogIn, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usePathname, useRouter } from 'next/navigation';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === '/') return null;

  return (
    <header className="fixed top-0 w-full z-40 bg-white/95 backdrop-blur-sm shadow-sm h-14 border-b border-gray-200">
      <div className="max-w-[1600px] mx-auto px-4 h-full flex items-center justify-between">
        
        {/* Left: Logo and Back */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white hover:bg-slate-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <Link href="/" className="flex items-center">
            <img src="/images/logo.png" alt="PLANA.AI Logo" className="h-14 transform scale-[1.15] object-contain ml-1" />
          </Link>
        </div>

        {/* Right: Menu Navigation */}
        <nav className="flex items-center">
          <ul className="flex items-center text-sm font-bold text-slate-800">
            <li>
              <Link href="/" className="px-4 hover:text-[var(--plana-primary)] transition-colors">로비</Link>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <Link href="/collection" className="px-4 hover:text-[var(--plana-primary)] transition-colors">컬렉션</Link>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <Link href="/archive" className="px-4 hover:text-[var(--plana-primary)] transition-colors">도감</Link>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <Link href="/gifts" className="px-4 hover:text-[var(--plana-primary)] transition-colors">선물</Link>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <Link href="/gacha" className="px-4 hover:text-[var(--plana-primary)] transition-colors">모집</Link>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <Link href="/planner" className="px-4 hover:text-[var(--plana-primary)] transition-colors">플래너</Link>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <Link href="/formation" className="px-4 hover:text-[var(--plana-primary)] transition-colors">모의 편성</Link>
            </li>

            <li className="text-slate-300">/</li>
            <li>
              <Link href="/pyroxene" className="px-4 hover:text-[var(--plana-primary)] transition-colors">청휘석 계산기</Link>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <Link href="/ap-calculator" className="px-4 hover:text-[var(--plana-primary)] transition-colors">AP 존버 계산기</Link>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <Link href="/tactics" className="px-4 hover:text-[var(--plana-primary)] transition-colors">공략</Link>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <Link href="/notices" className="px-4 hover:text-[var(--plana-primary)] transition-colors">공지사항</Link>
            </li>
          </ul>

          <div className="w-px h-5 bg-slate-300 mx-4"></div>

          {/* Auth & Settings */}
          <div className="flex items-center gap-4 text-slate-600">
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <Link href="/account" className="text-sm font-bold hover:text-[var(--plana-primary)] transition-colors">
                  {user?.nickname || user?.username}님
                </Link>
                <button onClick={logout} className="text-sm font-bold hover:text-[var(--plana-primary)] transition-colors flex items-center gap-1">
                  <LogOut size={16} /> 로그아웃
                </button>
              </div>
            ) : (
              <Link href={`/login?redirect=${pathname}`} className="text-sm font-bold hover:text-[var(--plana-primary)] transition-colors flex items-center gap-1">
                <LogIn size={16} /> 로그인
              </Link>
            )}
            <Link href="/settings" className="hover:text-[var(--plana-primary)] transition-colors">
              <Settings size={18} />
            </Link>
          </div>
        </nav>

      </div>
    </header>
  );
}
