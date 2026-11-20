'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { forwardRef } from 'react';

export type { TurnstileInstance };

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: (error?: string | Error) => void;
  onExpire?: () => void;
  size?: 'normal' | 'compact' | 'flexible' | 'invisible';
  action?: string;
  theme?: 'auto' | 'light' | 'dark';
}

const TurnstileWidget = forwardRef<TurnstileInstance, TurnstileWidgetProps>(
  ({ onSuccess, onError, onExpire, size = 'normal', action, theme = 'light' }, ref) => (
    <Turnstile
      ref={ref}
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
      onSuccess={onSuccess}
      onError={onError}
      onExpire={onExpire}
      options={{
        size,
        action,
        theme,
        refreshExpired: 'auto',
        refreshTimeout: 'auto',
        retry: 'auto',
      }}
    />
  )
);

TurnstileWidget.displayName = 'TurnstileWidget';
export default TurnstileWidget;
