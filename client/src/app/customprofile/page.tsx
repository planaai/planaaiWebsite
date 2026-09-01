'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Head from 'next/head';
import Image from 'next/image';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { useAuthStore } from '@/store/authStore';

export default function CustomProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuthStore(); // 인증 토큰 및 유저 정보
  
  const [isClient, setIsClient] = useState(false);
  
  // 폼 상태
  const [showStudents, setShowStudents] = useState(true);
  const [showTactics, setShowTactics] = useState(true);
  const [favoriteStudent, setFavoriteStudent] = useState('아로나');
  const [bondLevel, setBondLevel] = useState<number>(10);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    
    // OAuth2 콜백 처리
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (code && state && token) {
      handleDiscordCallback(code, state);
    }
  }, [searchParams, token]);

  const handleDiscordCallback = async (code: string, state: string) => {
    setIsSyncing(true);
    setSyncMessage('디스코드와 연동 중입니다...');
    try {
      const customData = JSON.parse(atob(state));
      
      const redirectUri = window.location.origin + '/customprofile';
      
      const response = await axios.post('http://localhost:3000/api/discord/callback', { // 서버 URL은 환경변수로 처리하는 것이 좋습니다
        code,
        redirectUri,
        customData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSyncMessage('디스코드 위젯이 성공적으로 갱신되었습니다!');
        // 쿼리 스트링 제거 (클린 URL 유지)
        router.replace('/customprofile');
      }
    } catch (error) {
      console.error(error);
      setSyncMessage('디스코드 연동 중 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDiscordSyncClick = () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '';
    if (!DISCORD_CLIENT_ID) {
      alert('디스코드 Client ID가 설정되지 않았습니다.');
      return;
    }

    const redirectUri = encodeURIComponent(window.location.origin + '/customprofile');
    
    const stateData = {
      show_students: showStudents,
      show_tactics: showTactics,
      favorite_student: favoriteStudent,
      bond_level: bondLevel
    };
    
    const state = encodeURIComponent(btoa(JSON.stringify(stateData)));
    
    const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=role_connections.write&state=${state}`;
    
    window.location.href = oauthUrl;
  };

  const handleDownloadImage = async () => {
    if (cardRef.current) {
      try {
        const canvas = await html2canvas(cardRef.current, { backgroundColor: null });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'planaai_profile.png';
        link.click();
      } catch (err) {
        console.error('이미지 저장 실패', err);
        alert('이미지 저장에 실패했습니다.');
      }
    }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8">
      <Head>
        <title>디스코드 위젯 커스텀 대시보드 - PlanaAI</title>
      </Head>

      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-blue-600 dark:text-blue-400">디스코드 위젯 커스텀 대시보드</h1>
        
        {syncMessage && (
          <div className="mb-6 p-4 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {syncMessage}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* 좌측 패널 (컨트롤러) */}
          <div className="w-full lg:w-1/3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col gap-6">
            <h2 className="text-xl font-semibold border-b pb-2">표시할 데이터 선택</h2>
            
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showStudents} 
                  onChange={(e) => setShowStudents(e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>학생 수집 및 전무 달성 데이터</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showTactics} 
                  onChange={(e) => setShowTactics(e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>택틱 및 전술대항전 공유 데이터</span>
              </label>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">최애 학생 전시</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm mb-1">최애 학생 이름</label>
                    <input 
                      type="text" 
                      value={favoriteStudent} 
                      onChange={(e) => setFavoriteStudent(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="예: 시로코"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">인연 레벨</label>
                    <input 
                      type="number" 
                      value={bondLevel} 
                      onChange={(e) => setBondLevel(Number(e.target.value))}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-auto pt-6 flex flex-col gap-3">
              <button 
                onClick={handleDiscordSyncClick}
                disabled={isSyncing}
                className="w-full py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-medium transition-colors shadow-md disabled:opacity-50"
              >
                {isSyncing ? '갱신 중...' : '디스코드 위젯 갱신'}
              </button>
              
              <button 
                onClick={handleDownloadImage}
                className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-medium transition-colors border border-gray-200 dark:border-gray-600"
              >
                이미지로 다운로드
              </button>
              <p className="text-xs text-center text-gray-500 mt-2">
                개인정보 보호를 위해 위젯 갱신 정보는 1회성으로 전송되며 서버에 저장되지 않습니다.
              </p>
            </div>
          </div>

          {/* 우측 캔버스 (미리보기) */}
          <div className="w-full lg:w-2/3 flex items-center justify-center bg-gray-200 dark:bg-gray-800 rounded-2xl shadow-inner p-8">
            <div 
              ref={cardRef}
              className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-white/20 dark:border-slate-700/50 rounded-3xl shadow-2xl p-8 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
              }}
            >
              {/* 블루아카이브 스타일 장식 요소 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-pink-500/10 rounded-tr-full -ml-10 -mb-10 blur-2xl pointer-events-none"></div>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-2xl shadow-sm border border-blue-200 dark:border-blue-800">
                  👨‍🏫
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {user?.nickname || user?.username || '선생님'}
                  </h2>
                  <p className="text-blue-500 text-sm font-medium">PlanaAI 샬레 오피스</p>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                {favoriteStudent && (
                  <div className="bg-gray-50/80 dark:bg-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
                        💖
                      </div>
                      <span className="font-medium text-gray-700 dark:text-gray-200">최애 학생</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{favoriteStudent}</p>
                      <p className="text-xs text-pink-500 font-semibold">인연 레벨 {bondLevel}</p>
                    </div>
                  </div>
                )}

                {showStudents && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/50">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">보유 학생</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">??? <span className="text-sm font-normal text-gray-400">명</span></p>
                    </div>
                    <div className="bg-purple-50/80 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-900/50">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">전무 3성</p>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">??? <span className="text-sm font-normal text-gray-400">명</span></p>
                    </div>
                  </div>
                )}

                {showTactics && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50/80 dark:bg-green-900/20 rounded-2xl p-4 border border-green-100 dark:border-green-900/50">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">택틱 공유</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">??? <span className="text-sm font-normal text-gray-400">개</span></p>
                    </div>
                    <div className="bg-orange-50/80 dark:bg-orange-900/20 rounded-2xl p-4 border border-orange-100 dark:border-orange-900/50">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">전술 덱 공유</p>
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">??? <span className="text-sm font-normal text-gray-400">개</span></p>
                    </div>
                  </div>
                )}
                
                {(!showStudents && !showTactics && !favoriteStudent) && (
                  <div className="py-12 text-center text-gray-400">
                    좌측 패널에서 표시할 데이터를 선택해주세요.
                  </div>
                )}
              </div>
              
              <div className="mt-8 text-center opacity-30">
                <p className="text-[10px] font-mono tracking-widest uppercase">Powered by PlanaAI</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
