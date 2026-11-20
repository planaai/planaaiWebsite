import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Search, Folder, FolderUp } from 'lucide-react';
import { API } from '../../constants';

interface ImageData {
  url: string;
  name: string;
  size: number;
  createdAt: string;
}

interface ImagePickerModalProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export function ImagePickerModal({ onSelect, onClose }: ImagePickerModalProps) {
  const [images, setImages] = useState<ImageData[]>([]);
  const [serverFolders, setServerFolders] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [imgRes, folderRes] = await Promise.all([
          axios.get(`${API}/api/images`),
          axios.get(`${API}/api/images/folders`)
        ]);
        setImages(imgRes.data);
        setServerFolders(folderRes.data);
      } catch (err) {
        console.error('Failed to fetch data', err);
      }
    };
    fetchData();
  }, []);

  const getParentPath = (path: string) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath('');
    } else {
      const parts = currentPath.split('/');
      setCurrentPath(parts.slice(0, index + 1).join('/'));
    }
  };

  const currentFolders: { name: string; fullPath: string }[] = [];
  const prefix = currentPath ? currentPath + '/' : '';
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">🖼️ DB에서 이미지 선택</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        
        <div className="flex flex-col gap-3 bg-slate-800 p-4 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3 w-full">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-400" />
              </div>
              <input 
                type="text"
                placeholder="파일명 검색..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-all shadow-inner"
              />
            </div>
          </div>
          
          <div className="flex items-center text-sm bg-slate-900/50 p-2 rounded border border-slate-700 overflow-x-auto whitespace-nowrap">
            <span 
              className="cursor-pointer hover:text-blue-400 text-blue-300 font-bold transition-colors"
              onClick={() => handleBreadcrumbClick(-1)}
            >
              🏠 Root
            </span>
            {currentPath.split('/').filter(Boolean).map((part, index) => (
              <React.Fragment key={index}>
                <span className="text-slate-500 mx-2">/</span>
                <span 
                  className="cursor-pointer hover:text-blue-400 text-blue-300 font-bold transition-colors"
                  onClick={() => handleBreadcrumbClick(index)}
                >
                  {part}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            
            {/* Back Folder */}
            {currentPath !== '' && !searchQuery && (
              <div 
                onDoubleClick={() => setCurrentPath(getParentPath(currentPath))}
                className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg cursor-pointer hover:bg-slate-700 transition-colors flex flex-col items-center justify-center p-4 h-24"
              >
                <FolderUp size={32} className="text-slate-400 mb-2" />
                <span className="text-[10px] font-bold text-slate-300">.. (상위 폴더)</span>
              </div>
            )}

            {/* Folders */}
            {!searchQuery && currentFolders.map(folder => (
              <div 
                key={folder.fullPath}
                onDoubleClick={() => setCurrentPath(folder.fullPath)}
                className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-lg hover:bg-slate-700 transition-colors flex flex-col items-center justify-center p-4 h-24 group cursor-pointer"
              >
                <Folder size={32} className="text-amber-400 mb-2 drop-shadow group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-slate-300 truncate w-full text-center px-1" title={folder.name}>{folder.name}</span>
              </div>
            ))}

            {/* Images */}
            {currentImages.map(img => (
              <div 
                key={img.url} 
                onClick={() => { onSelect(img.url); onClose(); }}
                className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden group cursor-pointer hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all flex flex-col h-24"
              >
                <div className="flex-1 bg-slate-900/80 flex items-center justify-center p-2">
                  <img src={`${API}${img.url}`} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-1.5 text-[9px] text-slate-400 border-t border-slate-700 bg-slate-800 flex justify-center items-center">
                  <span className="truncate max-w-full" title={img.name}>{img.name}</span>
                </div>
              </div>
            ))}

            {currentFolders.length === 0 && currentImages.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-700/30 border-dashed">
                해당 폴더가 비어 있습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
