import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../../constants';
import type { ArchiveData } from '../../types';

interface HofEntry {
  id: number;
  studentId: number;
  achievement: string | null;
  isVisible: boolean;
  createdAt: string;
  student: {
    id: number;
    name: string;
    imagePath: string | null;
  };
}

interface HallOfFameAdminManagerProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  data: ArchiveData[]; // Master data students
}

export function HallOfFameAdminManager({ showToast, data }: HallOfFameAdminManagerProps) {
  const [entries, setEntries] = useState<HofEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [achievementInput, setAchievementInput] = useState('');

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/hof/admin`);
      setEntries(res.data);
    } catch (err) {
      showToast('목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleAdd = async () => {
    if (!selectedStudentId) return;
    try {
      await axios.post(`${API}/api/hof/admin`, {
        studentId: Number(selectedStudentId),
        achievement: achievementInput,
        isVisible: false,
      });
      showToast('추가되었습니다.');
      setSelectedStudentId('');
      setAchievementInput('');
      fetchEntries();
    } catch (err) {
      showToast('추가 실패', 'error');
    }
  };

  const handleToggleVisible = async (id: number, currentVisible: boolean) => {
    try {
      await axios.put(`${API}/api/hof/admin/${id}`, {
        isVisible: !currentVisible,
      });
      showToast('상태가 변경되었습니다.');
      fetchEntries();
    } catch (err) {
      showToast('변경 실패', 'error');
    }
  };

  const handleUpdateAchievement = async (id: number, achievement: string) => {
    try {
      await axios.put(`${API}/api/hof/admin/${id}`, {
        achievement,
      });
      showToast('사유가 수정되었습니다.');
      fetchEntries();
    } catch (err) {
      showToast('수정 실패', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API}/api/hof/admin/${id}`);
      showToast('삭제되었습니다.');
      fetchEntries();
    } catch (err) {
      showToast('삭제 실패', 'error');
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700/50">
      <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">명예의 전당 관리</h2>
      
      <div className="flex flex-wrap gap-4 mb-8 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-slate-400 mb-1">학생 선택</label>
          <select
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">학생을 선택하세요...</option>
            {data.map(student => (
              <option key={student.master.id} value={student.master.id}>
                {student.master.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-[2] min-w-[300px]">
          <label className="block text-sm text-slate-400 mb-1">등재 사유 (선택)</label>
          <input
            type="text"
            value={achievementInput}
            onChange={e => setAchievementInput(e.target.value)}
            placeholder="예: 2024년 1학기 총력전 최우수..."
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleAdd}
            disabled={!selectedStudentId}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            추가 (Draft)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-700/50 text-slate-300 text-sm border-b border-slate-600">
              <th className="p-4 font-semibold rounded-tl-lg">캐릭터</th>
              <th className="p-4 font-semibold">등재 사유</th>
              <th className="p-4 font-semibold">등재일</th>
              <th className="p-4 font-semibold text-center">상태</th>
              <th className="p-4 font-semibold text-center rounded-tr-lg">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && entries.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">로딩 중...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">등록된 항목이 없습니다.</td></tr>
            ) : (
              entries.map(entry => (
                <tr key={entry.id} className="border-b border-slate-700/50 hover:bg-slate-750 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={`https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/images/student/icon/${entry.student.id}.webp`} alt={entry.student.name} className="w-10 h-10 rounded bg-slate-800 object-cover" onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/images/student/icon/10000.webp'; }} />
                      <span className="font-medium text-slate-200">{entry.student.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <input 
                      type="text" 
                      defaultValue={entry.achievement || ''} 
                      onBlur={e => {
                        if (e.target.value !== entry.achievement) {
                          handleUpdateAchievement(entry.id, e.target.value);
                        }
                      }}
                      className="w-full bg-slate-800/50 border border-transparent focus:border-slate-500 rounded px-2 py-1 text-slate-300" 
                      placeholder="사유 입력..." 
                    />
                  </td>
                  <td className="p-4 text-sm text-slate-400">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleVisible(entry.id, entry.isVisible)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${entry.isVisible ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'}`}
                    >
                      {entry.isVisible ? '노출됨' : '숨김'}
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleDelete(entry.id)} className="text-red-400 hover:text-red-300 text-sm font-medium">
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
