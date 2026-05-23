import { db } from './db';
import type { Submission, Problem, SkillProfile } from './db';

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'volume' | 'mastery' | 'variety' | 'difficulty';
}

export const ALL_BADGES: BadgeDef[] = [
  // Streak (Duolingo-inspired)
  { id: 'streak_7', name: '连续7天', description: '连续刷题7天', icon: '/achievements/streak-7.svg', category: 'streak' },
  { id: 'streak_30', name: '月度全勤', description: '连续刷题30天', icon: '/achievements/streak-30.svg', category: 'streak' },
  { id: 'streak_100', name: '百日修行', description: '连续刷题100天', icon: '/achievements/streak-100.svg', category: 'streak' },

  // Volume
  { id: 'sub_100', name: '百题斩', description: '累计提交100次', icon: '/achievements/sub-100.svg', category: 'volume' },
  { id: 'sub_500', name: '五百题', description: '累计提交500次', icon: '/achievements/sub-500.svg', category: 'volume' },
  { id: 'sub_1000', name: '千题大师', description: '累计提交1000次', icon: '/achievements/sub-1000.svg', category: 'volume' },

  // Mastery
  { id: 'mastery_first_3', name: '初次掌握', description: '首个标签达到等级3', icon: '/achievements/mastery-first-3.svg', category: 'mastery' },
  { id: 'mastery_first_4', name: '熟练达人', description: '首个标签达到等级4', icon: '/achievements/mastery-first-4.svg', category: 'mastery' },
  { id: 'mastery_first_5', name: '精通领域', description: '首个标签达到等级5', icon: '/achievements/mastery-first-5.svg', category: 'mastery' },
  { id: 'mastery_3_tags_3', name: '三项全能', description: '3个标签达到等级3+', icon: '/achievements/mastery-3-tags-3.svg', category: 'mastery' },

  // Variety
  { id: 'variety_5', name: '五艺初探', description: '练习过5个不同标签', icon: '/achievements/variety-5.svg', category: 'variety' },
  { id: 'variety_10', name: '十项全能', description: '练习过10个不同标签', icon: '/achievements/variety-10.svg', category: 'variety' },
  { id: 'variety_20', name: '博学多才', description: '练习过20个不同标签', icon: '/achievements/variety-20.svg', category: 'variety' },

  // Difficulty
  { id: 'first_hard', name: '首破困难', description: '首次通过困难题', icon: '/achievements/first-hard.svg', category: 'difficulty' },
  { id: 'hard_10', name: '困难克星', description: '通过10道困难题', icon: '/achievements/hard-10.svg', category: 'difficulty' },
];

const BADGE_MAP = new Map(ALL_BADGES.map((b) => [b.id, b]));

/**
 * 检查并解锁新成就，返回本次新解锁的成就
 */
export async function checkAchievements(
  submissions: Submission[],
  problems: Problem[],
  skillProfiles: SkillProfile[],
  currentStreak: number
): Promise<BadgeDef[]> {
  const existing = await db.achievements.toArray();
  const unlockedIds = new Set(existing.map((a) => a.id));
  const newlyUnlocked: BadgeDef[] = [];

  const totalSubs = submissions.length;
  const acSubs = submissions.filter((s) => s.verdict === 'AC');
  const probMap = new Map(problems.map((p) => [p.id, p]));

  // Tags practiced (from problems)
  const tagsPracticed = new Set<string>();
  for (const s of submissions) {
    const p = probMap.get(s.problemId);
    if (p?.tags) for (const t of p.tags) tagsPracticed.add(t);
  }

  // Hard problems solved
  const hardSolved = new Set<string>();
  for (const s of acSubs) {
    const p = probMap.get(s.problemId);
    if (p && p.rating >= 2000) hardSolved.add(s.problemId);
  }

  // Tags with Elo at least 1700 (掌握级)
  const tagsAtElo1700 = skillProfiles.filter((sp) => sp.rating >= 1700 && sp.tag !== 'global');

  const checks: [string, boolean][] = [
    ['streak_7', currentStreak >= 7],
    ['streak_30', currentStreak >= 30],
    ['streak_100', currentStreak >= 100],
    ['sub_100', totalSubs >= 100],
    ['sub_500', totalSubs >= 500],
    ['sub_1000', totalSubs >= 1000],
    ['mastery_first_3', tagsAtElo1700.length >= 1],
    ['mastery_first_4', skillProfiles.some((sp) => sp.rating >= 1900 && sp.tag !== 'global')],
    ['mastery_first_5', skillProfiles.some((sp) => sp.rating >= 2100 && sp.tag !== 'global')],
    ['mastery_3_tags_3', tagsAtElo1700.length >= 3],
    ['variety_5', tagsPracticed.size >= 5],
    ['variety_10', tagsPracticed.size >= 10],
    ['variety_20', tagsPracticed.size >= 20],
    ['first_hard', hardSolved.size >= 1],
    ['hard_10', hardSolved.size >= 10],
  ];

  for (const [badgeId, met] of checks) {
    if (met && !unlockedIds.has(badgeId)) {
      const badge = BADGE_MAP.get(badgeId);
      if (badge) {
        await db.achievements.put({ id: badgeId, unlockedAt: Date.now(), notified: false });
        newlyUnlocked.push(badge);
      }
    }
  }

  return newlyUnlocked;
}

/**
 * 标记成就为已通知
 */
export async function markNotified(badgeId: string): Promise<void> {
  const a = await db.achievements.get(badgeId);
  if (a) {
    await db.achievements.put({ ...a, notified: true });
  }
}

/**
 * 获取所有已解锁成就及其徽章定义
 */
export async function getUnlockedBadges(): Promise<(BadgeDef & { unlockedAt: number })[]> {
  const achievements = await db.achievements.toArray();
  return achievements
    .map((a) => {
      const badge = BADGE_MAP.get(a.id);
      return badge ? { ...badge, unlockedAt: a.unlockedAt } : null;
    })
    .filter(Boolean) as (BadgeDef & { unlockedAt: number })[];
}

export { BADGE_MAP };
