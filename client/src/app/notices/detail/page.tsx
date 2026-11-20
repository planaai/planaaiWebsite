'use client';



import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Eye, User, Download, Loader2, Pencil, Trash2 } from 'lucide-react';
import { api, API_BASE } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/sanitize';

const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

async function fetchBlobAsDataUrl(fetchUrl: string, init?: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(fetchUrl, init);
    if (!res.ok) return null;

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (
      contentType.includes('text/html') ||
      contentType.includes('application/json') ||
      contentType.includes('text/plain')
    ) {
      return null;
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;

    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function extractUploadsPath(rawSrc: string): string | null {
  try {
    const parsed = new URL(rawSrc, window.location.origin);
    const uploadsIdx = parsed.pathname.indexOf('/uploads/');
    if (uploadsIdx === -1) return null;
    const rawPath = parsed.pathname.slice(uploadsIdx);
    try {
      return decodeURIComponent(rawPath);
    } catch {
      return rawPath;
    }
  } catch {
    const match = rawSrc.match(/\/uploads\/[^?#]*/);
    return match ? match[0] : null;
  }
}

async function resolveImageAsDataUrl(rawSrc: string): Promise<string> {
  if (!rawSrc || rawSrc.startsWith('data:')) {
    return rawSrc || TRANSPARENT_PIXEL;
  }

  // 1. Direct CORS fetch with cache-buster to avoid opaque cached responses
  const sep = rawSrc.includes('?') ? '&' : '?';
  const direct = await fetchBlobAsDataUrl(`${rawSrc}${sep}_cors=${Date.now()}`, {
    mode: 'cors',
    cache: 'no-store',
  });
  if (direct) return direct;

  // 2. Backend /api/images/raw fallback for /uploads/ assets (bypasses static route/CDN restrictions)
  if (rawSrc.includes('/uploads/')) {
    const uploadsPath = extractUploadsPath(rawSrc);
    if (uploadsPath) {
      const rawApiUrl = `${API_BASE}/images/raw?path=${encodeURIComponent(uploadsPath)}&_t=${Date.now()}`;
      const viaApi = await fetchBlobAsDataUrl(rawApiUrl, {
        mode: 'cors',
        cache: 'no-store',
      });
      if (viaApi) return viaApi;
    }
  }

  // 3. Next.js image proxy fallback for external origins
  const proxied = await fetchBlobAsDataUrl(
    `/api/proxy/image?url=${encodeURIComponent(rawSrc)}&_t=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (proxied) return proxied;

  return TRANSPARENT_PIXEL;
}

function waitForImageSrc(img: HTMLImageElement, nextSrc: string): Promise<void> {
  return new Promise((resolve) => {
    if (img.src === nextSrc && img.complete) {
      resolve();
      return;
    }

    const finish = () => {
      img.removeEventListener('load', finish);
      img.removeEventListener('error', finish);
      resolve();
    };

    img.addEventListener('load', finish, { once: true });
    img.addEventListener('error', finish, { once: true });
    img.src = nextSrc;

    if (img.complete) {
      finish();
    }
  });
}

interface Notice {
  id: number;
  title: string;
  content: string;
  category: 'UPDATE' | 'EVENT' | 'GENERAL';
  viewCount: number;
  createdAt: string;
  author: { nickname: string; username: string };
}

function NoticeDetailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id') as string;
  
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);

  const currentUser = useAuthStore(state => state.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const contentHtml = useMemo(() => ({ __html: sanitizeHtml(notice?.content || '') }), [notice?.content]);

  const fetchNotice = useCallback(async () => {
    try {
      const res = await api.get(`/notices/${id}`);
      setNotice(res.data);
    } catch (error) {
      console.error('Failed to fetch notice:', error);
      toast.error('잠시 후에 다시 시도해 주세요');
      router.push('/notices');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    useAuthStore.getState().checkAuth();
    if (id) {
      fetchNotice();
    }
  }, [id, fetchNotice]);

  const handleDownloadImage = async () => {
    if (!captureRef.current) return;

    const targetElement = captureRef.current;
    const originalSrcs = new Map<HTMLImageElement, string>();

    try {
      setIsDownloading(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const images = targetElement.querySelectorAll('img');

      await Promise.all(
        Array.from(images).map(async (img) => {
          img.setAttribute('loading', 'eager');
          img.removeAttribute('srcset');
          img.removeAttribute('sizes');

          const rawAttrSrc = img.getAttribute('src') || img.src;
          if (!originalSrcs.has(img)) {
            originalSrcs.set(img, rawAttrSrc);
          }

          const dataUrl = await resolveImageAsDataUrl(img.src || rawAttrSrc);
          await waitForImageSrc(img, dataUrl);
          if (img.naturalWidth === 0 && dataUrl !== TRANSPARENT_PIXEL) {
            await waitForImageSrc(img, TRANSPARENT_PIXEL);
          }
        })
      );

      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(targetElement, {
        pixelRatio: 2,
        backgroundColor: 'transparent',
        imagePlaceholder: TRANSPARENT_PIXEL,
        filter: (node) => {
          const tagName = (node as HTMLElement).tagName?.toUpperCase();
          if (tagName && ['IFRAME', 'VIDEO', 'AUDIO', 'SCRIPT', 'PICTURE'].includes(tagName)) {
            return false;
          }
          return true;
        },
      });

      const link = document.createElement('a');
      link.download = `공지사항_${notice?.title || id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
      toast.error('이미지 추출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      originalSrcs.forEach((src, img) => {
        img.src = src;
      });
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('정말로 이 공지사항을 삭제하시겠습니까?')) return;
    
    try {
      await api.delete(`/notices/${id}`);
      toast.success('공지사항이 삭제되었습니다.');
      router.push('/notices');
    } catch (err) {
      console.error('Failed to delete notice:', err);
      toast.error('잠시 후에 다시 시도해 주세요');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="animate-pulse text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  if (!notice) return null;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Link href="/notices" className="inline-flex items-center text-sm text-gray-500 hover:text-[var(--plana-primary)] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로 돌아가기
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between mb-4">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
              notice.category === 'UPDATE' ? 'bg-green-100 text-green-800' :
              notice.category === 'EVENT' ? 'bg-pink-100 text-pink-800' :
              'bg-gray-200 text-gray-800'
            }`}>
              {notice.category === 'UPDATE' ? '업데이트' : notice.category === 'EVENT' ? '이벤트' : '일반'}
            </span>

            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/notices/edit?id=${id}`)}
                  className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  삭제
                </button>
                <button
                  onClick={handleDownloadImage}
                  disabled={isDownloading}
                  className="inline-flex items-center px-4 py-2 bg-[var(--plana-primary)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-95"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  이미지로 저장
                </button>
              </div>
            )}
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-snug">
            {notice.title}
          </h1>
          
          <div className="flex flex-wrap items-center text-sm text-gray-500 gap-6">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-2 opacity-70" />
              <span>{notice.author?.nickname || notice.author?.username || '관리자'}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 opacity-70" />
              <span>{format(new Date(notice.createdAt), 'yyyy년 MM월 dd일 HH:mm')}</span>
            </div>
            <div className="flex items-center">
              <Eye className="w-4 h-4 mr-2 opacity-70" />
              <span>조회 {notice.viewCount}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 md:p-10">
          <div 
            className="prose prose-blue max-w-none prose-headings:font-bold prose-a:text-blue-600 hover:prose-a:text-blue-500 prose-img:rounded-xl"
            dangerouslySetInnerHTML={contentHtml}
          />
        </div>
      </div>

      {/* Off-screen Template for Image Capture */}
      {isAdmin && (
        <div className="absolute left-[-9999px] top-[-9999px]">
          <div 
            ref={captureRef}
            className="w-[1080px] p-16 rounded-[40px] shadow-2xl relative overflow-hidden"
            style={{ background: 'linear-gradient(to bottom right, #f9fafb, #ffffff)' }}
          >
            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-50 rounded-full opacity-60 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-50 rounded-full opacity-60 translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

            <div className="relative z-10">
              {/* Header section (No Logo) */}
              <div className="flex items-center space-x-4 mb-10">
                <div className="px-5 py-2 bg-black text-white text-sm font-bold tracking-widest rounded-full uppercase">
                  NOTICE
                </div>
                <div className="px-5 py-2 bg-gray-100 text-gray-800 text-sm font-bold tracking-wide rounded-full">
                  {notice.category === 'UPDATE' ? '업데이트' : notice.category === 'EVENT' ? '이벤트' : '일반'}
                </div>
              </div>

              {/* Title */}
              <h1 className="text-5xl font-black text-gray-900 mb-8 leading-[1.3] tracking-tight">
                {notice.title}
              </h1>

              {/* Meta */}
              <div className="flex items-center space-x-8 text-lg text-gray-500 mb-12 pb-10 border-b border-gray-200">
                <div className="flex items-center">
                  <User className="w-6 h-6 mr-3 opacity-70" />
                  <span className="font-medium">{notice.author?.nickname || notice.author?.username || '관리자'}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-6 h-6 mr-3 opacity-70" />
                  <span className="font-medium">{format(new Date(notice.createdAt), 'yyyy년 MM월 dd일')}</span>
                </div>
              </div>

              {/* Content */}
              <div 
                className="prose prose-xl prose-blue max-w-none prose-headings:font-bold prose-p:leading-relaxed prose-img:rounded-2xl"
                dangerouslySetInnerHTML={contentHtml}
              />

              {/* Footer */}
              <div className="mt-20 pt-8 border-t border-gray-200 flex justify-end items-center">
                <span className="text-xl font-bold text-gray-300 tracking-wider">
                  Plana.AI
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function NoticeDetailPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading...</div>}>
      <NoticeDetailPageContent />
    </Suspense>
  );
}
