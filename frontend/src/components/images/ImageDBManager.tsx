import { useEffect, useState, useRef, Fragment } from 'react';
import axios from 'axios';
import { Image as ImageIcon, Settings, Copy, Trash2, Edit2, Folder, FolderUp, Scissors, ClipboardPaste, CheckSquare, Square } from 'lucide-react';
import type { ArchiveData, SchemaConfig } from '../../types';
import { API, PREFIX } from '../../constants';
import { ResourceIconUpload } from '../ui';

interface ImageData { url: string; name: string; size: number; createdAt: string; }

interface ImageDBManagerProps {
  data: ArchiveData[];
  schema: SchemaConfig;
  showToast: (m: string, t?: 'error') => void;
  onRefresh: () => void;
}

export function ImageDBManager({ data, schema, showToast, onRefresh }: ImageDBManagerProps) {
  const [images, setImages] = useState<ImageData[]>([]);
  const [serverFolders, setServerFolders] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedImages(new Set());
  }, [currentPath, searchQuery]);
  
  const fetchImages = async () => {
    try {
      const [imgRes, folderRes] = await Promise.all([
        axios.get(`${API}/api/images?t=${Date.now()}`),
        axios.get(`${API}/api/images/folders?t=${Date.now()}`)
      ]);
      setImages(imgRes.data);
      setServerFolders(folderRes.data);
    } catch {
      showToast('이미지 목록 불러오기 실패', 'error');
    }
  };
  
  useEffect(() => {
    fetchImages();
  }, []);

  const getUsage = (url: string) => {
    const usage: string[] = [];
    data.forEach(({ master }) => {
      if (master.portraitUrls && master.portraitUrls.includes(url)) usage.push(`[초상화] ${master.name}`);
      if (master.skills && Array.isArray(master.skills)) {
        master.skills.forEach(skillSet => {
          ['ex', 'normal', 'passive', 'sub', 'normalPlus', 'passivePlus'].forEach(k => {
            const skillItem = (skillSet as any)[k];
            if (skillItem) {
               if (Array.isArray(skillItem)) {
                 if (skillItem.some(s => s?.iconUrl === url)) usage.push(`[스킬] ${master.name} - 다중 모드 (${k})`);
               } else {
                 if (skillItem?.iconUrl === url) usage.push(`[스킬] ${master.name} - ${skillItem.name || k}`);
               }
            }
          });
        });
      }
    });
    schema.ooparts?.forEach(o => {
      o.tiers.forEach((t, i) => {
        if (t.iconUrl === url) usage.push(`[오파츠] ${o.label} (${PREFIX[i]})`);
      });
    });
    const ri = schema.resourceIcons;
    if (ri?.Credit === url) usage.push('[공통] Credit');
    if (ri?.SecretTechSheet === url) usage.push('[공통] 비의서');
    if (ri?.TechNotes) {
      Object.entries(ri.TechNotes).forEach(([s, arr]) => arr.forEach((u, i) => { if (u === url) usage.push(`[기술노트] ${s} (${PREFIX[i]})`); }));
    }
    if (ri?.BDs) {
      Object.entries(ri.BDs).forEach(([s, arr]) => arr.forEach((u, i) => { if (u === url) usage.push(`[전술 교육 BD] ${s} (${PREFIX[i]})`); }));
    }
    return usage;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('paths', files[i].webkitRelativePath);
      }
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
      const url = `${API}/api/images/upload_folder?folder=${encodeURIComponent(currentPath)}`;
      await axios.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast(`${files.length}개의 이미지(폴더 구조 포함) 업로드 완료`);
      fetchImages();
    } catch {
      showToast('폴더 업로드 실패', 'error');
    } finally {
      setUploading(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
      const url = `${API}/api/images/upload?folder=${encodeURIComponent(currentPath)}`;
      await axios.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast(`${files.length}개의 이미지 업로드 완료`);
      fetchImages();
    } catch {
      showToast('이미지 업로드 실패', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt('새 폴더 이름을 입력하세요:');
    if (!name) return;
    const folderName = currentPath ? `${currentPath}/${name}` : name;
    try {
      await axios.post(`${API}/api/images/folder`, { folderName });
      showToast('폴더가 생성되었습니다.');
      fetchImages();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      showToast(err.response?.data?.error || '폴더 생성 실패', 'error');
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!window.confirm(`[${folderPath}] 폴더와 내부의 모든 파일이 삭제됩니다. 계속하시겠습니까?`)) return;
    try {
      await axios.delete(`${API}/api/images/folder?path=${encodeURIComponent(folderPath)}`);
      showToast('폴더가 삭제되었습니다.');
      fetchImages();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      showToast(err.response?.data?.error || '폴더 삭제 실패', 'error');
    }
  };

  const handleRenameFolder = async (folderPath: string) => {
    const parts = folderPath.split('/');
    const currentName = parts[parts.length - 1];
    const newName = prompt('새 폴더 이름을 입력하세요:', currentName);
    if (!newName || newName === currentName) return;
    try {
      await axios.put(`${API}/api/images/folder/rename`, { oldPath: folderPath, newName });
      showToast('폴더 이름이 변경되었습니다.');
      onRefresh();
      fetchImages();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      showToast(err.response?.data?.error || '폴더 이름 변경 실패', 'error');
    }
  };

  const handleDeleteImage = async (imgUrl: string) => {
    if (!window.confirm('정말 삭제하시겠습니까? 연결된 데이터에서 이미지가 깨질 수 있습니다.')) return;
    const relPath = imgUrl.replace('/uploads/', '');
    try {
      await axios.delete(`${API}/api/images/file?path=${encodeURIComponent(relPath)}`);
      showToast('이미지 삭제 완료');
      fetchImages();
    } catch {
      showToast('삭제 실패', 'error');
    }
  };

  const handleRenameImage = async (imgUrl: string, currentName: string) => {
    const lastDotIndex = currentName.lastIndexOf('.');
    const ext = lastDotIndex !== -1 ? currentName.substring(lastDotIndex) : '';
    const baseName = lastDotIndex !== -1 ? currentName.substring(0, lastDotIndex) : currentName;

    const newBaseName = prompt('새 이미지 이름을 입력하세요 (확장자 생략):', baseName);
    if (!newBaseName || newBaseName === baseName) return;

    const newName = newBaseName + ext;
    const relPath = imgUrl.replace('/uploads/', '');
    try {
      await axios.put(`${API}/api/images/file/rename?path=${encodeURIComponent(relPath)}`, { newName });
      showToast('파일명이 변경되었습니다.');
      onRefresh();
      fetchImages();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      showToast(err.response?.data?.error || '파일명 변경 실패', 'error');
    }
  };

  const handleDropToFolder = async (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-blue-400');
    const sourceRelPath = e.dataTransfer.getData('text/plain');
    if (!sourceRelPath) return;

    try {
      await axios.put(`${API}/api/images/file/move?path=${encodeURIComponent(sourceRelPath)}`, { targetFolder: targetFolderPath });
      showToast(`파일이 이동되었습니다.`);
      onRefresh();
      fetchImages();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      showToast(err.response?.data?.error || '파일 이동 실패', 'error');
    }
  };

  const getParentPath = (path: string) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  };

  // Derive items for current directory
  const currentFolders: { name: string; fullPath: string }[] = [];
  const prefix = currentPath ? currentPath + '/' : '';
  
  // To avoid duplicates, keep track of folder names in the current level
  const folderNamesInCurrentPath = new Set<string>();

  serverFolders.forEach(f => {
    if (f.startsWith(prefix) && f.length > prefix.length) {
      const remaining = f.substring(prefix.length);
      const nextSlashIndex = remaining.indexOf('/');
      if (nextSlashIndex === -1) {
        folderNamesInCurrentPath.add(remaining);
      } else {
        folderNamesInCurrentPath.add(remaining.substring(0, nextSlashIndex));
      }
    }
  });

  Array.from(folderNamesInCurrentPath).sort().forEach(name => {
    currentFolders.push({ name, fullPath: prefix + name });
  });

  const currentImages = images.filter(img => {
    if (searchQuery) return img.name.toLowerCase().includes(searchQuery.toLowerCase());
    const relPath = img.url.replace('/uploads/', '');
    if (currentPath === '') return relPath.indexOf('/') === -1;
    return relPath.startsWith(prefix) && relPath.substring(prefix.length).indexOf('/') === -1;
  });

  // Common UI State
  const [selectedSchool, setSelectedSchool] = useState<string>(schema.enums.School?.values[0]?.key || '');
  const resourceIcons = schema.resourceIcons || { Credit: '', SecretTechSheet: '', Eleph: '', ExpReports: ['', '', '', ''], TechNotes: {}, BDs: {} };

  const updateResourceIcon = async (type: 'Credit' | 'SecretTechSheet' | 'Eleph', url: string) => {
    const updated = { ...resourceIcons, [type]: url };
    try { await axios.put(`${API}/api/schema/resourceIcons`, updated); showToast('저장되었습니다.'); onRefresh(); fetchImages(); } catch { showToast('오류 발생', 'error'); }
  };

  const updateAffinityResource = async (level: 'level2' | 'level3' | 'level4', url: string) => {
    const affinity = { ...(resourceIcons.Affinity || { level2: '', level3: '', level4: '' }) };
    affinity[level] = url;
    const updated = { ...resourceIcons, Affinity: affinity };
    try { await axios.put(`${API}/api/schema/resourceIcons`, updated); showToast('저장되었습니다.'); onRefresh(); fetchImages(); } catch { showToast('오류 발생', 'error'); }
  };

  const updateExpReportResource = async (tierIndex: number, url: string) => {
    const arr = [...(resourceIcons.ExpReports || ['', '', '', ''])];
    arr[tierIndex] = url;
    const updated = { ...resourceIcons, ExpReports: arr };
    try { await axios.put(`${API}/api/schema/resourceIcons`, updated); showToast('저장되었습니다.'); onRefresh(); fetchImages(); } catch { showToast('오류 발생', 'error'); }
  };

  const updateSchoolResource = async (type: 'TechNotes' | 'BDs', school: string, tierIndex: number, url: string) => {
    const arr = [...(resourceIcons[type][school] || ['', '', '', ''])];
    arr[tierIndex] = url;
    const updated = { ...resourceIcons, [type]: { ...resourceIcons[type], [school]: arr } };
    try { await axios.put(`${API}/api/schema/resourceIcons`, updated); showToast('저장되었습니다.'); onRefresh(); fetchImages(); } catch { showToast('오류 발생', 'error'); }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath('');
    } else {
      const parts = currentPath.split('/');
      setCurrentPath(parts.slice(0, index + 1).join('/'));
    }
  };

  const handleToggleSelect = (url: string) => {
    const newSet = new Set(selectedImages);
    if (newSet.has(url)) newSet.delete(url);
    else newSet.add(url);
    setSelectedImages(newSet);
  };

  const handleSelectAll = () => {
    if (selectedImages.size === currentImages.length && currentImages.length > 0) {
      setSelectedImages(new Set());
    } else {
      const newSet = new Set<string>();
      currentImages.forEach(img => newSet.add(img.url));
      setSelectedImages(newSet);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedImages.size === 0) return;
    if (!window.confirm(`선택한 ${selectedImages.size}개의 이미지를 정말 삭제하시겠습니까?`)) return;
    
    const paths = Array.from(selectedImages).map(url => url.replace('/uploads/', ''));
    try {
      await axios.post(`${API}/api/images/files/delete`, { paths });
      showToast(`${selectedImages.size}개의 이미지 삭제 완료`);
      setSelectedImages(new Set());
      fetchImages();
    } catch {
      showToast('삭제 실패', 'error');
    }
  };

  const handleCut = () => {
    if (selectedImages.size === 0) return;
    setClipboard(new Set(selectedImages));
    setSelectedImages(new Set());
    showToast(`${selectedImages.size}개의 이미지를 잘라내었습니다. 원하는 폴더에서 붙여넣기를 클릭하세요.`);
  };

  const handlePaste = async () => {
    if (clipboard.size === 0) return;
    const paths = Array.from(clipboard).map(url => url.replace('/uploads/', ''));
    try {
      await axios.put(`${API}/api/images/files/move`, { targetFolder: currentPath || 'root', paths });
      showToast(`${clipboard.size}개의 이미지가 이동되었습니다.`);
      setClipboard(new Set());
      onRefresh();
      fetchImages();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      showToast(err.response?.data?.error || '파일 이동 실패', 'error');
    }
  };

  const handleCancelCut = () => {
    setClipboard(new Set());
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex justify-between items-center bg-purple-900/20 p-5 rounded-xl border border-purple-500/20">
        <div>
          <h2 className="text-xl font-bold text-purple-300 flex items-center gap-2"><ImageIcon size={20} /> 서버 이미지 관리 (탐색기)</h2>
          <p className="text-sm text-purple-200/70 mt-1">마스터 데이터 등에 연결되는 이미지 및 폴더를 윈도우 탐색기처럼 관리할 수 있습니다.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg text-white">
            {uploading ? '업로드 중...' : '이미지 업로드'}
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleUploadImage} />
          
          <button onClick={() => folderInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg text-white">
            {uploading ? '업로드 중...' : '폴더 업로드'}
          </button>
          <input type="file" ref={folderInputRef} className="hidden" accept="image/*" multiple {...({ webkitdirectory: "true" } as any)} onChange={handleUploadFolder} />
          
          <button onClick={fetchImages} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg text-white">
            새로고침
          </button>
        </div>
      </div>

      <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 shadow-lg mb-8">
        <h3 className="text-lg font-bold text-amber-400 mb-6 flex items-center gap-2"><Settings size={18}/> 공통 재료 아이콘 설정</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h4 className="text-sm font-bold text-slate-300 mb-4 pb-2 border-b border-slate-700/50">전역 재료</h4>
            <div className="flex gap-6">
              <ResourceIconUpload label="Credit" url={resourceIcons.Credit || ''} onUpload={url => updateResourceIcon('Credit', url)} showToast={showToast} />
              <ResourceIconUpload label="비의서" url={resourceIcons.SecretTechSheet || ''} onUpload={url => updateResourceIcon('SecretTechSheet', url)} showToast={showToast} />
              <ResourceIconUpload label="엘레프" url={resourceIcons.Eleph || ''} onUpload={url => updateResourceIcon('Eleph', url)} showToast={showToast} />
            </div>
            <div className="mt-6">
              <div className="text-xs font-bold text-slate-500 mb-2">경험치 보고서 (초급 / 일반 / 고급 / 최상급)</div>
              <div className="flex gap-4">
                {[0,1,2,3].map(i => <ResourceIconUpload key={`exprpt-${i}`} label={['초급', '일반', '고급', '최상급'][i]} url={resourceIcons.ExpReports?.[i] || ''} onUpload={url => updateExpReportResource(i, url)} showToast={showToast} />)}
              </div>
            </div>
            <div className="mt-6">
              <div className="text-xs font-bold text-slate-500 mb-2">선호도 아이콘 (일반 / 상급 / 매우 선호)</div>
              <div className="flex gap-4">
                <ResourceIconUpload label="일반 (Lv.2)" url={resourceIcons.Affinity?.level2 || ''} onUpload={url => updateAffinityResource('level2', url)} showToast={showToast} />
                <ResourceIconUpload label="상급 (Lv.3)" url={resourceIcons.Affinity?.level3 || ''} onUpload={url => updateAffinityResource('level3', url)} showToast={showToast} />
                <ResourceIconUpload label="매우 선호 (Lv.4)" url={resourceIcons.Affinity?.level4 || ''} onUpload={url => updateAffinityResource('level4', url)} showToast={showToast} />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700/50">
              <h4 className="text-sm font-bold text-slate-300">학원별 재료</h4>
              <select value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)} className="bg-slate-900 border border-slate-600 rounded text-xs px-2 py-1 text-slate-300 focus:outline-none focus:border-blue-500">
                {schema.enums.School?.values.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </div>
            {selectedSchool && (
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-2">기술 노트 (기초 / 일반 / 고급 / 최상급)</div>
                  <div className="flex gap-4">
                    {[0,1,2,3].map(i => <ResourceIconUpload key={`note-${i}`} label={PREFIX[i]} url={resourceIcons.TechNotes[selectedSchool]?.[i] || ''} onUpload={url => updateSchoolResource('TechNotes', selectedSchool, i, url)} showToast={showToast} />)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-2">전술 교육 BD (기초 / 일반 / 고급 / 최상급)</div>
                  <div className="flex gap-4">
                    {[0,1,2,3].map(i => <ResourceIconUpload key={`bd-${i}`} label={PREFIX[i]} url={resourceIcons.BDs[selectedSchool]?.[i] || ''} onUpload={url => updateSchoolResource('BDs', selectedSchool, i, url)} showToast={showToast} />)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explorer Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        {/* Toolbar & Breadcrumbs */}
        <div className="flex flex-col gap-3 bg-slate-800 p-4 border-b border-slate-700">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <button onClick={handleCreateFolder} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded text-sm font-bold transition-colors shadow flex items-center gap-1">
                <Folder size={16} /> 새 폴더
              </button>
              {currentImages.length > 0 && (
                <button onClick={handleSelectAll} className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded text-sm font-bold transition-colors shadow flex items-center gap-1 ml-2">
                  {selectedImages.size === currentImages.length ? <CheckSquare size={16} /> : <Square size={16} />} 전체선택
                </button>
              )}
              {selectedImages.size > 0 && (
                <>
                  <button onClick={handleCut} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors shadow flex items-center gap-1 ml-2">
                    <Scissors size={16} /> {selectedImages.size}개 잘라내기
                  </button>
                  <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors shadow flex items-center gap-1 ml-2">
                    <Trash2 size={16} /> {selectedImages.size}개 삭제
                  </button>
                </>
              )}
              {clipboard.size > 0 && (
                <>
                  <button onClick={handlePaste} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors shadow flex items-center gap-1 ml-2 animate-pulse">
                    <ClipboardPaste size={16} /> {clipboard.size}개 붙여넣기
                  </button>
                  <button onClick={handleCancelCut} className="bg-slate-600 hover:bg-slate-500 text-slate-200 px-3 py-1.5 rounded text-sm font-bold transition-colors shadow flex items-center gap-1 ml-2">
                    취소
                  </button>
                </>
              )}
            </div>
            <input 
              type="text"
              placeholder="이미지 이름 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500 min-w-[200px]"
            />
          </div>
          
          <div className="flex items-center text-sm bg-slate-900/50 p-2 rounded border border-slate-700 overflow-x-auto whitespace-nowrap">
            <span 
              className="cursor-pointer hover:text-blue-400 text-blue-300 font-bold transition-colors"
              onClick={() => handleBreadcrumbClick(-1)}
            >
              🏠 Root
            </span>
            {currentPath.split('/').filter(Boolean).map((part, index) => (
              <Fragment key={index}>
                <span className="text-slate-500 mx-2">/</span>
                <span 
                  className="cursor-pointer hover:text-blue-400 text-blue-300 font-bold transition-colors"
                  onClick={() => handleBreadcrumbClick(index)}
                >
                  {part}
                </span>
              </Fragment>
            ))}
          </div>
        </div>

        {/* File Grid */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 min-h-[300px] content-start">
          
          {/* Back Folder */}
          {currentPath !== '' && !searchQuery && (
            <div 
              onDoubleClick={() => setCurrentPath(getParentPath(currentPath))}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-blue-400'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('ring-2', 'ring-blue-400')}
              onDrop={(e) => handleDropToFolder(e, getParentPath(currentPath) || 'root')}
              className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg cursor-pointer hover:bg-slate-700 transition-colors flex flex-col items-center justify-center p-4 h-32"
            >
              <FolderUp size={48} className="text-slate-400 mb-2" />
              <span className="text-xs font-bold text-slate-300">.. (상위 폴더)</span>
            </div>
          )}

          {/* Folders */}
          {!searchQuery && currentFolders.map(folder => (
            <div 
              key={folder.fullPath}
              onDoubleClick={() => setCurrentPath(folder.fullPath)}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-blue-400'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('ring-2', 'ring-blue-400')}
              onDrop={(e) => handleDropToFolder(e, folder.fullPath)}
              className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-lg hover:bg-slate-700 transition-colors flex flex-col items-center justify-center p-4 h-32 relative group"
            >
              <Folder size={48} className="text-amber-400 mb-2 drop-shadow" />
              <span className="text-xs font-bold text-slate-300 truncate w-full text-center px-1" title={folder.name}>{folder.name}</span>
              
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex bg-slate-900/80 rounded shadow">
                <button onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.fullPath); }} className="p-1.5 text-slate-300 hover:text-white" title="이름 변경"><Edit2 size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.fullPath); }} className="p-1.5 text-red-400 hover:text-red-300" title="삭제"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}

          {/* Images */}
          {currentImages.map(img => {
            const usage = getUsage(img.url);
            const relPath = img.url.replace('/uploads/', '');
            return (
              <div 
                key={img.name} 
                draggable 
                onDragStart={(e) => e.dataTransfer.setData('text/plain', relPath)}
                onClick={() => handleToggleSelect(img.url)}
                className={`bg-slate-800 rounded-xl border ${selectedImages.has(img.url) ? 'border-blue-400 ring-2 ring-blue-400' : usage.length > 0 ? 'border-blue-500/50' : 'border-slate-700'} overflow-hidden group relative flex flex-col shadow-lg cursor-pointer hover:-translate-y-1 transition-transform h-32`}
              >
                <div className="absolute top-2 left-2 z-10">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedImages.has(img.url) ? 'bg-blue-500 border-blue-500' : 'bg-slate-900/80 border-slate-500 group-hover:border-blue-400'}`}>
                    {selectedImages.has(img.url) && <CheckSquare size={14} className="text-white" />}
                  </div>
                </div>
                <div className="flex-1 bg-slate-900/80 flex items-center justify-center p-2 relative">
                  <img src={`${API}${img.url}`} className="max-w-full max-h-full object-contain" draggable={false} />
                  {usage.length > 0 && (
                    <div className="absolute top-1 right-1">
                      <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow border border-blue-500" title={usage.join('\n')}>사용중({usage.length})</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(img.url); showToast('URL 복사됨'); }} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white transition-colors" title="URL 복사"><Copy size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleRenameImage(img.url, img.name); }} className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-full text-white transition-colors" title="이름 변경"><Edit2 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.url); }} className="p-2 bg-red-600 hover:bg-red-500 rounded-full text-white transition-colors" title="이미지 삭제"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="p-1.5 text-[10px] text-slate-400 break-all border-t border-slate-700 bg-slate-800 flex justify-between items-center">
                  <span className="truncate flex-1 font-medium text-slate-300" title={img.name}>{img.name}</span>
                  <span className="text-slate-500 ml-1 whitespace-nowrap">{(img.size / 1024).toFixed(0)} KB</span>
                </div>
              </div>
            );
          })}

          {currentFolders.length === 0 && currentImages.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-700/30 border-dashed self-start">
              해당 폴더가 비어 있습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
