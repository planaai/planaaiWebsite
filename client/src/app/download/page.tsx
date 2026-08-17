import { Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 3600; // 1시간마다 ISR 갱신

async function getLatestRelease() {
  try {
    const res = await fetch('https://api.github.com/repos/planaai/screenshotMacro/releases/latest', {
      next: { revalidate: 3600 }
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (error) {
    return null;
  }
}

export default async function DownloadPage() {
  const release = await getLatestRelease();

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Plana SE 유틸리티 프로그램
        </h1>
        <p className="text-lg text-slate-600">
          Plana.AI를 더욱 편리하게 사용하기 위한 스크린샷 매크로 및 데이터 연동 도구입니다.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-pink-100/50 border border-pink-100 overflow-hidden mb-12">
        <div className="p-8 sm:p-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10">
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">최신 버전 다운로드</h2>
              {release ? (
                <div className="flex items-center justify-center md:justify-start gap-3 text-sm mt-3">
                  <span className="px-3 py-1 bg-green-100 text-green-700 font-semibold rounded-full">
                    {release.tag_name}
                  </span>
                  <span className="text-slate-500">
                    {new Date(release.published_at).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <p className="text-slate-500 mt-2">버전 정보를 불러오지 못했습니다.</p>
              )}
            </div>

            {release?.assets?.[0] ? (
              <a
                href={release.assets[0].browser_download_url}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-[var(--plana-primary)] text-white font-bold rounded-2xl hover:bg-pink-500 w-full md:w-auto"
              >
                <Download size={24} />
                <span>Windows용 다운로드</span>
              </a>
            ) : (
              <a
                href="https://github.com/planaai/screenshotMacro/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-[var(--plana-primary)] text-white font-bold rounded-2xl hover:bg-pink-500 w-full md:w-auto"
              >
                <ExternalLink size={24} />
                <span>GitHub에서 다운로드</span>
              </a>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-10 border-t border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">1. 스캐너 모드 (수동 캡처)</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                원하는 학생을 직접 확인하며 하나씩 스캔할 수 있습니다. 실시간으로 정보를 추출하고 검수 후 즉시 서버에 동기화합니다.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">2. 매크로 모드 (자동 캡처)</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                F8 단축키 한 번으로 학생 목록을 자동으로 넘기며 연속으로 스크린샷을 촬영하고 정보를 일괄 추출 및 업로드합니다.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">3. 일괄 인식 기능 (기존 파일)</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                미리 찍어둔 스크린샷 폴더를 지정하여 한 번에 정보를 추출합니다. 다량의 데이터를 빠르게 일괄 동기화할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {release?.body && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 sm:p-12 mb-12">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            업데이트 내역
            <span className="text-sm font-normal text-slate-500 ml-2">({release.tag_name})</span>
          </h3>
          <div className="prose prose-slate max-w-none text-sm whitespace-pre-wrap font-sans bg-slate-50 p-6 rounded-2xl border border-slate-100 text-slate-700">
            {release.body}
          </div>
        </div>
      )}

      <div className="text-center bg-slate-50 py-8 rounded-3xl border border-slate-100">
        <p className="text-slate-600 mb-3">프로그램 사용 중 문제가 발생하셨나요?</p>
        <Link 
          href="/inquiries"
          className="inline-flex items-center gap-2 text-[var(--plana-primary)] hover:text-pink-600 font-bold hover:underline"
        >
          오류 제보 및 문의하기 <ExternalLink size={16} />
        </Link>
      </div>
    </div>
  );
}
