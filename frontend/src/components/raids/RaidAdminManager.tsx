import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Target, Plus, Search, Image as ImageIcon } from 'lucide-react';
import { API } from '../../constants';
import { ImagePickerModal } from '../images/ImagePickerModal';

interface RaidBoss {
  id: string;
  name: string;
  iconUrl: string;
  bannerUrl?: string;
  defenseType: string;
  category: string;
}

interface RaidSeason {
  id: number;
  bossId: string;
  terrain: string;
  difficulty: string;
}

export const RaidAdminManager: React.FC<{ showToast: (msg: string, type: 'success' | 'error') => void }> = ({ showToast }) => {
  const [bosses, setBosses] = useState<RaidBoss[]>([]);
  const [seasons, setSeasons] = useState<RaidSeason[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedBossId, setSelectedBossId] = useState<string | null>(null);
  const [showAddBoss, setShowAddBoss] = useState(false);
  const [isEditingBoss, setIsEditingBoss] = useState(false);
  const [editingBossData, setEditingBossData] = useState({ id: '', name: '', iconUrl: '', bannerUrl: '', defenseType: '', category: '' });
  
  const [pickerTarget, setPickerTarget] = useState<'newIcon'|'newBanner'|'editIcon'|'editBanner'|null>(null);

  const [newBoss, setNewBoss] = useState({ id: '', name: '', iconUrl: '/images/boss/', bannerUrl: '/images/boss_banner/', defenseType: 'LightArmor', category: 'Assault' });
  const [newSeason, setNewSeason] = useState({ terrain: 'Urban' });

  const fetchMeta = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/raids/meta`);
      setBosses(res.data.bosses);
      setSeasons(res.data.seasons);
    } catch (error) {
      showToast('보스 데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  const handleAddBoss = async () => {
    if (!newBoss.id || !newBoss.name) {
      showToast('ID와 이름을 입력하세요.', 'error');
      return;
    }
    try {
      await axios.post(`${API}/api/raids/bosses`, newBoss);
      showToast('보스가 추가되었습니다.', 'success');
      setShowAddBoss(false);
      setNewBoss({ id: '', name: '', iconUrl: '/images/boss/', bannerUrl: '/images/boss_banner/', defenseType: 'LightArmor', category: 'Assault' });
      fetchMeta();
    } catch (err: any) {
      showToast(err.response?.data?.error || '보스 추가 실패', 'error');
    }
  };

  const handleUpdateBoss = async () => {
    try {
      await axios.put(`${API}/api/raids/bosses/${editingBossData.id}`, editingBossData);
      showToast('보스가 수정되었습니다.', 'success');
      setIsEditingBoss(false);
      fetchMeta();
    } catch (err: any) {
      showToast(err.response?.data?.error || '보스 수정 실패', 'error');
    }
  };

  const handleDeleteBoss = async () => {
    if (!selectedBossId) return;
    if (!confirm('정말 이 보스를 삭제하시겠습니까? 관련 데이터(시즌)가 함께 삭제될 수 있습니다.')) return;
    
    try {
      await axios.delete(`${API}/api/raids/bosses/${selectedBossId}`);
      showToast('보스가 삭제되었습니다.', 'success');
      setSelectedBossId(null);
      fetchMeta();
    } catch (err: any) {
      showToast(err.response?.data?.error || '보스 삭제 실패', 'error');
    }
  };

  const handleAddSeason = async () => {
    if (!selectedBossId) return;
    try {
      await axios.post(`${API}/api/raids/seasons`, {
        bossId: selectedBossId,
        terrain: newSeason.terrain
      });
      showToast('지형의 모든 난이도가 추가되었습니다.', 'success');
      fetchMeta();
    } catch (err: any) {
      showToast(err.response?.data?.error || '지형 추가 실패', 'error');
    }
  };

  const selectedBoss = bosses.find(b => b.id === selectedBossId);
  const bossSeasons = seasons.filter(s => s.bossId === selectedBossId);
  
  // Group by terrain for display
  const groupedSeasons = Array.from(new Set(bossSeasons.map(s => s.terrain)));

  return (
    <div className="flex h-[calc(100vh-180px)] gap-6">
      {/* Sidebar */}
      <div className="w-80 bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-700/50 bg-slate-800">
          <button 
            onClick={() => setShowAddBoss(true)}
            className="w-full py-2.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-blue-500/30 transition-colors"
          >
            <Plus size={16} /> 새 보스 추가
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <p className="text-slate-400 text-center mt-10 animate-pulse">로딩 중...</p>
          ) : bosses.map(boss => (
            <button
              key={boss.id}
              onClick={() => { setSelectedBossId(boss.id); setShowAddBoss(false); }}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex flex-col ${selectedBossId === boss.id && !showAddBoss ? 'bg-blue-600 shadow-lg shadow-blue-500/20 text-white' : 'hover:bg-slate-700/50 text-slate-300'}`}
            >
              <span className="font-bold">{boss.name}</span>
              <span className={`text-xs mt-1 ${selectedBossId === boss.id && !showAddBoss ? 'text-blue-100' : 'text-slate-500'}`}>{boss.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto">
        {showAddBoss ? (
          <div className="bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700/50 p-6">
            <h2 className="text-2xl font-black text-slate-100 mb-6 flex items-center gap-2">
              <Target className="text-blue-400" /> 새 보스 추가
            </h2>
            <div className="space-y-5 max-w-lg">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">ID (영문)</label>
                <input value={newBoss.id} onChange={e => setNewBoss({...newBoss, id: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none" placeholder="ex) binah" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">이름</label>
                <input value={newBoss.name} onChange={e => setNewBoss({...newBoss, name: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none" placeholder="ex) 비나 (Binah)" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">아이콘 URL</label>
                <div className="flex gap-2">
                  <input type="text" value={newBoss.iconUrl} onChange={e => setNewBoss({...newBoss, iconUrl: e.target.value})} className="flex-1 p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none" />
                  <button onClick={() => setPickerTarget('newIcon')} className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"><ImageIcon size={18} /></button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">배너 URL</label>
                <div className="flex gap-2">
                  <input type="text" value={newBoss.bannerUrl} onChange={e => setNewBoss({...newBoss, bannerUrl: e.target.value})} className="flex-1 p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none" />
                  <button onClick={() => setPickerTarget('newBanner')} className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"><ImageIcon size={18} /></button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">방어 타입</label>
                <select value={newBoss.defenseType} onChange={e => setNewBoss({...newBoss, defenseType: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none">
                  <option value="LightArmor">경장갑 (LightArmor)</option>
                  <option value="HeavyArmor">중장갑 (HeavyArmor)</option>
                  <option value="SpecialArmor">특수장갑 (SpecialArmor)</option>
                  <option value="ElasticArmor">탄력장갑 (ElasticArmor)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">보스 분류</label>
                <select value={newBoss.category} onChange={e => setNewBoss({...newBoss, category: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none">
                  <option value="Assault">총력전 / 대결전 (Assault)</option>
                  <option value="LimitBreak">제약해제결전 (LimitBreak)</option>
                </select>
              </div>
              <button onClick={handleAddBoss} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors mt-4 shadow-lg shadow-blue-500/20">저장하기</button>
            </div>
          </div>
        ) : selectedBoss ? (
          <div className="bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700/50 h-full overflow-y-auto">
            <div className="p-6 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-white">{selectedBoss.name}</h2>
                <p className="text-slate-400 mt-1">ID: {selectedBoss.id} | 속성: {selectedBoss.defenseType} | 분류: {selectedBoss.category === 'LimitBreak' ? '제약해제결전' : '총력/대결전'}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setEditingBossData({ ...selectedBoss, bannerUrl: selectedBoss.bannerUrl || '' });
                    setIsEditingBoss(true);
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                >
                  수정
                </button>
                <button 
                  onClick={handleDeleteBoss}
                  className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-200 rounded-lg text-sm transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>

            {isEditingBoss ? (
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-4">보스 정보 수정</h3>
                <div className="space-y-4 max-w-lg bg-slate-900/50 p-6 rounded-xl border border-slate-700/50">
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-1">이름</label>
                    <input value={editingBossData.name} onChange={e => setEditingBossData({...editingBossData, name: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-1">아이콘 URL</label>
                    <div className="flex gap-2">
                      <input type="text" value={editingBossData.iconUrl} onChange={e => setEditingBossData({...editingBossData, iconUrl: e.target.value})} className="flex-1 p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none" />
                      <button onClick={() => setPickerTarget('editIcon')} className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"><ImageIcon size={18} /></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-1">배너 URL</label>
                    <div className="flex gap-2">
                      <input type="text" value={editingBossData.bannerUrl} onChange={e => setEditingBossData({...editingBossData, bannerUrl: e.target.value})} className="flex-1 p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none" />
                      <button onClick={() => setPickerTarget('editBanner')} className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"><ImageIcon size={18} /></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-1">방어 타입</label>
                    <select value={editingBossData.defenseType} onChange={e => setEditingBossData({...editingBossData, defenseType: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none">
                      <option value="LightArmor">경장갑 (LightArmor)</option>
                      <option value="HeavyArmor">중장갑 (HeavyArmor)</option>
                      <option value="SpecialArmor">특수장갑 (SpecialArmor)</option>
                      <option value="ElasticArmor">탄력장갑 (ElasticArmor)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-1">보스 분류</label>
                    <select value={editingBossData.category} onChange={e => setEditingBossData({...editingBossData, category: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none">
                      <option value="Assault">총력전 / 대결전 (Assault)</option>
                      <option value="LimitBreak">제약해제결전 (LimitBreak)</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleUpdateBoss} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors">저장</button>
                    <button onClick={() => setIsEditingBoss(false)} className="flex-1 py-2.5 bg-slate-700 text-white font-bold rounded-lg hover:bg-slate-600 transition-colors">취소</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-4">현재 등록된 지형 (모든 난이도 포함)</h3>
              {groupedSeasons.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                  {groupedSeasons.map(terrain => (
                    <div key={terrain} className="p-3 border border-slate-700 rounded-lg bg-slate-900 flex justify-center items-center text-slate-300">
                      <span className="font-bold">{terrain}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 mb-8 p-4 bg-slate-900/50 rounded-lg border border-slate-800 text-center">등록된 지형 정보가 없습니다.</p>
              )}

              <h3 className="text-lg font-bold text-slate-200 mb-4 border-t border-slate-700/50 pt-6 flex items-center gap-2">
                <Plus size={18} className="text-blue-400"/> 새로운 지형 추가 (전체 난이도 일괄 추가)
              </h3>
              <div className="flex gap-4 items-end bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 max-w-lg">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-400 mb-2">지형</label>
                  <select 
                    value={newSeason.terrain}
                    onChange={e => setNewSeason({ terrain: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Urban">Urban (시가전)</option>
                    <option value="Outdoor">Outdoor (야전)</option>
                    <option value="Indoor">Indoor (실내전)</option>
                  </select>
                </div>
                <button 
                  onClick={handleAddSeason}
                  className="h-[46px] px-6 bg-blue-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
                >
                  <Plus size={16} /> 일괄 추가하기
                </button>
              </div>
            </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700/50 text-slate-500">
            <Search size={48} className="mb-4 opacity-30" />
            <p className="font-bold text-lg">왼쪽 목록에서 보스를 선택하거나 새 보스를 추가해주세요.</p>
          </div>
        )}
      </div>

      {pickerTarget && (
        <ImagePickerModal 
          onClose={() => setPickerTarget(null)}
          onSelect={(url) => {
            if (pickerTarget === 'newIcon') setNewBoss(p => ({ ...p, iconUrl: url }));
            else if (pickerTarget === 'newBanner') setNewBoss(p => ({ ...p, bannerUrl: url }));
            else if (pickerTarget === 'editIcon') setEditingBossData(p => ({ ...p, iconUrl: url }));
            else if (pickerTarget === 'editBanner') setEditingBossData(p => ({ ...p, bannerUrl: url }));
            setPickerTarget(null);
          }}
        />
      )}
    </div>
  );
};
