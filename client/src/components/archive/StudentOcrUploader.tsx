'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Sparkles,
  RefreshCw,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE } from '@/lib/api';
import type {
  NormalizedStudentOcrData,
  OcrErrorResponse,
  OcrMeta,
  OcrSceneType,
  OcrSlotName,
} from '@/lib/ocr/studentOcrParser';

interface StudentOcrUploaderProps {
  onOcrExtracted: (data: NormalizedStudentOcrData, meta?: OcrMeta) => void;
  disabled?: boolean;
}

interface SlotFileState {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  sizeKb: number;
}

interface SlotConfig {
  key: OcrSlotName;
  label: string;
  required: boolean;
  expectedScene: OcrSceneType;
  guideSrc: string;
  hint: string;
}

const SLOT_CONFIGS: readonly SlotConfig[] = [
  {
    key: 'main',
    label: '학생 상세',
    required: true,
    expectedScene: 'student_info',
    guideSrc: '/guides/ocr/student_info.png',
    hint: '기본 정보 메인 화면 (필수)',
  },
  {
    key: 'equip1',
    label: '장비 1',
    required: false,
    expectedScene: 'equipment_modal',
    guideSrc: '/guides/ocr/equipment_modal.png',
    hint: '1번 장비 모달 (선택)',
  },
  {
    key: 'equip2',
    label: '장비 2',
    required: false,
    expectedScene: 'equipment_modal',
    guideSrc: '/guides/ocr/equipment_modal.png',
    hint: '2번 장비 모달 (선택)',
  },
  {
    key: 'equip3',
    label: '장비 3',
    required: false,
    expectedScene: 'equipment_modal',
    guideSrc: '/guides/ocr/equipment_modal.png',
    hint: '3번 장비 모달 (선택)',
  },
  {
    key: 'favorite',
    label: '애용품',
    required: false,
    expectedScene: 'favorite_popup',
    guideSrc: '/guides/ocr/favorite_popup.png',
    hint: '애용품 팝업 (선택)',
  },
];

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const RATIO_16_9 = 16 / 9;
const RATIO_21_9 = 21 / 9;
const RATIO_TOLERANCE = 0.02;
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_EXT_RE = /\.(png|jpe?g|webp)$/i;

const SCENE_LABELS: Record<string, string> = {
  student_info: '학생 상세',
  equipment_modal: '장비 모달',
  favorite_popup: '애용품 팝업',
  unknown: '알 수 없는 화면',
};

const NEEDS_REVIEW_LABELS: Record<string, string> = {
  studentName: '학생명',
  level: '레벨',
  starGrade: '성급',
  bondRank: '인연 랭크',
  'skills.ex': 'EX 스킬',
  'skills.normal': '기본 스킬',
  'skills.passive': '강화 스킬',
  'skills.sub': '서브 스킬',
  'equipments[0].tier': '장비1 티어',
  'equipments[0].level': '장비1 레벨',
  'equipments[1].tier': '장비2 티어',
  'equipments[1].level': '장비2 레벨',
  'equipments[2].tier': '장비3 티어',
  'equipments[2].level': '장비3 레벨',
  favoriteItem: '애용품',
  'favoriteItem.tier': '애용품 티어',
  weapon: '전용무기',
  'weapon.starGrade': '전용무기 성급',
  'weapon.level': '전용무기 레벨',
  'stats.hp.value': '체력',
  'stats.hp.releaseLevel': '체력 능력개방',
  'stats.atk.value': '공격력',
  'stats.atk.releaseLevel': '공격력 능력개방',
  'stats.def.value': '방어력',
  'stats.def.releaseLevel': '방어력 능력개방',
  'stats.heal.value': '치유력',
  'stats.heal.releaseLevel': '치유력 능력개방',
};

const EMPTY_SLOTS: Record<OcrSlotName, SlotFileState | null> = {
  main: null,
  equip1: null,
  equip2: null,
  equip3: null,
  favorite: null,
};

