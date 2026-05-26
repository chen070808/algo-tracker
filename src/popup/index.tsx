import React, { useMemo, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { db, type Submission, type Problem, type Note } from '../lib/db';
import { type BadgeDef } from '../lib/achievements';
import { AchievementIcon } from '../components/AchievementIcon';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDailyRecommendations, type TagRecommendation } from '../lib/recommend';
import { computeStreak } from '../lib/stats';
import { getDueReviewCount } from '../lib/sm2';
import { COMPETITIONS, getTargetElo, computeBandStats, eloProgressColor } from '../lib/elo';
import { TOPIC_TAXONOMY } from '../lib/knowledge-graph';
import {
  ExternalLink, Activity, Target, Flame, Calendar,
  ChevronDown, ChevronUp, LayoutDashboard, BookOpen, Award, TrendingUp
} from 'lucide-react';
import Heatmap from './Heatmap';
import SyncButton from './SyncButton';
import './index.css';

// ── 工具 ──

function tagLabel(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const BAND_DEFS = [
  { key: '<1500' as const, label: '简单', color: '#2EA043' },
  { key: '1500-2000' as const, label: '中等', color: '#D29922' },
  { key: '2000+' as const, label: '困难', color: '#F85149' },
];

// ── 难度分带条 ──

function BandBars({ tag, subs, probs }: { tag: string; subs: Submission[]; probs: Problem[] }) {
  const bands = useMemo(() => computeBandStats(tag, subs, probs), [tag, subs, probs]);
  return (
    <div className="space-y-1 mt-1.5">
      {BAND_DEFS.map((bd) => {
        const b = bands.find((x) => x.band === bd.key)!;
        return (
          <div key={bd.key} className="flex items-center gap-2 text-[10px]">
            <span className="w-7 text-right text-[var(--color-text-muted)] shrink-0">{bd.label}</span>
            <div className="flex-1 h-1.5 bg-[var(--color-border-muted)] rounded-full overflow-hidden">
              {b.total > 0 && (
                <div className="h-full rounded-full elo-bar" style={{ width: `${Math.max(b.acRate, 6)}%`, backgroundColor: bd.color }} />
              )}
            </div>
            <span className="w-16 text-right font-mono text-[var(--color-text-muted)]">
              {b.total > 0 ? `${b.acRate}%` : '--'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Elo 进度条 ──

function EloBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(Math.round((current / target) * 100), 100);
  const color = eloProgressColor(current, target);
  const done = current >= target;
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-[var(--color-border-muted)] rounded-full overflow-hidden">
        <div className="h-full rounded-full elo-bar" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }} />
      </div>
      <span className={`text-[10px] font-semibold font-mono w-14 text-right ${done ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
        {done ? `✓ ${current}` : `${current}/${target}`}
      </span>
    </div>
  );
}

// ── 能力评估面板 ──

function SkillPanel({
  skillProfiles, submissions, problems, targetCompId,
}: {
  skillProfiles: any[]; submissions: Submission[]; problems: Problem[]; targetCompId: string;
}) {
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  const topicLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of TOPIC_TAXONOMY) m.set(t.id, `${t.labelCn} ${t.labelEn}`);
    return m;
  }, []);

  const sorted = useMemo(() => {
    return skillProfiles
      .filter((sp) => sp.tag !== 'global' && sp.totalAttempted >= 1)
      .map((sp) => {
        const target = getTargetElo(targetCompId, sp.tag);
        const label = topicLabelMap.get(sp.tag) || tagLabel(sp.tag);
        return { ...sp, label, currentElo: Math.round(sp.rating), targetElo: target, eloGap: target - Math.round(sp.rating) };
      })
      .sort((a, b) => b.eloGap - a.eloGap);
  }, [skillProfiles, targetCompId, topicLabelMap]);

  if (sorted.length === 0) {
    return (
      <div className="card mb-3">
        <h2 className="section-label mb-2">能力评估</h2>
        <div className="empty-state py-6"><Target className="w-8 h-8 mb-2 opacity-30" /><p className="text-xs">提交题目以生成能力评估</p></div>
      </div>
    );
  }

  const doneCount = sorted.filter((t) => t.eloGap <= 0).length;

  return (
    <div className="card mb-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-label">能力评估</h2>
        <span className="text-[10px] text-[var(--color-text-muted)]">{doneCount}/{sorted.length} 达标</span>
      </div>
      <div className="space-y-0.5 max-h-72 overflow-y-auto custom-scrollbar">
        {sorted.map((sp) => {
          const isOpen = expandedTag === sp.tag;
          return (
            <div key={sp.tag}>
              <button
                onClick={() => setExpandedTag(isOpen ? null : sp.tag)}
                className="w-full flex items-center gap-2 py-1.5 px-2 row-hover rounded text-left transition-colors"
              >
                <span className="w-18 text-xs font-medium text-[var(--color-text-primary)] truncate shrink-0">{sp.label}</span>
                <EloBar current={sp.currentElo} target={sp.targetElo} />
                <span className="text-[var(--color-text-muted)] shrink-0 w-4 h-4 flex items-center justify-center">
                  {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </span>
              </button>
              {isOpen && (
                <div className="ml-2 pl-16 pr-3 pb-2">
                  <BandBars tag={sp.tag} subs={submissions} probs={problems} />
                  <div className="flex gap-3 mt-1.5 text-[10px] text-[var(--color-text-muted)]">
                    <span>Elo {sp.currentElo}→{sp.targetElo}</span>
                    <span>{sp.totalAttempted}次</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 成就通知 ──

function AchievementToast({ badges, onDismiss }: { badges: BadgeDef[]; onDismiss: () => void }) {
  if (badges.length === 0) return null;
  return (
    <div className="toast-enter mb-3 card-sm border-[var(--color-success)]/30 bg-[var(--color-primary-muted)]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Award className="w-4 h-4 text-[var(--color-success)]" />
          <span className="text-xs text-[var(--color-success)] font-semibold">成就解锁!</span>
        </div>
        <button onClick={onDismiss} className="text-[var(--color-text-muted)] hover:text-white text-xs px-1">✕</button>
      </div>
      {badges.slice(0, 3).map((b) => (
        <div key={b.id} className="flex items-center gap-2 mt-1.5 text-xs text-[var(--color-text-primary)]">
          <AchievementIcon badge={b} className="h-5 w-5 shrink-0" />
          <span className="font-medium">{b.name}</span>
          <span className="text-[var(--color-text-muted)]">{b.description}</span>
        </div>
      ))}
    </div>
  );
}

// ── 今日聚焦 ──

function DailyFocus({ recs }: { recs: TagRecommendation[] }) {
  if (recs.length === 0) return null;
  return (
    <div className="card-sm mb-3 border-[var(--color-warning)]/25">
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp className="w-3.5 h-3.5 text-[var(--color-warning)]" />
        <span className="text-xs font-semibold text-[var(--color-warning)]">今日聚焦</span>
      </div>
      <div className="space-y-1.5">
        {recs.slice(0, 3).map((rec) => (
          <div key={rec.tag} className="flex items-center gap-2 text-[11px]">
            <span className="font-medium text-[var(--color-text-primary)] w-16 truncate shrink-0">{rec.label}</span>
            <EloBar current={rec.currentElo} target={rec.targetElo} />
            <span className="text-[var(--color-text-muted)] text-[10px] text-right">{rec.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 主应用 ──

function PopupApp() {
  const skillProfiles = useLiveQuery(() => db.skillProfiles.toArray()) || [];
  const allSubs = useLiveQuery(() => db.submissions.orderBy('timestamp').reverse().toArray()) || [];
  const recentSubs = allSubs.slice(0, 20);
  const problems = useLiveQuery(() => db.problems.toArray()) || [];
  const notes = useLiveQuery(() => db.notes.toArray()) || [];

  const [expanded, setExpanded] = useState<string | null>(null);
  const [duReviewCount, setDueReviewCount] = useState(0);
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

  const recentItems = useMemo(() => {
    const noteMap = new Map<string, Note>();
    for (const n of notes) noteMap.set(n.problemId, n);
    const probMap = new Map<string, Problem>();
    for (const p of problems) probMap.set(p.id, p);
    return recentSubs.map((s: Submission) => {
      const prob = probMap.get(s.problemId);
      const note = noteMap.get(s.problemId);
      return {
        ...s,
        title: prob?.title || s.problemId.replace(/^(leetcode-cn|nowcoder)_/, ''),
        url: prob?.url || '#',
        platformLabel: prob?.platform === 'nowcoder' ? '牛客' : 'LC',
        noteContent: note?.markdownContent || '',
        mistakeTags: note?.mistakeTags || [],
      };
    });
  }, [recentSubs, problems, notes]);

  const stats = useMemo(() => {
    const ac = allSubs.filter((s) => s.verdict === 'AC').length;
    const total = allSubs.length || 1;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = allSubs.filter((s) => new Date(s.timestamp).toISOString().slice(0, 10) === today).length;
    const weekCount = allSubs.filter((s) => s.timestamp >= Date.now() - 7 * 86400000).length;
    const solved = new Set(allSubs.filter((s) => s.verdict === 'AC').map((s) => s.problemId)).size;
    const streak = computeStreak(allSubs);
    const efficiency = solved > 0 ? (ac / solved).toFixed(1) : '0';
    return { ac, total, rate: Math.round((ac / total) * 100), todayCount, weekCount, solved, streak, efficiency };
  }, [allSubs]);

  const toggleExpand = (id: string) => { setExpanded((prev) => (prev === id ? null : id)); };

  const verBadge = (v: string) => {
    const cls = v === 'AC' ? 'badge-ac' : v === 'TLE' ? 'badge-tle' : 'badge-wa';
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{v}</span>;
  };

  return (
    <div className="p-3 w-[400px] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-sans leading-relaxed">
      {/* ═══ 头部 ═══ */}
      <div className="mb-3 pb-3 border-b border-[var(--color-border-muted)]">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-base font-bold text-[var(--color-primary)] flex items-center gap-1.5">
              <LayoutDashboard className="w-4 h-4" />AlgoTracker
            </h1>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">精准攻克薄弱点</p>
          </div>
          <a href="/options.html" target="_blank" rel="noreferrer"
            className="text-[10px] flex items-center gap-1 bg-[var(--color-bg-overlay)] hover:bg-[var(--color-border-default)] text-[var(--color-text-secondary)] px-2 py-1 rounded-md transition-colors">
            控制台 <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* 比赛选择器 */}
        <div className="flex gap-1 mb-2 flex-wrap">
          {COMPETITIONS.map((comp) => (
            <button key={comp.id} onClick={() => handleCompChange(comp.id)}
              className={`comp-tab ${targetCompId === comp.id ? 'active' : ''}`}>
              {comp.name}
            </button>
          ))}
        </div>

        {/* KPI */}
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {[
            { label: 'AC/总数', value: stats.ac, sub: `/${stats.total}`, color: 'var(--color-success)' },
            { label: '已解题', value: stats.solved, sub: '', color: 'var(--color-info)' },
            { label: 'Rating', value: globalRating, sub: '', color: 'var(--color-warning)' },
            { label: '效率', value: stats.efficiency, sub: '次/题', color: 'var(--color-info)' },
          ].map((k) => (
            <div key={k.label} className="card-sm flex flex-col items-center">
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-value" style={{ color: k.color }}>
                {k.value}<span className="text-[10px] font-normal text-[var(--color-text-muted)]">{k.sub}</span>
              </span>
            </div>
          ))}
        </div>

        {/* 活动统计 */}
        <div className="flex justify-between px-1 text-[10px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-[var(--color-info)]" />今日 <b className="text-[var(--color-text-primary)]">{stats.todayCount}</b></span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-[var(--color-accent)]" />本周 <b className="text-[var(--color-text-primary)]">{stats.weekCount}</b></span>
          <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-[var(--color-warning)]" />连续 <b className="text-[var(--color-text-primary)]">{stats.streak}</b></span>
          {duReviewCount > 0 && (
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-yellow-400" />复习 <b className="text-yellow-400">{duReviewCount}</b></span>
          )}
        </div>

        {/* Cloud sync */}
        <SyncButton />
      </div>

      {/* ═══ 成就通知 ═══ */}
      {showBadges && newBadges.length > 0 && <AchievementToast badges={newBadges} onDismiss={() => setShowBadges(false)} />}

      {/* ═══ 今日聚焦 ═══ */}
      <DailyFocus recs={recommendations} />

      {/* ═══ 能力评估 ═══ */}
      <SkillPanel skillProfiles={skillProfiles} submissions={allSubs} problems={problems} targetCompId={targetCompId} />

      {/* ═══ 提交热力图 ═══ */}
      <Heatmap dailyStats={dailyStats} />

      {/* ═══ 最近提交 ═══ */}
      <div>
        <h2 className="section-label mb-2">最近提交</h2>
        {recentItems.length === 0 ? (
          <div className="card empty-state py-6"><Activity className="w-8 h-8 mb-2 opacity-30" /><p className="text-xs">去力扣或牛客网提交一道题吧</p></div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto custom-scrollbar">
            {recentItems.map((item) => {
              const isOpen = expanded === item.id;
              return (
                <div key={item.id} className="card-sm overflow-hidden">
                  <button onClick={() => toggleExpand(item.id)}
                    className="w-full text-left flex items-center gap-2 row-hover -m-1.5 p-1.5 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {verBadge(item.verdict)}
                        <span className="platform-chip">{item.platformLabel}</span>
                        <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.title}</span>
                      </div>
                      <div className="flex gap-2 text-[10px] text-[var(--color-text-muted)] mt-0.5">
                        {item.language && <span>{item.language}</span>}
                        {item.runtimeStr && <span>{item.runtimeStr}</span>}
                        <span>{new Date(item.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <span className="text-[var(--color-text-muted)] shrink-0">{isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-[var(--color-border-muted)] mt-2 pt-2 space-y-2">
                      {item.codeUrl && <a href={item.codeUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--color-info)] hover:underline block">查看提交详情 ↗</a>}
                      {item.code && (
                        <div>
                          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">代码 ({item.language || '--'})</p>
                          <pre className="text-[10px] bg-[var(--color-bg-base)] border border-[var(--color-border-muted)] rounded p-2 overflow-x-auto max-h-32 text-[var(--color-text-secondary)] font-mono whitespace-pre leading-snug">{item.code}</pre>
                        </div>
                      )}
                      {item.noteContent && (
                        <div>
                          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">笔记</p>
                          <pre className="text-[10px] bg-[var(--color-bg-base)] border border-[var(--color-border-muted)] rounded p-2 overflow-x-auto max-h-24 text-[var(--color-text-secondary)] font-mono whitespace-pre-wrap leading-snug">{item.noteContent}</pre>
                        </div>
                      )}
                      {item.mistakeTags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {item.mistakeTags.map((t) => <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-full badge-wa">{t}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><PopupApp /></React.StrictMode>);
