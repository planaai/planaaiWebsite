'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Head from 'next/head';
import Image from 'next/image';
import axios from 'axios';
import { toPng } from 'html-to-image';
import { useAuthStore } from '@/store/authStore';
import { useArchiveStore } from '@/store/archiveStore';
import { fetchServerData, getImageUrl } from '@/lib/api';

function CustomProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore(); // 인증 토큰 및 유저 정보
  
  const [isClient, setIsClient] = useState(false);
  
  // 폼 상태
  const [showStudents, setShowStudents] = useState(true);
  const [showTactics, setShowTactics] = useState(true);
  const [favoriteStudent, setFavoriteStudent] = useState('');
  const [favoriteStudentImage, setFavoriteStudentImage] = useState('');
  const [bondLevel, setBondLevel] = useState<number>(10);
  const [teacherLevel, setTeacherLevel] = useState<number>(1);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // 학생 리스트 상태
  const [ownedStudents, setOwnedStudents] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  
  const records = useArchiveStore(state => state.records);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    
    // 학생 데이터 불러오기
    const loadStudents = async () => {
      try {
        const { masterData, archiveData } = await fetchServerData();
        
        const archiveMap = new Map();
        archiveData.forEach(record => {
          if (record && record.studentId) {
            archiveMap.set(record.studentId, record);
          }
        });
        
        const owned = [];
        for (let i = 0; i < masterData.length; i++) {
          const student = masterData[i];
          if (archiveMap.has(student.id)) {
            owned.push(student);
          }
        }
        
        setOwnedStudents(owned);
        if (owned.length > 0 && !favoriteStudent) {
          setFavoriteStudent(owned[0].name);
          setFavoriteStudentImage(getImageUrl(owned[0].portraitUrls?.[0]));
          
          const record = archiveMap.get(owned[0].id);
          if (record && record.bondRank) {
            setBondLevel(record.bondRank);
          }
        }
      } catch (error) {
        console.error('학생 데이터를 불러오는데 실패했습니다.', error);
      } finally {
        setIsLoadingStudents(false);
      }
    };
    
    if (user) {
      loadStudents();
    } else {
      setIsLoadingStudents(false);
    }
  }, [user]);

    // OAuth2 콜백 처리
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    
    if (code && state && token) {
      handleDiscordCallback(code, state, token);
    }
  }, [searchParams]);

  const handleDiscordCallback = async (code: string, state: string, token: string) => {
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
      favorite_student_image: favoriteStudentImage,
      bond_level: bondLevel,
      teacher_level: teacherLevel
    };
    
    const state = encodeURIComponent(btoa(JSON.stringify(stateData)));
    
    const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=role_connections.write&state=${state}`;
    
    window.location.href = oauthUrl;
  };

  const handleDownloadImage = async () => {
    if (cardRef.current) {
      try {
        const dataUrl = await toPng(cardRef.current, { cacheBust: true, style: { background: 'transparent' } });
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
    <div className="w-full fade-in-anim">
      <Head>
        <title>디스코드 위젯 커스텀 대시보드 - PlanaAI</title>
      </Head>

      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-[var(--plana-text-main)]">디스코드 위젯 커스텀 대시보드</h1>
        
        {syncMessage && (
          <div className="mb-6 p-4 rounded-xl glass-panel text-[var(--plana-text-main)] border border-plana-primary">
            {syncMessage}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* 좌측 패널 (컨트롤러) */}
          <div className="w-full lg:w-1/3 glass-panel rounded-2xl p-6 flex flex-col gap-6">
            <h2 className="text-xl font-semibold border-b border-plana-border pb-2 text-[var(--plana-text-main)]">표시할 데이터 선택</h2>
            
            <div className="flex flex-col gap-4 text-[var(--plana-text-main)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showStudents} 
                  onChange={(e) => setShowStudents(e.target.checked)}
                  className="w-5 h-5 rounded text-plana-primary focus:ring-plana-primary border-gray-300"
                />
                <span>학생 수집 및 전무 달성 데이터</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showTactics} 
                  onChange={(e) => setShowTactics(e.target.checked)}
                  className="w-5 h-5 rounded text-plana-primary focus:ring-plana-primary border-gray-300"
                />
                <span>택틱 및 전술대항전 공유 데이터</span>
              </label>

              <div className="mt-4 pt-4 border-t border-plana-border">
                <h3 className="text-sm font-medium text-[var(--plana-text-muted)] mb-3">최애 학생 전시</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm mb-1">최애 학생</label>
                    <select 
                      value={favoriteStudent} 
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        setFavoriteStudent(selectedName);
                        const student = ownedStudents.find(s => s.name === selectedName);
                        if (student) {
                          setFavoriteStudentImage(getImageUrl(student.portraitUrls?.[0]));
                          
                          // 선택 시 archiveStore 대신 서버에서 받아온 archiveData를 쓸 수 있도록,
                          // 이미 bondLevel은 기본값 10을 주거나 사용자가 수정하도록 둡니다.
                          // 만약 여기서도 bondRank를 넣고 싶다면 archiveMap을 state로 빼야 합니다.
                          // 현재로선 로컬 archiveStore를 fallback으로 사용해 봅니다.
                          const record = records[student.id];
                          if (record && record.bondRank) {
                            setBondLevel(record.bondRank);
                          }
                        } else {
                          setFavoriteStudentImage('');
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-xl bg-white/50 border-plana-border focus:ring-2 focus:ring-plana-primary outline-none text-[var(--plana-text-main)]"
                      disabled={isLoadingStudents || ownedStudents.length === 0}
                    >
                      {isLoadingStudents ? (
                        <option value="">불러오는 중...</option>
                      ) : ownedStudents.length === 0 ? (
                        <option value="">보유한 학생이 없습니다</option>
                      ) : (
                        ownedStudents.map((student) => (
                          <option key={student.id} value={student.name}>
                            {student.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">인연 레벨</label>
                    <input 
                      type="number" 
                      value={bondLevel} 
                      onChange={(e) => setBondLevel(Number(e.target.value))}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border rounded-xl bg-white/50 border-plana-border focus:ring-2 focus:ring-plana-primary outline-none text-[var(--plana-text-main)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">선생님 레벨</label>
                    <input 
                      type="number" 
                      value={teacherLevel} 
                      onChange={(e) => setTeacherLevel(Number(e.target.value))}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border rounded-xl bg-white/50 border-plana-border focus:ring-2 focus:ring-plana-primary outline-none text-[var(--plana-text-main)]"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-auto pt-6 flex flex-col gap-3">
              <button 
                onClick={handleDiscordSyncClick}
                disabled={isSyncing}
                className="w-full py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {isSyncing ? '갱신 중...' : '디스코드 위젯 갱신'}
              </button>
              
              <button 
                onClick={handleDownloadImage}
                className="w-full py-3 bg-white/60 hover:bg-white/80 text-[var(--plana-text-main)] rounded-xl font-medium transition-colors border border-plana-border shadow-sm"
              >
                이미지로 다운로드
              </button>
              <p className="text-xs text-center text-[var(--plana-text-muted)] mt-2">
                개인정보 보호를 위해 위젯 갱신 정보는 1회성으로 전송되며 서버에 저장되지 않습니다.
              </p>
            </div>
          </div>

          {/* 우측 캔버스 (미리보기) */}
          <div className="w-full lg:w-2/3 flex items-center justify-center glass-panel rounded-2xl p-8">
            <div 
              ref={cardRef}
              className="relative w-full max-w-md bg-white/80 backdrop-blur-md border border-plana-primary-light rounded-3xl shadow-xl p-8 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
              }}
            >
              {/* 블루아카이브 스타일 장식 요소 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-plana-primary/20 rounded-bl-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-plana-accent/30 rounded-tr-full -ml-10 -mb-10 blur-2xl pointer-events-none"></div>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-sm border border-plana-primary-light">
                  👨‍🏫
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[var(--plana-text-main)]">
                    {user?.nickname || user?.username || '선생님'} <span className="text-lg font-medium text-[var(--plana-text-muted)]">Lv.{teacherLevel}</span>
                  </h2>
                  <p className="text-plana-primary-dark text-sm font-medium">PlanaAI 샬레 오피스</p>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                {favoriteStudent && (
                  <div className="bg-white/60 rounded-2xl p-4 flex items-center justify-between shadow-sm border border-plana-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-plana-primary-light/30 flex items-center justify-center text-plana-primary-dark overflow-hidden">
                        {favoriteStudentImage ? (
                          <img src={favoriteStudentImage} alt={favoriteStudent} className="w-full h-full object-cover" crossOrigin="anonymous" />
                        ) : (
                          <span>💖</span>
                        )}
                      </div>
                      <span className="font-medium text-[var(--plana-text-main)]">최애 학생</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[var(--plana-text-main)]">{favoriteStudent}</p>
                      <p className="text-xs text-plana-primary-dark font-semibold">인연 레벨 {bondLevel}</p>
                    </div>
                  </div>
                )}

                {showStudents && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/60 rounded-2xl p-4 border border-plana-border shadow-sm">
                      <p className="text-sm text-[var(--plana-text-muted)] mb-1">보유 학생</p>
                      <p className="text-2xl font-bold text-plana-primary-dark">??? <span className="text-sm font-normal text-[var(--plana-text-muted)]">명</span></p>
                    </div>
                    <div className="bg-white/60 rounded-2xl p-4 border border-plana-border shadow-sm">
                      <p className="text-sm text-[var(--plana-text-muted)] mb-1">전무 3성</p>
                      <p className="text-2xl font-bold text-[var(--plana-accent)]">??? <span className="text-sm font-normal text-[var(--plana-text-muted)]">명</span></p>
                    </div>
                  </div>
                )}

                {showTactics && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/60 rounded-2xl p-4 border border-plana-border shadow-sm">
                      <p className="text-sm text-[var(--plana-text-muted)] mb-1">택틱 공유</p>
                      <p className="text-2xl font-bold text-plana-primary">??? <span className="text-sm font-normal text-[var(--plana-text-muted)]">개</span></p>
                    </div>
                    <div className="bg-white/60 rounded-2xl p-4 border border-plana-border shadow-sm">
                      <p className="text-sm text-[var(--plana-text-muted)] mb-1">전술 덱 공유</p>
                      <p className="text-2xl font-bold text-plana-primary-dark">??? <span className="text-sm font-normal text-[var(--plana-text-muted)]">개</span></p>
                    </div>
                  </div>
                )}
                
                {(!showStudents && !showTactics && !favoriteStudent) && (
                  <div className="py-12 text-center text-[var(--plana-text-muted)]">
                    좌측 패널에서 표시할 데이터를 선택해주세요.
                  </div>
                )}
              </div>
              
              <div className="mt-8 text-center opacity-40">
                <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--plana-text-main)]">Powered by PlanaAI</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function CustomProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CustomProfileContent />
    </Suspense>
  );
}
