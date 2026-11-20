'use client';

import React, { useState, useRef, useEffect } from 'react';
import { calculateApSchedule, ApTimelineStep, MailboxExpiryItem } from './apLogic';
import { format } from 'date-fns';

import { Download, AlertTriangle, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';

const CAFE_MAX_AP: Record<number, number> = {
  1: 90,
  2: 150,
  3: 220,
  4: 300,
  5: 390,
  6: 460,
  7: 530,
  8: 600,
  9: 670,
  10: 740,
};

export function ApCalculator() {
  const [targetDateStr, setTargetDateStr] = useState<string>('');
  const [currentAp, setCurrentAp] = useState<number>(0);
  const [cafeRank, setCafeRank] = useState<number>(10);
  const [useDailyQuest, setUseDailyQuest] = useState<boolean>(true);
  const [useWeeklyQuest, setUseWeeklyQuest] = useState<boolean>(true);
  const [pvpRefreshes, setPvpRefreshes] = useState<number>(0);
  const [pyroxeneRefreshes, setPyroxeneRefreshes] = useState<number>(0);
  const [useApPackage, setUseApPackage] = useState<boolean>(false);
  const [userLevel, setUserLevel] = useState<number>(90);
  const [hoardingDays, setHoardingDays] = useState<number>(1);
  const [todayAttendance, setTodayAttendance] = useState<number>(0);
  const [useTr4DailyQuest, setUseTr4DailyQuest] = useState<boolean>(false);
  
  const [result, setResult] = useState<ReturnType<typeof calculateApSchedule> | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('apCalculatorState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.targetDateStr) setTargetDateStr(parsed.targetDateStr);
        if (parsed.currentAp !== undefined) setCurrentAp(parsed.currentAp);
        if (parsed.cafeRank !== undefined) setCafeRank(parsed.cafeRank);
        if (parsed.useDailyQuest !== undefined) setUseDailyQuest(parsed.useDailyQuest);
        if (parsed.useWeeklyQuest !== undefined) setUseWeeklyQuest(parsed.useWeeklyQuest);
        if (parsed.pvpRefreshes !== undefined) setPvpRefreshes(parsed.pvpRefreshes);
        if (parsed.pyroxeneRefreshes !== undefined) setPyroxeneRefreshes(parsed.pyroxeneRefreshes);
        if (parsed.useApPackage !== undefined) setUseApPackage(parsed.useApPackage);
        if (parsed.userLevel !== undefined) setUserLevel(parsed.userLevel);
        if (parsed.hoardingDays !== undefined) setHoardingDays(parsed.hoardingDays);
        if (parsed.todayAttendance !== undefined) setTodayAttendance(parsed.todayAttendance);
        if (parsed.useTr4DailyQuest !== undefined) setUseTr4DailyQuest(parsed.useTr4DailyQuest);
        
        // Only run calculation if targetDateStr exists
        if (parsed.targetDateStr) {
          const res = calculateApSchedule(
            new Date(parsed.targetDateStr),
            parsed.currentAp || 0,
            CAFE_MAX_AP[parsed.cafeRank || 10] || 0,
            parsed.useDailyQuest !== undefined ? parsed.useDailyQuest : true,
            parsed.pvpRefreshes || 0,
            parsed.pyroxeneRefreshes || 0,
            parsed.useApPackage || false,
            parsed.userLevel || 90,
            23.5,
            parsed.hoardingDays || 1,
            parsed.todayAttendance || 0,
            parsed.useWeeklyQuest !== undefined ? parsed.useWeeklyQuest : true,
            parsed.useTr4DailyQuest || false
          );
          setResult(res);
        }
      } catch (e) {
        console.error('Failed to parse saved calculator state', e);
      }
    }
  }, []);

  const handleDownloadImage = async () => {
    if (exportRef.current === null) return;
    setIsExporting(true);
    
    setTimeout(async () => {
      try {
        const images = exportRef.current!.querySelectorAll('img');
        const originalSrcs = new Map<HTMLImageElement, string>();
        
        images.forEach(img => {
          if (img.src.startsWith('http') && !img.src.includes(window.location.host)) {
            originalSrcs.set(img, img.src);
            img.crossOrigin = 'anonymous';
            img.src = `/api/proxy/image?url=${encodeURIComponent(img.src)}&_t=${Date.now()}`;
          }
        });
        
        await Promise.all(Array.from(images).map(async (img) => {
          if (!originalSrcs.has(img)) originalSrcs.set(img, img.src);
          
          try {
            if (!img.complete) {
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
              });
            }
            
            if (img.naturalWidth === 0) {
              throw new Error('Broken image');
            }
            
            if (img.src.startsWith('data:')) return;
            
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 1;
            canvas.height = img.naturalHeight || img.height || 1;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              img.src = canvas.toDataURL('image/png');
            }
          } catch (e) {
            img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
          }
        }));

        const htmlToImage = await import('html-to-image');
        const dataUrl = await htmlToImage.toPng(exportRef.current!, {
          pixelRatio: 2,
          backgroundColor: '#f8fafc'
        });
        
        originalSrcs.forEach((src, img) => {
          img.src = src;
          img.removeAttribute('crossOrigin');
        });

        const link = document.createElement('a');
        link.download = `ap-schedule-${format(new Date(), 'yyyyMMdd-HHmm')}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Failed to export image:', err);
        toast.error('잠시 후에 다시 시도해 주세요');
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  const handleCalculate = () => {
    if (!targetDateStr) {
      toast.error('목표 시간을 설정해 주세요');
      return;
    }

    const targetDate = new Date(targetDateStr);
    const cafeAp = CAFE_MAX_AP[cafeRank] || 0;
    
    const res = calculateApSchedule(
      targetDate,
      currentAp,
      cafeAp,
      useDailyQuest,
      pvpRefreshes,
      pyroxeneRefreshes,
      useApPackage,
      userLevel,
      23.5,
      hoardingDays,
      todayAttendance,
      useWeeklyQuest,
      useTr4DailyQuest
    );
    
    setResult(res);

    const stateToSave = {
      targetDateStr,
      currentAp,
      cafeRank,
      useDailyQuest,
      useWeeklyQuest,
      pvpRefreshes,
      pyroxeneRefreshes,
      useApPackage,
      userLevel,
      hoardingDays,
      todayAttendance,
      useTr4DailyQuest
    };
    localStorage.setItem('apCalculatorState', JSON.stringify(stateToSave));
  };

  // 타임라인을 dayLabel 기준으로 그룹핑
  const groupTimelineByDay = (timeline: ApTimelineStep[]) => {
    const groups: { dayLabel: string; steps: ApTimelineStep[] }[] = [];
    let currentGroup: { dayLabel: string; steps: ApTimelineStep[] } | null = null;

    for (const step of timeline) {
      const label = step.dayLabel || format(step.time, 'M월 d일');
      if (!currentGroup || currentGroup.dayLabel !== label) {
        currentGroup = { dayLabel: label, steps: [] };
        groups.push(currentGroup);
      }
      currentGroup.steps.push(step);
    }
    return groups;
  };

  return (
    <div className="max-w-6xl mx-auto mt-6">
    <div className="flex flex-col lg:flex-row gap-8">
      {/* 좌측: 입력 패널 */}
      <div className="lg:w-1/2 glass-panel p-8 rounded-2xl shadow-sm h-fit">
        <h2 className="text-2xl font-bold mb-4 text-[var(--plana-text-main)]">AP 존버 계산기</h2>
        <p className="text-[var(--plana-text-muted)] mb-8 text-sm">
          이벤트를 위해 최대한 많은 AP를 모으는 스케줄을 계산합니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
          <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">목표 시간 (이벤트/점검 끝나는 시간)</label>
          <input 
            type="datetime-local" 
            className="w-full bg-white text-[var(--plana-text-main)] p-2 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] transition-all"
            value={targetDateStr}
            onChange={(e) => setTargetDateStr(e.target.value)}
          />
        </div>

        <div className="bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
          <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">선생님 레벨</label>
          <input 
            type="number" 
            min="1"
            max="120"
            className="w-full bg-white text-[var(--plana-text-main)] p-2 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] transition-all"
            value={userLevel}
            onChange={(e) => setUserLevel(Number(e.target.value))}
          />
        </div>

        <div className="bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
          <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">현재 보유 AP</label>
          <input 
            type="number" 
            min="0"
            max="999"
            className="w-full bg-white text-[var(--plana-text-main)] p-2 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] transition-all"
            value={currentAp}
            onChange={(e) => setCurrentAp(Number(e.target.value))}
          />
        </div>

        <div className="bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
          <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">카페 랭크</label>
          <select 
            className="w-full bg-white text-[var(--plana-text-main)] p-2 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] transition-all"
            value={cafeRank}
            onChange={(e) => setCafeRank(Number(e.target.value))}
          >
            {Object.keys(CAFE_MAX_AP).map(rank => (
              <option key={rank} value={rank}>랭크 {rank} (최대 {CAFE_MAX_AP[Number(rank)]} AP)</option>
            ))}
          </select>
        </div>

        <div className="bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
          <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">전술 대회 코인 충전 횟수</label>
          <select 
            className="w-full bg-white text-[var(--plana-text-main)] p-2 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] transition-all"
            value={pvpRefreshes}
            onChange={(e) => setPvpRefreshes(Number(e.target.value))}
          >
            <option value={0}>0회 (사용 안함)</option>
            <option value={1}>1회 (90 AP)</option>
            <option value={2}>2회 (180 AP)</option>
            <option value={3}>3회 (270 AP)</option>
            <option value={4}>4회 (360 AP)</option>
          </select>
        </div>

        <div className="bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
          <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">목표 청휘석 충전 횟수</label>
          <select 
            className="w-full bg-white text-[var(--plana-text-main)] p-2 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] transition-all"
            value={pyroxeneRefreshes}
            onChange={(e) => setPyroxeneRefreshes(Number(e.target.value))}
          >
            {Array.from({ length: 21 }, (_, i) => (
              <option key={i} value={i}>{i}회 ({i * 120} AP)</option>
            ))}
          </select>
        </div>

        <div className="bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
          <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">오늘 기준 출석부 일차</label>
          <select 
            className="w-full bg-white text-[var(--plana-text-main)] p-2 rounded-lg border border-[var(--plana-border)] outline-none focus:ring-2 focus:ring-[var(--plana-primary-light)] transition-all"
            value={todayAttendance}
            onChange={(e) => setTodayAttendance(Number(e.target.value))}
          >
            <option value={0}>사용 안 함</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(day => (
              <option key={day} value={day}>{day}일차</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 flex flex-col gap-3 bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="useDaily"
              className="mr-3 w-5 h-5 accent-[var(--plana-primary)] cursor-pointer"
              checked={useDailyQuest}
              onChange={(e) => setUseDailyQuest(e.target.checked)}
            />
            <label htmlFor="useDaily" className="text-sm font-semibold text-[var(--plana-text-main)] cursor-pointer">일일 퀘스트 (150 AP) 우편함 저장</label>
          </div>

          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="useWeekly"
              className="mr-3 w-5 h-5 accent-[var(--plana-primary)] cursor-pointer"
              checked={useWeeklyQuest}
              onChange={(e) => setUseWeeklyQuest(e.target.checked)}
            />
            <label htmlFor="useWeekly" className="text-sm font-semibold text-[var(--plana-text-main)] cursor-pointer">주간 퀘스트 (200 AP) 당일 수령</label>
          </div>
          
          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="useApPkg"
              className="mr-3 w-5 h-5 accent-[var(--plana-primary)] cursor-pointer"
              checked={useApPackage}
              onChange={(e) => setUseApPackage(e.target.checked)}
            />
            <label htmlFor="useApPkg" className="text-sm font-semibold text-[var(--plana-text-main)] cursor-pointer">
              2주 AP 패키지 (150 AP) 우편함 저장 <span className="text-[var(--plana-text-muted)] font-normal text-xs ml-1">(이틀 존버 등 극단적 존버 시 체크)</span>
            </label>
          </div>

          {hoardingDays >= 2 && (
            <div className="flex items-center border-t border-[var(--plana-border)] pt-3 mt-1">
              <input 
                type="checkbox" 
                id="useTr4"
                className="mr-3 w-5 h-5 accent-[var(--plana-primary)] cursor-pointer"
                checked={useTr4DailyQuest}
                onChange={(e) => setUseTr4DailyQuest(e.target.checked)}
              />
              <label htmlFor="useTr4" className="text-sm font-semibold text-[var(--plana-text-main)] cursor-pointer">
                D-1 TR-4 일퀘 달성 <span className="text-[var(--plana-text-muted)] font-normal text-xs ml-1">(23:59 AP 1 소모로 일퀘 보상 획득)</span>
              </label>
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-white/50 p-4 rounded-xl border border-[var(--plana-border)]">
          <label className="block text-sm font-semibold text-[var(--plana-text-muted)] mb-2">존버 기간</label>
          <div className="flex gap-4 mt-2 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hoardingDays"
                className="w-4 h-4 text-[var(--plana-primary)] border-[var(--plana-border)] focus:ring-[var(--plana-primary-light)]"
                checked={hoardingDays === 1}
                onChange={() => { setHoardingDays(1); setUseTr4DailyQuest(false); }}
              />
              <span className="text-[var(--plana-text-main)] text-sm">1일 존버 (기본)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hoardingDays"
                className="w-4 h-4 text-[var(--plana-primary)] border-[var(--plana-border)] focus:ring-[var(--plana-primary-light)]"
                checked={hoardingDays === 2}
                onChange={() => setHoardingDays(2)}
              />
              <span className="text-[var(--plana-text-main)] text-sm">2일 존버 (하드코어)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hoardingDays"
                className="w-4 h-4 text-[var(--plana-primary)] border-[var(--plana-border)] focus:ring-[var(--plana-primary-light)]"
                checked={hoardingDays === 3}
                onChange={() => setHoardingDays(3)}
              />
              <span className="text-[var(--plana-text-main)] text-sm">3일 존버 (극한)</span>
            </label>
          </div>
          {hoardingDays >= 2 && (
            <p className="text-xs text-[var(--plana-text-muted)] mt-2">
              * {hoardingDays}일 동안 매일 로그인하여 AP를 우편함에 저장하는 전략입니다. 
              {hoardingDays === 3 && ' D-1일에 TR-4 일퀘 달성 옵션을 활용하면 더 많은 AP를 확보할 수 있습니다.'}
            </p>
          )}
        </div>
      </div>

      <button 
        onClick={handleCalculate}
        className="w-full bg-[var(--plana-primary)] text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-[var(--plana-primary-dark)] transition-colors mt-2"
      >
        계산하기
      </button>
      </div>

      {/* 우측: 타임라인 패널 */}
      <div className="lg:w-1/2">
      {result ? (
        <div className="bg-white/60 p-6 rounded-xl border border-[var(--plana-border)] shadow-sm">
          <div className="flex justify-end mb-4">
            <button 
              onClick={handleDownloadImage}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--plana-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--plana-primary-dark)] transition-colors shadow-sm"
            >
              <Download size={16} />
              이미지로 저장
            </button>
          </div>
          
          <div ref={resultRef} className={`w-full ${!isExporting ? 'max-h-[600px] overflow-y-auto pr-2 custom-scrollbar' : ''}`}>
          <div className="border-b border-[var(--plana-border)] pb-4 mb-6">
            <h3 className="text-xl font-bold text-[var(--plana-text-main)] flex items-center gap-2">
              <span className="text-[var(--plana-primary)]">✧</span> 결과 타임라인
            </h3>
            {result.isPossible ? (
              <p className="text-[var(--plana-primary)] font-bold mt-2">
                최종 목표 AP: {result.totalHoardedAp} AP
              </p>
            ) : (
              <p className="text-red-500 font-bold mt-2">{result.errorMessage}</p>
            )}
          </div>

          {result.warningMessage && (
            <div className={`mb-6 p-4 rounded-xl border ${result.isRetroactive ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <h4 className={`font-bold flex items-center gap-2 mb-1 ${result.isRetroactive ? 'text-orange-600' : 'text-yellow-600'}`}>
                <Info size={16} />
                {result.isRetroactive ? '과거 시점 시뮬레이션' : '참고 안내'}
              </h4>
              <p className={`text-sm ${result.isRetroactive ? 'text-orange-600' : 'text-yellow-700'}`}>
                {result.warningMessage}
              </p>
            </div>
          )}

          {result.timeline.length > 0 && (
            <>
            {/* 날짜별 그룹핑된 타임라인 */}
            {groupTimelineByDay(result.timeline).map((group, groupIdx) => (
              <div key={groupIdx} className="mb-6">
                {/* 날짜 구분 배너 */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-[var(--plana-border)]"></div>
                  <div className="shrink-0 text-center text-sm font-bold text-[var(--plana-primary-dark)] bg-[var(--plana-primary-light)]/10 px-5 py-2 rounded-2xl border border-[var(--plana-primary-light)]/30 whitespace-nowrap">
                    {group.dayLabel}
                  </div>
                  <div className="h-px flex-1 bg-[var(--plana-border)]"></div>
                </div>

                <div className="relative border-l-2 border-[var(--plana-border)] ml-8 space-y-4">
                  {group.steps.map((step, idx) => (
                    <div key={idx} className="relative ml-8">
                      <span className={`absolute flex items-center justify-center w-6 h-6 rounded-full -left-[45px] ring-4 ring-white ${
                        step.isWarning 
                          ? 'bg-amber-100' 
                          : step.isImportant 
                            ? 'bg-[var(--plana-primary-light)]/30' 
                            : 'bg-[var(--plana-primary-light)]/20'
                      }`}>
                        {step.isWarning ? (
                          <AlertTriangle size={12} className="text-amber-500" />
                        ) : (
                          <div className={`w-2.5 h-2.5 rounded-full ${step.isImportant ? 'bg-[var(--plana-primary-dark)]' : 'bg-[var(--plana-primary)]'}`}></div>
                        )}
                      </span>
                      
                      <div className={`flex flex-col p-4 rounded-lg border shadow-sm ${
                        step.isWarning 
                          ? 'bg-amber-50/80 border-amber-200' 
                          : 'bg-white/80 border-[var(--plana-border)]'
                      }`}>
                        <span className="text-sm text-[var(--plana-text-muted)] font-mono mb-1 block">
                          {format(step.time, 'yyyy년 MM월 dd일 HH:mm')}
                        </span>
                        <h4 className={`text-lg font-bold ${
                          step.isWarning 
                            ? 'text-amber-600' 
                            : step.isImportant 
                              ? 'text-[var(--plana-primary-dark)]' 
                              : 'text-[var(--plana-text-main)]'
                        }`}>
                          {step.action}
                        </h4>
                        <p className="text-[var(--plana-text-muted)] text-sm whitespace-pre-line mt-1">
                          {step.description}
                        </p>
                        
                        {step.barAp !== undefined && step.mailboxAp !== undefined && (
                          <div className="bg-[var(--plana-background)] p-3 rounded-lg flex flex-col sm:flex-row justify-between gap-2 text-sm border border-[var(--plana-border)] mt-3">
                            <span className="font-semibold text-[var(--plana-text-main)] flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[var(--plana-primary)]"></span>
                              현재 보유 AP: <span className="text-[var(--plana-primary-dark)]">{step.barAp}</span> <span className="text-[var(--plana-text-muted)] font-normal text-xs">/ 999</span>
                            </span>
                            <div className="relative group flex items-center">
                              <span className={`font-semibold text-[var(--plana-text-main)] flex items-center gap-2 ${step.mailboxDetails && step.mailboxDetails.length > 0 ? 'cursor-help' : ''}`}>
                                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                우편함 누적 AP: 
                                <span className={`text-orange-500 ${step.mailboxDetails && step.mailboxDetails.length > 0 ? 'border-b border-dashed border-orange-500' : ''}`}>
                                  {step.mailboxAp}
                                </span>
                              </span>
                              
                              {step.mailboxDetails && step.mailboxDetails.length > 0 && (
                                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-48 bg-white text-[var(--plana-text-main)] text-xs rounded-xl p-3 shadow-lg border border-[var(--plana-border)] z-10">
                                  <p className="font-bold border-b border-[var(--plana-border)] pb-1 mb-2 text-[var(--plana-primary-dark)]">우편함 상세</p>
                                  <div className="flex flex-col gap-1.5">
                                    {step.mailboxDetails.map(item => (
                                      <div key={item.name} className="flex justify-between items-center">
                                        <span className="text-[var(--plana-text-muted)] font-medium">{item.name}</span>
                                        <span className="text-orange-500 font-bold">+{item.amount}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* 우편함 만료 경고 섹션 */}
            {result.mailboxExpiryWarnings && result.mailboxExpiryWarnings.length > 0 && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <h4 className="text-red-600 font-bold flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} />
                  ⚠ 우편함 AP 만료 경고
                </h4>
                <p className="text-red-500 text-sm mb-3">
                  아래 우편함 AP는 목표 시간 전에 만료됩니다. 반드시 만료 전에 수령하세요!
                </p>
                <div className="flex flex-col gap-2">
                  {result.mailboxExpiryWarnings.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-white/80 px-3 py-2 rounded-lg">
                      <span className="text-red-600 font-medium">{item.name} ({item.amount} AP)</span>
                      <span className="text-red-500 font-mono text-xs">
                        만료: {format(item.expiresAt, 'MM/dd HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 우편함 만료 안내 (경고 아닌 일반 안내) */}
            {result.earliestMailboxExpiry && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h4 className="text-blue-600 font-bold flex items-center gap-2 mb-2">
                  <Clock size={16} />
                  우편함 AP 만료 안내
                </h4>
                <p className="text-blue-500 text-sm">
                  가장 빠른 우편함 AP 만료: <span className="font-bold">{format(result.earliestMailboxExpiry, 'yyyy년 MM월 dd일 HH:mm')}</span>
                </p>
                <p className="text-blue-400 text-xs mt-1">
                  * 우편함 AP는 입금 시점으로부터 24시간 후 자동 만료됩니다.
                </p>
              </div>
            )}
            </>
          )}
          </div>
        </div>
      ) : (
        <div className="bg-white/40 border border-dashed border-[var(--plana-border)] rounded-xl h-full flex flex-col items-center justify-center p-8 text-center text-[var(--plana-text-muted)] min-h-[300px]">
          <p>좌측에서 옵션을 설정하고 '계산하기'를 누르면<br/>이곳에 타임라인이 표시됩니다.</p>
        </div>
      )}
      </div>
      
      {/* Hidden Export Template — 단일 컬럼 세로형 */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        {result && result.isPossible && (
          <div ref={exportRef} className="bg-[#f8fafc] p-8 w-[700px] rounded-2xl relative font-sans text-gray-800">
            <div className="border-b-2 border-[var(--plana-primary)] pb-4 mb-6">
              <h2 className="text-3xl font-bold text-[var(--plana-text-main)] flex items-center gap-3">
                <span className="text-[var(--plana-primary)] text-4xl">✧</span> AP 존버 시뮬레이션 결과
              </h2>
              <div className="flex gap-4 mt-2 font-bold">
                <p className="text-[var(--plana-primary-dark)] text-xl">최종 목표 AP: {result.totalHoardedAp} AP</p>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                {hoardingDays}일 존버 · 생성 시간 {format(new Date(), 'yyyy-MM-dd HH:mm')}
              </p>
            </div>
            
            {/* 단일 컬럼 타임라인 */}
            <div className="flex flex-col gap-3">
              {groupTimelineByDay(result.timeline).map((group, groupIdx) => (
                <div key={groupIdx}>
                  {/* 날짜 구분 배너 */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="h-px flex-1 bg-slate-300"></div>
                    <div className="shrink-0 text-center text-sm font-bold text-[var(--plana-primary-dark)] bg-[var(--plana-primary-light)]/15 px-6 py-2 rounded-2xl border border-[var(--plana-primary-light)]/30 whitespace-nowrap">
                      {group.dayLabel}
                    </div>
                    <div className="h-px flex-1 bg-slate-300"></div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {group.steps.map((step, idx) => (
                      <div key={idx} className={`flex flex-col p-4 rounded-xl border shadow-sm relative ${
                        step.isWarning 
                          ? 'bg-amber-50 border-amber-200' 
                          : step.isImportant 
                            ? 'bg-[var(--plana-primary-light)]/5 border-[var(--plana-primary-light)]/40' 
                            : 'bg-white border-slate-200'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <span className="text-xs text-slate-400 font-mono mb-1 block">
                              {format(step.time, 'yyyy년 MM월 dd일 HH:mm')}
                            </span>
                            <h4 className={`text-base font-bold ${
                              step.isWarning 
                                ? 'text-amber-600' 
                                : step.isImportant 
                                  ? 'text-[var(--plana-primary-dark)]' 
                                  : 'text-slate-800'
                            }`}>
                              {step.action}
                            </h4>
                            <p className="text-slate-500 text-sm whitespace-pre-line mt-1 leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                          
                          {step.barAp !== undefined && step.mailboxAp !== undefined && (
                            <div className="text-right ml-4 flex-shrink-0">
                              <div className="text-sm font-bold text-[var(--plana-primary-dark)]">
                                AP: {step.barAp}
                              </div>
                              {step.mailboxAp > 0 && (
                                <div className="text-xs text-orange-500 font-semibold">
                                  +{step.mailboxAp}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 우편함 만료 안내 */}
            {result.earliestMailboxExpiry && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h4 className="text-blue-600 font-bold flex items-center gap-2 mb-2 text-sm">
                  ⏰ 우편함 AP 만료 안내
                </h4>
                <p className="text-blue-500 text-sm">
                  가장 빠른 만료: <span className="font-bold">{format(result.earliestMailboxExpiry, 'yyyy년 MM월 dd일 HH:mm')}</span>
                </p>
                {result.mailboxExpiryWarnings && result.mailboxExpiryWarnings.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {result.mailboxExpiryWarnings.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-red-500">
                        <span>⚠ {item.name} ({item.amount} AP)</span>
                        <span>만료: {format(item.expiresAt, 'MM/dd HH:mm')}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-blue-400 text-xs mt-2">
                  * 우편함 AP는 입금 시점으로부터 24시간 후 자동 만료됩니다.
                </p>
              </div>
            )}

            <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200 flex justify-end items-end">
              <div className="flex items-center gap-4 relative">
                <div className="text-right z-10 pb-2">
                  <div className="text-sm text-gray-500 font-bold mb-0.5">보고서 작성자</div>
                  <div className="text-2xl font-black text-[var(--plana-primary-dark)] tracking-wider">프라나</div>
                </div>
                <div className="w-24 h-24 relative z-0">
                  <img src="/images/plana_stamp.png" alt="Plana Stamp" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] max-w-none h-auto object-contain drop-shadow-sm opacity-90 -rotate-12" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
    </div>
  );
}
