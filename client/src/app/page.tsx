'use client';

import React from 'react';
import Link from 'next/link';
import { Users, BookOpen, Gift, Sparkles, Target, User, Calculator, Layout, BatteryCharging, Terminal, Info } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';

const menuGroups = [
  {
    title: '정보 & 도감',
    items: [
      { num: '01', title: '컬렉션', path: '/collection', icon: Users },
      { num: '02', title: '도감', path: '/archive', icon: BookOpen },
      { num: '03', title: '선물', path: '/gifts', icon: Gift },
    ]
  },
  {
    title: '플래너 & 유틸리티',
    items: [
      { num: '04', title: '가챠 시뮬레이터', path: '/gacha', icon: Sparkles },
      { num: '05', title: '육성 플래너', path: '/planner', icon: Target },
      { num: '06', title: '모의 편성', path: '/formation', icon: Layout },
      { num: '07', title: '청휘석 계산기', path: '/pyroxene', icon: Calculator },
      { num: '08', title: 'AP 존버 계산기', path: '/ap-calculator', icon: BatteryCharging },
    ]
  },
  {
    title: '시스템',
    items: [
      { num: '09', title: '공지사항', path: '/notices', icon: Info },
      { num: '10', title: 'API', path: '#', icon: Terminal, isComingSoon: true },
      { num: '11', title: '계정', path: '/account', icon: User },
    ]
  }
];

export default function LobbyPage() {
  const { showAlert } = useAlert();

  return (
    <div className="fixed inset-0 w-full h-full flex items-center justify-center overflow-hidden z-20 bg-transparent">
      
      {/* Central Content Wrapper */}
      <div className="w-full max-w-[1400px] flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 px-6 md:px-12 h-full max-h-screen py-8">
        
        {/* Left side: Huge Logo */}
        <div className="flex-1 flex items-center justify-center fade-in-anim">
          <img 
            src="/images/logo.png" 
            alt="PLANA.AI Logo" 
            className="w-full max-w-[350px] md:max-w-[450px] lg:max-w-[500px] h-auto object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] transform transition-transform duration-700 hover:scale-105"
          />
        </div>

        {/* Right side: Menu Buttons Grouped */}
        <div className="flex-1 flex flex-col w-full max-w-[400px] md:max-w-[850px] h-full justify-center overflow-y-auto pr-2 sm:pr-4 custom-scrollbar" style={{ maxHeight: '85vh' }}>
          <div className="flex flex-col gap-8 w-full py-4">
            {menuGroups.map((group, groupIdx) => (
              <div key={group.title} className="flex flex-col gap-4 fade-in-anim" style={{ animationDelay: `${groupIdx * 0.15}s` }}>
                
                {/* Group Header */}
                <div className="flex items-center gap-3 pl-2 md:pl-4 border-l-4 border-[var(--plana-primary)]">
                  <h3 className="text-lg md:text-xl font-bold text-slate-700 tracking-tight">
                    {group.title}
                  </h3>
                  <div className="flex-1 h-px bg-slate-200/50"></div>
                </div>

                {/* Group Items */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pl-2 md:pl-4">
                  {group.items.map((item, itemIdx) => {
                    const Icon = item.icon;
                    return (
                      <Link 
                        key={item.num} 
                        href={item.path}
                        onClick={(e) => {
                          if (item.isComingSoon) {
                            e.preventDefault();
                            showAlert('알림', '선생님, 해당 기능은 준비중입니다.');
                          }
                        }}
                        className="group relative block w-full h-[4.5rem] bg-[var(--plana-bg-panel)]/90 backdrop-blur-xl border border-[var(--plana-border)] shadow-lg transition-all duration-300 transform -skew-x-12 hover:translate-x-4 hover:border-[var(--plana-primary)] hover:bg-white/95 hover:shadow-[0_0_30px_rgba(255,166,201,0.6)] slide-in-right-anim"
                        style={{ 
                          animationDelay: `${(groupIdx * 0.15) + (itemIdx * 0.08)}s`
                        }}
                      >
                        {/* Accent bar on the left (skewed with the button) */}
                        <div className="absolute top-0 left-0 w-2 md:w-3 h-full bg-[var(--plana-primary)] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="flex items-center justify-between w-full h-full px-6 md:px-8 transform skew-x-12">
                          <div className="flex items-center gap-3 md:gap-5">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-100/50 border border-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-[var(--plana-primary-light)] group-hover:border-[var(--plana-primary)] group-hover:text-white transition-all shadow-sm group-hover:shadow-[0_0_10px_rgba(255,166,201,0.5)] group-hover:scale-110">
                              <Icon size={20} className="w-4 h-4 md:w-5 md:h-5" />
                            </div>
                            <span className="text-lg md:text-xl font-bold text-slate-700 tracking-tight group-hover:text-[var(--plana-primary-dark)] transition-colors whitespace-nowrap">
                              {item.title}
                            </span>
                          </div>
                          
                          <span className="text-2xl md:text-3xl font-black text-slate-300/50 group-hover:text-[var(--plana-primary-light)]/40 transition-colors tracking-tighter italic mr-2 md:mr-0">
                            {item.num}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
