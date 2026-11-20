import { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../../constants';
import { ShieldAlert } from 'lucide-react';

interface ShadowbannedUser {
  id: number;
  uid: number;
  username: string;
  nickname: string | null;
  createdAt: string;
}

interface Props {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function ShadowbanAdminManager({ showToast }: Props) {
  const [users, setUsers] = useState<ShadowbannedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/auth/admin/shadowbanned`);
      if (res.data.status === 'success') {
        setUsers(res.data.users);
      }
    } catch (error) {
      console.error('Failed to load shadowbanned users:', error);
      showToast('쉐도우밴 유저 목록을 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (userId: number, username: string) => {
    if (!confirm(`정말 ${username} 유저의 쉐도우밴을 해제하시겠습니까?`)) return;
    
    try {
      const res = await axios.put(`${API}/api/auth/admin/shadowban/${userId}/unban`);
      if (res.data.status === 'success') {
        showToast('해제되었습니다.');
        setUsers(users.filter(u => u.id !== userId));
      }
    } catch (error) {
      console.error('Failed to unban user:', error);
      showToast('해제 중 오류가 발생했습니다.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="w-12 h-12 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-red-400 font-bold animate-pulse">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="text-red-500 w-8 h-8" />
        <h2 className="text-2xl font-black text-white">쉐도우밴 유저 목록</h2>
      </div>

      <div className="bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700 text-slate-300">
                <th className="p-4 font-bold text-sm">ID (DB)</th>
                <th className="p-4 font-bold text-sm">UID (Game)</th>
                <th className="p-4 font-bold text-sm">아이디</th>
                <th className="p-4 font-bold text-sm">닉네임</th>
                <th className="p-4 font-bold text-sm">가입일</th>
                <th className="p-4 font-bold text-sm text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    쉐도우밴된 유저가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 text-sm text-slate-300">{u.id}</td>
                    <td className="p-4 text-sm text-slate-300 font-mono">{u.uid}</td>
                    <td className="p-4 text-sm text-slate-200 font-medium">{u.username}</td>
                    <td className="p-4 text-sm text-slate-300">{u.nickname || '-'}</td>
                    <td className="p-4 text-sm text-slate-400">
                      {new Date(u.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm text-center">
                      <button 
                        onClick={() => handleUnban(u.id, u.username)}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 rounded-lg font-bold text-xs transition-colors"
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
