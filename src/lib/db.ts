import Dexie, { type Table } from 'dexie';

export interface Problem {
  id: string; // e.g. leetcode-cn_1
  platform: string;
  title: string;
  url: string;
  rating: number;
  tags: string[];
  unifiedTopics: string[]; // cross-platform normalized topic IDs
}

export interface Submission {
  id: string;
  problemId: string;
  timestamp: number;
  verdict: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | 'MLE' | string;
  language: string;
  runtimeStr?: string;
  memoryStr?: string;
  code?: string;
  codeUrl?: string;
}

export interface SkillProfile {
  tag: string; // e.g. 'dp', 'global'
  rating: number; // Elo rating, default 1500
  volatility: number;
  lastPracticedAt: number;
  streak: number;
  totalAttempted: number;
  totalAC: number;
}

export interface Achievement {
  id: string;
  unlockedAt: number;
  notified: boolean;
}

export interface AchievementState {
  achievements: Achievement[];
}

export interface Note {
  problemId: string;
  markdownContent: string;
  mistakeTags: string[];
  lastUpdatedAt: number;
}

export interface ReviewSchedule {
  problemId: string;
  nextReviewAt: number;
  stage: number;
  history: number[];
}

export class AlgoTrackerDB extends Dexie {
  problems!: Table<Problem>;
  submissions!: Table<Submission>;
  skillProfiles!: Table<SkillProfile>;
  notes!: Table<Note>;
  reviews!: Table<ReviewSchedule>;
  achievements!: Table<Achievement>;

  constructor() {
    super('AlgoTrackerDB');
    this.version(1).stores({
      problems: 'id, platform, rating, *tags',
      submissions: 'id, problemId, timestamp, verdict',
      skillProfiles: 'tag, rating, lastPracticedAt',
      notes: 'problemId, lastUpdatedAt',
      reviews: 'problemId, nextReviewAt, stage',
    });
    this.version(2).stores({
      problems: 'id, platform, rating, *tags, *unifiedTopics',
      submissions: 'id, problemId, timestamp, verdict',
      skillProfiles: 'tag, rating, lastPracticedAt, masteryLevel',
      notes: 'problemId, lastUpdatedAt',
      reviews: 'problemId, nextReviewAt, stage',
      achievements: 'id, unlockedAt',
    });
  }
}

export const db = new AlgoTrackerDB();