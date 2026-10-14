import { useState, useMemo } from 'react';
import axios from 'axios';
import { Users, Plus, Sparkles, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import type { ArchiveData, SchemaConfig, StudentMaster } from '../../types';
import { API } from '../../constants';
import { MasterModal } from './MasterModal';
import { MasterJsonImportModal } from './MasterJsonImportModal';
import { EnumManager } from '../enums/EnumManager';

export type MasterSortKey =
  | 'id'
  | 'studentNumber'
  | 'name'
  | 'school'
  | 'starNum'
  | 'Role'
  | 'attackType'
  | 'armorType';

export type SortDirection = 'asc' | 'desc';

interface MasterManagerProps {
  data: ArchiveData[];
  schema: SchemaConfig;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function MasterManager({ data, schema, onRefresh, showToast }: MasterManagerProps) {
  const [modal, setModal] = useState<{ student: Omit<StudentMaster, 'id'> & { id?: number }; isNew: boolean } | null>(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterAttack, setFilterAttack] = useState('');
  const [filterArmor, setFilterArmor] = useState('');

  const [sortKey, setSortKey] = useState<MasterSortKey>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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
    portraitUrls: [],
    primaryOopart: '',
    secondaryOopart: '',
    terrainAffinity: { urban: 'B', outdoor: 'B', indoor: 'B' },
    uniqueWeaponEffects: { star2: '', star3: '', star4: '' },
    favoriteItemEffects: { t1: '', t2: '' },
    skills: [emptySkills]
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

  const handleSort = (key: MasterSortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection(key === 'starNum' ? 'desc' : 'asc');
    }
  };

  const handleResetFiltersAndSort = () => {
    setSearchQuery('');
    setFilterSchool('');
    setFilterRole('');
    setFilterAttack('');
    setFilterArmor('');
    setSortKey('id');
    setSortDirection('asc');
  };

  const sortedAndFilteredData = useMemo(() => {
    const filtered = data.filter(({ master }) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = master.name.toLowerCase().includes(q);
        const matchesNum = master.studentNumber?.toString().includes(q);
        const matchesId = master.id.toString() === q || master.id.toString().includes(q);
        if (!matchesName && !matchesNum && !matchesId) return false;
      }
      if (filterSchool && master.school !== filterSchool) return false;
      if (filterRole && master.Role !== filterRole) return false;
      if (filterAttack && master.attackType !== filterAttack) return false;
      if (filterArmor && master.armorType !== filterArmor) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'id':
          comparison = a.master.id - b.master.id;
          break;

        case 'studentNumber': {
          const numA = a.master.studentNumber;
          const numB = b.master.studentNumber;
          if (numA == null && numB == null) comparison = a.master.id - b.master.id;
          else if (numA == null) return 1;
          else if (numB == null) return -1;
          else comparison = numA - numB;
          break;
        }

        case 'name':
          comparison = (a.master.name || '').localeCompare(b.master.name || '', 'ko');
          break;

        case 'school':
          comparison = (a.master.school || '').localeCompare(b.master.school || '', 'ko');
          break;

        case 'starNum':
          comparison = (a.master.starNum || 0) - (b.master.starNum || 0);
          break;

        case 'Role':
          comparison = (a.master.Role || '').localeCompare(b.master.Role || '', 'ko');
          break;

        case 'attackType':
          comparison = (a.master.attackType || '').localeCompare(b.master.attackType || '', 'ko');
          break;

        case 'armorType':
          comparison = (a.master.armorType || '').localeCompare(b.master.armorType || '', 'ko');
          break;

        default:
          comparison = a.master.id - b.master.id;
          break;
      }

      if (comparison === 0) {
        comparison = a.master.id - b.master.id;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, searchQuery, filterSchool, filterRole, filterAttack, filterArmor, sortKey, sortDirection]);

  const renderSortableTh = (
    label: string,
    key: MasterSortKey,
    extraClass: string = ''
  ) => {
    const isActive = sortKey === key;
    return (
      <th
        onClick={() => handleSort(key)}
        className={`px-5 py-3 font-semibold cursor-pointer select-none transition-colors group ${
          isActive ? 'text-blue-400 bg-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
        } ${extraClass}`}
      >
        <div className={`flex items-center gap-1.5 ${extraClass.includes('text-center') ? 'justify-center' : extraClass.includes('text-right') ? 'justify-end' : ''}`}>
          <span>{label}</span>
          <span className="inline-flex items-center">
            {isActive ? (
              sortDirection === 'asc' ? (
                <ArrowUp size={13} className="text-blue-400" />
              ) : (
                <ArrowDown size={13} className="text-blue-400" />
              )
            ) : (
              <ArrowUpDown size={13} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-slide-in">
      {showJsonModal && (
        <MasterJsonImportModal
          isOpen={showJsonModal}
          onClose={() => setShowJsonModal(false)}
          existingStudents={data.map(d => d.master)}
          onImport={(imported) => {
            setShowJsonModal(false);
            const matched = data.find(d => 
              (imported.name && d.master.name.trim() === imported.name.trim()) ||
              (imported.studentNumber && d.master.studentNumber === imported.studentNumber)
            );
            if (matched) {
              setModal({
                student: {
                  ...imported,
                  id: matched.master.id
                },
                isNew: false
              });
              showToast(`기존 '${matched.master.name}'(ID: ${matched.master.id}) 마스터 데이터에 적용했습니다. (이미지 URL 보존 완료)`);
            } else {
              setModal({ student: imported, isNew: true });
              showToast(`'${imported.name || '학생'}' 신규 데이터를 불러왔습니다. 검토 후 저장해주세요.`);
            }
          }}
          schema={schema}
          showToast={showToast}
        />
      )}
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
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowJsonModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg text-white cursor-pointer"
          >
            <Sparkles size={18} /> JSON 자동완성 등록
          </button>
          <button
            onClick={() => setModal({ student: emptyStudent, isNew: true })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg text-white cursor-pointer"
          >
            <Plus size={18} /> 새 마스터 등록
          </button>
        </div>
      </div>
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="p-4 border-b border-slate-700/50 grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-800/80">
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="이름, 번호, ID 검색..."
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

        {/* Sort & Status Bar */}
        <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">목록:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold text-xs border border-blue-500/20">
              {sortedAndFilteredData.length}명
            </span>
            {(searchQuery || filterSchool || filterRole || filterAttack || filterArmor) && (
              <span className="text-xs text-slate-400">
                (전체 {data.length}명 중 필터링됨)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">정렬:</span>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as MasterSortKey)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="id">ID순 (고유 ID)</option>
              <option value="studentNumber">학생 번호순 (No.)</option>
              <option value="name">이름순 (가나다)</option>
              <option value="school">학교순</option>
              <option value="starNum">성급순 (★)</option>
              <option value="Role">역할군순</option>
              <option value="attackType">공격 속성순</option>
              <option value="armorType">방어 속성순</option>
            </select>

            <button
              type="button"
              onClick={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-700 border border-slate-600 text-xs text-white font-medium transition-colors shadow-sm cursor-pointer"
              title={sortDirection === 'asc' ? '현재 오름차순 (클릭 시 내림차순 전환)' : '현재 내림차순 (클릭 시 오름차순 전환)'}
            >
              {sortDirection === 'asc' ? (
                <>
                  <ArrowUp size={13} className="text-blue-400" />
                  <span>오름차순</span>
                </>
              ) : (
                <>
                  <ArrowDown size={13} className="text-blue-400" />
                  <span>내림차순</span>
                </>
              )}
            </button>

            {(searchQuery || filterSchool || filterRole || filterAttack || filterArmor || sortKey !== 'id' || sortDirection !== 'asc') && (
              <button
                type="button"
                onClick={handleResetFiltersAndSort}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors border border-transparent hover:border-slate-600 cursor-pointer"
                title="필터 및 정렬 초기화"
              >
                <RotateCcw size={12} />
                <span>초기화</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 border-b border-slate-700/50">
              <tr>
                {renderSortableTh('ID', 'id', 'w-16 text-center')}
                {renderSortableTh('No.', 'studentNumber', 'w-16 text-center')}
                <th className="px-5 py-3 text-slate-400 font-semibold w-16">초상화</th>
                {renderSortableTh('이름', 'name')}
                {renderSortableTh('학교', 'school')}
                <th className="px-5 py-3 text-slate-400 font-semibold">성급 / 속성 / 역할</th>
                <th className="px-5 py-3 text-slate-400 font-semibold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {sortedAndFilteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-300">검색 또는 필터 조건에 일치하는 마스터 데이터가 없습니다.</p>
                    <p className="text-xs text-slate-500 mt-1">검색어나 필터 설정을 변경해보세요.</p>
                  </td>
                </tr>
              ) : (
                sortedAndFilteredData.map(({ master }) => (
                  <tr key={master.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-xs text-blue-400/90 text-center">
                      #{master.id}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-400 text-center">
                      {master.studentNumber || '-'}
                    </td>
                    <td className="px-5 py-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-600 flex items-center justify-center p-0.5 overflow-hidden">
                        {master.portraitUrls && master.portraitUrls.length > 0 ? (
                          <img
                            src={`${API}${master.portraitUrls[0]}`}
                            alt={master.name}
                            className="w-full h-full object-contain drop-shadow-sm"
                          />
                        ) : (
                          <Users size={16} className="text-slate-600" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{master.name}</span>
                        {master.starNum && (
                          <span className="text-[11px] text-amber-400/90 font-medium tracking-tight">
                            {'★'.repeat(Math.min(Math.max(master.starNum, 1), 3))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{master.school}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {master.attackType && (
                          <span className="px-2 py-0.5 rounded bg-slate-900/80 text-slate-300 border border-slate-700/80">
                            {schema.enums.AttackType?.values?.find(v => v.key === master.attackType)?.label || master.attackType}
                          </span>
                        )}
                        {master.armorType && (
                          <span className="px-2 py-0.5 rounded bg-slate-900/80 text-slate-400 border border-slate-700/80">
                            {schema.enums.ArmorType?.values?.find(v => v.key === master.armorType)?.label || master.armorType}
                          </span>
                        )}
                        {master.Role && (
                          <span className="px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-800/40">
                            {schema.enums.Role?.values?.find(v => v.key === master.Role)?.label || master.Role}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setModal({ student: master, isNew: false })}
                        className="text-blue-400 hover:text-blue-300 px-3 py-1 bg-blue-900/30 rounded font-semibold transition-colors cursor-pointer"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(master.id, master.name)}
                        className="text-red-400 hover:text-red-300 px-3 py-1 bg-red-900/30 rounded font-semibold transition-colors cursor-pointer"
                      >
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
      <EnumManager schema={schema} showToast={showToast} onRefresh={onRefresh} />
    </div>
  );
}

