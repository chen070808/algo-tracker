/**
 * Cloud sync utilities for OI Life Chrome extension.
 * Syncs local IndexedDB data to the OI Life backend.
 */

const DEFAULT_API_BASE = 'http://localhost:8000';

interface SyncConfig {
  apiBase: string;
  token: string | null;
  userId: string | null;
}

export interface SyncResult {
  synced: boolean;
  new_submissions: number;
  strength_summary: {
    overall_elo: number;
    topics_tracked: number;
    total_submissions: number;
    ac_rate: number;
  };
  weak_topics: Array<{ topic_id: string; current_elo: number }>;
}

export async function getSyncConfig(): Promise<SyncConfig> {
  const result = await chrome.storage.local.get(['oi_token', 'oi_userId', 'oi_apiBase']);
  return {
    token: (result.oi_token as string) || null,
    userId: (result.oi_userId as string) || null,
    apiBase: (result.oi_apiBase as string) || DEFAULT_API_BASE,
  };
}

export async function saveAuth(token: string, userId: string, apiBase: string = DEFAULT_API_BASE) {
  await chrome.storage.local.set({ oi_token: token, oi_userId: userId, oi_apiBase: apiBase });
}

export async function clearAuth() {
  await chrome.storage.local.remove(['oi_token', 'oi_userId', 'oi_apiBase']);
}

export async function syncToCloud(): Promise<SyncResult> {
  const config = await getSyncConfig();
  if (!config.token || !config.userId) {
    throw new Error('Not authenticated. Please log in via the OI Life web console.');
  }

  // Dynamically import Dexie to access DB
  const { db } = await import('./db');

  const skillProfiles = await db.skillProfiles.toArray();
  const submissions = await db.submissions
    .orderBy('timestamp')
    .reverse()
    .limit(500)
    .toArray();

  function platformFromProblemId(problemId: string): string {
    const prefix = problemId.split('_')[0];
    switch (prefix) {
      case 'nowcoder': return 'nowcoder';
      case 'luogu': return 'luogu';
      default: return 'leetcode';
    }
  }

  const payload = {
    user_id: config.userId,
    skill_profiles: skillProfiles.map((sp) => ({
      topic_id: sp.tag,
      rating: sp.rating,
      k_factor: 40,
      ac_count: sp.totalAC,
      wa_count: sp.totalAttempted - sp.totalAC,
      last_updated: sp.lastPracticedAt || 0,
    })),
    submissions: submissions.map((s) => ({
      platform: platformFromProblemId(s.problemId),
      problem_id: s.problemId,
      problem_title: '',
      verdict: s.verdict,
      language: s.language || '',
      runtime: 0,
      memory: 0,
      timestamp: s.timestamp,
      tags: [],
      topic_ids: [],
    })),
  };

  const response = await fetch(`${config.apiBase}/v1/user/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Sync failed' }));
    throw new Error(err.detail || err.error?.message || 'Sync failed');
  }

  return response.json();
}
