'use client';

import { useEffect } from 'react';

/**
 * Safely updates document.title on client mount and subsequent title value changes.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    if (typeof document !== 'undefined' && title) {
      document.title = title;
    }
  }, [title]);
}
