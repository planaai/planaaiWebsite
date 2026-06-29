export const TIER_COLORS = {
  1: {
    gradient: 'linear-gradient(135deg, #f4f6f9 0%, #e1e7f0 100%)',
    border: '#c2cbd6',
    text: '#4b5563', // slate-600
    badge: 'bg-slate-200 text-slate-700'
  },
  2: {
    gradient: 'linear-gradient(135deg, #e0effe 0%, #aed6fc 100%)',
    border: '#8cbff2',
    text: '#1e40af', // blue-800
    badge: 'bg-blue-200 text-blue-800'
  },
  3: {
    gradient: 'linear-gradient(135deg, #ffedd5 0%, #fbc27b 100%)',
    border: '#e8a956',
    text: '#92400e', // amber-900
    badge: 'bg-amber-200 text-amber-900'
  },
  4: {
    gradient: 'linear-gradient(135deg, #f5e1fd 0%, #e0abfa 100%)',
    border: '#c88be8',
    text: '#6b21a8', // purple-800
    badge: 'bg-purple-200 text-purple-900'
  }
};

export function getTierColor(tier: number) {
  return TIER_COLORS[tier as keyof typeof TIER_COLORS] || TIER_COLORS[1];
}
