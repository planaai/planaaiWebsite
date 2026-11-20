'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, KeyRound, Save, Loader2, Check, MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { updateProfile } from '@/lib/api';

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, updateNickname } = useAuthStore();
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          await useAuthStore.getState().checkAuth();
          if (!useAuthStore.getState().isAuthenticated) {
            router.replace('/login');
          }
        } else {
          router.replace('/login');
        }
      }
      setIsChecking(false);
    };
    init();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || user.username || '');
    }
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setErrorMsg('닉네임을 입력해주세요.');
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      await updateProfile(nickname);
      updateNickname(nickname);
      setSuccessMsg('닉네임이 성공적으로 변경되었습니다!');
      successTimerRef.current = setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setErrorMsg(err.response?.data?.error || '닉네임 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-[var(--plana-primary)] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-[var(--plana-primary)] rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(255,105,180,0.3)]">
            <User size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">계정 정보</h1>
          <p className="text-slate-500 mt-2">내 프로필과 공유용 고유 번호를 관리하세요.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <KeyRound size={120} />
          </div>
          
          <div className="mb-6 relative z-10">
            <p className="text-sm text-slate-500 mb-1">고유 식별자 (UID)</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black text-[var(--plana-primary)] tracking-wider">
                #{user.uid}
              </span>
            </div>
          </div>

          <div className="mb-6 relative z-10">
            <p className="text-sm text-slate-500 mb-1">로그인 아이디</p>
            <p className="text-lg font-medium text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              {user.username}
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">프로필 수정</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-slate-500 mb-1.5">
                표시될 닉네임
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="새로운 닉네임을 입력하세요"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-sm flex items-center gap-2">
                <Check size={16} /> {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || nickname.trim() === (user.nickname || user.username)}
              className="w-full bg-[var(--plana-primary)] hover:bg-[var(--plana-primary-dark)] text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              변경사항 저장
            </button>
          </div>
        </form>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-slate-800 mb-4">문의사항</h2>
          <div className="flex flex-col gap-3">
            <Link href="/inquiries" className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-pink-50 hover:border-pink-200 hover:text-[var(--plana-primary)] transition-all group cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200 group-hover:border-pink-200 shadow-sm">
                  <MessageSquare size={20} className="text-slate-500 group-hover:text-[var(--plana-primary)] transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 group-hover:text-[var(--plana-primary)] transition-colors m-0 leading-none">문의사항</h3>
                  <p className="text-sm text-slate-500 mt-1 mb-0 leading-none">버그 제보, 건의사항, 리소스 지원</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
