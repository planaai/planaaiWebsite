'use client';

import { useEffect } from 'react';

export default function FormationExport() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentOrigin = window.location.origin;

    const sendData = (source: MessageEventSource | Window, origin: string) => {
      try {
        // Enforce strict same-origin delivery
        if (origin !== currentOrigin) return;
        const data = localStorage.getItem('formation-storage');
        if (data) {
          source.postMessage({ type: 'FORMATION_DATA', payload: data }, { targetOrigin: currentOrigin });
        }
      } catch (e) {
        console.error('Failed to send formation data', e);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      // Reject cross-origin messages
      if (event.origin !== currentOrigin) {
        return;
      }

      if (event.data?.type === 'GET_FORMATION_DATA') {
        if (event.source) {
          sendData(event.source, currentOrigin);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Also broadcast to parent immediately if embedded in same-origin frame
    if (window.parent !== window) {
      try {
        sendData(window.parent, currentOrigin);
      } catch (e) {
        // Detached or protected frame
      }
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return null;
}
