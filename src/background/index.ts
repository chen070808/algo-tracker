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

  if (!existingSub) {
    isNewSubmission = true;
    let verdict = submission.status_display;
    if (verdict === 'Accepted') verdict = 'AC';
    else if (verdict === 'Wrong Answer') verdict = 'WA';
    else if (verdict === 'Time Limit Exceeded') verdict = 'TLE';
    else if (verdict === 'Compile Error') verdict = 'CE';
    else if (verdict === 'Runtime Error') verdict = 'RE';
    else if (verdict === 'Memory Limit Exceeded') verdict = 'MLE';

    await db.submissions.put({
      id: submissionId,
      problemId,
      timestamp: Date.now(),
      verdict,
      language: submission.lang,
    });
  }

  // 3. 保存笔记和错因标签
  if (note || (mistakeTags && mistakeTags.length > 0)) {
    const existingNote = await db.notes.get(problemId);
    await db.notes.put({
      problemId,
      markdownContent: note || existingNote?.markdownContent || '',
      mistakeTags: mistakeTags || existingNote?.mistakeTags || [],
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
