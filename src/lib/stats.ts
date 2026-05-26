import type { Submission } from './db';

/** 从提交记录计算连续刷题天数 */
export function computeStreak(submissions: Submission[]): number {
  const daySet = new Set<string>();
  for (const s of submissions) {
    daySet.add(new Date(s.timestamp).toISOString().slice(0, 10));
  }
  const sorted = [...daySet].sort().reverse();
  if (sorted.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (sorted[0] !== today && sorted[0] !== yest) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86400000;
    if (Math.abs(diff - 1) < 0.1) streak++;
    else break;
  }
  return streak;
}
