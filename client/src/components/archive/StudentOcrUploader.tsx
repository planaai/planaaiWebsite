'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Info,
  ImagePlus,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE } from '@/lib/api';
import type { NormalizedStudentOcrData } from '@/lib/ocr/studentOcrParser';

interface StudentOcrUploaderProps {
  onOcrExtracted: (data: NormalizedStudentOcrData) => void;
  disabled?: boolean;
}

interface ImageMetadata {
  dataUrl: string;
  fileName: string;
  width: number;
  height: number;
  sizeKb: number;
}

interface OcrApiResponse {
  success: boolean;
  data?: NormalizedStudentOcrData;
  error?: string;
  code?: string;
  model?: string;
}

export function StudentOcrUploader({ onOcrExtracted, disabled = false }: StudentOcrUploaderProps) {
  const [imageMeta, setImageMeta] = useState<ImageMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastExtractedName, setLastExtractedName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 컴포넌트 언마운트 시 진행 중인 요청 취소
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * 고해상도 스크린샷 최적화 및 캔버스 다운스케일링 (메모리 절약 및 NIM 페이로드 최적화)
   */
  const processAndSetImage = useCallback((file: File) => {
    const isImageMime = file.type.startsWith('image/');
    const isImageExt = /\.(png|jpe?g|webp|bmp)$/i.test(file.name || '');

    if (!isImageMime && !isImageExt) {
      toast.error('이미지 파일(PNG, JPG, WebP)만 업로드할 수 있습니다.');
      return;
    }

    if (file.size === 0) {
      toast.error('빈 이미지 파일입니다.');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      toast.error('파일 크기가 30MB를 초과하여 처리할 수 없습니다.');
      return;
    }

    // 메모리 절약을 위해 FileReader 대신 createObjectURL 사용
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);

      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      if (!origW || !origH || origW <= 0 || origH <= 0) {
        toast.error('이미지 규격을 확인할 수 없습니다.');
        return;
      }

      const maxDim = 1920;
      let targetW = origW;
      let targetH = origH;

      if (Math.max(origW, origH) > maxDim) {
        const scale = maxDim / Math.max(origW, origH);
        targetW = Math.max(1, Math.round(origW * scale));
        targetH = Math.max(1, Math.round(origH * scale));
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Canvas 2D context unavailable');
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);
        let quality = 0.88;
        let optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        let approxSizeKb = Math.round((optimizedDataUrl.length * 3) / 4 / 1024);

        // 페이로드가 1MB를 초과하는 경우 점진적 압축 (NIM 권장 규격 맞춤)
        while (approxSizeKb > 1000 && quality > 0.5) {
          quality -= 0.1;
          optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
          approxSizeKb = Math.round((optimizedDataUrl.length * 3) / 4 / 1024);
        }

        // 품질을 최저치(0.5)까지 낮추어도 1MB를 초과하는 경우 캔버스 규격 축소
        if (approxSizeKb > 1000) {
          const downscale = 1280 / Math.max(targetW, targetH);
          if (downscale < 1) {
            targetW = Math.max(1, Math.round(targetW * downscale));
            targetH = Math.max(1, Math.round(targetH * downscale));
            canvas.width = targetW;
            canvas.height = targetH;
            ctx.drawImage(img, 0, 0, targetW, targetH);
            optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            approxSizeKb = Math.round((optimizedDataUrl.length * 3) / 4 / 1024);
          }
        }

        setImageMeta({
          dataUrl: optimizedDataUrl,
          fileName: file.name || 'clipboard_screenshot.jpg',
          width: targetW,
          height: targetH,
          sizeKb: approxSizeKb,
        });
        setErrorMessage(null);
        setLastExtractedName(null);
        toast.info('스크린샷이 준비되었습니다. [OCR 추출 실행] 버튼을 눌러주세요.');
      } catch {
        // 캔버스 실패 시 원본이 2MB 이하일 때만 FileReader 폴백
        if (file.size <= 2 * 1024 * 1024) {
          const fallbackReader = new FileReader();
          fallbackReader.onload = (e) => {
            const rawUrl = e.target?.result as string;
            if (rawUrl) {
              setImageMeta({
                dataUrl: rawUrl,
                fileName: file.name || 'screenshot.png',
                width: origW,
                height: origH,
                sizeKb: Math.round(file.size / 1024),
              });
              setErrorMessage(null);
              setLastExtractedName(null);
              toast.info('스크린샷이 준비되었습니다. [OCR 추출 실행] 버튼을 눌러주세요.');
            }
          };
          fallbackReader.readAsDataURL(file);
        } else {
          toast.error('고해상도 이미지 변환에 실패했습니다. 이미지 용량을 줄이거나 다른 형식으로 시도해주세요.');
        }
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      toast.error('이미지 데이터를 디코딩하지 못했습니다.');
    };

    img.src = blobUrl;
  }, []);

  // 클립보드 붙여넣기 (Ctrl+V) 이벤트 리스너 등록
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || isLoading || e.defaultPrevented) return;

      // 사용자가 텍스트 입력 필드(input, textarea)에 포커스 중인 경우 붙여넣기 가로채기 방지
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isInputFocused) {
        return;
      }

      // 1) 클립보드 items 확인
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              processAndSetImage(file);
              return;
            }
          }
        }
      }

      // 2) 윈도우 파일 복사(files) 폴백 확인
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name || '')) {
            e.preventDefault();
            processAndSetImage(file);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, isLoading, processAndSetImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndSetImage(file);
    }
    // 동일한 파일 재선택 허용
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isLoading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndSetImage(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleClearImage = () => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setImageMeta(null);
    setErrorMessage(null);
    setLastExtractedName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancelOcr = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  /**
   * 명시적 추출 실행 버튼 클릭 시에만 API 요청 발생
   */
  const handleExecuteOcr = async () => {
    if (!imageMeta || isLoading || disabled) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMessage(null);

    const toastId = toast.loading('OCR 분석 중...');

    try {
      const endpoint = API_BASE ? `${API_BASE}/ocr` : '/api/ocr';
      let res: Response;

      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: imageMeta.dataUrl,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr: unknown) {
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw fetchErr;
        }
        // API_BASE 호출 실패 시 로컬 /api/ocr 폴백 시도
        if (endpoint !== '/api/ocr') {
          res = await fetch('/api/ocr', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: imageMeta.dataUrl,
            }),
            signal: controller.signal,
          });
        } else {
          throw fetchErr;
        }
      }

      const responseText = await res.text();
      let json: OcrApiResponse;
      try {
        json = JSON.parse(responseText);
      } catch {
        throw new Error(
          `서버 응답 오류 (HTTP ${res.status}): ${
            responseText.slice(0, 150) || '서버가 올바른 JSON 응답을 반환하지 않았습니다.'
          }`
        );
      }

      if (!res.ok || !json.success) {
        if (res.status === 499) {
          toast.info('OCR 요청이 취소되었습니다.', { id: toastId });
          return;
        }
        if (res.status === 429 || json.code === 'QUEUE_FULL') {
          throw new Error(
            json.error || '호출 제한(40 RPM)에 도달했거나 대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.'
          );
        }
        if (res.status === 504 || json.code === 'QUEUE_TIMEOUT') {
          throw new Error(json.error || '대기열 처리 시간이 초과되었습니다. 다시 시도해주세요.');
        }
        throw new Error(json.error || `OCR 요청 실패 (HTTP ${res.status})`);
      }

      if (!json.data) {
        throw new Error('추출된 학생 스펙 데이터가 없습니다.');
      }

      const extractedData: NormalizedStudentOcrData = json.data;
      setLastExtractedName(extractedData.studentName || '알 수 없음');
      toast.success(
        extractedData.studentName
          ? `[${extractedData.studentName}] 스펙이 성공적으로 추출되어 폼에 반영되었습니다!`
          : '학생 스펙이 성공적으로 추출되었습니다!',
        { id: toastId }
      );

      // 상위 폼에 데이터 주입
      onOcrExtracted(extractedData);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('OCR 요청이 취소되었습니다.', { id: toastId });
        return;
      }
      const errMsg = err instanceof Error ? err.message : 'OCR 처리 도중 오류가 발생했습니다.';
      setErrorMessage(errMsg);
      toast.error(errMsg, { id: toastId });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="bg-gradient-to-br from-white to-[var(--plana-primary-light)]/10 border border-[var(--plana-border)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* 상단 헤더: API 키/모델 설정 제거된 정갈한 테크니컬 디자인 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--plana-border)]/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--plana-primary-light)]/40 flex items-center justify-center text-[var(--plana-primary-dark)]">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-[var(--plana-text-main)] flex items-center gap-2">
              인게임 스크린샷 AI 자동 인식 (OCR)
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--plana-primary)] text-white">
                DeepSeek Vision
              </span>
            </h3>
            <p className="text-xs text-[var(--plana-text-muted)]">
              학생 상세 스펙 스크린샷을 등록하면 레벨, 스킬, 장비, 전무, 스탯이 폼에 자동 입력됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 숨겨진 파일 인풋 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        disabled={disabled || isLoading}
        className="hidden"
      />

      {/* 이미지 미선택 시 드롭다운 업로드 영역 */}
      {!imageMeta ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => !disabled && !isLoading && fileInputRef.current?.click()}
          className="border-2 border-dashed border-[var(--plana-border)] hover:border-[var(--plana-primary)] bg-white/70 hover:bg-white rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 group"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--plana-primary-light)]/30 group-hover:bg-[var(--plana-primary-light)]/60 flex items-center justify-center text-[var(--plana-primary)] transition-colors">
            <Upload size={22} className="group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--plana-text-main)]">
              클릭하여 스크린샷 이미지 업로드 또는 드래그 앤 드롭
            </p>
            <p className="text-xs text-[var(--plana-text-muted)] mt-1">
              클립보드 스크린샷 복사 후 창 어디서나 <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 font-mono text-[10px] font-bold">Ctrl+V</kbd> 로 바로 붙여넣을 수도 있습니다.
            </p>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">지원 형식: PNG, JPG, WebP (최대 1920px 자동 최적화)</span>
        </div>
      ) : (
        /* 이미지 선택 완료 시: 화이트 테마 프리뷰 박스 (Shittim Chest Technical Glassmorphism) */
        <div className="bg-white/95 rounded-xl p-4 text-slate-800 space-y-3.5 shadow-xs border border-slate-200/80 backdrop-blur-xs">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* 썸네일 미리보기 컨테이너 */}
            <div className="relative w-full sm:w-60 h-36 bg-slate-50 rounded-lg overflow-hidden border border-slate-200/80 flex items-center justify-center flex-shrink-0 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageMeta.dataUrl}
                alt="학생 스펙 스크린샷 미리보기"
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-1 right-1 bg-slate-900/75 backdrop-blur-xs text-[10px] text-white font-mono px-1.5 py-0.5 rounded tabular-nums">
                {imageMeta.width}×{imageMeta.height}
              </div>
            </div>

            {/* 이미지 메타데이터 및 액션 */}
            <div className="flex-1 space-y-2.5 w-full">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800 truncate max-w-[260px]">
                    {imageMeta.fileName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    전송 규격: 약 {imageMeta.sizeKb} KB ({imageMeta.width}×{imageMeta.height}px)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearImage}
                  disabled={isLoading || disabled}
                  className="text-xs text-slate-500 hover:text-rose-600 font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 transition-colors flex items-center gap-1 disabled:opacity-50 border border-slate-200/60"
                  title="이미지 제거"
                >
                  <X size={14} /> 취소
                </button>
              </div>

              {/* 안내 문구 (이모지 대신 Lucide Info 아이콘 사용) */}
              {!lastExtractedName && !errorMessage && !isLoading && (
                <div className="text-[11px] text-sky-800 bg-sky-50/80 px-3 py-2 rounded-lg border border-sky-200/70 flex items-center gap-2">
                  <Info size={14} className="text-sky-500 flex-shrink-0" />
                  <span>
                    프리뷰가 준비되었습니다. 아래 <strong className="text-sky-700 font-bold">[OCR 추출 실행]</strong> 버튼을 누르면 인게임 스펙 분석이 시작됩니다.
                  </span>
                </div>
              )}

              {/* 추출 성공 알림 배지 (라이트 에메랄드 테마) */}
              {lastExtractedName && (
                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-3 py-2 rounded-lg flex items-center gap-2 font-medium">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                  <span>
                    <strong>[{lastExtractedName}]</strong> 데이터 추출 및 폼 반영 완료! 입력값을 확인해주세요.
                  </span>
                </div>
              )}

              {/* 명시적 추출 실행 버튼 */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExecuteOcr}
                  disabled={isLoading || disabled}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-[var(--plana-primary-dark)] to-pink-500 hover:from-pink-600 hover:to-rose-500 text-white font-bold text-sm rounded-xl transition-all shadow-[0_4px_14px_rgba(255,105,180,0.35)] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white" />
                      <span>OCR 분석 중...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="text-white" />
                      <span>OCR 추출 실행</span>
                    </>
                  )}
                </button>

                {isLoading && (
                  <button
                    type="button"
                    onClick={handleCancelOcr}
                    className="text-xs text-rose-700 hover:text-rose-900 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 cursor-pointer font-semibold flex items-center gap-1.5"
                  >
                    <Square size={13} className="fill-rose-700 text-rose-700" />
                    <span>추출 중단</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="text-xs text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 border border-slate-200/80 font-semibold flex items-center gap-1.5"
                >
                  <ImagePlus size={14} className="text-slate-600" />
                  <span>다른 이미지 선택</span>
                </button>
              </div>
            </div>
          </div>

          {/* 에러 피드백 (라이트 로즈 테마) */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 flex items-start gap-2.5 animate-fade-in shadow-2xs">
              <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="block text-rose-900 font-bold mb-0.5">추출 실패 안내</strong>
                <p className="text-[11px] text-rose-700 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