const EMPTY_PREVIEW_URLS: Record<OcrSlotName, string | null> = {
  main: null,
  equip1: null,
  equip2: null,
  equip3: null,
  favorite: null,
};

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height };
    } catch {
      // Fallback to HTMLImageElement below
    } finally {
      bitmap?.close();
    }
  }

  return new Promise((resolve, reject) => {
    const tempUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error('이미지 규격을 읽지 못했습니다.'));
    };
    img.src = tempUrl;
  });
}

function isSupportedAspectRatio(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = width / height;
  const match16x9 = Math.abs(ratio - RATIO_16_9) / RATIO_16_9 <= RATIO_TOLERANCE;
  const match21x9 = Math.abs(ratio - RATIO_21_9) / RATIO_21_9 <= RATIO_TOLERANCE;
  return match16x9 || match21x9;
}

function formatReviewField(path: string): string {
  return NEEDS_REVIEW_LABELS[path] || path;
}

function formatSlotError(json: OcrErrorResponse): { slot?: OcrSlotName; message: string } {
  const detail = json.detail;
  if (json.code === 'SCENE_MISMATCH' && detail?.slot) {
    const rawDetected = detail.detected ? SCENE_LABELS[detail.detected] || detail.detected : '알 수 없는 화면';
    const rawExpected = detail.expected ? SCENE_LABELS[detail.expected] || detail.expected : '지정된 화면';
    const detectedLabel = rawDetected.endsWith('화면') ? rawDetected : `${rawDetected} 화면`;
    const expectedLabel = rawExpected.endsWith('화면') ? rawExpected : `${rawExpected} 화면`;
    return {
      slot: detail.slot,
      message:
        json.message ||
        json.error ||
        `${expectedLabel}이 필요하지만 ${detectedLabel}이 감지되었습니다.`,
    };
  }
  if (json.code === 'SLOT_DUPLICATE' && detail?.slot) {
    return {
      slot: detail.slot,
      message:
        json.message ||
        json.error ||
        `장비 ${detail.activeSlot ?? ''}번 모달이 '${detail.conflictingWith ?? ''}' 슬롯과 중복됩니다.`,
    };
  }
  return {
    slot: detail?.slot,
    message: json.error || json.message || 'OCR 처리에 실패했습니다.',
  };
}

