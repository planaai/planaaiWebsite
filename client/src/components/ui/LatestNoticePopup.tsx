'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { Bell, X, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

interface NoticeSummary {
  id: number;
  title: string;
  category: 'UPDATE' | 'EVENT' | 'GENERAL';
  createdAt: string;
}

const DISMISSED_NOTICE_STORAGE_KEY = 'plana_dismissed_notice_id';
const RECHECK_INTERVAL_MS = 5 * 60 * 1000;
const HIDDEN_PATHS = ['/notices/write', '/notices/edit'];

function getDismissedNoticeId(): number | null {
  try {
    const raw = localStorage.getItem(DISMISSED_NOTICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function setDismissedNoticeId(id: number): void {
  try {
    localStorage.setItem(DISMISSED_NOTICE_STORAGE_KEY, String(id));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

function getCategoryBadge(category: NoticeSummary['category']) {
  switch (category) {
    case 'UPDATE':
      return {
        label: '업데이트',
        className: 'bg-sky-500/10 text-sky-600 border border-sky-500/20',
      };
    case 'EVENT':
      return {
        label: '이벤트',
        className: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
      };
    default:
      return {
        label: '일반',
        className: 'bg-slate-500/10 text-slate-600 border border-slate-500/20',
      };
  }
}

export function LatestNoticePopup() {
  const pathname = usePathname();
  const [notice, setNotice] = useState<NoticeSummary | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const lastCheckedRef = useRef<number>(0);

  const isHiddenRoute = HIDDEN_PATHS.some((path) => pathname?.startsWith(path));

  const checkLatestNotice = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheckedRef.current < RECHECK_INTERVAL_MS) {
      return;
    }
    lastCheckedRef.current = now;

    try {
      const res = await api.get('/notices', {
        params: { page: 1, limit: 1 },
      });
      const latest: NoticeSummary | undefined = res.data?.notices?.[0];
      if (!latest || typeof latest.id !== 'number') return;

      const dismissedId = getDismissedNoticeId();
      if (dismissedId !== null && latest.id <= dismissedId) {
        return;
      }

      if (typeof window !== 'undefined' && pathname?.startsWith('/notices/detail')) {
        const currentId = new URLSearchParams(window.location.search).get('id');
        if (currentId === String(latest.id)) {
          setDismissedNoticeId(latest.id);
          return;
        }
      }

      setNotice(latest);
      requestAnimationFrame(() => setIsVisible(true));
    } catch {
      // Fail silently to avoid disrupting normal page usage
    }
  }, [pathname]);

  useEffect(() => {
    if (isHiddenRoute) {
      setIsVisible(false);
      return;
    }

    checkLatestNotice(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkLatestNotice(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isHiddenRoute, checkLatestNotice]);

  const handleDismiss = () => {
    if (notice) {
      setDismissedNoticeId(notice.id);
    }
    setIsVisible(false);
    setTimeout(() => setNotice(null), 200);
  };

  if (isHiddenRoute || !notice) return null;

  const badge = getCategoryBadge(notice.category);
  const topPositionClass = pathname === '/' ? 'top-4 sm:top-6' : 'top-[4.5rem]';

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="새 공지사항 알림"
      className={`fixed right-4 sm:right-6 ${topPositionClass} z-50 w-[calc(100vw-2rem)] sm:w-[360px] max-w-[380px] transition-all duration-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
        }`}
    >
      <div className="relative bg-white/90 backdrop-blur-md border border-slate-200/80 hover:border-sky-500/40 shadow-sm rounded-xl overflow-hidden transition-all duration-200">
        <div className="h-[2px] w-full bg-gradient-to-r from-rose-400 via-rose-400/70 to-sky-400/70" />

        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-50/90 border-b border-slate-200/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0" />
            <span className="inline-flex items-center px-2 py-0.5 rounded-xs bg-rose-400/15 text-rose-500 border border-rose-400/25 text-[10px] font-bold tracking-wider uppercase -skew-x-6 shrink-0">
              <span className="skew-x-6 inline-flex items-center gap-1">
                <Bell size={10} />
                NEW NOTICE
              </span>
            </span>
            <span className={`inline-flex px-1.5 py-0.5 rounded-xs text-[10px] font-bold tracking-wide whitespace-nowrap ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 tabular-nums">
              #{String(notice.id).padStart(3, '0')}
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="공지 알림 닫기"
              className="p-1 rounded-xs text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <Link
          href={`/notices/detail?id=${notice.id}`}
          onClick={handleDismiss}
          className="group block px-3.5 py-3 active:scale-[0.99] transition-all duration-200"
        >
          <p className="font-[family-name:var(--font-title-v)] text-[15px] font-bold tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors duration-200 line-clamp-2 leading-snug">
            {notice.title}
          </p>
          <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200/80 flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 tabular-nums">
              {format(new Date(notice.createdAt), 'yyyy.MM.dd')}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-sky-500 group-hover:text-sky-600 transition-colors duration-200">
              공지 확인하기
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform duration-200" />
            </span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
