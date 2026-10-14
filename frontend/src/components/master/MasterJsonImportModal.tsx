import React, { useState, useId } from 'react';
import { X, FileCode, Upload, Sparkles, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import type { StudentMaster, SchemaConfig, SkillSet } from '../../types';

interface MasterJsonImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (student: Omit<StudentMaster, 'id'> & { id?: number }) => void;
  schema: SchemaConfig;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  currentStudent?: Omit<StudentMaster, 'id'> & { id?: number };
}

export function normalizeStudentData(
  raw: any,
  schema: SchemaConfig,
  currentStudent?: Omit<StudentMaster, 'id'> & { id?: number }
): Omit<StudentMaster, 'id'> & { id?: number } {
  const emptySkill = { name: '', descriptionTemplate: '', parameters: {}, iconUrl: '' };

  const name = typeof raw.name === 'string' ? raw.name.trim() : currentStudent?.name || '';
  const studentNumber = typeof raw.studentNumber === 'number'
    ? raw.studentNumber
    : raw.studentNumber ? Number(raw.studentNumber) : undefined;

  const school = raw.school || schema.enums.School?.values?.[0]?.key || 'Trinity';
  const fieldType = raw.fieldType || 'Striker';
  const Role = raw.Role || schema.enums.Role?.values?.[0]?.key || 'DamageDealer';
  const attackType = raw.attackType || schema.enums.AttackType?.values?.[0]?.key || 'Explosion';
  const armorType = raw.armorType || schema.enums.ArmorType?.values?.[0]?.key || 'LightArmor';
  const weaponType = raw.weaponType || schema.enums.WeaponType?.values?.[0]?.key || 'AR';
  const position = raw.position || schema.enums.Position?.values?.[0]?.key || 'Middle';

  const starNum = typeof raw.starNum === 'number' ? Math.min(Math.max(raw.starNum, 1), 3) : 3;
  const hasFavoriteItem = Boolean(raw.hasFavoriteItem);

  const equipmentSlot1 = raw.equipmentSlot1 || schema.enums.EquipmentSlot1?.values?.[0]?.key || '';
  const equipmentSlot2 = raw.equipmentSlot2 || schema.enums.EquipmentSlot2?.values?.[0]?.key || '';
  const equipmentSlot3 = raw.equipmentSlot3 || schema.enums.EquipmentSlot3?.values?.[0]?.key || '';

  const primaryOopart = raw.primaryOopart || '';
  const secondaryOopart = raw.secondaryOopart || '';

  const terrainAffinity = {
    urban: raw.terrainAffinity?.urban || 'B',
    outdoor: raw.terrainAffinity?.outdoor || 'B',
    indoor: raw.terrainAffinity?.indoor || 'B'
  };

  const uniqueWeaponName = raw.uniqueWeaponName || raw.skills?.[0]?.uniqueWeaponName || '';
  const uniqueWeaponEffects = {
    star2: raw.uniqueWeaponEffects?.star2 || raw.skills?.[0]?.uniqueWeaponEffects?.star2 || '',
    star3: raw.uniqueWeaponEffects?.star3 || raw.skills?.[0]?.uniqueWeaponEffects?.star3 || '',
    star4: raw.uniqueWeaponEffects?.star4 || raw.skills?.[0]?.uniqueWeaponEffects?.star4 || ''
  };

  const favoriteItemEffects = {
    t1: raw.favoriteItemEffects?.t1 || '',
    t2: raw.favoriteItemEffects?.t2 || ''
  };

  let portraitUrls: string[] = [];
  if (Array.isArray(raw.portraitUrls) && raw.portraitUrls.length > 0) {
    portraitUrls = raw.portraitUrls;
  } else if (raw.portraitUrl) {
    portraitUrls = [raw.portraitUrl];
    if (raw.fullIllustUrl) portraitUrls.push(raw.fullIllustUrl);
  } else if (currentStudent?.portraitUrls) {
    portraitUrls = currentStudent.portraitUrls;
  }

  let skills: SkillSet[] = [];
  if (Array.isArray(raw.skills) && raw.skills.length > 0) {
    skills = raw.skills.map((sSet: any) => ({
      ex: sSet.ex || emptySkill,
      normal: sSet.normal || emptySkill,
      passive: sSet.passive || emptySkill,
      sub: sSet.sub || emptySkill,
      normalPlus: sSet.normalPlus || emptySkill,
      passivePlus: sSet.passivePlus || emptySkill,
      uniqueWeaponName: sSet.uniqueWeaponName || uniqueWeaponName,
      uniqueWeaponEffects: sSet.uniqueWeaponEffects || uniqueWeaponEffects
    }));
  } else {
    skills = [{
      ex: emptySkill,
      normal: emptySkill,
      passive: emptySkill,
      sub: emptySkill,
      normalPlus: emptySkill,
      passivePlus: emptySkill,
      uniqueWeaponName,
      uniqueWeaponEffects
    }];
  }

  return {
    name,
    studentNumber,
    school,
    club: raw.club || '',
    fieldType,
    Role,
    Role2: raw.Role2 || '',
    attackType,
    armorType,
    weaponType,
    position,
    position2: raw.position2 || '',
    starNum,
    hasFavoriteItem,
    equipmentSlot1,
    equipmentSlot2,
    equipmentSlot3,
    portraitUrls,
    primaryOopart,
    secondaryOopart,
    terrainAffinity,
    uniqueWeaponName,
    uniqueWeaponEffects,
    uniqueWeaponUrl: raw.uniqueWeaponUrl || '',
    favoriteItemUrl: raw.favoriteItemUrl || '',
    favoriteItemEffects,
    skills,
    summon: raw.summon
  };
}