export function StudentOcrUploader({ onOcrExtracted, disabled = false }: StudentOcrUploaderProps) {
  const [slots, setSlots] = useState<Record<OcrSlotName, SlotFileState | null>>(EMPTY_SLOTS);
  const [focusedSlot, setFocusedSlot] = useState<OcrSlotName>('main');
  const [dragOverSlot, setDragOverSlot] = useState<OcrSlotName | null>(null);
  const [slotErrors, setSlotErrors] = useState<Partial<Record<OcrSlotName, string>>>({});
  const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ studentName: string; meta: OcrMeta } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<OcrSlotName>('main');
  const abortControllerRef = useRef<AbortController | null>(null);
  const statusAbortRef = useRef<AbortController | null>(null);
  const previewUrlsRef = useRef<Record<OcrSlotName, string | null>>({ ...EMPTY_PREVIEW_URLS });
  const isMountedRef = useRef(true);
  const slotSeqRef = useRef<Record<OcrSlotName, number>>({
    main: 0,
    equip1: 0,
    equip2: 0,
    equip3: 0,
    favorite: 0,
  });

  const revokeSlotUrl = useCallback((slot: OcrSlotName) => {
    const existing = previewUrlsRef.current[slot];
    if (existing) {
      URL.revokeObjectURL(existing);
      previewUrlsRef.current[slot] = null;
    }
  }, []);

  const checkEngineStatus = useCallback(async (showChecking = false) => {
    statusAbortRef.current?.abort();
    const controller = new AbortController();
    statusAbortRef.current = controller;
    if (showChecking) {
      setEngineStatus('checking');
    }

    try {
      const res = await fetch(`${API_BASE}/ocr/status`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        setEngineStatus('offline');
        return;
      }
      const json = (await res.json()) as { healthy?: boolean };
      setEngineStatus(json?.healthy === true ? 'online' : 'offline');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setEngineStatus('offline');
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void checkEngineStatus(false);
    const previewUrls = previewUrlsRef.current;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      statusAbortRef.current?.abort();
      (Object.keys(previewUrls) as OcrSlotName[]).forEach((slot) => {
        const url = previewUrls[slot];
        if (url) {
          URL.revokeObjectURL(url);
          previewUrls[slot] = null;
        }
      });
    };
  }, [checkEngineStatus]);

  const assignFileToSlot = useCallback(
    async (slot: OcrSlotName, file: File) => {
      const seq = (slotSeqRef.current[slot] += 1);
      setFocusedSlot(slot);

      const isAllowedMime = file.type ? ALLOWED_MIMES.has(file.type.toLowerCase()) : false;
      const isAllowedExt = !file.type && ALLOWED_EXT_RE.test(file.name || '');

      if (!isAllowedMime && !isAllowedExt) {
        const msg = 'PNG, JPG, WebP 형식의 이미지 파일만 업로드할 수 있습니다.';
        setSlotErrors((prev) => ({ ...prev, [slot]: msg }));
        toast.error(msg);
        return;
      }

      if (file.size <= 0) {
        const msg = '빈 이미지 파일은 업로드할 수 없습니다.';
        setSlotErrors((prev) => ({ ...prev, [slot]: msg }));
        toast.error(msg);
        return;
      }

      if (file.size > MAX_FILE_BYTES) {
        const msg = '파일 크기는 8MB 이하여야 합니다.';
        setSlotErrors((prev) => ({ ...prev, [slot]: msg }));
        toast.error(msg);
        return;
      }

      let dims: { width: number; height: number };
      try {
        dims = await readImageDimensions(file);
      } catch {
        if (!isMountedRef.current || slotSeqRef.current[slot] !== seq) return;
        const msg = '이미지 파일을 디코딩할 수 없습니다.';
        setSlotErrors((prev) => ({ ...prev, [slot]: msg }));
        toast.error(msg);
        return;
      }

      if (!isMountedRef.current || slotSeqRef.current[slot] !== seq) return;

      if (dims.width < MIN_WIDTH || dims.height < MIN_HEIGHT) {
        const msg = `최소 1280×720 이상 해상도가 필요합니다 (현재 ${dims.width}×${dims.height}).`;
        setSlotErrors((prev) => ({ ...prev, [slot]: msg }));
        toast.error(msg);
        return;
      }

      if (!isSupportedAspectRatio(dims.width, dims.height)) {
        const msg = `16:9 또는 21:9 비율의 인게임 스크린샷만 지원됩니다 (현재 ${dims.width}×${dims.height}).`;
        setSlotErrors((prev) => ({ ...prev, [slot]: msg }));
        toast.error(msg);
        return;
      }

      revokeSlotUrl(slot);
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current[slot] = previewUrl;

      setSlots((prev) => ({
        ...prev,
        [slot]: {
          file,
          previewUrl,
          width: dims.width,
          height: dims.height,
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
        },
      }));
      setSlotErrors((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
      setGlobalError(null);
      setLastResult(null);
    },
    [revokeSlotUrl]
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || isLoading || e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInputFocused) return;

      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              void assignFileToSlot(focusedSlot, file);
              return;
            }
          }
        }
      }

      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/') || ALLOWED_EXT_RE.test(file.name || '')) {
            e.preventDefault();
            void assignFileToSlot(focusedSlot, file);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, isLoading, focusedSlot, assignFileToSlot]);

  const openFilePicker = (slot: OcrSlotName) => {
    if (disabled || isLoading) return;
    setFocusedSlot(slot);
    pendingSlotRef.current = slot;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void assignFileToSlot(pendingSlotRef.current, file);
    }
    if (e.target) e.target.value = '';
  };

  const handleDrop = (slot: OcrSlotName, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(null);
    if (disabled || isLoading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void assignFileToSlot(slot, file);
    }
  };

  const handleClearSlot = (slot: OcrSlotName, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;
    slotSeqRef.current[slot] += 1;
    revokeSlotUrl(slot);
    setSlots((prev) => ({ ...prev, [slot]: null }));
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setGlobalError(null);
    setLastResult(null);
  };

  const handleClearAll = () => {
    if (isLoading) {
      abortControllerRef.current?.abort();
    }
    (Object.keys(previewUrlsRef.current) as OcrSlotName[]).forEach((slot) => {
      slotSeqRef.current[slot] += 1;
      revokeSlotUrl(slot);
    });
    setSlots({ ...EMPTY_SLOTS });
    setSlotErrors({});
    setGlobalError(null);
    setLastResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelOcr = () => {
    abortControllerRef.current?.abort();
  };

  const handleExecuteOcr = async () => {
    if (!slots.main || isLoading || disabled) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setGlobalError(null);
    setSlotErrors({});

    const toastId = toast.loading('5슬롯 OCR 분석 중...');

    try {
      const formData = new FormData();
      formData.append('main', slots.main.file);
      (['equip1', 'equip2', 'equip3', 'favorite'] as const).forEach((slotKey) => {
        const entry = slots[slotKey];
        if (entry) {
          formData.append(slotKey, entry.file);
        }
      });

      const headers: HeadersInit = {};
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${API_BASE}/ocr`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (res.status === 499) {
        toast.info('OCR 요청이 취소되었습니다.', { id: toastId });
        return;
      }

      const responseText = await res.text();
      if (res.status === 502 || res.status === 503 || res.status === 530) {
        setEngineStatus('offline');
      }

      let json: {
        success?: boolean;
        data?: NormalizedStudentOcrData;
        meta?: OcrMeta;
      } & Partial<OcrErrorResponse>;

      try {
        json = JSON.parse(responseText);
      } catch {
        throw new Error(
          `서버 응답 오류 (HTTP ${res.status}): ${responseText.slice(0, 150) || '올바른 JSON 응답이 아닙니다.'}`
        );
      }

      if (!res.ok || json.success === false) {
        if (res.status === 422) {
          const mapped = formatSlotError(json as OcrErrorResponse);
          if (mapped.slot) {
            setSlotErrors({ [mapped.slot]: mapped.message });
          }
          throw new Error(mapped.message);
        }
        if (res.status === 429 || json.code === 'QUEUE_FULL' || json.code === 'RATE_LIMITED') {
          throw new Error(json.error || json.message || '요청 제한에 도달했거나 대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.');
        }
        if (res.status === 504 || json.code === 'QUEUE_TIMEOUT' || json.code === 'ENGINE_TIMEOUT') {
          throw new Error(json.error || json.message || 'OCR 처리 시간이 초과되었습니다. 다시 시도해주세요.');
        }
        throw new Error(json.error || json.message || `OCR 요청 실패 (HTTP ${res.status})`);
      }

      if (!json.data) {
        throw new Error('추출된 학생 스펙 데이터가 없습니다.');
      }

      const extractedData = json.data;
      const meta = json.meta;
      if (meta) {
        setLastResult({ studentName: extractedData.studentName || '알 수 없음', meta });
      }
      setEngineStatus('online');

      toast.success(
        extractedData.studentName
          ? `[${extractedData.studentName}] 스펙이 추출되어 폼에 반영되었습니다.`
          : '학생 스펙이 추출되었습니다.',
        { id: toastId }
      );

      onOcrExtracted(extractedData, meta);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('OCR 요청이 취소되었습니다.', { id: toastId });
        return;
      }
      const errMsg = err instanceof Error ? err.message : 'OCR 처리 도중 오류가 발생했습니다.';
      setGlobalError(errMsg);
      toast.error(errMsg, { id: toastId });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const filledCount = (Object.keys(slots) as OcrSlotName[]).filter((k) => Boolean(slots[k])).length;

  const renderSlotCard = (cfg: SlotConfig, isPrimary = false) => {
    const item = slots[cfg.key];
    const slotError = slotErrors[cfg.key];
    const isFocused = focusedSlot === cfg.key;
    const isDragOver = dragOverSlot === cfg.key;

    const borderClass = slotError
      ? 'border-rose-400 bg-rose-50/40'
      : isDragOver
        ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/25'
        : isFocused
          ? 'border-sky-500 ring-2 ring-sky-500/20 bg-white'
          : 'border-slate-200/80 bg-white/80 hover:border-sky-500/40';

    return (
      <div
        key={cfg.key}
        tabIndex={0}
        onFocus={() => setFocusedSlot(cfg.key)}
        onClick={() => {
          setFocusedSlot(cfg.key);
          if (!item) openFilePicker(cfg.key);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled && !isLoading) setDragOverSlot(cfg.key);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverSlot((prev) => (prev === cfg.key ? null : prev));
        }}
        onDrop={(e) => handleDrop(cfg.key, e)}
        className={`rounded-xl border p-2.5 transition-all duration-200 flex flex-col gap-2 cursor-pointer focus:outline-none group ${borderClass} ${isPrimary ? 'h-full justify-between' : ''}`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold -skew-x-6 rounded-xs ${cfg.required
                ? 'bg-sky-500 text-white'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
            >
              <span className="skew-x-6">{cfg.required ? '필수' : '선택'}</span>
            </span>
            <span className="text-xs font-bold text-slate-900 truncate">{cfg.label}</span>
          </div>

          <div className="flex items-center gap-1">
            {isFocused && (
              <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                Ctrl+V 대상
              </span>
            )}
            {item && (
              <button
                type="button"
                onClick={(e) => handleClearSlot(cfg.key, e)}
                disabled={isLoading || disabled}
                title={`${cfg.label} 이미지 제거`}
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200 active:scale-[0.98] disabled:opacity-40"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div
          className={`relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200/80 bg-slate-100 flex items-center justify-center ${isPrimary ? 'min-h-[150px]' : ''
            }`}
        >
          {item ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={`${cfg.label} 미리보기`}
                className="w-full h-full object-contain bg-slate-900/5"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openFilePicker(cfg.key);
                }}
                disabled={isLoading || disabled}
                className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-white/90 backdrop-blur-xs border border-slate-200 text-[10px] font-bold text-slate-700 hover:border-sky-500/40 transition-all duration-200 active:scale-[0.98]"
              >
                변경
              </button>
              <div className="absolute bottom-1.5 right-1.5 bg-slate-900/75 backdrop-blur-xs text-[10px] text-white font-mono px-1.5 py-0.5 rounded tabular-nums">
                {item.width}×{item.height} · {item.sizeKb.toLocaleString()}KB
              </div>
            </>
          ) : (
            <>
              <Image
                src={cfg.guideSrc}
                alt={`${cfg.label} 촬영 예시`}
                width={480}
                height={270}
                unoptimized
                className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/65 via-slate-900/20 to-transparent flex flex-col items-center justify-end p-2 text-center">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[10px] font-bold text-slate-800 shadow-xs">
                  <Upload size={11} className="text-sky-500" />
                  클릭 · 드래그 · Ctrl+V
                </span>
                <span className="text-[10px] text-white/95 font-medium mt-1 drop-shadow-xs">
                  {cfg.hint}
                </span>
              </div>
            </>
          )}
        </div>

        {slotError && (
          <p className="text-[11px] font-semibold text-rose-600 flex items-start gap-1 leading-snug">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{slotError}</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
            <Sparkles size={17} />
          </div>
          <div>
            <h3 className="font-title-v text-sm font-bold tracking-tight text-slate-900">
              인게임 스크린샷 자동 인식 (5슬롯 OCR)
            </h3>
            <p className="text-xs text-slate-500">
              원본 스크린샷을 미리보기에 있는것처럼 첨부해주세요(지원 해상도 : FHD,QHD). 장비1 장비2 장비3은 각각 1슬롯 2슬롯 3슬롯을 첨부해주세요. 애용품은 해당 학생이 장착을 했을경우 선택적으로 업로드를 해주시면 됩니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {engineStatus === 'checking' && (
            <span className="animate-pulse px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
              엔진 확인 중...
            </span>
          )}
          {engineStatus === 'online' && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 border border-sky-500/20">
              OCR 엔진 정상
            </span>
          )}
          {engineStatus === 'offline' && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
              OCR 서버 오프라인
            </span>
          )}
          <button
            type="button"
            onClick={() => void checkEngineStatus(true)}
            disabled={engineStatus === 'checking' || isLoading}
            title="OCR 엔진 상태 재확인"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw size={13} className={engineStatus === 'checking' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {engineStatus === 'offline' && (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <span>
              현재 OCR 서버에 연결할 수 없습니다(점검 중). 아래 폼에서 학생 정보를 직접 입력하여 등록할 수 있습니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() => void checkEngineStatus(true)}
            className="px-2.5 py-1 rounded-md bg-white border border-amber-300 text-[11px] font-bold text-amber-800 hover:border-sky-500/40 transition-all duration-200 active:scale-[0.98]"
          >
            재확인
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        disabled={disabled || isLoading}
        className="hidden"
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5">{renderSlotCard(SLOT_CONFIGS[0], true)}</div>
        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SLOT_CONFIGS.slice(1).map((cfg) => renderSlotCard(cfg, false))}
        </div>
      </div>

      {isLoading && (
        <div className="animate-pulse rounded-xl border border-sky-200 bg-sky-50/70 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-sky-800">
            <Loader2 size={14} className="animate-spin text-sky-500" />
            <span>화면 판별 및 ROI OCR 정밀 분석 중...</span>
          </div>
          <div className="h-2 w-2/3 rounded-full bg-sky-200/80" />
        </div>
      )}

      {globalError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2.5 animate-fade-in">
          <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block text-rose-900 font-bold mb-0.5">OCR 추출 실패</strong>
            <p className="text-[11px] text-rose-700 leading-relaxed">{globalError}</p>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 text-emerald-900">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>[{lastResult.studentName}] 데이터 추출 및 폼 반영 완료</span>
            </div>
            <span className="font-mono text-[11px] text-emerald-700 tabular-nums">
              {lastResult.meta.preset} · {Math.round(lastResult.meta.elapsedMs).toLocaleString()}ms
              {lastResult.meta.studentMatch.score < 0.95 &&
                ` · 매칭 ${Math.round(lastResult.meta.studentMatch.score * 100)}%`}
            </span>
          </div>

          {lastResult.meta.needsReview.length > 0 && (
            <div className="pt-1.5 border-t border-emerald-200/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-600" />
                검수 필요 항목:
              </span>
              {lastResult.meta.needsReview.map((field) => (
                <span
                  key={field}
                  className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-900"
                >
                  {formatReviewField(field)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExecuteOcr()}
            disabled={!slots.main || isLoading || disabled}
            className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-600 hover:to-cyan-500 text-white font-bold text-sm rounded-xl transition-all duration-200 active:scale-[0.98] shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>OCR 분석 중...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>OCR 추출 실행</span>
              </>
            )}
          </button>

          {isLoading && (
            <button
              type="button"
              onClick={handleCancelOcr}
              className="text-xs text-rose-700 hover:text-rose-900 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 transition-all duration-200 active:scale-[0.98] border border-rose-200 cursor-pointer font-semibold flex items-center gap-1.5"
            >
              <Square size={12} className="fill-rose-700" />
              <span>추출 중단</span>
            </button>
          )}
        </div>

        {filledCount > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={disabled}
            className="text-xs text-slate-600 hover:text-rose-600 px-3 py-2 rounded-lg bg-slate-100 hover:bg-rose-50 transition-all duration-200 active:scale-[0.98] border border-slate-200 font-semibold flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            <span className="tabular-nums">전체 비우기 ({filledCount})</span>
          </button>
        )}
      </div>
    </div>
  );
}
