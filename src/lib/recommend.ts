export function calculateProblemScore(
  userTagRating: number,
  globalRating: number,
  problemRating: number,
  lastPracticedAt: number
): number {
  // 1. 难度匹配分 (W1) - 最优胜率目标设为 60% (0.6)
  const expectedProb = 1 / (1 + Math.pow(10, (problemRating - userTagRating) / 400));
  // 胜率越接近 0.6，得分越高 (最高 1 分，最低 0 分)
  const difficultyScore = 1 - Math.abs(expectedProb - 0.6) / 0.6;

  // 2. 短板补齐分 (W2)
  // 如果该标签 rating 低于全局 rating，则加分
  const deficit = globalRating - userTagRating;
  const weaknessScore = deficit > 0 ? Math.min(deficit / 400, 1) : 0;

  // 3. 遗忘分 (W3)
  // 距离上次练习时间越长，得分越高
  const daysSinceLastPractice = (Date.now() - lastPracticedAt) / (1000 * 60 * 60 * 24);
  const forgettingScore = Math.min(daysSinceLastPractice / 14, 1); // 14天不练满分

  // 权重
  const W1 = 0.5;
  const W2 = 0.3;
  const W3 = 0.2;

  return W1 * difficultyScore + W2 * weaknessScore + W3 * forgettingScore;
}