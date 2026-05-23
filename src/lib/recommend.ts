import type { SkillProfile, Submission, Problem } from './db';
import { getTargetElo } from './elo';

export function calculateTagUrgency(
  acRate: number,
  daysSinceLastPractice: number,
  totalAttempted: number
): number {
  if (totalAttempted < 3) return 0;
  const weaknessScore = 1 - acRate / 100;
  const forgettingScore = Math.min(daysSinceLastPractice / 14, 1);
  return 0.6 * weaknessScore + 0.4 * forgettingScore;
}

export function getExpectedProbability(
  userRating: number,
  problemRating: number
): number {
  return 1 / (1 + Math.pow(10, (problemRating - userRating) / 400));
}

export interface TagRecommendation {
  tag: string;
  label: string;
  currentElo: number;
  targetElo: number;
  eloGap: number;
  urgency: number;
  reason: string;
  suggestedDifficulty: [number, number];
  acRate: number;
  totalAttempted: number;
  daysSince: number;
}

function difficultyForElo(elo: number): [number, number] {
  if (elo < 1500) return [1200, 1500];
  if (elo < 1700) return [1300, 1700];
  if (elo < 1900) return [1500, 2000];
  if (elo < 2100) return [1700, 2200];
  return [2000, 2600];
}

/**
 * 多因子推荐引擎 v3 — 基于 Elo 差距而非 1-5 等级
 * @param targetCompId 目标比赛ID，用于计算 Elo 差距
 */
export function getDailyRecommendations(
  skillProfiles: SkillProfile[],
  allSubmissions: Submission[],
  allProblems: Problem[],
  targetCompId: string = 'lanqiao'
): TagRecommendation[] {
  const now = Date.now();
  const probMap = new Map(allProblems.map((p) => [p.id, p]));

  // 计算每个标签的最后练习时间
  const tagLastAt = new Map<string, number>();
  for (const sub of allSubmissions) {
    const prob = probMap.get(sub.problemId);
    if (!prob?.tags) continue;
    for (const tag of prob.tags) {
      const prev = tagLastAt.get(tag) || 0;
      if (sub.timestamp > prev) tagLastAt.set(tag, sub.timestamp);
    }
  }

  const recs: TagRecommendation[] = [];

  for (const sp of skillProfiles) {
    if (sp.tag === 'global') continue;

    const lastAt = tagLastAt.get(sp.tag) || 0;
    const daysSince = lastAt ? Math.round((now - lastAt) / 86400000) : 999;
    const acRate = sp.totalAttempted > 0
      ? Math.round((sp.totalAC / sp.totalAttempted) * 100)
      : 0;
    const currentElo = Math.round(sp.rating);
    const targetElo = getTargetElo(targetCompId, sp.tag);
    const eloGap = targetElo - currentElo;

    // 因子1: Elo 差距分 (离目标越远越紧迫)
    const gapScore = eloGap > 0 ? Math.min(eloGap / 400, 1) : 0;

    // 因子2: 遗忘分
    const forgettingScore = Math.min(daysSince / 14, 1);

    // 因子3: 置信度
    const confidence = Math.min(sp.totalAttempted / 20, 1);

    // 综合紧急度
    const urgency = confidence > 0
      ? (0.5 * gapScore + 0.35 * forgettingScore + 0.15 * (1 - confidence)) * confidence
      : 0;

    // 诊断原因
    let reason: string;
    if (eloGap <= 0) {
      reason = '已达标，保持手感';
    } else if (eloGap > 200) {
      reason = `距目标差${eloGap}分，需要系统训练`;
    } else if (daysSince > 7) {
      reason = `${daysSince}天未练，建议复习`;
    } else if (eloGap > 100) {
      reason = `接近目标，差${eloGap}分`;
    } else {
      reason = `即将达标，差${eloGap}分`;
    }

    recs.push({
      tag: sp.tag,
      label: sp.tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      currentElo,
      targetElo,
      eloGap,
      urgency: Math.round(urgency * 100) / 100,
      reason,
      suggestedDifficulty: difficultyForElo(currentElo),
      acRate,
      totalAttempted: sp.totalAttempted,
      daysSince,
    });
  }

  return recs
    .filter((r) => r.totalAttempted >= 1)
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 5);
}
