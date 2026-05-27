import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Activity,
  Award,
  BookOpen,
  ExternalLink,
  Flame,
  LayoutDashboard,
  Target,
  TrendingUp,
} from 'lucide-react';
import { db, type SkillProfile, type Submission } from '../lib/db';
import { type BadgeDef } from '../lib/achievements';
import { AchievementIcon } from '../components/AchievementIcon';
import { getDailyRecommendations, type TagRecommendation } from '../lib/recommend';
import { computeStreak } from '../lib/stats';
import { getDueReviewCount } from '../lib/sm2';
import { COMPETITIONS, getTargetElo } from '../lib/elo';
import { TOPIC_TAXONOMY } from '../lib/knowledge-graph';
import { MiniHeatmap } from './Heatmap';
import SyncButton from './SyncButton';
import './index.css';

function topicLabel(slug: string): string {
  const node = TOPIC_TAXONOMY.find((t) => t.id === slug);
  if (node) return node.labelCn;
  return slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function AchievementToast({ badges, onDismiss }: { badges: BadgeDef[]; onDismiss: () => void }) {
  if (badges.length === 0) return null;
  return (
    <div className="toast-enter card-sm border-[var(--color-success)]/30 bg-[var(--color-primary-muted)]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Award className="w-4 h-4 text-[var(--color-success)]" />
          <span className="text-xs text-[var(--color-success)] font-semibold">成就解锁</span>
        </div>
        <button onClick={onDismiss} className="text-[var(--color-text-muted)] hover:text-white text-xs px-1">x</button>
      </div>
      {badges.slice(0, 2).map((b) => (
        <div key={b.id} className="flex items-center gap-2 mt-1.5 text-xs text-[var(--color-text-primary)]">
          <AchievementIcon badge={b} className="h-5 w-5 shrink-0" />
          <span className="font-medium">{b.name}</span>
          <span className="text-[var(--color-text-muted)] truncate">{b.description}</span>
        </div>
      ))}
    </div>
  );
}

function TodayCard({
  todayCount,
  todayAc,
  streak,
  dueReviewCount,
}: {
  todayCount: number;
  todayAc: number;
  streak: number;
  dueReviewCount: number;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">今日状态</p>
          <div className="mt-1 flex items-end gap-1">
            <span className="text-3xl font-bold text-[var(--color-primary)]">{todayCount}</span>
            <span className="text-xs text-[var(--color-text-muted)] mb-1">次提交 / {todayAc} 次 AC</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-center">
          <div className="card-sm min-w-16">
            <Flame className="w-3.5 h-3.5 mx-auto text-[var(--color-warning)]" />
            <p className="mt-1 text-sm font-bold">{streak}</p>
            <p className="text-[9px] text-[var(--color-text-muted)]">连续天</p>
          </div>
          <div className="card-sm min-w-16">
            <BookOpen className="w-3.5 h-3.5 mx-auto text-[var(--color-info)]" />
            <p className="mt-1 text-sm font-bold">{dueReviewCount}</p>
            <p className="text-[9px] text-[var(--color-text-muted)]">待复习</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeaknessCard({
  globalRating,
  weaknesses,
}: {
  globalRating: number;
  weaknesses: Array<{ tag: string; label: string; currentElo: number; targetElo: number; gap: number }>;
}) {
  const main = weaknesses[0];
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">能力画像</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-bold text-[var(--color-warning)]">{globalRating}</span>
            <span className="text-[10px] text-[var(--color-text-muted)] mb-1">总 Elo</span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {main ? <>主要短板：<b className="text-[var(--color-text-primary)]">{main.label}</b>，距目标 {main.gap} 分</> : '完成一次提交后开始生成弱项分析'}
          </p>
        </div>
        <a
          href="/options.html"
          target="_blank"
          rel="noreferrer"
          className="text-[10px] flex items-center gap-1 bg-[var(--color-bg-overlay)] hover:bg-[var(--color-border-default)] text-[var(--color-text-secondary)] px-2 py-1 rounded-md transition-colors shrink-0"
        >
          设置 <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {weaknesses.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {weaknesses.slice(0, 3).map((w) => (
            <div key={w.tag} className="rounded-md border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] px-2 py-1.5">
              <p className="truncate text-[11px] font-semibold text-[var(--color-text-primary)]">{w.label}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{w.currentElo}/{w.targetElo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionCard({ rec }: { rec?: TagRecommendation }) {
  if (!rec) {
    return (
      <div className="card-sm border-[var(--color-info)]/25">
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 h-4 w-4 text-[var(--color-info)] shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">先完成一次提交</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">我会根据题目标签和结果给出下一步练习建议。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-sm border-[var(--color-warning)]/25">
      <div className="flex items-start gap-2">
        <TrendingUp className="mt-0.5 h-4 w-4 text-[var(--color-warning)] shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-text-primary)]">
            建议练习：{rec.label}
            <span className="ml-1 text-[10px] font-normal text-[var(--color-text-muted)]">
              {rec.currentElo}/{rec.targetElo}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{rec.reason}</p>
          <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
            难度建议：{rec.suggestedDifficulty[0]} - {rec.suggestedDifficulty[1]}
          </p>
        </div>
      </div>
    </div>
  );
}

function TargetTabs({
  targetCompId,
  onChange,
}: {
  targetCompId: string;
  onChange: (compId: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto custom-scrollbar">
      {COMPETITIONS.map((comp) => (
        <button key={comp.id} onClick={() => onChange(comp.id)} className={`comp-tab shrink-0 ${targetCompId === comp.id ? 'active' : ''}`}>
          {comp.name}
        </button>
      ))}
    </div>
  );
}

function PopupApp() {
  const skillProfiles = useLiveQuery(() => db.skillProfiles.toArray()) || [];
  const allSubs = useLiveQuery(() => db.submissions.orderBy('timestamp').reverse().toArray()) || [];
  const problems = useLiveQuery(() => db.problems.toArray()) || [];

  const [dueReviewCount, setDueReviewCount] = useState(0);
  const [newBadges, setNewBadges] = useState<BadgeDef[]>([]);
  const [showBadges, setShowBadges] = useState(true);
  const [targetCompId, setTargetCompId] = useState<string>('lanqiao');

  useEffect(() => {
    getDueReviewCount().then(setDueReviewCount);
    chrome.storage.local.get(['targetCompetition'], (result) => {
      if (typeof result.targetCompetition === 'string') setTargetCompId(result.targetCompetition);
    });
    db.achievements.where('notified').equals(0).toArray().then((as) => {
      if (as.length > 0) {
        import('../lib/achievements').then(({ ALL_BADGES, markNotified }) => {
          const badges = as.map((a) => ALL_BADGES.find((b) => b.id === a.id)).filter(Boolean) as BadgeDef[];
          setNewBadges(badges);
          for (const a of as) markNotified(a.id);
        });
      }
    });
  }, []);

  const handleCompChange = (compId: string) => {
    setTargetCompId(compId);
    chrome.storage.local.set({ targetCompetition: compId });
  };

  const globalRating = useMemo(() => {
    const g = skillProfiles.find((p) => p.tag === 'global');
    return g ? Math.round(g.rating) : 1500;
  }, [skillProfiles]);

  const recommendations = useMemo(() => {
    if (skillProfiles.length === 0 || allSubs.length === 0) return [];
    return getDailyRecommendations(skillProfiles, allSubs, problems, targetCompId);
  }, [skillProfiles, allSubs, problems, targetCompId]);

  const dailyStats = useMemo(() => {
    const map = new Map<string, { count: number; acCount: number }>();
    for (const s of allSubs) {
      const ds = new Date(s.timestamp).toISOString().slice(0, 10);
      const entry = map.get(ds) || { count: 0, acCount: 0 };
      entry.count++;
      if (s.verdict === 'AC') entry.acCount++;
      map.set(ds, entry);
    }
    return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
  }, [allSubs]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todaySubs = allSubs.filter((s: Submission) => new Date(s.timestamp).toISOString().slice(0, 10) === today);
    return {
      todayCount: todaySubs.length,
      todayAc: todaySubs.filter((s) => s.verdict === 'AC').length,
      streak: computeStreak(allSubs),
    };
  }, [allSubs]);

  const weaknesses = useMemo(() => {
    return skillProfiles
      .filter((sp: SkillProfile) => sp.tag !== 'global' && sp.totalAttempted >= 1)
      .map((sp) => {
        const currentElo = Math.round(sp.rating);
        const targetElo = getTargetElo(targetCompId, sp.tag);
        return {
          tag: sp.tag,
          label: topicLabel(sp.tag),
          currentElo,
          targetElo,
          gap: targetElo - currentElo,
        };
      })
      .filter((sp) => sp.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3);
  }, [skillProfiles, targetCompId]);

  return (
    <div className="w-[400px] bg-[var(--color-bg-base)] p-3 text-[var(--color-text-primary)] font-sans leading-relaxed">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-base font-bold text-[var(--color-primary)]">
            <LayoutDashboard className="h-4 w-4" />OI Life
          </h1>
          <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">看清今天该练什么</p>
        </div>
        <div className="w-56">
          <TargetTabs targetCompId={targetCompId} onChange={handleCompChange} />
        </div>
      </header>

      <div className="space-y-2.5">
        {showBadges && newBadges.length > 0 && <AchievementToast badges={newBadges} onDismiss={() => setShowBadges(false)} />}

        <TodayCard
          todayCount={stats.todayCount}
          todayAc={stats.todayAc}
          streak={stats.streak}
          dueReviewCount={dueReviewCount}
        />

        <WeaknessCard globalRating={globalRating} weaknesses={weaknesses} />

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <p className="section-label">近 7 天</p>
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
              <Activity className="h-3 w-3" />每格代表一天
            </span>
          </div>
          <MiniHeatmap dailyStats={dailyStats} />
        </div>

        <ActionCard rec={recommendations[0]} />

        <SyncButton />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><PopupApp /></React.StrictMode>);

