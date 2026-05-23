import { Lock } from 'lucide-react';
import type { BadgeDef } from '../lib/achievements';

interface AchievementIconProps {
  badge: BadgeDef;
  unlocked?: boolean;
  className?: string;
}

export function AchievementIcon({ badge, unlocked = true, className = 'h-10 w-10' }: AchievementIconProps) {
  if (!unlocked) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-[#161B22] text-gray-600 ${className}`}>
        <Lock className="h-1/2 w-1/2" aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={badge.icon}
      alt={badge.name}
      className={`inline-block object-contain ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}
