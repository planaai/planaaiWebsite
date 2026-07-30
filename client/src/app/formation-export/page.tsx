'use client';

import { useEffect } from 'react';

export default function FormationExport() {
  useEffect(() => {
    const sendData = (source: MessageEventSource | Window, origin: string) => {
      try {
        const data = localStorage.getItem('formation-storage');
        if (data) {
          source.postMessage({ type: 'FORMATION_DATA', payload: data }, { targetOrigin: origin });
        }
      } catch (e) {
        console.error('Failed to send formation data', e);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GET_FORMATION_DATA') {
        if (event.source) {
          sendData(event.source, event.origin || '*');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Also broadcast to parent immediately
    if (window.parent !== window) {
      sendData(window.parent, '*');
    }
    
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return null;
}
