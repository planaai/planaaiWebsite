import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Terminal,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Code2,
  FileJson,
  Sparkles,
} from 'lucide-react';
import { API } from '../../constants';

interface ApiParamDoc {
  name: string;
  location: string;
  type: string;
  required: boolean;
  description: string;
}

interface ApiEndpointDoc {
  id: string;
  method: string;
  path: string;
  altPath?: string;
  badge: string;
  title: string;
  summary: string;
  description: string;
  parameters: ApiParamDoc[];
  codeExamples: {
    curl: string;
    javascript: string;
    python: string;
  };
  responseExample: string;
  notes: string[];
}

interface ApiDocsConfig {
  terminalLabel: string;
  title: string;
  disclaimer?: string;
  baseUrl: string;
  rateLimit: string;
  corsPolicy: string;
  cachePolicy: string;
  authPolicy: string;
  overview: string;
  endpoints: ApiEndpointDoc[];
}

interface ApiDocsAdminManagerProps {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function ApiDocsAdminManager({ showToast }: ApiDocsAdminManagerProps) {
  const [docs, setDocs] = useState<ApiDocsConfig | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'javascript' | 'python'>('curl');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchApiDocs = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API}/api/api-docs`);
      setDocs(res.data);
      setSelectedIdx(0);
    } catch {
      showToast('API 문서 설정을 불러오지 못했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchApiDocs();
  }, []);

  if (isLoading || !docs) {
    return (
      <div className="p-8 bg-slate-800/50 rounded-xl border border-slate-700 text-center text-slate-400 animate-pulse">
        API 문서 설정을 불러오는 중...
      </div>
    );
  }

  const currentEp = docs.endpoints[selectedIdx] || docs.endpoints[0];

  const updateEndpoint = (patch: Partial<ApiEndpointDoc>) => {
    setDocs((prev) => {
      if (!prev) return prev;
      const nextEps = prev.endpoints.map((ep, idx) =>
        idx === selectedIdx ? { ...ep, ...patch } : ep
      );
      return { ...prev, endpoints: nextEps };
    });
  };

  const handleAddEndpoint = () => {
    const newEp: ApiEndpointDoc = {
      id: `students-custom-${Date.now()}`,
      method: 'GET',
      path: '/v1/students/example',
      altPath: '',
      badge: 'CUSTOM',
      title: '새 공개 API 엔드포인트',
      summary: '엔드포인트 한 줄 요약을 입력하세요.',
      description: '상세 호출 방법 및 주의사항을 입력하세요.',
      parameters: [],
      codeExamples: {
        curl: 'curl -X GET "https://api.plan4ai.fyi/v1/students/example"',
        javascript: "const res = await fetch('https://api.plan4ai.fyi/v1/students/example');\nconst data = await res.json();",
        python: 'import requests\nres = requests.get("https://api.plan4ai.fyi/v1/students/example")\nprint(res.json())',
      },
      responseExample: '{\n  "ok": true\n}',
      notes: [],
    };
    setDocs((prev) => {
      if (!prev) return prev;
      return { ...prev, endpoints: [...prev.endpoints, newEp] };
    });
    setSelectedIdx(docs.endpoints.length);
  };

  const handleDeleteEndpoint = (idx: number) => {
    if (docs.endpoints.length <= 1) {
      showToast('최소 1개의 엔드포인트는 유지해야 합니다.', 'error');
      return;
    }
    setDocs((prev) => {
      if (!prev) return prev;
      const next = prev.endpoints.filter((_, i) => i !== idx);
      return { ...prev, endpoints: next };
    });
    setSelectedIdx((prev) => Math.max(0, prev >= idx ? prev - 1 : prev));
  };

  const handleAddParam = () => {
    if (!currentEp) return;
    updateEndpoint({
      parameters: [
        ...(currentEp.parameters || []),
        {
          name: 'param',
          location: 'query',
          type: 'string',
          required: false,
          description: '파라미터 설명',
        },
      ],
    });
  };

  const handleUpdateParam = (pIdx: number, patch: Partial<ApiParamDoc>) => {
    if (!currentEp) return;
    const nextParams = currentEp.parameters.map((p, i) =>
      i === pIdx ? { ...p, ...patch } : p
    );
    updateEndpoint({ parameters: nextParams });
  };

  const handleRemoveParam = (pIdx: number) => {
    if (!currentEp) return;
    updateEndpoint({
      parameters: currentEp.parameters.filter((_, i) => i !== pIdx),
    });
  };

  const handleFormatResponseJson = () => {
    if (!currentEp) return;
    try {
      const parsed = JSON.parse(currentEp.responseExample);
      updateEndpoint({ responseExample: JSON.stringify(parsed, null, 2) });
      showToast('JSON 포맷이 정렬되었습니다.');
    } catch {
      showToast('주석(//)이 포함되었거나 단일 JSON 객체가 아니어서 원문을 유지합니다.', 'error');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await axios.put(`${API}/api/api-docs`, docs);
      if (res.data?.data) {
        setDocs(res.data.data);
      }
      showToast('공개 API 문서가 저장되었습니다.');
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : '저장에 실패했습니다.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = async () => {
    if (!window.confirm('학생 공개 API 3종 기본 문서로 초기화하시겠습니까?')) return;
    setIsSaving(true);
    try {
      const res = await axios.post(`${API}/api/api-docs/reset`);
      if (res.data?.data) {
        setDocs(res.data.data);
        setSelectedIdx(0);
      }
      showToast('기본 API 문서로 복원되었습니다.');
    } catch {
      showToast('기본값 복원에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/70 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Terminal size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">공개 API 문서 관리 (/api-docs)</h2>
            <p className="text-xs text-slate-400">
              메인 사이트 13. API 페이지의 호출 예시 코드(cURL / JS / Python), 파라미터, 응답 JSON을 직접 편집합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handleResetDefault()}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 border border-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={14} />
            <span>기본값 복원</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-600/25 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>{isSaving ? '저장 중...' : '변경사항 저장'}</span>
          </button>
        </div>
      </div>

      {/* Global Header & Policy Settings */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
          1. 상단 터미널 헤더 및 공통 정책 설정
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1">상단 영문 라벨</label>
            <input
              type="text"
              value={docs.terminalLabel}
              onChange={(e) => setDocs({ ...docs, terminalLabel: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">문서 메인 제목</label>
            <input
              type="text"
              value={docs.title}
              onChange={(e) => setDocs({ ...docs, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">Base URL</label>
            <input
              type="text"
              value={docs.baseUrl}
              onChange={(e) => setDocs({ ...docs, baseUrl: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-cyan-300 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">Rate Limit 표기</label>
            <input
              type="text"
              value={docs.rateLimit}
              onChange={(e) => setDocs({ ...docs, rateLimit: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">CORS 표기</label>
            <input
              type="text"
              value={docs.corsPolicy}
              onChange={(e) => setDocs({ ...docs, corsPolicy: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">Cache-Control 표기</label>
            <input
              type="text"
              value={docs.cachePolicy}
              onChange={(e) => setDocs({ ...docs, cachePolicy: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1">인증 정책 안내</label>
            <input
              type="text"
              value={docs.authPolicy}
              onChange={(e) => setDocs({ ...docs, authPolicy: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-slate-400 font-bold mb-1">상단 개요 설명</label>
            <input
              type="text"
              value={docs.overview}
              onChange={(e) => setDocs({ ...docs, overview: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
            />
          </div>
        </div>
        <div className="text-xs">
          <label className="block text-amber-400 font-bold mb-1">상단 사전 공지 (비공식 안내 문구)</label>
          <input
            type="text"
            value={docs.disclaimer || ''}
            onChange={(e) => setDocs({ ...docs, disclaimer: e.target.value })}
            placeholder="PlanaAI에서 제공하는 OpenAPI는 넥슨이나 블루 아카이브로부터 공식적으로 지원을 받아 만들어지지 않았으며 자체 구축한 비공식 API임을 알려드립니다."
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-amber-200"
          />
        </div>
      </div>

      {/* Endpoint Selector Bar (Background-free style matching client) */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
          <div className="flex items-center gap-5 overflow-x-auto">
            {docs.endpoints.map((ep, idx) => {
              const active = selectedIdx === idx;
              return (
                <button
                  key={ep.id || idx}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`relative py-2 px-1 bg-transparent text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer ${active ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <span className="font-mono text-[10px]">{ep.method}</span>
                  <span>{ep.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 border border-slate-600 rounded">
                    {ep.badge}
                  </span>
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddEndpoint}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>엔드포인트 추가</span>
            </button>
            {docs.endpoints.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteEndpoint(selectedIdx)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>현재 탭 삭제</span>
              </button>
            )}
          </div>
        </div>

