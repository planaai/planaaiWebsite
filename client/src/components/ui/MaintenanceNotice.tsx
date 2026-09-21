import React from 'react';

export function MaintenanceNotice() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]">
      <div className="w-full max-w-[420px] rounded-2xl bg-white/95 border border-slate-200/80 p-8 sm:p-10 text-center shadow-2xl">
        <div className="text-xs sm:text-sm font-bold tracking-wider text-sky-500 uppercase">
          PLANA.AI
        </div>
        <h1 className="mt-3 text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          서비스 업데이트 중입니다
        </h1>
        <p className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed break-keep">
          더 나은 서비스를 위해 업데이트를 진행하고 있습니다.
          <br className="hidden sm:inline" />
          {' '}재오픈 시점은 추후 커뮤니티를 통한 공지로 알려드리겠습니다.
        </p>
      </div>
    </div>
  );
}
