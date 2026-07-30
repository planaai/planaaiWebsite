import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { API } from '../../constants';

interface UserInfo {
  id: number;
  username: string;
  nickname: string | null;
  penaltyStatus?: string;
  bannedUntil?: string;
}

interface RaidInfo {
  id: number;
  name: string;
  isBlinded: boolean;
  shortCode: string | null;
  mode: string;
  bossId: string;
  difficulty: string;
}

interface Report {
  id: number;
  reporterId: number;
  reportedRaidId: number;
  reportedUserId: number;
  reason: string;
  description: string | null;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED';
  createdAt: string;
  reporter: UserInfo;
  reportedUser: UserInfo;
  reportedRaid: RaidInfo;
}

export const ReportAdminManager: React.FC<{ showToast: (msg: string, type: 'success' | 'error') => void }> = ({ showToast }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'PENDING' | 'REVIEWED' | 'RESOLVED' | ''>('PENDING');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/raids/admin/reports`, {
        params: { status: filterStatus || undefined, page, limit: 20 }
      });
      setReports(res.data.reports);
      setTotalPages(res.data.pagination.totalPages || 1);
    } catch (err: any) {
      showToast('신고 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterStatus, page]);

  const handleAction = async (id: number, status: string, action: string, penaltyDays?: number) => {
    try {
      setProcessingId(id);
      await axios.put(`${API}/api/raids/admin/reports/${id}`, {
        status,
        action,
        penaltyDays
      });
      showToast('처리되었습니다.', 'success');
      fetchReports();
    } catch (err: any) {
      showToast(err.response?.data?.error || '처리 실패', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="h-[calc(100vh-180px)] bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700/50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-800 flex justify-between items-center shrink-0">
        <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
          <ShieldAlert className="text-red-400" /> 공략 신고 관리
        </h2>
        <div className="flex gap-2">
          <select 
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as any); setPage(1); }}
            className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none"
          >
            <option value="">전체 상태</option>
            <option value="PENDING">대기중 (PENDING)</option>
            <option value="REVIEWED">확인됨 (REVIEWED)</option>
            <option value="RESOLVED">처리완료 (RESOLVED)</option>
          </select>
          <button 
            onClick={fetchReports}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 flex items-center gap-2"
          >
            <RefreshCw size={16} /> 새로고침
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-slate-500 my-10 animate-pulse">로딩 중...</p>
        ) : reports.length === 0 ? (
          <p className="text-center text-slate-500 my-10">신고 내역이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                        report.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                        report.status === 'REVIEWED' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {report.status}
                      </span>
                      <span className="text-slate-400 text-xs">
                        {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-red-400 font-bold">사유: {report.reason}</h3>
                    {report.description && (
                      <p className="text-slate-300 text-sm mt-1 p-2 bg-slate-800 rounded border border-slate-700">
                        {report.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-slate-400">신고자: <span className="text-slate-200">{report.reporter?.nickname || report.reporter?.username}</span></p>
                    <p className="text-slate-400 mt-1">
                      대상 유저: <span className="text-slate-200">{report.reportedUser?.nickname || report.reportedUser?.username}</span>
                    </p>
                    {report.reportedUser?.penaltyStatus && report.reportedUser.penaltyStatus !== 'NONE' && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-900/50 text-red-300 text-xs rounded border border-red-800">
                        상태: {report.reportedUser.penaltyStatus}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center justify-between border-t border-slate-700/50 pt-3 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">대상 공략:</span>
                    <a 
                      href={`https://plana.ai/raids/${report.reportedRaid?.shortCode || report.reportedRaid?.id}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-blue-400 text-sm hover:underline font-bold"
                    >
                      {report.reportedRaid?.name} {report.reportedRaid?.isBlinded && '(블라인드 됨)'}
                    </a>
                  </div>

                  <div className="flex gap-2">
                    {report.status !== 'RESOLVED' && (
                      <>
                        <button
                          onClick={() => handleAction(report.id, 'RESOLVED', 'none')}
                          disabled={processingId === report.id}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                        >
                          반려 (이상없음)
                        </button>
                        <button
                          onClick={() => handleAction(report.id, 'RESOLVED', 'blind')}
                          disabled={processingId === report.id}
                          className="px-3 py-1.5 bg-yellow-600/80 hover:bg-yellow-500 text-white text-sm rounded-lg transition-colors"
                        >
                          게시글 블라인드
                        </button>
                        <button
                          onClick={() => handleAction(report.id, 'RESOLVED', 'ban_temp', 7)}
                          disabled={processingId === report.id}
                          className="px-3 py-1.5 bg-orange-600/80 hover:bg-orange-500 text-white text-sm rounded-lg transition-colors"
                        >
                          7일 정지
                        </button>
                        <button
                          onClick={() => {
                            if(confirm('이 유저를 영구 정지(IP 밴)하시겠습니까?')) {
                              handleAction(report.id, 'RESOLVED', 'ban_permanent');
                            }
                          }}
                          disabled={processingId === report.id}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors font-bold"
                        >
                          영구 정지 (IP 밴)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                  page === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