        {currentEp && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left column: Meta & Parameters */}
            <div className="lg:col-span-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">HTTP Method</label>
                  <select
                    value={currentEp.method}
                    onChange={(e) => updateEndpoint({ method: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-cyan-300 font-mono font-bold"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">배지 태그</label>
                  <input
                    type="text"
                    value={currentEp.badge}
                    onChange={(e) => updateEndpoint({ badge: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">고유 ID</label>
                  <input
                    type="text"
                    value={currentEp.id}
                    onChange={(e) => updateEndpoint({ id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">엔드포인트 제목</label>
                <input
                  type="text"
                  value={currentEp.title}
                  onChange={(e) => updateEndpoint({ title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">기본 경로 (Path)</label>
                  <input
                    type="text"
                    value={currentEp.path}
                    onChange={(e) => updateEndpoint({ path: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-cyan-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">대체/쿼리 경로 (선택)</label>
                  <input
                    type="text"
                    value={currentEp.altPath || ''}
                    onChange={(e) => updateEndpoint({ altPath: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">한 줄 요약 (Summary)</label>
                <input
                  type="text"
                  value={currentEp.summary}
                  onChange={(e) => updateEndpoint({ summary: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">호출 상세 설명 (Description)</label>
                <textarea
                  rows={4}
                  value={currentEp.description}
                  onChange={(e) => updateEndpoint({ description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white leading-relaxed"
                />
              </div>

              {/* Parameters Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">파라미터 목록</span>
                  <button
                    type="button"
                    onClick={handleAddParam}
                    className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs font-bold text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>파라미터 추가</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(currentEp.parameters || []).map((param, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-2.5 bg-slate-900/90 border border-slate-700 rounded-lg space-y-2"
                    >
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={param.name}
                          onChange={(e) => handleUpdateParam(pIdx, { name: e.target.value })}
                          placeholder="이름"
                          className="col-span-4 px-2 py-1 bg-slate-800 border border-slate-700 rounded font-mono text-white"
                        />
                        <input
                          type="text"
                          value={param.location}
                          onChange={(e) => handleUpdateParam(pIdx, { location: e.target.value })}
                          placeholder="query / path"
                          className="col-span-3 px-2 py-1 bg-slate-800 border border-slate-700 rounded font-mono text-slate-300"
                        />
                        <input
                          type="text"
                          value={param.type}
                          onChange={(e) => handleUpdateParam(pIdx, { type: e.target.value })}
                          placeholder="string"
                          className="col-span-2 px-2 py-1 bg-slate-800 border border-slate-700 rounded font-mono text-cyan-300"
                        />
                        <label className="col-span-2 flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={param.required}
                            onChange={(e) =>
                              handleUpdateParam(pIdx, { required: e.target.checked })
                            }
                          />
                          <span>필수</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveParam(pIdx)}
                          className="col-span-1 text-rose-400 hover:text-rose-300 flex justify-end cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={param.description}
                        onChange={(e) => handleUpdateParam(pIdx, { description: e.target.value })}
                        placeholder="파라미터 설명"
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes Editor (1 per line) */}
              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  응답/예외 규칙 메모 (줄바꿈으로 구분)
                </label>
                <textarea
                  rows={3}
                  value={(currentEp.notes || []).join('\n')}
                  onChange={(e) =>
                    updateEndpoint({
                      notes: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                />
              </div>
            </div>

            {/* Right column: Code Editors (cURL / JS / Python + Response JSON) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                    <Code2 size={16} />
                    <span>호출 코드 스니펫 편집기 (Request Code Editor)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {(['curl', 'javascript', 'python'] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveCodeTab(lang)}
                        className={`relative py-1 bg-transparent text-xs font-mono font-bold uppercase cursor-pointer ${activeCodeTab === lang
                            ? 'text-cyan-400'
                            : 'text-slate-500 hover:text-slate-300'
                          }`}
                      >
                        <span>{lang}</span>
                        {activeCodeTab === lang && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={12}
                  value={currentEp.codeExamples?.[activeCodeTab] || ''}
                  onChange={(e) =>
                    updateEndpoint({
                      codeExamples: {
                        ...currentEp.codeExamples,
                        [activeCodeTab]: e.target.value,
                      },
                    })
                  }
                  spellCheck={false}
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg font-mono text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <FileJson size={16} />
                    <span>응답 JSON 예시 편집기 (Response Example Editor)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFormatResponseJson}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-bold text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={12} className="text-cyan-400" />
                    <span>JSON 정렬</span>
                  </button>
                </div>

                <textarea
                  rows={12}
                  value={currentEp.responseExample || ''}
                  onChange={(e) => updateEndpoint({ responseExample: e.target.value })}
                  spellCheck={false}
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-lg font-mono text-xs text-emerald-100 leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
