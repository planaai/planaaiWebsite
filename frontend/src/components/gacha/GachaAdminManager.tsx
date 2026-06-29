import { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, Trash2, Plus, DownloadCloud, Tags } from 'lucide-react';
import { API } from '../../constants';

interface GachaAdminManagerProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function GachaAdminManager({ showToast }: GachaAdminManagerProps) {
  const [urls, setUrls] = useState<string[]>(['']);
  const [activeBanners, setActiveBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API}/api/master/gacha/status`);
      if (res.data) {
        setActiveBanners(res.data.banners || []);
        if (res.data.urls && res.data.urls.length > 0) {
          setUrls(res.data.urls);
        }
      }
    } catch (err) {
      console.error('Failed to fetch gacha status', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleAddUrl = () => setUrls([...urls, '']);
  
  const handleRemoveUrl = (index: number) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index));
    }
  };

  const handleChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const handleSubmit = async () => {
    const validUrls = urls.filter(u => u.trim() !== '');
    if (validUrls.length === 0) {
      showToast('최소 한 개의 URL을 입력해주세요. (모두 지우면 픽업이 초기화됩니다)', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API}/api/master/gacha/update`, { urls: validUrls });
      if (res.data.status === 'success') {
        showToast('가챠 확률표가 성공적으로 업데이트되었습니다.');
        fetchStatus();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || err.message || '업데이트에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 shadow-xl overflow-hidden p-6 max-w-4xl mx-auto mt-8">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
          <Sparkles className="text-white" size={20} />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">가챠 시뮬레이션 확률표 유지보수</h2>
          <p className="text-sm text-slate-400 mt-1">
            넥슨 공식 확률표 링크를 입력하여 시뮬레이터의 픽업 배너를 갱신합니다. 여러 개의 링크를 추가하면 다중 픽업 배너가 생성됩니다.
          </p>
        </div>
      </div>

      {activeBanners.length > 0 && (
        <div className="mb-6 bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Tags size={16} className="text-purple-400" /> 현재 적용된 픽업 배너 목록
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeBanners.map((b, i) => (
              <div key={i} className="bg-slate-700/50 text-slate-200 px-3 py-1.5 rounded-full text-sm font-medium border border-slate-600 shadow-inner">
                {b.name}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            * 픽업 배너를 삭제하시려면 아래의 해당 URL 항목 우측의 쓰레기통 버튼을 누른 뒤 [적용]을 누르세요.
          </p>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {urls.map((url, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
            <span className="w-8 text-center text-xs font-bold text-slate-500">{idx + 1}</span>
            <input
              type="text"
              placeholder="https://forum.nexon.com/bluearchive/..."
              value={url}
              onChange={(e) => handleChange(idx, e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <button
              onClick={() => handleRemoveUrl(idx)}
              disabled={urls.length === 1 && urls[0] === ''}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="URL 삭제"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleAddUrl}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-300 rounded-lg font-bold hover:bg-slate-700 transition-colors border border-slate-700 hover:text-white"
        >
          <Plus size={18} /> 링크 추가
        </button>
        
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/25"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <DownloadCloud size={18} />
          )}
          <span>{loading ? '업데이트 진행 중...' : '확률표 데이터 적용 (가챠 시뮬레이터 서버 업데이트)'}</span>
        </button>
      </div>
    </div>
  );
}
