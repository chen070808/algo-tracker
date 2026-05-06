import { db } from './db';

const DEFAULT_RATING = 1500;
const ELO_K_NEW = 40;
const ELO_K_OLD = 20;

/**
 * 计算预期胜率
 * @param userRating 用户的 Rating
 * @param problemRating 题目的 Rating
 * @returns 预期胜率 0~1
 */
export function getExpectedProbability(userRating: number, problemRating: number): number {
  return 1 / (1 + Math.pow(10, (problemRating - userRating) / 400));
}

/**
 * 赛后结算，更新用户特定标签的 Rating
 * @param tag 知识点标签
 * @param problemRating 题目难度 Rating
 * @param isAC 是否通过
 */
export async function updateSkillRating(tag: string, problemRating: number, isAC: boolean) {
  await db.transaction('rw', db.skillProfiles, async () => {
    let profile = await db.skillProfiles.get(tag);
    if (!profile) {
      profile = {
        tag,
        rating: DEFAULT_RATING,
        volatility: 0,
        lastPracticedAt: Date.now(),
        streak: 0,
        totalAttempted: 0,
        totalAC: 0,
      };
    }

    const expected = getExpectedProbability(profile.rating, problemRating);
    const actual = isAC ? 1 : 0;
    
    // K 因子随练习次数衰减
    const K = profile.totalAttempted < 30 ? ELO_K_NEW : ELO_K_OLD;
    
    // 更新 Rating
    profile.rating = profile.rating + K * (actual - expected);
    
    // 更新其他统计信息
    profile.totalAttempted += 1;
    if (isAC) {
      profile.totalAC += 1;
      profile.streak += 1;
    } else {
      profile.streak = 0;
    }
    profile.lastPracticedAt = Date.now();

    await db.skillProfiles.put(profile);
  });
}
