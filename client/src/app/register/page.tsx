'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReCAPTCHA from 'react-google-recaptcha';
import { api } from '@/lib/api';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  
  const router = useRouter();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!recaptchaToken) {
      setError('reCAPTCHA 인증을 완료해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.post('/auth/register', { username, password, recaptchaToken });
      if (res.data.status === 'success') {
        setSuccess('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
        redirectTimerRef.current = setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      setError(err.response?.data?.error || '회원가입에 실패했습니다.');
      // Reset reCAPTCHA on failure
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-slate-200">
        <h2 className="text-2xl font-bold text-center text-slate-800">회원가입</h2>
        {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded">{error}</div>}
        {success && <div className="p-3 text-sm text-emerald-500 bg-emerald-50 rounded">{success}</div>}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-600">ID</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-md shadow-sm bg-white text-slate-800 focus:outline-none focus:ring-[var(--plana-primary)] focus:border-[var(--plana-primary)]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">비밀번호</label>
            <input
              type="password"
              required
              className="w-full px-3 py-2 mt-1 border border-slate-300 rounded-md shadow-sm bg-white text-slate-800 focus:outline-none focus:ring-[var(--plana-primary)] focus:border-[var(--plana-primary)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <div className="flex justify-center my-4">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || 'dummy_site_key_for_dev'}
              onChange={(token) => setRecaptchaToken(token)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 text-white bg-[var(--plana-primary)] rounded-md hover:bg-pink-400 focus:outline-none focus:ring-2 focus:ring-[var(--plana-primary)] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50"
          >
            {isLoading ? '처리 중...' : '가입하기'}
          </button>
        </form>
        <div className="text-sm text-center text-slate-500">
          이미 계정이 있으신가요? <Link href="/login" className="text-[var(--plana-primary)] hover:underline">로그인</Link>
        </div>
      </div>
    </div>
  );
}
