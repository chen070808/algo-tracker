/// <reference types="chrome"/>
import { db } from '../lib/db';
import { updateSkillRating } from '../lib/elo';
import { syncToGithub } from '../lib/github';
import { scheduleReview } from '../lib/sm2';
import { checkAchievements } from '../lib/achievements';
import { mapToUnifiedTopics } from '../lib/knowledge-graph';

console.log('[AlgoTracker] Background service worker 启动');

async function processSubmissionSave(submission: any, note?: string, mistakeTags?: string[], platform?: string) {
  const plat = platform || 'leetcode-cn';
  const problemId = `${plat}_${submission.titleSlug}`;
  const problemRating = submission.difficulty || 1500;
  const rawTags: { slug: string; name: string }[] = submission.tags?.length
    ? submission.tags
    : [];
  const tagSlugs = rawTags.map((t: { slug: string }) => t.slug);

  // 计算统一主题映射
  const unifiedTopics = rawTags.length
    ? mapToUnifiedTopics(plat, tagSlugs)
    : [];

  // 规范化 verdict
  let verdict = submission.status_display;
  if (verdict === 'Accepted') verdict = 'AC';
  else if (verdict === 'Wrong Answer') verdict = 'WA';
  else if (verdict === 'Time Limit Exceeded') verdict = 'TLE';
  else if (verdict === 'Compile Error') verdict = 'CE';
  else if (verdict === 'Runtime Error') verdict = 'RE';
  else if (verdict === 'Memory Limit Exceeded') verdict = 'MLE';
  // LuoGu-specific: Unaccepted maps to WA
  else if (verdict === 'Unaccepted') verdict = 'WA';

  // 1. 确保 Problem 记录存在
  const existingProb = await db.problems.get(problemId);
  if (!existingProb) {
    let url: string;
    if (plat === 'luogu') {
      url = `https://www.luogu.com.cn/problem/${submission.titleSlug}`;
    } else if (plat === 'nowcoder') {
      url = `https://www.nowcoder.com/practice/${submission.titleSlug}`;
    } else {
      url = `https://leetcode.cn/problems/${submission.titleSlug}/`;
    }
    await db.problems.put({
      id: problemId,
      platform: plat,
      title: submission.titleSlug,
      url,
      rating: problemRating,
      tags: tagSlugs,
      unifiedTopics,
    });
  } else if ((existingProb.tags.length === 0 && tagSlugs.length > 0) ||
             ((existingProb.unifiedTopics || []).length === 0 && unifiedTopics.length > 0)) {
    const update: any = {};
    if (existingProb.tags.length === 0 && tagSlugs.length > 0) update.tags = tagSlugs;
    if ((existingProb.unifiedTopics || []).length === 0 && unifiedTopics.length > 0) update.unifiedTopics = unifiedTopics;
    await db.problems.update(problemId, update);
  }

  // 2. 去重
  const submissionId = submission.id || `${problemId}_${Date.now()}`;
  const existingSub = await db.submissions.get(submissionId);
  if (existingSub) {
    console.log('[AlgoTracker] 主键去重拦截:', submissionId);
    return;
  }
  const recentDup = await db.submissions
    .where('problemId')
    .equals(problemId)
    .filter(s => s.verdict === verdict && s.timestamp > Date.now() - 120000)
    .first();
  if (recentDup) {
    console.log('[AlgoTracker] 窗口去重拦截:', problemId, verdict);
    return;
  }

  // 3. 保存提交记录
  let codeUrl = '';
  if (submission.id) {
    if (plat === 'luogu') {
      codeUrl = `https://www.luogu.com.cn/record/${submission.id}`;
    } else if (plat === 'nowcoder') {
      codeUrl = `https://www.nowcoder.com/practice/${submission.titleSlug}/submission/${submission.id}`;
    } else {
      codeUrl = `https://leetcode.cn/problems/${submission.titleSlug}/submissions/${submission.id}/`;
    }
  }

  await db.submissions.put({
    id: submissionId,
    problemId,
    timestamp: Date.now(),
    verdict,
    language: submission.lang || '',
    runtimeStr: submission.runtime || '',
    memoryStr: submission.memory || '',
    code: submission.code || '',
    codeUrl,
  });

  // 4. 保存笔记和错因标签
  const existingNote = await db.notes.get(problemId);
  const mergedMistakeTags = mistakeTags?.length
    ? mistakeTags
    : existingNote?.mistakeTags || [];
  let mdContent = note || existingNote?.markdownContent || '';
  if (!note && !existingNote && submission.code) {
    const lang = submission.lang || '';
    mdContent = '```' + lang + '\n' + submission.code + '\n```\n';
  }
  if (
    note ||
    mdContent !== (existingNote?.markdownContent || '') ||
    (mistakeTags && mistakeTags.length > 0)
  ) {
    await db.notes.put({
      problemId,
      markdownContent: mdContent,
      mistakeTags: mergedMistakeTags,
      lastUpdatedAt: Date.now(),
    });
  }

  // 5. 更新 Elo Rating + 掌握等级
  const isAC = verdict === 'AC';
  await updateSkillRating('global', problemRating, isAC);
  for (const tag of tagSlugs) {
    await updateSkillRating(tag, problemRating, isAC);
  }
  // 也更新统一主题的 Rating
  for (const ut of unifiedTopics) {
    await updateSkillRating(ut, problemRating, isAC);
  }

  // 6. 间隔重复 (SM2)
  await scheduleReview(problemId, isAC);

  // 7. 成就检查 (仅 AC 时触发，减少计算)
  if (isAC) {
    try {
      const allSubs = await db.submissions.toArray();
      const allProbs = await db.problems.toArray();
      const allProfiles = await db.skillProfiles.toArray();

      // 计算当前连续天数
      const daySet = new Set<string>();
      for (const s of allSubs) {
        daySet.add(new Date(s.timestamp).toISOString().slice(0, 10));
      }
      const sorted = [...daySet].sort().reverse();
      let streak = 0;
      if (sorted.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (sorted[0] === today || sorted[0] === yest) {
          streak = 1;
          for (let i = 1; i < sorted.length; i++) {
            const diff = (new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86400000;
            if (Math.abs(diff - 1) < 0.1) streak++;
            else break;
          }
        }
      }

      const newBadges = await checkAchievements(allSubs, allProbs, allProfiles, streak);
      for (const badge of newBadges) {
        console.log(`[AlgoTracker] 成就解锁: ${badge.name} - ${badge.description}`);
      }
    } catch (e) {
      console.error('[AlgoTracker] 成就检查失败:', e);
    }
  }

  // 8. GitHub 自动同步 (仅 AC 且有代码时)
  if (verdict === 'AC' && submission.code) {
    try {
      const lang = submission.lang || '';
      const uploaded = await syncToGithub(
        submission.titleSlug,
        submission.code,
        mdContent,
        lang,
        verdict
      );
      if (uploaded) {
        console.log('[AlgoTracker] GitHub 同步成功:', submission.titleSlug);
      } else {
        console.log('[AlgoTracker] GitHub 同步未执行（未配置或不满足条件）');
      }
    } catch (e) {
      console.error('[AlgoTracker] GitHub 同步失败:', e);
    }
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: any,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (message.type === 'AUTO_SAVE_SUBMISSION') {
      const { submission, platform: plat } = message.payload;
      processSubmissionSave(submission, undefined, undefined, plat)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error }));
      return true;
    }

    if (message.type === 'SAVE_SUBMISSION') {
      const { submission, note, mistakeTags, platform: plat } = message.payload;
      processSubmissionSave(submission, note, mistakeTags, plat)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error }));
      return true;
    }

    if (message.type === 'GET_ACHIEVEMENTS') {
      import('../lib/achievements').then(({ getUnlockedBadges }) => {
        getUnlockedBadges().then((badges) => sendResponse({ badges }));
      });
      return true;
    }

    if (message.type === 'GET_DUE_REVIEWS') {
      import('../lib/sm2').then(({ getDueReviews }) => {
        getDueReviews().then((reviews) => sendResponse({ reviews }));
      });
      return true;
    }
  }
);
