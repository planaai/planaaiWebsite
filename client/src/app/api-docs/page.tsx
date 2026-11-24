'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Terminal,
  Play,
  RotateCcw,
  Globe,
  ShieldCheck,
  Clock,
  Info,
  Code2,
  FileJson,
  AlertTriangle,
} from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatTitle } from '@/lib/seo';
import {
  DEFAULT_API_DOCS,
  type ApiDocsConfig,
  type ApiEndpointDoc,
} from '@/data/defaultApiDocs';

type CodeLang = 'curl' | 'javascript' | 'python';

const CODE_LANG_TABS: { id: CodeLang; label: string; fileName: string }[] = [
  { id: 'curl', label: 'cURL', fileName: 'request.sh' },
  { id: 'javascript', label: 'JavaScript (fetch)', fileName: 'request.js' },
  { id: 'python', label: 'Python (requests)', fileName: 'request.py' },
];

function CodeEditorBlock({
  fileName,
  badgeText,
  code,
  onCopy,
  copied,
  headerRight,
}: {
  fileName: string;
  badgeText?: string;
  code: string;
  onCopy: () => void;
  copied: boolean;
  headerRight?: React.ReactNode;
}) {
  const lines = useMemo(() => (code || '').split('\n'), [code]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xs shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-zinc-900/90 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[11px] font-mono font-bold text-zinc-300 truncate ml-1">
            {fileName}
          </span>
          {badgeText && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-sky-400 border border-sky-500/30 rounded-xs">
              {badgeText}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {headerRight}
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400">COPIED</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>COPY</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-3 overflow-x-auto custom-scrollbar max-h-[380px] overflow-y-auto">
        <table className="w-full border-collapse font-mono text-xs leading-relaxed">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-white/[0.03]">
                <td className="pr-3 text-right text-zinc-600 select-none tabular-nums w-8 align-top">
                  {idx + 1}
                </td>
                <td className="text-zinc-100 whitespace-pre break-normal">{line || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  useDocumentTitle(formatTitle('OpenAPI'));

  const [docs, setDocs] = useState<ApiDocsConfig>(DEFAULT_API_DOCS);
  const [activeEndpointIdx, setActiveEndpointIdx] = useState(0);
  const [activeLang, setActiveLang] = useState<CodeLang>('curl');
  const [copiedTarget, setCopiedTarget] = useState<'url' | 'code' | 'response' | null>(null);

  // Live API sandbox state
  const [testInput, setTestInput] = useState<string>('map');
  const [testSecondInput, setTestSecondInput] = useState<string>('true');
  const [liveResult, setLiveResult] = useState<{
    status: number;
    elapsedMs: number;
    url: string;
    body: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    fetch(`${API_BASE}/api-docs`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: ApiDocsConfig | null) => {
        if (mounted && json && Array.isArray(json.endpoints) && json.endpoints.length > 0) {
          setDocs(json);
        }
      })
      .catch(() => {
        // Keep DEFAULT_API_DOCS fallback
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const endpoints = docs.endpoints.length > 0 ? docs.endpoints : DEFAULT_API_DOCS.endpoints;
  const currentEndpoint: ApiEndpointDoc =
    endpoints[activeEndpointIdx] || endpoints[0];

  useEffect(() => {
    setLiveResult(null);
    if (currentEndpoint.path.includes('/names')) {
      setTestInput('map');
    } else if (currentEndpoint.path.includes('/id')) {
      setTestInput('시로코*테러');
      setTestSecondInput('true');
    } else {
      setTestInput('1');
    }
  }, [activeEndpointIdx, currentEndpoint.path]);

  const handleCopy = async (text: string, target: 'url' | 'code' | 'response') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget((prev) => (prev === target ? null : prev)), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const fullEndpointUrl = `${docs.baseUrl.replace(/\/+$/, '')}${currentEndpoint.path}`;
  const currentCode =
    currentEndpoint.codeExamples?.[activeLang] ||
    currentEndpoint.codeExamples?.curl ||
    '';
  const currentLangMeta =
    CODE_LANG_TABS.find((t) => t.id === activeLang) || CODE_LANG_TABS[0];

  const handleRunLiveTest = async () => {
    setIsTesting(true);
    const apiOrigin = API_BASE.replace(/\/api$/, '');
    let requestUrl = `${apiOrigin}${currentEndpoint.path}`;

    if (currentEndpoint.path.includes('/names')) {
      const fmt = testInput.trim();
      requestUrl = fmt
        ? `${apiOrigin}/v1/students/names?format=${encodeURIComponent(fmt)}`
        : `${apiOrigin}/v1/students/names`;
    } else if (currentEndpoint.path.includes('/id')) {
      const nameVal = testInput.trim();
      const qs = new URLSearchParams();
      if (nameVal) qs.set('name', nameVal);
      if (testSecondInput === 'false') qs.set('exact', 'false');
      requestUrl = `${apiOrigin}/v1/students/id?${qs.toString()}`;
    } else if (currentEndpoint.path.includes(':id')) {
      const idVal = testInput.trim() || '1';
      requestUrl = `${apiOrigin}/v1/students/${encodeURIComponent(idVal)}`;
    }

    const t0 = performance.now();
    try {
      const res = await fetch(requestUrl, {
        headers: { Accept: 'application/json' },
      });
      const elapsedMs = Math.round(performance.now() - t0);
      const rawText = await res.text();
      let formatted = rawText;
      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed) && parsed.length > 25) {
          formatted =
            JSON.stringify(parsed.slice(0, 20), null, 2) +
            `\n// ... 외 ${parsed.length - 20}건 (총 ${parsed.length}건)`;
        } else {
          formatted = JSON.stringify(parsed, null, 2);
        }
      } catch {
        // Keep rawText
      }
      setLiveResult({
        status: res.status,
        elapsedMs,
        url: requestUrl,
        body: formatted,
      });
    } catch (err: unknown) {
      const elapsedMs = Math.round(performance.now() - t0);
      setLiveResult({
        status: 0,
        elapsedMs,
        url: requestUrl,
        body: JSON.stringify(
          {
            error: err instanceof Error ? err.message : '요청 실패',
          },
          null,
          2
        ),
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-transparent text-slate-700 font-sans p-2.5 sm:p-4 pb-24 sm:pb-8">
      <div className="max-w-[1140px] mx-auto space-y-3.5">
        {/* 1. Technical Header (Shittim Chest Recruit Terminal Aesthetic) */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[var(--plana-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-6 bg-gradient-to-b from-[var(--plana-primary)] to-[var(--plana-primary-dark)] rounded-xs shadow-xs" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--plana-primary-dark)] leading-none">
                {docs.terminalLabel || 'OPEN API TERMINAL'}
              </div>
              <h1 className="text-lg sm:text-xl font-bold font-title-v text-slate-900 tracking-tight leading-tight mt-0.5">
                {docs.title}
              </h1>
            </div>
          </div>

          {/* Right Telemetry Pill */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs shadow-xs text-xs font-mono tabular-nums">
              <span className="text-slate-400 font-bold tracking-wider text-[10px]">RATE</span>
              <span className="font-bold text-slate-900">{docs.rateLimit}</span>
              <span className="w-px h-3 bg-[var(--plana-border)]" />
              <span className="text-slate-400 font-bold text-[10px]">ACCESS</span>
              <span className="font-bold text-[var(--plana-primary-dark)]">{docs.corsPolicy}</span>
            </div>
          </div>
        </header>

        {/* 1.1 Disclaimer Alert Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-xs border border-amber-200/90 bg-amber-50/80 backdrop-blur-md text-amber-950 text-xs shadow-xs">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium whitespace-pre-wrap">
              <strong className="font-bold text-amber-900 mr-1.5">[사전 공지]</strong>
              {docs.disclaimer ||
                'PlanaAI에서 제공하는 OpenAPI는 넥슨이나 블루 아카이브로부터 공식적으로 지원을 받아 만들어지지 않았으며 자체 구축한 비공식 API임을 알려드립니다.\n\n필수 사항은 아니지만, API를 유용하게 활용해주셨다면 서비스 구석 한편이라도 "API Powered by PlanaAI" 같은 작은 문구 하나만 함께 기재해 주시면 감사하겠습니다.'}
            </div>
          </div>

          {/* 2. Background-Free Endpoint Selector Tabs (사용자 요청: 선택 버튼 배경 제거) */}
          <nav
            aria-label="API 엔드포인트 선택"
            className="flex gap-4 sm:gap-6 overflow-x-auto border-b border-[var(--plana-border)]/70 custom-scrollbar"
          >
            {endpoints.map((ep, idx) => {
              const active = activeEndpointIdx === idx;
              return (
                <button
                  key={ep.id || idx}
                  type="button"
                  onClick={() => setActiveEndpointIdx(idx)}
                  className={`group relative px-1 py-2.5 bg-transparent font-bold text-xs whitespace-nowrap transition-all duration-200 flex items-center gap-2 cursor-pointer ${active
                    ? 'text-[var(--plana-primary-dark)]'
                    : 'text-slate-500 hover:text-[var(--plana-primary-dark)]'
                    }`}
                >
                  <span
                    className={`font-mono text-[10px] font-bold tracking-wider ${active ? 'text-[var(--plana-primary-dark)]' : 'text-slate-400 group-hover:text-[var(--plana-primary-dark)]'
                      }`}
                  >
                    {ep.method}
                  </span>
                  <span>{ep.title}</span>
                  {ep.badge && (
                    <span
                      className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded-xs uppercase tracking-wider border ${active
                        ? 'border-[var(--plana-primary)] text-[var(--plana-primary-dark)]'
                        : 'border-slate-300 text-slate-400'
                        }`}
                    >
                      {ep.badge}
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--plana-primary)] to-[var(--plana-primary-dark)] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* 3. Policy Strip */}
          <div className="bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
            <p className="text-slate-600 leading-relaxed">{docs.overview}</p>
            <div className="flex flex-wrap items-center gap-3 shrink-0 font-mono text-[11px] text-slate-600 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Globe size={13} className="text-[var(--plana-primary-dark)]" />
                <strong>Base:</strong> {docs.baseUrl}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={13} className="text-sky-500" />
                <strong>Cache:</strong> {docs.cachePolicy}
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-600" />
                <strong>Auth:</strong> {docs.authPolicy}
              </span>
            </div>
          </div>

          {/* 4. Asymmetric Bento Grid: Spec & Live Sandbox (col-span-5) + Code Editors (col-span-7) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            {/* LEFT: Endpoint Specification & Live Sandbox */}
            <section className="lg:col-span-5 space-y-3.5">
              <div className="bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs p-4 shadow-xs space-y-4">
                {/* Endpoint Title & Path Bar */}
                <div className="space-y-2 pb-3 border-b border-[var(--plana-border)]/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--plana-primary-dark)]">
                      ENDPOINT SPECIFICATION
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      #{String(activeEndpointIdx + 1).padStart(2, '0')} / {String(endpoints.length).padStart(2, '0')}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold font-title-v text-slate-900 tracking-tight">
                    {currentEndpoint.title}
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">{currentEndpoint.summary}</p>

                  {/* Primary Endpoint URL Box */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 text-slate-100 rounded-xs font-mono text-xs">
                    <div className="flex items-center gap-2 min-w-0 overflow-x-auto custom-scrollbar">
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 rounded-xs shrink-0">
                        {currentEndpoint.method}
                      </span>
                      <span className="truncate text-zinc-100">{currentEndpoint.path}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopy(fullEndpointUrl, 'url')}
                      title="전체 엔드포인트 URL 복사"
                      className="text-[11px] text-zinc-300 hover:text-white inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedTarget === 'url' ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>

                  {currentEndpoint.altPath && (
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400">ALT:</span>
                      <code className="text-slate-700">{currentEndpoint.altPath}</code>
                    </div>
                  )}
                </div>

                {/* Detailed Description */}
                <div className="space-y-1.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    호출 상세 안내
                  </h3>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {currentEndpoint.description}
                    </p>
                </div>

                {/* Parameters Table */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    파라미터 (Parameters)
                  </h3>
                  {currentEndpoint.parameters && currentEndpoint.parameters.length > 0 ? (
                    <div className="border border-slate-200 rounded-xs overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                            <th className="py-2 px-2.5">이름</th>
                            <th className="py-2 px-2">위치/타입</th>
                            <th className="py-2 px-2.5">설명</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70">
                          {currentEndpoint.parameters.map((param, pIdx) => (
                            <tr key={param.name || pIdx} className="bg-white/60">
                              <td className="py-2 px-2.5 font-mono font-bold text-slate-900 align-top">
                                <div className="flex items-center gap-1">
                                  <span>{param.name}</span>
                                  {param.required && (
                                    <span className="text-[9px] text-rose-500 font-bold">*</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2 font-mono text-[11px] text-slate-500 align-top whitespace-nowrap">
                                <div>{param.location}</div>
                                <div className="text-[10px] text-sky-600">{param.type}</div>
                              </td>
                              <td className="py-2 px-2.5 text-slate-600 leading-snug align-top">
                                {param.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">별도 파라미터가 없는 엔드포인트입니다.</p>
                  )}
                </div>

                {/* Notes */}
                {currentEndpoint.notes && currentEndpoint.notes.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/70">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Info size={12} className="text-[var(--plana-primary-dark)]" />
                      <span>응답 및 예외 규칙</span>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside">
                      {currentEndpoint.notes.map((note, nIdx) => (
                        <li key={nIdx} className="leading-relaxed">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Live Sandbox Card */}
              <div className="bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Terminal size={14} className="text-[var(--plana-primary-dark)]" />
                    <h3 className="text-xs font-bold text-slate-900">
                      실시간 API 호출 테스트 (Live Try)
                    </h3>
                  </div>
                  {liveResult && (
                    <button
                      type="button"
                      onClick={() => setLiveResult(null)}
                      className="text-[11px] text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw size={11} />
                      <span>초기화</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  {currentEndpoint.path.includes('/names') && (
                    <div>
                      <label className="block text-[11px] font-mono font-bold text-slate-500 mb-1">
                        query: format (선택: map 또는 비움)
                      </label>
                      <input
                        type="text"
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        placeholder="map (비우면 이름 배열 반환)"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xs font-mono text-xs text-slate-800 focus:outline-none focus:border-[var(--plana-primary-dark)]"
                      />
                    </div>
                  )}

                  {currentEndpoint.path.includes('/id') && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-mono font-bold text-slate-500 mb-1">
                          name (학생 이름)
                        </label>
                        <input
                          type="text"
                          value={testInput}
                          onChange={(e) => setTestInput(e.target.value)}
                          placeholder="예: 시로코*테러, 하나코(수영복)"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xs font-mono text-xs text-slate-800 focus:outline-none focus:border-[var(--plana-primary-dark)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono font-bold text-slate-500 mb-1">
                          exact (일치 모드)
                        </label>
                        <select
                          value={testSecondInput}
                          onChange={(e) => setTestSecondInput(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xs font-mono text-xs text-slate-800 focus:outline-none focus:border-[var(--plana-primary-dark)]"
                        >
                          <option value="true">true (정확 일치)</option>
                          <option value="false">false (부분 검색)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {currentEndpoint.path.includes(':id') && (
                    <div>
                      <label className="block text-[11px] font-mono font-bold text-slate-500 mb-1">
                        path: id (양의 정수 ID)
                      </label>
                      <input
                        type="text"
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        placeholder="예: 1"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xs font-mono text-xs text-slate-800 focus:outline-none focus:border-[var(--plana-primary-dark)]"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleRunLiveTest()}
                    disabled={isTesting}
                    className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xs transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Play size={12} />
                    <span>{isTesting ? '호출 중...' : 'GET 요청 실행 및 우측 에디터에 결과 표시'}</span>
                  </button>
                </div>

                {/* Response Status Code Reference Table inside Live Sandbox */}
                <div className="pt-3 border-t border-slate-200/80 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    HTTP 응답 코드
                  </div>
                  <div className="border border-slate-200 rounded-xs overflow-hidden">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                          <th className="py-1.5 px-2.5 w-14">코드</th>
                          <th className="py-1.5 px-2 w-36">상태</th>
                          <th className="py-1.5 px-2.5">발생 조건</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 bg-white/70">
                        <tr>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-emerald-600">200</td>
                          <td className="py-1.5 px-2 font-mono font-semibold text-slate-700">OK</td>
                          <td className="py-1.5 px-2.5 text-slate-600">요청이 정상적으로 처리됨</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-amber-600">400</td>
                          <td className="py-1.5 px-2 font-mono font-semibold text-slate-700">Bad Request</td>
                          <td className="py-1.5 px-2.5 text-slate-600">필수 파라미터 누락 또는 잘못된 형식의 요청</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-rose-600">403</td>
                          <td className="py-1.5 px-2 font-mono font-semibold text-slate-700">Forbidden</td>
                          <td className="py-1.5 px-2.5 text-slate-600">비정상 접근</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-rose-600">404</td>
                          <td className="py-1.5 px-2 font-mono font-semibold text-slate-700">Not Found</td>
                          <td className="py-1.5 px-2.5 text-slate-600">요청한 리소스(학생 데이터)를 찾을 수 없음</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-rose-600">429</td>
                          <td className="py-1.5 px-2 font-mono font-semibold text-slate-700">Too Many Requests</td>
                          <td className="py-1.5 px-2.5 text-slate-600">요청 한도 초과 (1분당 60회)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-slate-500">500</td>
                          <td className="py-1.5 px-2 font-mono font-semibold text-slate-700">Internal Server Error</td>
                          <td className="py-1.5 px-2.5 text-slate-600">서버 내부 오류 발생</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            {/* RIGHT: IDE Code Editor & Response Viewer */}
            <section className="lg:col-span-7 space-y-3.5">
              {/* Code Editor Box */}
              <div className="bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs p-3.5 sm:p-4 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--plana-border)]/70 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Code2 size={15} className="text-[var(--plana-primary-dark)]" />
                    <span className="text-xs font-bold text-slate-900">
                      호출 코드 에디터 (Request Code)
                    </span>
                  </div>

                  {/* Background-Free Language Selection Buttons (배경 없는 탭 버튼) */}
                  <div className="flex items-center gap-4">
                    {CODE_LANG_TABS.map((tab) => {
                      const isSelected = activeLang === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveLang(tab.id)}
                          className={`relative py-1 px-0.5 bg-transparent text-xs font-mono font-bold transition-colors cursor-pointer ${isSelected
                            ? 'text-[var(--plana-primary-dark)]'
                            : 'text-slate-400 hover:text-[var(--plana-primary-dark)]'
                            }`}
                        >
                          <span>{tab.label}</span>
                          {isSelected && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--plana-primary-dark)] rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <CodeEditorBlock
                  fileName={currentLangMeta.fileName}
                  badgeText={currentEndpoint.method}
                  code={currentCode}
                  onCopy={() => void handleCopy(currentCode, 'code')}
                  copied={copiedTarget === 'code'}
                />
              </div>

              {/* Response JSON Editor Box */}
              <div className="bg-white/90 backdrop-blur-md border border-[var(--plana-border)] rounded-xs p-3.5 sm:p-4 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <FileJson size={15} className="text-[var(--plana-primary-dark)]" />
                    <span className="text-xs font-bold text-slate-900">
                      {liveResult ? '실시간 호출 응답 (Live Response)' : '응답 JSON 예시 (Response Example)'}
                    </span>
                  </div>

                  {liveResult && (
                    <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span
                        className={`px-1.5 py-0.5 rounded-xs font-bold ${liveResult.status >= 200 && liveResult.status < 300
                          ? 'text-emerald-700 border border-emerald-300'
                          : 'text-rose-700 border border-rose-300'
                          }`}
                      >
                        HTTP {liveResult.status || 'ERR'}
                      </span>
                      <span className="text-slate-500">{liveResult.elapsedMs}ms</span>
                    </div>
                  )}
                </div>

                <CodeEditorBlock
                  fileName={liveResult ? 'live-response.json' : 'response.200.json'}
                  badgeText={liveResult ? `HTTP ${liveResult.status}` : '200 OK'}
                  code={liveResult ? liveResult.body : currentEndpoint.responseExample}
                  onCopy={() =>
                    void handleCopy(
                      liveResult ? liveResult.body : currentEndpoint.responseExample,
                      'response'
                    )
                  }
                  copied={copiedTarget === 'response'}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
      );
}
