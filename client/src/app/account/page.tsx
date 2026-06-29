'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, KeyRound, Save, Loader2, Check } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { updateProfile } from '@/lib/api';

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, updateNickname } = useAuthStore();
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user) {
      setNickname(user.nickname || user.username || '');
    }
  }, [isAuthenticated, user, router]);

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
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || '닉네임 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

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
            <p className="text-xs text-slate-400 mt-2">
              이 번호는 회원님의 컬렉션을 다른 사람에게 공유할 때 사용되는 고유 번호입니다.
            </p>
          </div>

          <div className="mb-6 relative z-10">
            <p className="text-sm text-slate-500 mb-1">로그인 아이디</p>
            <p className="text-lg font-medium text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              {user.username}
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg">
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
                className="w-full bg-slate-50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
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
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              변경사항 저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
