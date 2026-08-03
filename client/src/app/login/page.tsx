'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useArchiveStore } from '@/store/archiveStore';

function LoginContent() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const records = useArchiveStore((state) => state.records);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.data.status === 'success') {
        login(res.data.token, res.data.user);
        const redirect = searchParams.get('redirect') || '/';
        router.push(redirect);
      }
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setError(err.response?.data?.error || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-slate-200">
        <h2 className="text-2xl font-bold text-center text-slate-800">로그인</h2>
        {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded">{error}</div>}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-600">ID</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-md shadow-sm bg-white text-pink-500 focus:outline-none focus:ring-[var(--plana-primary)] focus:border-[var(--plana-primary)]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">비밀번호</label>
            <input
              type="password"
              required
              className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-md shadow-sm bg-white text-pink-500 focus:outline-none focus:ring-[var(--plana-primary)] focus:border-[var(--plana-primary)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 text-white bg-[var(--plana-primary)] rounded-md hover:bg-pink-400 focus:outline-none focus:ring-2 focus:ring-[var(--plana-primary)] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <div className="text-sm text-center text-slate-500">
          계정이 없으신가요? <Link href="/register" className="text-[var(--plana-primary)] hover:underline">회원가입</Link>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[70vh]">로딩중...</div>}>
      <LoginContent />
    </Suspense>
  );
}
