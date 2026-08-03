'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const MENU_ITEMS = [
  { name: '컬렉션', path: '/' },
  { name: '도감', path: '/archive' },
  { name: '모의 편성', path: '/formation' },
  { name: '조합 추천', path: '/raids' },
  { name: '가챠 시뮬레이터', path: '/gacha' },
  { name: '육성 플래너', path: '/planner' },
  { name: '청휘석 계산기', path: '/pyroxene' },
  { name: '선물 도감', path: '/gifts' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <aside className="w-64 h-screen fixed top-0 left-0 bg-[var(--plana-bg-panel)] border-r border-[var(--plana-border)] flex flex-col pt-12 pb-8 z-40 shadow-[4px_0_15px_rgba(188,163,240,0.1)] backdrop-blur-md">
      <div className="px-8 mb-12">
        <Link href="/" className="group block">
            <img src="/images/logo.png" alt="PLANA.AI Logo" className="w-[115%] max-w-none h-auto -ml-1 object-contain object-left" />
        </Link>
      </div>

      <nav className="flex-1 flex flex-col gap-4 px-4">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`
                relative h-12 flex items-center px-6 transition-all duration-300 clip-diagonal
                ${isActive 
                  ? 'bg-[var(--plana-primary-light)] text-[var(--plana-text-main)] font-bold shadow-[inset_4px_0_0_var(--plana-accent)]' 
                  : 'bg-white text-[var(--plana-text-muted)] hover:bg-[var(--plana-primary-light)] hover:text-[var(--plana-text-main)]'}
              `}
            >
              <span className="relative z-10 text-[15px] tracking-wide">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-6 mt-auto">
        <div className="w-full h-px bg-[var(--plana-border)] mb-6"></div>
        {isAuthenticated ? (
          <div className="flex flex-col gap-3 px-2">
            <Link href="/account" className="text-sm font-semibold text-[var(--plana-primary-dark)] hover:text-[var(--plana-accent)] transition-colors">
              {user?.nickname || user?.username}님
            </Link>
            <button 
              onClick={logout} 
              className="text-sm font-bold text-[#FF6B6B] hover:text-[#FF8787] transition-colors text-left"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <Link href={`/login?redirect=${pathname}`} className="text-sm font-bold text-[var(--plana-primary-dark)] hover:text-[var(--plana-accent)] transition-colors px-2">
            로그인
          </Link>
        )}
      </div>
    </aside>
  );
}
