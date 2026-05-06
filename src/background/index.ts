/// <reference types="chrome"/>
import { db } from '../lib/db';
import { updateSkillRating } from '../lib/elo';

console.log('[AlgoTracker] Background service worker 启动');

async function processSubmissionSave(submission: any, note?: string, mistakeTags?: string[]) {
  // 1. 确保 Problem 记录存在
  const problemId = `leetcode-cn_${submission.titleSlug}`;
  const existingProb = await db.problems.get(problemId);
  if (!existingProb) {
    await db.problems.put({
      id: problemId,
      platform: 'leetcode-cn',
      title: submission.titleSlug,
      url: `https://leetcode.cn/problems/${submission.titleSlug}/`,
      rating: 1500,
      tags: ['global'],
    });
  }

  // 2. 保存提交记录（去重）
  const submissionId = submission.id || Date.now().toString();
  const existingSub = await db.submissions.get(submissionId);
  let isNewSubmission = false;

  // 无 ID 提交的二次去重：检查最近 30s 内同题目同结果的提交
  if (!submission.id && !existingSub) {
    // 必须用和存储一致的短名，否则永远匹配不到
    let verdictNorm = submission.status_display;
    if (verdictNorm === 'Accepted') verdictNorm = 'AC';
    else if (verdictNorm === 'Wrong Answer') verdictNorm = 'WA';
    else if (verdictNorm === 'Time Limit Exceeded') verdictNorm = 'TLE';
    else if (verdictNorm === 'Compile Error') verdictNorm = 'CE';
    else if (verdictNorm === 'Runtime Error') verdictNorm = 'RE';
    else if (verdictNorm === 'Memory Limit Exceeded') verdictNorm = 'MLE';

    const recentDup = await db.submissions
      .where('problemId')
      .equals(problemId)
      .filter(s => s.verdict === verdictNorm && s.timestamp > Date.now() - 30000)
      .first();
    if (recentDup) {
      console.log('[AlgoTracker] 跳过重复提交（30s 窗口去重）:', problemId);
      return;
    }
  }

  if (!existingSub) {
    isNewSubmission = true;
    let verdict = submission.status_display;
    if (verdict === 'Accepted') verdict = 'AC';
    else if (verdict === 'Wrong Answer') verdict = 'WA';
    else if (verdict === 'Time Limit Exceeded') verdict = 'TLE';
    else if (verdict === 'Compile Error') verdict = 'CE';
    else if (verdict === 'Runtime Error') verdict = 'RE';
    else if (verdict === 'Memory Limit Exceeded') verdict = 'MLE';

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
  // 首次保存时，把代码附带进笔记
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
    await updateSkillRating('global', 1500, isAC);
    await updateSkillRating('dp', 1500, isAC);
    await updateSkillRating('graph', 1500, isAC);
    await updateSkillRating('tree', 1500, isAC);
    await updateSkillRating('string', 1500, isAC);
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
      return true; // 保持异步通道
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
