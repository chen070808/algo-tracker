import type { SkillProfile, Submission, Problem } from './db';
import { getTargetElo } from './elo';
import { getTopicNode, getLearningPath, getTopicProblems } from './knowledge-graph';

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
  /** 该主题的前置知识 */
  prerequisites: { id: string; label: string; mastered: boolean; elo: number; targetElo: number }[];
  /** 前置知识是否全部掌握 */
  prereqsReady: boolean;
  /** 推荐练习题目 */
  suggestedProblems: { platform: string; id: string; title: string; difficulty: number }[];
}

function difficultyForElo(elo: number): [number, number] {
  if (elo < 1500) return [1200, 1500];
  if (elo < 1700) return [1300, 1700];
  if (elo < 1900) return [1500, 2000];
  if (elo < 2100) return [1700, 2200];
  return [2000, 2600];
}

/** Elo >= 目标 Elo * 0.85 视为已掌握 */
function isMastered(currentElo: number, targetElo: number): boolean {
  return currentElo >= targetElo * 0.85;
}

function buildSkillMap(
  skillProfiles: SkillProfile[],
  targetCompId: string
): Map<string, { elo: number; targetElo: number; mastered: boolean }> {
  const map = new Map<string, { elo: number; targetElo: number; mastered: boolean }>();
  for (const sp of skillProfiles) {
    if (sp.tag === 'global') continue;
    const targetElo = getTargetElo(targetCompId, sp.tag);
    map.set(sp.tag, {
      elo: Math.round(sp.rating),
      targetElo,
      mastered: isMastered(Math.round(sp.rating), targetElo),
    });
  }
  return map;
}

/**
 * 多因子推荐引擎 v4 — 前置依赖感知
 * 核心改进：如果前置知识未掌握，降低紧急度，引导先学前置
 */
export function getDailyRecommendations(
  skillProfiles: SkillProfile[],
  allSubmissions: Submission[],
  allProblems: Problem[],
  targetCompId: string = 'lanqiao'
): TagRecommendation[] {
  const now = Date.now();
  const probMap = new Map(allProblems.map((p) => [p.id, p]));
  const skillMap = buildSkillMap(skillProfiles, targetCompId);

  // 每个标签的最后练习时间
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

    // 前置依赖分析
    const node = getTopicNode(sp.tag);
    const prerequisites = (node?.prerequisites || []).map((pid) => {
      const pSkill = skillMap.get(pid);
      return {
        id: pid,
        label: getTopicNode(pid)?.labelCn || pid,
        mastered: pSkill?.mastered || false,
        elo: pSkill?.elo || 0,
        targetElo: pSkill?.targetElo || 0,
      };
    });
    const masteredCount = prerequisites.filter((p) => p.mastered).length;
    const prereqsReady = prerequisites.length === 0 || masteredCount === prerequisites.length;

    // 推荐题目（仅当本主题已有一定基础时）
    const problems = getTopicProblems(sp.tag);
    const suggestedProblems = currentElo >= 1400
      ? problems.slice(0, 3)
      : [];

    // 因子1: Elo 差距分
    const gapScore = eloGap > 0 ? Math.min(eloGap / 400, 1) : 0;
    // 因子2: 遗忘分
    const forgettingScore = Math.min(daysSince / 14, 1);
    // 因子3: 置信度
    const confidence = Math.min(sp.totalAttempted / 20, 1);

    // 基础紧急度
    let urgency = confidence > 0
      ? (0.5 * gapScore + 0.35 * forgettingScore + 0.15 * (1 - confidence)) * confidence
      : 0;

    // 前置依赖调整：未掌握的前置越多，紧急度越低
    // （因为现在学这个主题效率不高，应该先学前置）
    if (prerequisites.length > 0) {
      const readiness = masteredCount / prerequisites.length;
      // 如果前置全未掌握，大幅降低（但不清零，保留少量信号）
      urgency *= 0.2 + 0.8 * readiness;
    }

    // 诊断原因 — 前置依赖感知
    let reason: string;
    if (!prereqsReady && eloGap > 0) {
      const missing = prerequisites.filter((p) => !p.mastered);
      const missingNames = missing.slice(0, 2).map((p) => p.label).join('、');
      const extra = missing.length > 2 ? `等${missing.length}项` : '';
      reason = `前置${missingNames}${extra}未掌握，建议先巩固`;
    } else if (eloGap <= 0) {
      reason = '已达标，保持手感';
    } else if (eloGap > 200) {
      reason = `前置已备，距目标差${eloGap}分，可以系统训练`;
    } else if (daysSince > 7) {
      reason = `${daysSince}天未练，建议复习巩固`;
    } else if (eloGap > 100) {
      reason = `接近目标，差${eloGap}分`;
    } else {
      reason = `即将达标，差${eloGap}分`;
    }

    recs.push({
      tag: sp.tag,
      label: node?.labelCn || sp.tag,
      currentElo,
      targetElo,
      eloGap,
      urgency: Math.round(urgency * 100) / 100,
      reason,
      suggestedDifficulty: difficultyForElo(currentElo),
      acRate,
      totalAttempted: sp.totalAttempted,
      daysSince,
      prerequisites,
      prereqsReady,
      suggestedProblems,
    });
  }

  return recs
    .filter((r) => r.totalAttempted >= 1)
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 5);
}

