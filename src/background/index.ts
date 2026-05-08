/// <reference types="chrome"/>
import { db } from '../lib/db';
import { updateSkillRating } from '../lib/elo';
import { syncToGithub } from '../lib/github';

console.log('[AlgoTracker] Background service worker 启动');

// 内存级去重：防止同一道题短时间内重复入库
const recentSaves = new Map<string, number>(); // key: problemId::verdict, value: timestamp

function isRecentDuplicate(problemId: string, verdict: string): boolean {
  const key = `${problemId}::${verdict}`;
  const ts = recentSaves.get(key);
  if (ts && Date.now() - ts < 30000) return true;
  // 清理超过 60s 的旧条目
  for (const [k, v] of recentSaves) {
    if (Date.now() - v > 60000) recentSaves.delete(k);
  }
  return false;
}

function markRecentSave(problemId: string, verdict: string) {
  recentSaves.set(`${problemId}::${verdict}`, Date.now());
}

async function processSubmissionSave(submission: any, note?: string, mistakeTags?: string[]) {
  // 1. 确保 Problem 记录存在
  const problemId = `leetcode-cn_${submission.titleSlug}`;
  const problemRating = submission.difficulty || 1500;
  const rawTags: { slug: string; name: string }[] = submission.tags?.length
    ? submission.tags
    : [];
  const tagSlugs = rawTags.map((t: { slug: string }) => t.slug);

  // 规范化 verdict
  let verdict = submission.status_display;
  if (verdict === 'Accepted') verdict = 'AC';
  else if (verdict === 'Wrong Answer') verdict = 'WA';
  else if (verdict === 'Time Limit Exceeded') verdict = 'TLE';
  else if (verdict === 'Compile Error') verdict = 'CE';
  else if (verdict === 'Runtime Error') verdict = 'RE';
  else if (verdict === 'Memory Limit Exceeded') verdict = 'MLE';

  // 内存级快速去重（挡住并发竞态）
  if (isRecentDuplicate(problemId, verdict)) {
    console.log('[AlgoTracker] 内存去重拦截:', problemId, verdict);
    return;
  }
  markRecentSave(problemId, verdict);

  const existingProb = await db.problems.get(problemId);
  if (!existingProb) {
    await db.problems.put({
      id: problemId,
      platform: 'leetcode-cn',
      title: submission.titleSlug,
      url: `https://leetcode.cn/problems/${submission.titleSlug}/`,
      rating: problemRating,
      tags: tagSlugs,
    });
  } else if (existingProb.tags.length === 0 && tagSlugs.length > 0) {
    await db.problems.update(problemId, { tags: tagSlugs });
  }

  // 2. 保存提交记录（去重）
  const submissionId = submission.id || Date.now().toString();
  const existingSub = await db.submissions.get(submissionId);
  let isNewSubmission = false;

  // 无 ID 提交的二次去重：检查最近 30s 内同题目同结果的提交
  if (!submission.id && !existingSub) {
    const recentDup = await db.submissions
      .where('problemId')
      .equals(problemId)
      .filter(s => s.verdict === verdict && s.timestamp > Date.now() - 30000)
      .first();
    if (recentDup) {
      console.log('[AlgoTracker] DB 去重拦截:', problemId);
      return;
    }
  }

  if (!existingSub) {
    isNewSubmission = true;
    const codeUrl = submission.id
      ? `https://leetcode.cn/problems/${submission.titleSlug}/submissions/${submission.id}/`
      : '';

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
  }

  // 3. 保存笔记和错因标签
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

  // 4. 更新 Elo Rating（仅新提交时）
  if (isNewSubmission) {
    const isAC = submission.status_display === 'Accepted';
    // 更新全局 Elo
    await updateSkillRating('global', problemRating, isAC);
    // 更新每个标签的 Elo
    for (const tag of tagSlugs) {
      await updateSkillRating(tag, problemRating, isAC);
    }
  }

  // 5. GitHub 自动同步（仅 AC 且有配置时）
  if (isNewSubmission && verdict === 'AC' && submission.code) {
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
      const { submission } = message.payload;
      processSubmissionSave(submission)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error }));
      return true;
    }

    if (message.type === 'SAVE_SUBMISSION') {
      const { submission, note, mistakeTags } = message.payload;
      processSubmissionSave(submission, note, mistakeTags)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error }));
      return true;
    }
  }
);
