import { useState } from 'react';
import axios from 'axios';
import { Users, Plus } from 'lucide-react';
import type { ArchiveData, SchemaConfig, StudentMaster } from '../../types';
import { API } from '../../constants';
import { MasterModal } from './MasterModal';
import { EnumManager } from '../enums/EnumManager';

interface MasterManagerProps {
  data: ArchiveData[];
  schema: SchemaConfig;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function MasterManager({ data, schema, onRefresh, showToast }: MasterManagerProps) {
  const [modal, setModal] = useState<{ student: Omit<StudentMaster, 'id'> & { id?: number }; isNew: boolean } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterAttack, setFilterAttack] = useState('');
  const [filterArmor, setFilterArmor] = useState('');

  const emptySkills = {
    ex: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
    normal: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
    passive: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
    sub: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
    normalPlus: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' },
    passivePlus: { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' }
  };

  const emptyStudent: Omit<StudentMaster, 'id'> = {
    name: '',
    school: schema.enums.School?.values?.[0]?.key || '',
    fieldType: schema.enums.FieldType?.values?.[0]?.key || 'Striker',
    Role: schema.enums.Role?.values?.[0]?.key || '',
    attackType: schema.enums.AttackType?.values?.[0]?.key || '',
    armorType: schema.enums.ArmorType?.values?.[0]?.key || '',
    weaponType: schema.enums.WeaponType?.values?.[0]?.key || '',
    position: schema.enums.Position?.values?.[0]?.key || '',
    starNum: 1,
    hasFavoriteItem: false,
    equipmentSlot1: schema.enums.EquipmentSlot1?.values?.[0]?.key || '',
    equipmentSlot2: schema.enums.EquipmentSlot2?.values?.[0]?.key || '',
    equipmentSlot3: schema.enums.EquipmentSlot3?.values?.[0]?.key || '',
    portraitUrl: '',
    fullIllustUrl: '',
    primaryOopart: '',
    secondaryOopart: '',
    terrainAffinity: { urban: 'B', outdoor: 'B', indoor: 'B' },
    uniqueWeaponEffects: { star2: '', star3: '', star4: '' },
    favoriteItemEffects: { t1: '', t2: '' },
    skills: emptySkills
  };

  const handleSave = async (student: Omit<StudentMaster, 'id'> & { id?: number }, isNew: boolean) => {
    try {
      if (isNew) await axios.post(`${API}/api/master/students`, student);
      else await axios.put(`${API}/api/master/students/${student.id}`, student);
      showToast(`${student.name} 마스터 데이터 저장 성공!`);
      setModal(null);
      onRefresh();
    } catch {
      showToast('오류 발생', 'error');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`정말 '${name}' 학생의 마스터 데이터와 연관된 아카이브 기록을 모두 삭제하시겠습니까?`)) return;
    try {
      await axios.delete(`${API}/api/master/students/${id}`);
      showToast(`${name} 데이터 삭제 완료`);
      onRefresh();
    } catch {
      showToast('삭제 실패', 'error');
    }
  };

  const filteredData = data.filter(({ master }) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = master.name.toLowerCase().includes(q);
      const matchesNum = master.studentNumber?.toString().includes(q);
      if (!matchesName && !matchesNum) return false;
    }
    if (filterSchool && master.school !== filterSchool) return false;
    if (filterRole && master.Role !== filterRole) return false;
    if (filterAttack && master.attackType !== filterAttack) return false;
    if (filterArmor && master.armorType !== filterArmor) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-slide-in">
      {modal && (
        <MasterModal
          student={modal.student}
          isNew={modal.isNew}
          schema={schema}
          onSave={d => handleSave(d, modal.isNew)}
          onClose={() => setModal(null)}
          showToast={showToast}
        />
      )}
      <div className="flex justify-between items-center bg-blue-900/20 p-5 rounded-xl border border-blue-500/20">
        <div>
          <h2 className="text-xl font-bold text-blue-300 flex items-center gap-2">
            <Users size={20} /> 서버 마스터 DB 관리
          </h2>
          <p className="text-sm text-blue-200/70 mt-1">
            학생들의 마스터 데이터를 등록하고 초상화, 고유 스킬을 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setModal({ student: emptyStudent, isNew: true })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg text-white"
        >
          <Plus size={18} /> 새 마스터 등록
        </button>
      </div>
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="p-4 border-b border-slate-700/50 grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-800/80">
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="이름 또는 학생 번호 검색..."
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="">모든 학교</option>
            {schema.enums.School?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="">모든 역할</option>
            {schema.enums.Role?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
          <select value={filterAttack} onChange={e => setFilterAttack(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="">모든 공격 속성</option>
            {schema.enums.AttackType?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
          <select value={filterArmor} onChange={e => setFilterArmor(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="">모든 방어 속성</option>
            {schema.enums.ArmorType?.values?.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 border-b border-slate-700/50">
              <tr>
                <th className="px-5 py-3 text-slate-400 font-semibold w-16 text-center">No.</th>
                <th className="px-5 py-3 text-slate-400 font-semibold w-16">초상화</th>
                <th className="px-5 py-3 text-slate-400 font-semibold">이름</th>
                <th className="px-5 py-3 text-slate-400 font-semibold">학교</th>
                <th className="px-5 py-3 text-slate-400 font-semibold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredData.map(({ master }) => (
                <tr key={master.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-5 py-4 font-bold text-slate-400 text-center">{master.studentNumber || '-'}</td>
                <td className="px-5 py-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-600 flex items-center justify-center p-0.5">
                    {master.portraitUrl ? (
                      <img src={`${API}${master.portraitUrl}`} className="w-full h-full object-contain drop-shadow-sm" />
                    ) : (
                      <Users size={16} className="text-slate-600" />
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 font-bold text-white">{master.name}</td>
                <td className="px-5 py-4 text-slate-300">{master.school}</td>
                <td className="px-5 py-4 text-right space-x-2">
                  <button
                    onClick={() => setModal({ student: master, isNew: false })}
                    className="text-blue-400 hover:text-blue-300 px-3 py-1 bg-blue-900/30 rounded font-semibold transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(master.id, master.name)}
                    className="text-red-400 hover:text-red-300 px-3 py-1 bg-red-900/30 rounded font-semibold transition-colors"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <EnumManager schema={schema} showToast={showToast} onRefresh={onRefresh} />
    </div>
  );
}