export interface LearningPathStep {
  order: number;
  tag: string;
  label: string;
  currentElo: number;
  targetElo: number;
  eloGap: number;
  mastered: boolean;
  isTarget: boolean;
}

/**
 * 为指定主题生成学习路径 — 从基础到目标的完整路线图
 * 返回按学习顺序排列的步骤，标注每步的掌握状态
 */
export function getLearningPathRecommendation(
  topicId: string,
  skillProfiles: SkillProfile[],
  targetCompId: string = 'lanqiao'
): LearningPathStep[] | null {
  const path = getLearningPath(topicId);
  if (path.length === 0) return null;

  const skillMap = buildSkillMap(skillProfiles, targetCompId);

  return path.map((node, i) => {
    const s = skillMap.get(node.id);
    const currentElo = s?.elo || 0;
    const targetElo = s?.targetElo || getTargetElo(targetCompId, node.id);
    return {
      order: i,
      tag: node.id,
      label: node.labelCn,
      currentElo,
      targetElo,
      eloGap: targetElo - currentElo,
      mastered: s?.mastered || false,
      isTarget: node.id === topicId,
    };
  });
}

/**
 * 获取「可以开始学」的主题 — 所有前置知识已掌握，但本主题尚未达标
 * 按 Elo 差距降序排列（差距最大的优先）
 */
export function getReadyTopics(
  skillProfiles: SkillProfile[],
  targetCompId: string = 'lanqiao'
): TagRecommendation[] {
  const skillMap = buildSkillMap(skillProfiles, targetCompId);

  const ready: TagRecommendation[] = [];

  for (const sp of skillProfiles) {
    if (sp.tag === 'global') continue;

    const currentElo = Math.round(sp.rating);
    const targetElo = getTargetElo(targetCompId, sp.tag);
    if (currentElo >= targetElo) continue; // 已达标，跳过

    const node = getTopicNode(sp.tag);
    if (!node) continue;

    // 检查所有前置是否掌握
    const allPrereqsReady = node.prerequisites.every((pid) => {
      const s = skillMap.get(pid);
      return s?.mastered || false;
    });
    if (!allPrereqsReady) continue;

    const eloGap = targetElo - currentElo;
    const problems = getTopicProblems(sp.tag);

    ready.push({
      tag: sp.tag,
      label: node.labelCn,
      currentElo,
      targetElo,
      eloGap,
      urgency: eloGap / 400,
      reason: `前置已全部掌握，可以开始系统学习`,
      suggestedDifficulty: difficultyForElo(currentElo),
      acRate: sp.totalAttempted > 0 ? Math.round((sp.totalAC / sp.totalAttempted) * 100) : 0,
      totalAttempted: sp.totalAttempted,
      daysSince: 0,
      prerequisites: [],
      prereqsReady: true,
      suggestedProblems: problems.slice(0, 3),
    });
  }

  return ready.sort((a, b) => b.eloGap - a.eloGap);
}
