'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { forwardRef } from 'react';

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  size?: 'normal' | 'compact' | 'invisible';
}

const TurnstileWidget = forwardRef<TurnstileInstance, TurnstileWidgetProps>(
  ({ onSuccess, onError, onExpire, size = 'normal' }, ref) => (
    <Turnstile
      ref={ref}
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
      onSuccess={onSuccess}
      onError={onError}
      onExpire={onExpire}
      options={{ size }}
    />
  )
);

TurnstileWidget.displayName = 'TurnstileWidget';
export default TurnstileWidget;
