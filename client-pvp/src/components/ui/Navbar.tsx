'use client';

import { ArrowLeft, Settings, LogOut, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';

export function Navbar() {
  const MAIN_URL = 'http://localhost:3001';
  const { user, isAuthenticated, logout, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <header className="fixed top-0 w-full z-40 bg-white/95 backdrop-blur-sm shadow-sm h-14 border-b border-gray-200">
      <div className="max-w-[1600px] mx-auto px-4 h-full flex items-center justify-between">
        
        {/* Left: Logo and Back */}
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white hover:bg-slate-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <a href={`${MAIN_URL}/`} className="flex items-center">
            <img src="/images/logo.png" alt="PLANA.AI Logo" className="h-14 transform scale-[1.15] object-contain ml-1" />
          </a>
        </div>

        {/* Right: Menu Navigation */}
        <nav className="flex items-center">
          <ul className="flex items-center text-sm font-bold text-slate-800">
            <li>
              <a href={`${MAIN_URL}/`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">로비</a>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <a href={`${MAIN_URL}/collection`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">컬렉션</a>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <a href={`${MAIN_URL}/archive`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">도감</a>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <a href={`${MAIN_URL}/gifts`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">선물</a>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <a href={`${MAIN_URL}/gacha`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">모집</a>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <a href={`${MAIN_URL}/planner`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">플래너</a>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <a href={`${MAIN_URL}/formation`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">모의 편성</a>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <a href={`${MAIN_URL}/pyroxene`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">청휘석 계산기</a>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <a href={`${MAIN_URL}/ap-calculator`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">AP 존버 계산기</a>
            </li>
            <li className="text-slate-300">/</li>
            <li>
              <a href={`${MAIN_URL}/notices`} className="px-4 hover:text-[var(--plana-primary)] transition-colors">공지사항</a>
            </li>
          </ul>

          <div className="w-px h-5 bg-slate-300 mx-4"></div>

          {/* Auth & Settings */}
          <div className="flex items-center gap-4 text-slate-600">
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <a href={`${MAIN_URL}/account`} className="text-sm font-bold hover:text-[var(--plana-primary)] transition-colors">
                  {user?.nickname || user?.username}님
                </a>
                <button onClick={logout} className="text-sm font-bold hover:text-[var(--plana-primary)] transition-colors flex items-center gap-1">
                  <LogOut size={16} /> 로그아웃
                </button>
              </div>
            ) : (
              <Link href="/login" className="text-sm font-bold hover:text-[var(--plana-primary)] transition-colors flex items-center gap-1">
                <LogIn size={16} /> 로그인
              </Link>
            )}
            <a href={`${MAIN_URL}/settings`} className="hover:text-[var(--plana-primary)] transition-colors">
              <Settings size={18} />
            </a>
          </div>
        </nav>

      </div>
    </header>
  );
}
