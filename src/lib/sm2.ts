import { db } from './db';

/**
 * SM2 间隔重复算法
 * 基于 SuperMemo SM-2，适应算法刷题场景
 */

const INTERVALS = [1, 3, 7, 14, 30, 60, 120];

/**
 * 计算下一次复习时间
 * @param stage 当前阶段 (0-based index into INTERVALS)
 * @param quality AC=1, WA=0
 * @returns 新的 stage 和下次复习时间戳
 */
export function computeNextReview(
  stage: number,
  quality: number
): { stage: number; nextReviewAt: number } {
  let newStage: number;
  if (quality >= 1) {
    newStage = Math.min(stage + 1, INTERVALS.length - 1);
  } else {
    newStage = Math.max(stage - 1, 0);
  }
  const intervalDays = INTERVALS[newStage];
  const nextReviewAt = Date.now() + intervalDays * 86400000;
  return { stage: newStage, nextReviewAt };
}

/**
 * 提交后更新复习计划
 */
export async function scheduleReview(
  problemId: string,
  isAC: boolean
): Promise<void> {
  const existing = await db.reviews.get(problemId);
  const quality = isAC ? 1 : 0;
  const prevStage = existing?.stage ?? 0;

  const { stage, nextReviewAt } = computeNextReview(prevStage, quality);

  await db.reviews.put({
    problemId,
    nextReviewAt,
    stage,
    history: [...(existing?.history || []), Date.now()],
  });
}

/**
 * 获取到期需要复习的题目列表
 */
export async function getDueReviews(): Promise<
  { problemId: string; nextReviewAt: number; stage: number }[]
> {
  const now = Date.now();
  return db.reviews.where('nextReviewAt').belowOrEqual(now).toArray();
}

/**
 * 获取即将到期的复习数量
 */
export async function getDueReviewCount(): Promise<number> {
  const now = Date.now();
  return db.reviews.where('nextReviewAt').belowOrEqual(now).count();
}
