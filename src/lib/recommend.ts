/**
 * 计算标签的练习紧急度分数
 * @param acRate 该标签的 AC 率 (0-100)
 * @param daysSinceLastPractice 距上次练习的天数
 * @param totalAttempted 总提交次数
 * @returns 紧急度 0-1，越高越需要练习
 */
export function calculateTagUrgency(
  acRate: number,
  daysSinceLastPractice: number,
  totalAttempted: number
): number {
  // 样本不足时降低置信度
  if (totalAttempted < 3) return 0;
  const weaknessScore = 1 - acRate / 100;
  const forgettingScore = Math.min(daysSinceLastPractice / 14, 1);
  return 0.6 * weaknessScore + 0.4 * forgettingScore;
}

/**
 * 基于全局 Elo 和题目难度，计算预期胜率
 */
export function getExpectedProbability(
  userRating: number,
  problemRating: number
): number {
  return 1 / (1 + Math.pow(10, (problemRating - userRating) / 400));
}
