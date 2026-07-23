'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { Ban, ShieldAlert } from 'lucide-react';

interface ShadowbannedUser {
  id: number;
  uid: number;
  username: string;
  nickname: string | null;
  createdAt: string;
}

export default function ShadowbanAdminPage() {
  const [users, setUsers] = useState<ShadowbannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    if (!user || user.role !== 'ADMIN') {
      alert('관리자 권한이 필요합니다.');
      router.push('/');
      return;
    }

    async function loadData() {
      try {
        const res = await api.get('/auth/admin/shadowbanned');
        if (res.data.status === 'success') {
          setUsers(res.data.users);
        }
      } catch (error) {
        console.error('Failed to load shadowbanned users:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, router]);

  const handleUnban = async (userId: number, username: string) => {
    if (!confirm(`정말 ${username} 유저의 쉐도우밴을 해제하시겠습니까?`)) return;
    
    try {
      const res = await api.put(`/auth/admin/shadowban/${userId}/unban`);
      if (res.data.status === 'success') {
        alert('해제되었습니다.');
        setUsers(users.filter(u => u.id !== userId));
      }
    } catch (error) {
      console.error('Failed to unban user:', error);
      alert('해제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-[var(--plana-primary)] rounded-full animate-spin"></div>
        <p className="mt-4 text-[var(--plana-primary)] font-bold animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="text-red-500 w-8 h-8" />
        <h1 className="text-2xl font-black text-slate-800">쉐도우밴 유저 목록</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="p-4 font-bold text-sm">ID (DB)</th>
                <th className="p-4 font-bold text-sm">UID (Game)</th>
                <th className="p-4 font-bold text-sm">아이디</th>
                <th className="p-4 font-bold text-sm">닉네임</th>
                <th className="p-4 font-bold text-sm">가입일</th>
                <th className="p-4 font-bold text-sm">관리</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                    쉐도우밴된 유저가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm text-slate-700">{u.id}</td>
                    <td className="p-4 text-sm text-slate-700 font-mono">{u.uid}</td>
                    <td className="p-4 text-sm text-slate-700 font-medium">{u.username}</td>
                    <td className="p-4 text-sm text-slate-700">{u.nickname || '-'}</td>
                    <td className="p-4 text-sm text-slate-500">
                      {new Date(u.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm">
                      <button 
                        onClick={() => handleUnban(u.id, u.username)}
                        className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded font-bold text-xs transition-colors"
                      >
                        해제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
