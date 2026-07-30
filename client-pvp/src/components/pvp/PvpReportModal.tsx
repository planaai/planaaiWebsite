import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  partyId: number | string;
  partyName: string;
  onClose: () => void;
}

export function PvpReportModal({ partyId, partyName, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = [
    { id: 'SPAM', label: '스팸 및 상업적 홍보' },
    { id: 'ABUSE', label: '욕설, 비방, 혐오 표현' },
    { id: 'FAKE_INFO', label: '허위 정보 및 악의적인 낚시성 공략' },
    { id: 'FLOODING', label: '무의미한 도배성 게시물' },
    { id: 'OTHER', label: '기타' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error('신고 사유를 선택해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post(`/pvp/parties/${partyId}/reports`, {
        reason,
        description
      });
      if (res.data.success) {
        toast.success(res.data.message || '신고가 정상적으로 접수되었습니다.');
        onClose();
      } else {
        toast.error(res.data.error || '신고 접수에 실패했습니다.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || '신고 접수 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-bold text-gray-900">공략 신고하기</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <span className="text-xs text-gray-500 font-bold mb-1 block">신고 대상</span>
            <div className="font-bold text-gray-800 line-clamp-1">{partyName}</div>
          </div>
          
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-bold text-gray-700">신고 사유 (필수)</label>
            <div className="flex flex-col gap-2 mt-1">
              {reasons.map(r => (
                <label key={r.id} className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${reason === r.id ? 'border-red-500 bg-red-500' : 'border-gray-300 group-hover:border-red-400'}`}>
                    {reason === r.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <input 
                    type="radio" 
                    name="reportReason" 
                    className="hidden" 
                    value={r.id}
                    checked={reason === r.id}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <span className={`text-sm ${reason === r.id ? 'text-gray-900 font-bold' : 'text-gray-600'}`}>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-bold text-gray-700">상세 내용 (선택)</label>
            <textarea
              className="w-full h-24 p-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              placeholder="신고 사유에 대한 상세한 내용을 입력해주세요. (최대 300자)"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button 
              type="submit"
              disabled={isSubmitting || !reason}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 disabled:bg-red-300 transition-colors"
            >
              {isSubmitting ? '처리 중...' : '신고 접수'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
