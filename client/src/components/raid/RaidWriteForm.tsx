"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useFormationStore } from '@/store/formationStore';
import { Loader2, ArrowLeft, Upload, Users, X, Trash2 } from 'lucide-react';
import raidData from '@/data/raids.json';
import type { StudentMaster } from '@/types';
import type { SubParty } from '@/types/raid';

interface Props {
  masterData: StudentMaster[];
}

export function RaidWriteForm({ masterData }: Props) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { teams } = useFormationStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    bossId: raidData.bosses[0].id,
    terrain: 'Urban',
    difficulty: 'Insane',
    tags: '',
    tactics: '',
    clearTime: ''
  });

  const [parties, setParties] = useState<SubParty[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const openImportModal = () => {
    if (teams.length === 0) {
      alert("모의 편성에 구성된 부대가 없습니다.");
      return;
    }
    // 기본적으로 모두 선택된 상태로 띄움
    setSelectedTeamIds(teams.map(t => t.id));
    setIsImportModalOpen(true);
  };

  const toggleTeamSelect = (id: string) => {
    setSelectedTeamIds(prev => 
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const confirmImport = () => {
    const selectedTeams = teams.filter(t => selectedTeamIds.includes(t.id));
    const importedParties = selectedTeams.map((team, idx) => ({
      name: team.name || `${idx + 1}파티`,
      strikers: team.strikers,
      specials: team.specials
    }));
    setParties(importedParties);
    setIsImportModalOpen(false);
  };

  const removeParty = (index: number) => {
    setParties(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError('로그인이 필요합니다.');
      return;
    }
    if (parties.length === 0) {
      setError('최소 1개 이상의 파티가 구성되어야 합니다. 모의 편성에서 불러오기를 사용해주세요.');
      return;
    }
    if (!imageFile) {
      setError('대미지 인증 이미지를 반드시 첨부해야 합니다.');
      return;
    }

    setLoading(true);
    setError(null);

    const tagsArray = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => t.startsWith('#') ? t : `#${t}`);

    const payload = new FormData();
    payload.append('name', formData.name);
    payload.append('bossId', formData.bossId);
    payload.append('terrain', formData.terrain);
    payload.append('difficulty', formData.difficulty);
    payload.append('tactics', formData.tactics);
    payload.append('clearTime', formData.clearTime);
    payload.append('tags', JSON.stringify(tagsArray));
    payload.append('parties', JSON.stringify(parties));
    payload.append('image', imageFile);

    try {
      await api.post('/raids/parties', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('성공적으로 공략이 등록되었습니다!');
      router.push('/raids');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || '업로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getStudent = (id: number | null) => {
    if (!id) return null;
    return masterData.find(s => s.id === id) || null;
  };

  const renderStudentIcon = (id: number | null, index: number, type: 'striker'|'special') => {
    const student = getStudent(id);
    return (
      <div 
        key={`${type}-${index}`} 
        className="w-10 h-10 rounded-full bg-[#1C2532] border border-[#4A5568] flex items-center justify-center overflow-hidden flex-shrink-0 relative"
      >
        {student && student.portraitUrls?.[0] ? (
          <img src={student.portraitUrls[0]} alt={student.name} className="w-full h-full object-cover scale-[1.3] pt-1.5" />
        ) : (
          <span className="text-[10px] text-gray-500">Empty</span>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 h-full overflow-y-auto">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-white">✍️ 공략 작성하기</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#1a202c] border border-[#2D3748] rounded-xl p-6 shadow-xl flex flex-col gap-6">
        {error && <div className="p-4 bg-red-900/50 text-red-300 border border-red-700 rounded-lg">{error}</div>}

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">파티/공략 이름 *</label>
            <input 
              required 
              type="text" 
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="예: 마키 메인 방깎 1파티"
              className="w-full bg-[#0F172A] border border-[#2D3748] rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">보스 *</label>
              <select name="bossId" value={formData.bossId} onChange={handleChange} className="w-full bg-[#0F172A] border border-[#2D3748] rounded-lg p-3 text-white focus:outline-none focus:border-blue-500">
                {raidData.bosses.map(boss => (
                  <option key={boss.id} value={boss.id}>{boss.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">지형 *</label>
              <select name="terrain" value={formData.terrain} onChange={handleChange} className="w-full bg-[#0F172A] border border-[#2D3748] rounded-lg p-3 text-white focus:outline-none focus:border-blue-500">
                <option value="Urban">시가전 (Urban)</option>
                <option value="Outdoor">야전 (Outdoor)</option>
                <option value="Indoor">실내전 (Indoor)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">난이도 *</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange} className="w-full bg-[#0F172A] border border-[#2D3748] rounded-lg p-3 text-white focus:outline-none focus:border-blue-500">
                <option value="Hardcore">Hardcore</option>
                <option value="Extreme">Extreme</option>
                <option value="Insane">Insane</option>
                <option value="Torment">Torment</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-[#2D3748] pt-6">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-semibold text-gray-300">사용 부대 (파티) *</label>
            <button 
              type="button" 
              onClick={openImportModal}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-sm shadow-md transition-all font-bold"
            >
              <Users size={16} />
              <span>모의 편성에서 불러오기</span>
            </button>
          </div>

          {parties.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-[#2D3748] rounded-xl text-center text-gray-500">
              우측 상단의 <b>불러오기 버튼</b>을 눌러 모의 편성에 구성된 덱을 가져오세요.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {parties.map((p, pIdx) => (
                <div key={pIdx} className="bg-[#1C2532] p-4 rounded-lg border border-[#2D3748] flex flex-col gap-2 relative">
                  <button 
                    type="button" 
                    onClick={() => removeParty(pIdx)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="font-bold text-gray-200 pr-8">{p.name}</div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400 w-12 text-right">Striker</span>
                    <div className="flex gap-2">{p.strikers.map((id, idx) => renderStudentIcon(id, idx, 'striker'))}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400 w-12 text-right">Special</span>
                    <div className="flex gap-2">{p.specials.map((id, idx) => renderStudentIcon(id, idx, 'special'))}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#2D3748] pt-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">인증 이미지 (필수) *</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-[#4A5568] rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-blue-500 transition-colors bg-[#0F172A]"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="max-h-[300px] object-contain rounded" />
              ) : (
                <>
                  <Upload size={32} className="text-gray-500" />
                  <span className="text-gray-400">클릭하여 이미지 파일 첨부 (최대 10MB)</span>
                </>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">택틱 요약 *</label>
            <textarea 
              required
              name="tactics"
              value={formData.tactics}
              onChange={handleChange}
              rows={4}
              placeholder="스킬 사용 순서나 주의사항 등을 적어주세요."
              className="w-full bg-[#0F172A] border border-[#2D3748] rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">태그 (쉼표로 구분)</label>
              <input 
                type="text" 
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="예: 1파티클, 고점픽, 대여필수"
                className="w-full bg-[#0F172A] border border-[#2D3748] rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">예상 클리어 타임 (선택)</label>
              <input 
                type="text" 
                name="clearTime"
                value={formData.clearTime}
                onChange={handleChange}
                placeholder="예: 03:15.300 또는 설거지"
                className="w-full bg-[#0F172A] border border-[#2D3748] rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3 pt-4">
          <button 
            type="submit" 
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg disabled:opacity-50 flex items-center justify-center min-w-[150px] transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '공략 공유하기'}
          </button>
        </div>
      </form>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1C2532] border border-[#2D3748] rounded-xl w-full max-w-sm flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-[#2D3748]">
              <h2 className="text-lg font-bold text-white">불러올 부대 선택</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
              {teams.map((team, idx) => (
                <label key={team.id} className="flex items-center gap-3 p-3 bg-[#0F172A] border border-[#2D3748] rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedTeamIds.includes(team.id)} 
                    onChange={() => toggleTeamSelect(team.id)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 focus:ring-2 bg-gray-700 border-gray-600"
                  />
                  <span className="text-gray-200 font-medium">{team.name || `${idx + 1}파티`}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-[#2D3748] flex justify-end gap-3">
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-gray-400 hover:text-white font-semibold transition-colors"
              >
                취소
              </button>
              <button 
                onClick={confirmImport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow transition-colors"
              >
                가져오기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