export function MasterJsonImportModal({
  isOpen,
  onClose,
  onImport,
  schema,
  showToast,
  currentStudent
}: MasterJsonImportModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [parsedData, setParsedData] = useState<Omit<StudentMaster, 'id'> & { id?: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [candidateList, setCandidateList] = useState<any[]>([]);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState(0);
  const fileInputId = useId();

  if (!isOpen) return null;

  const handleProcessRawJson = (rawContent: string) => {
    setJsonText(rawContent);
    setParseError(null);
    setParsedData(null);
    setCandidateList([]);

    if (!rawContent.trim()) return;

    try {
      const parsed = JSON.parse(rawContent);

      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          setParseError('빈 JSON 배열입니다.');
          return;
        }
        setCandidateList(parsed);
        setSelectedCandidateIdx(0);
        const normalized = normalizeStudentData(parsed[0], schema, currentStudent);
        setParsedData(normalized);
      } else if (typeof parsed === 'object' && parsed !== null) {
        const normalized = normalizeStudentData(parsed, schema, currentStudent);
        setParsedData(normalized);
      } else {
        setParseError('학생 데이터 객체 또는 배열 형식이어야 합니다.');
      }
    } catch (err: any) {
      setParseError(`JSON 파싱 오류: ${err.message || '올바른 JSON 문법이 아닙니다.'}`);
    }
  };

  const handleSelectCandidate = (idx: number) => {
    setSelectedCandidateIdx(idx);
    if (candidateList[idx]) {
      const normalized = normalizeStudentData(candidateList[idx], schema, currentStudent);
      setParsedData(normalized);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessRawJson(content);
      showToast(`'${file.name}' 파일을 성공적으로 읽었습니다.`);
    };
    reader.onerror = () => {
      showToast('파일을 읽는 도중 오류가 발생했습니다.', 'error');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        handleProcessRawJson(content);
        showToast(`'${file.name}' 파일을 성공적으로 읽었습니다.`);
      };
      reader.readAsText(file, 'utf-8');
    }
  };

  const handleApply = () => {
    if (!parsedData) {
      showToast('적용할 유효한 데이터가 없습니다.', 'error');
      return;
    }
    if (!parsedData.name) {
      showToast('학생 이름(name) 필드가 지정되지 않았습니다.', 'error');
      return;
    }
    onImport(parsedData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="bg-slate-900 border-b border-slate-700/80 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                마스터 DB 자동 채우기 (JSON 임포트)
              </h2>
              <p className="text-xs text-slate-400">
                변환 도구에서 생성된 학생 JSON을 붙여넣거나 파일을 등록하면 모든 필드가 자동 완성됩니다.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* 입력 방식 영역: 파일 업로드 드롭존 & 텍스트 영역 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode size={14} className="text-indigo-400" /> JSON 데이터 입력
              </label>
              <label
                htmlFor={fileInputId}
                className="cursor-pointer text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-950/40 hover:bg-indigo-900/50 px-2.5 py-1 rounded-md border border-indigo-700/40 transition-colors"
              >
                <Upload size={13} /> .json 파일 열기
              </label>
              <input
                id={fileInputId}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="relative"
            >
              <textarea
                value={jsonText}
                onChange={(e) => handleProcessRawJson(e.target.value)}
                placeholder={'여기에 tools/namu_skill_converter 에서 복사한 학생 JSON을 붙여넣거나,\n.json 파일을 이 영역으로 드래그 앤 드롭하세요.'}
                rows={7}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-colors resize-y"
              />
            </div>
          </div>

          {/* 에러 상태 안내 */}
          {parseError && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-red-300 text-xs">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">JSON 구문 분석 실패</p>
                <p className="text-red-400/80 mt-0.5">{parseError}</p>
              </div>
            </div>
          )}

          {/* 다중 학생 배열 감지 시 선택 옵션 */}
          {candidateList.length > 1 && (
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-semibold">
                총 {candidateList.length}명의 학생 데이터가 감지되었습니다. 적용할 학생:
              </span>
              <select
                value={selectedCandidateIdx}
                onChange={(e) => handleSelectCandidate(Number(e.target.value))}
                className="bg-slate-900 border border-slate-600 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                {candidateList.map((c, i) => (
                  <option key={i} value={i}>
                    [{c.studentNumber || i + 1}] {c.name || '이름 없음'} ({c.school || '미지정'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 정상 파싱된 데이터 미리보기 카드 */}
          {parsedData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> 자동 인식된 학생 데이터 미리보기
                </h3>
                <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  총 24개 속성 정규화 완료
                </span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3.5">
                {/* 1. 기본 프로필 배지 */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-sm font-bold text-white bg-indigo-600/40 border border-indigo-500/40">
                    {parsedData.name || '이름 미입력'}
                  </span>
                  {parsedData.studentNumber && (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700">
                      No. {parsedData.studentNumber}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-xs font-semibold text-blue-300 bg-blue-950/60 border border-blue-700/50">
                    {parsedData.school}
                  </span>
                  {parsedData.club && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium text-slate-400 bg-slate-800/80 border border-slate-700">
                      {parsedData.club}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-xs font-semibold text-amber-300 bg-amber-950/50 border border-amber-700/50">
                    ★{parsedData.starNum}
                  </span>
                  {parsedData.hasFavoriteItem && (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold text-pink-300 bg-pink-950/50 border border-pink-700/50">
                      애장품 보유
                    </span>
                  )}
                </div>

                {/* 2. 전투 속성 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">역할 / 부대</span>
                    <span className="text-slate-200 font-semibold">{parsedData.Role} ({parsedData.fieldType})</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">공격 / 방어</span>
                    <span className="text-slate-200 font-semibold">{parsedData.attackType} / {parsedData.armorType}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">무기 / 포지션</span>
                    <span className="text-slate-200 font-semibold">{parsedData.weaponType} / {parsedData.position}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">지형 적성</span>
                    <span className="text-slate-200 font-semibold">
                      시: {parsedData.terrainAffinity?.urban} / 야: {parsedData.terrainAffinity?.outdoor} / 실: {parsedData.terrainAffinity?.indoor}
                    </span>
                  </div>
                </div>

                {/* 3. 장비 및 오파츠 */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-500 mr-1.5 font-medium">장비:</span>
                    <span className="text-slate-300">{parsedData.equipmentSlot1 || '-'} / {parsedData.equipmentSlot2 || '-'} / {parsedData.equipmentSlot3 || '-'}</span>
                  </div>
                  {(parsedData.primaryOopart || parsedData.secondaryOopart) && (
                    <div>
                      <span className="text-slate-500 mr-1.5 font-medium">오파츠:</span>
                      <span className="text-slate-300">{parsedData.primaryOopart || '-'} / {parsedData.secondaryOopart || '-'}</span>
                    </div>
                  )}
                  {parsedData.uniqueWeaponName && (
                    <div>
                      <span className="text-purple-400 mr-1.5 font-medium">고유무기:</span>
                      <span className="text-purple-200">{parsedData.uniqueWeaponName}</span>
                    </div>
                  )}
                </div>

                {/* 4. 스킬 세부 요약 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">인식된 스킬 목록</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { label: 'EX', s: parsedData.skills?.[0]?.ex },
                      { label: '기본', s: parsedData.skills?.[0]?.normal },
                      { label: '강화', s: parsedData.skills?.[0]?.passive },
                      { label: '서브', s: parsedData.skills?.[0]?.sub },
                      { label: '강화+', s: parsedData.skills?.[0]?.passivePlus },
                    ].map(item => {
                      const skillObj = item.s as any;
                      const hasSkill = skillObj && skillObj.name;
                      const paramCount = Object.keys(skillObj?.parameters || {}).length;
                      return (
                        <div key={item.label} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-blue-400">{item.label}</span>
                            <span className={`truncate ${hasSkill ? 'text-slate-200 font-medium' : 'text-slate-500 italic'}`}>
                              {hasSkill ? skillObj.name : '미설정'}
                            </span>
                          </div>
                          {paramCount > 0 && (
                            <span className="text-[10px] text-indigo-400 font-mono bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40 flex-shrink-0">
                              {paramCount}개 변수
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 안내 배너 */}
                <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-lg text-xs text-blue-200/80 flex items-start gap-2">
                  <Eye size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>
                    아래 <strong>[입력 폼에 적용 및 검토하기]</strong>를 누르면 본 입력 창(`MasterModal`)의 모든 입력란에 채워집니다.
                    초상화/일러스트 이미지 등록 및 스킬 세부 확인 후 최종 등록을 완료하세요.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={!parsedData || !parsedData.name}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all shadow-md"
          >
            <CheckCircle2 size={16} /> 입력 폼에 적용 및 검토하기
          </button>
        </div>
      </div>
    </div>
  );
}
