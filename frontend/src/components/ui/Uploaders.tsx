import React, { useRef, useState } from 'react';
import axios from 'axios';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';
import { API } from '../../constants';
import { ImagePickerModal } from '../images/ImagePickerModal';

interface UploaderProps {
  url?: string;
  onChange?: (url: string) => void;
  onUpload?: (url: string) => void;
  showToast: (m: string, t?: 'error') => void;
}

export function TierIconUpload({ url, onChange, showToast }: UploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('icon', file);
    setUploading(true);
    try {
      const res = await axios.post(`${API}/api/upload/skill-icon`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onChange?.(res.data.url);
    } catch {
      showToast('이미지 업로드 실패', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 items-center">
      <div
        className={`relative w-8 h-8 rounded ${
          url ? 'bg-transparent border-transparent' : 'bg-slate-900 border-slate-600'
        } border flex items-center justify-center overflow-hidden group cursor-pointer flex-shrink-0`}
        onClick={() => fileRef.current?.click()}
      >
        {url ? (
          <img src={`${API}${url}`} className="w-full h-full object-contain drop-shadow-md group-hover:opacity-50 transition-opacity" />
        ) : (
          <ImageIcon className="text-slate-500 group-hover:text-blue-400 transition-colors" size={16} />
        )}
        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="w-3 h-3 border border-white rounded-full animate-spin border-t-transparent" />
          </div>
        )}
      </div>
      <button onClick={() => setShowPicker(true)} className="text-[9px] text-blue-400 hover:text-blue-300">DB 선택</button>
      {showPicker && <ImagePickerModal onSelect={val => onChange?.(val)} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

export function PortraitUpload({ url, onChange, showToast }: UploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('portrait', file);
    setUploading(true);
    try {
      const res = await axios.post(`${API}/api/upload/portrait`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onChange?.(res.data.url);
    } catch {
      showToast('이미지 업로드 실패', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 items-center justify-center">
      <div
        className="relative w-24 h-24 rounded-2xl bg-slate-900 border border-slate-600 flex items-center justify-center overflow-hidden group cursor-pointer shadow-inner p-1"
        onClick={() => fileRef.current?.click()}
      >
        {url ? (
          <img src={`${API}${url}`} className="w-full h-full object-contain drop-shadow-md group-hover:opacity-50 transition-opacity" />
        ) : (
          <ImageIcon className="text-slate-500 group-hover:text-blue-400 transition-colors" size={32} />
        )}
        <div className="absolute inset-0 bg-black/50 flex flex-col gap-1 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <UploadCloud size={20} className="text-white" />
          <span className="text-[10px] text-white font-bold">1:1 사진</span>
        </div>
        {uploading && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
      <button onClick={() => setShowPicker(true)} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold bg-blue-900/20 px-2 py-1 rounded w-full border border-blue-500/20">DB에서 선택</button>
      {showPicker && <ImagePickerModal onSelect={val => onChange?.(val)} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

export function IllustUpload({ url, onChange, showToast }: UploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('illust', file);
    setUploading(true);
    try {
      const res = await axios.post(`${API}/api/upload/illust`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onChange?.(res.data.url);
    } catch {
      showToast('업로드 실패', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 items-center justify-center mt-4 w-32">
      <div
        className="relative w-full h-64 rounded-2xl bg-slate-900 border border-slate-600 flex items-center justify-center overflow-hidden group cursor-pointer shadow-inner p-2"
        onClick={() => fileRef.current?.click()}
      >
        {url ? (
          <img src={`${API}${url}`} className="w-full h-full object-contain drop-shadow-lg group-hover:opacity-50 transition-opacity" />
        ) : (
          <ImageIcon className="text-slate-500 group-hover:text-blue-400 transition-colors" size={32} />
        )}
        <div className="absolute inset-0 bg-black/50 flex flex-col gap-1 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <UploadCloud size={20} className="text-white" />
          <span className="text-[10px] text-white font-bold">전신 일러스트</span>
        </div>
        {uploading && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
      <button onClick={() => setShowPicker(true)} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold bg-blue-900/20 px-2 py-1 rounded w-full border border-blue-500/20">DB에서 선택</button>
      {showPicker && <ImagePickerModal onSelect={val => onChange?.(val)} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

export function ResourceIconUpload({ label, url, onUpload, showToast }: { label: string; url: string; onUpload: (url: string) => void; showToast: (m: string, t?: 'error') => void; }) {
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('icon', file);
      const res = await axios.post(`${API}/api/upload/skill-icon`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onUpload(res.data.url);
      showToast(`${label} 아이콘 업로드 완료`);
    } catch {
      showToast('아이콘 업로드 실패', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="text-[10px] font-bold text-slate-400 truncate w-16 text-center">{label}</div>
      <div className={`w-14 h-14 rounded-xl ${url ? 'bg-transparent' : 'bg-slate-900 border border-slate-700'} flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition-colors shadow-inner`} onClick={() => fileInputRef.current?.click()} title="이미지 업로드">
        {uploading ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : url ? <img src={`${API}${url}`} className="w-full h-full object-contain p-1 drop-shadow-md" /> : <ImageIcon size={20} className="text-slate-600" />}
      </div>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
      <button onClick={() => setShowPicker(true)} className="text-[9px] text-blue-400 hover:text-blue-300 font-bold border border-blue-900/50 px-1.5 py-0.5 rounded w-full">DB선택</button>
      {showPicker && <ImagePickerModal onSelect={val => onUpload(val)} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

export function FavoriteItemUpload({ url, onChange, showToast }: UploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('icon', file); // Use skill-icon route for favorite items
    setUploading(true);
    try {
      const res = await axios.post(`${API}/api/upload/skill-icon`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onChange?.(res.data.url);
    } catch {
      showToast('이미지 업로드 실패', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 items-center">
      <div
        className={`relative w-12 h-12 rounded-xl ${
          url ? 'bg-transparent border-transparent' : 'bg-slate-900 border-slate-600'
        } border flex items-center justify-center overflow-hidden group cursor-pointer flex-shrink-0 shadow-inner p-1`}
        onClick={() => fileRef.current?.click()}
        title="애장품 이미지"
      >
        {url ? (
          <img src={`${API}${url}`} className="w-full h-full object-contain drop-shadow-md group-hover:opacity-50 transition-opacity" />
        ) : (
          <ImageIcon className="text-slate-500 group-hover:text-pink-400 transition-colors" size={20} />
        )}
        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="w-4 h-4 border-2 border-pink-500 rounded-full animate-spin border-t-transparent" />
          </div>
        )}
      </div>
      <button onClick={() => setShowPicker(true)} className="text-[9px] text-pink-400 hover:text-pink-300">DB 선택</button>
      {showPicker && <ImagePickerModal onSelect={val => onChange?.(val)} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

export function UniqueWeaponUpload({ url, onChange, showToast }: UploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('icon', file);
    setUploading(true);
    try {
      const res = await axios.post(`${API}/api/upload/skill-icon`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onChange?.(res.data.url);
    } catch {
      showToast('이미지 업로드 실패', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 items-center">
      <div
        className={`relative w-16 h-16 rounded-xl ${
          url ? 'bg-[#111b3d] border-slate-600' : 'bg-slate-900 border-slate-600'
        } border flex items-center justify-center overflow-hidden group cursor-pointer flex-shrink-0 shadow-inner p-1`}
        onClick={() => fileRef.current?.click()}
        title="고유무기 이미지"
      >
        {url ? (
          <img src={`${API}${url}`} className="w-full h-full object-contain drop-shadow-md group-hover:opacity-50 transition-opacity" />
        ) : (
          <ImageIcon className="text-slate-500 group-hover:text-amber-400 transition-colors" size={24} />
        )}
        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
        {uploading && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <button onClick={() => setShowPicker(true)} className="text-[9px] text-amber-400 hover:text-amber-300">DB 선택</button>
      {showPicker && <ImagePickerModal onSelect={val => onChange?.(val)} onClose={() => setShowPicker(false)} />}
    </div>
  );
}
