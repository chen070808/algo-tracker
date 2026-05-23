import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { db, type Submission, type Problem } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { getGithubConfig, setGithubConfig, verifyConnection } from '../lib/github';
import { getDailyRecommendations } from '../lib/recommend';
import { getUnlockedBadges, ALL_BADGES } from '../lib/achievements';
import { AchievementIcon } from '../components/AchievementIcon';
import { COMPETITIONS, getTargetElo, computeBandStats, eloProgressColor } from '../lib/elo';
import { TOPIC_TAXONOMY } from '../lib/knowledge-graph';
import {
  Database, LineChart, Cloud, Activity, Target, Award, TrendingUp, Settings
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer,
} from 'recharts';
import '../popup/index.css';

// ── 常量 ──

function tagLabel(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const BAND_DEFS = [
  { key: '<1500' as const, label: '简单', color: '#2EA043' },
  { key: '1500-2000' as const, label: '中等', color: '#D29922' },
  { key: '2000+' as const, label: '困难', color: '#F85149' },
];

const VERDICT_COLORS: Record<string, string> = { AC: '#2EA043', WA: '#F85149', TLE: '#F0883E', RE: '#D29922', CE: '#8B949E', MLE: '#A371F7' };
const VERDICT_FALLBACK = '#484F58';
const CHART_TOOLTIP = { contentStyle: { backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '8px', fontSize: '12px', color: '#E6EDF3' } };

// ── 分带 AC 率 ──

function BandBars({ tag, subs, probs }: { tag: string; subs: Submission[]; probs: Problem[] }) {
  const bands = useMemo(() => computeBandStats(tag, subs, probs), [tag, subs, probs]);
  return (
    <div className="space-y-1 mt-1.5">
      {BAND_DEFS.map((bd) => {
        const b = bands.find((x) => x.band === bd.key)!;
        return (
          <div key={bd.key} className="flex items-center gap-2 text-[11px]">
            <span className="w-8 text-right text-[var(--color-text-muted)]">{bd.label}</span>
            <div className="flex-1 h-1.5 bg-[var(--color-border-muted)] rounded-full overflow-hidden">
              {b.total > 0 && <div className="h-full rounded-full elo-bar" style={{ width: `${Math.max(b.acRate, 6)}%`, backgroundColor: bd.color }} />}
            </div>
            <span className="w-20 text-right font-mono text-[var(--color-text-muted)]">
              {b.total > 0 ? `${b.acRate}% (${b.ac}/${b.total})` : '--'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 徽章画廊 ──

function AchievementGallery() {
  const [badges, setBadges] = useState<(typeof ALL_BADGES[number] & { unlockedAt?: number })[]>([]);
  useEffect(() => {
    getUnlockedBadges().then((u) => {
      setBadges(ALL_BADGES.map((b) => ({ ...b, unlockedAt: u.find((x) => x.id === b.id)?.unlockedAt })));
    });
  }, []);
  const unlockedCount = badges.filter((b) => b.unlockedAt).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">成就徽章</h2>
        <span className="text-xs text-[var(--color-text-muted)]">{unlockedCount}/{ALL_BADGES.length} 已解锁</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {badges.map((badge) => {
          const unlocked = !!badge.unlockedAt;
          return (
            <div key={badge.id} className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}>
              <AchievementIcon badge={badge} unlocked={unlocked} className="mb-1.5 h-10 w-10" />
              <span className={`text-xs font-medium ${unlocked ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{badge.name}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{badge.description}</span>
              {unlocked && badge.unlockedAt && <span className="text-[9px] text-[var(--color-text-muted)] mt-1">{new Date(badge.unlockedAt).toLocaleDateString('zh-CN')}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 能力评估面板 ──

function TagSkillsPanel({ submissions, problems, targetCompId }: { submissions: Submission[]; problems: Problem[]; targetCompId: string }) {
  const skillProfiles = useLiveQuery(() => db.skillProfiles.toArray()) || [];
  const topicLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of TOPIC_TAXONOMY) m.set(t.id, `${t.labelCn} ${t.labelEn}`);
    return m;
  }, []);

  const tagStats = useMemo(() => {
    const probMap = new Map(problems.map((p) => [p.id, p]));
    const tagMap = new Map<string, { total: number; ac: number; lastAt: number }>();
    for (const sub of submissions) {
      const prob = probMap.get(sub.problemId);
      if (!prob) continue;
      for (const tag of [...(prob.tags || []), ...(prob.unifiedTopics || [])]) {
        const e = tagMap.get(tag) || { total: 0, ac: 0, lastAt: 0 };
        e.total++; if (sub.verdict === 'AC') e.ac++;
        if (sub.timestamp > e.lastAt) e.lastAt = sub.timestamp;
        tagMap.set(tag, e);
      }
    }
    const spMap = new Map(skillProfiles.map((sp) => [sp.tag, sp]));
    return [...tagMap.entries()]
      .filter(([, s]) => s.total >= 1)
      .map(([tag, s]) => {
        const sp = spMap.get(tag);
        const currentElo = sp ? Math.round(sp.rating) : 1500;
        const targetElo = getTargetElo(targetCompId, tag);
        return { tag, label: topicLabelMap.get(tag) || tagLabel(tag), ...s,
          acRate: s.total ? Math.round((s.ac / s.total) * 100) : 0,
          daysSince: Math.round((Date.now() - s.lastAt) / 86400000),
          currentElo, targetElo, eloGap: targetElo - currentElo };
      }).sort((a, b) => b.eloGap - a.eloGap);
  }, [submissions, problems, skillProfiles, targetCompId, topicLabelMap]);

  if (tagStats.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">能力评估</h2>
        <div className="card empty-state py-16"><Target className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm">提交题目以生成能力评估</p></div>
      </div>
    );
  }

  const doneCount = tagStats.filter((t) => t.eloGap <= 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">能力评估</h2>
        <span className="text-xs text-[var(--color-text-muted)]">{doneCount}/{tagStats.length} 达标</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {tagStats.map((t) => {
          const pct = Math.min(Math.round((t.currentElo / t.targetElo) * 100), 100);
          const color = eloProgressColor(t.currentElo, t.targetElo);
          const done = t.eloGap <= 0;
          return (
            <div key={t.tag} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{t.label}</span>
                <span className="text-xs font-mono text-[var(--color-text-muted)]">
                  Elo {t.currentElo}{done ? <span className="text-[var(--color-success)] ml-1 font-medium">✓ 达标</span> : <span className="ml-1">→ {t.targetElo} <span className="text-[var(--color-warning)]">差{t.eloGap}</span></span>}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--color-border-muted)] rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full elo-bar" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }} />
              </div>
              <BandBars tag={t.tag} subs={submissions} probs={problems} />
              <div className="flex gap-4 mt-2 text-[10px] text-[var(--color-text-muted)]">
                <span>通过率 {t.acRate}%</span><span>{t.total}次</span><span>{t.daysSince}天前</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── GitHub 配置 ──

function GithubTab({ token, repo, saving, status, error, onTokenChange, onRepoChange, onSave }: {
  token: string; repo: string; saving: boolean; status: 'idle' | 'success' | 'error'; error: string;
  onTokenChange: (v: string) => void; onRepoChange: (v: string) => void;
  onSave: (token: string, repo: string) => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [verifyMsg, setVerifyMsg] = useState('');
  const canSave = token.trim() && repo.trim() && !saving;
  const handleVerify = async () => { setVerifying(true); setVerifyResult('idle'); setVerifyMsg(''); const { ok, error: errMsg } = await verifyConnection(token, repo); setVerifyResult(ok ? 'ok' : 'fail'); setVerifyMsg(ok ? '连接成功' : errMsg); setVerifying(false); };

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">GitHub 自动同步</h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-6">将提交的代码和笔记自动推送到你的 GitHub 仓库。</p>
      <div className="card mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">仓库全名</label>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--color-text-muted)]">github.com/</span>
            <input type="text" value={repo} onChange={(e) => onRepoChange(e.target.value)} placeholder="用户名/仓库名" className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-muted)]" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Token</label>
          <input type="password" value={token} onChange={(e) => onTokenChange(e.target.value)} placeholder="github_pat_..." className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-muted)]" />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">Token 仅保存在本地浏览器存储中。</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={() => onSave(token, repo)} disabled={!canSave}
            className={`text-sm font-semibold py-2 px-6 rounded-lg transition-colors ${canSave ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white' : 'bg-[var(--color-border-default)] text-[var(--color-text-muted)] cursor-not-allowed'}`}>
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button onClick={handleVerify} disabled={!token.trim() || !repo.trim() || verifying}
            className={`text-sm py-2 px-5 rounded-lg border transition-colors ${token.trim() && repo.trim() && !verifying ? 'border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)]' : 'border-[var(--color-border-muted)] text-[var(--color-text-muted)] cursor-not-allowed'}`}>
            {verifying ? '测试中...' : '测试连接'}
          </button>
          {status === 'success' && <span className="text-xs text-[var(--color-success)] font-medium">✓ 已保存</span>}
          {status === 'error' && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
        </div>
        {verifyResult !== 'idle' && (
          <div className={`text-xs p-3 rounded-lg ${verifyResult === 'ok' ? 'bg-[var(--color-primary-muted)] text-[var(--color-success)]' : 'bg-[#3A1A1A] text-[var(--color-danger)]'}`}>
            {verifyResult === 'ok' ? '✓' : '✗'} {verifyMsg}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 数据分析 ──

function AnalyticsTab({ submissions, problems }: { submissions: Submission[]; problems: Problem[] }) {
  const kpi = useMemo(() => {
    const total = submissions.length;
    const ac = submissions.filter((s) => s.verdict === 'AC').length;
    const solved = new Set(submissions.filter((s) => s.verdict === 'AC').map((s) => s.problemId)).size;
    const daySet = new Set<string>();
    for (const s of submissions) daySet.add(new Date(s.timestamp).toISOString().slice(0, 10));
    const sorted = [...daySet].sort().reverse();
    let streak = 0;
    if (sorted.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (sorted[0] === today || sorted[0] === yest) {
        streak = 1;
        for (let i = 1; i < sorted.length; i++) {
          if (Math.abs((new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86400000 - 1) < 0.1) streak++; else break;
        }
      }
    }
    return { total, ac, acRate: total ? ((ac / total) * 100).toFixed(1) : '0.0', solved, streak, efficiency: solved > 0 ? (ac / solved).toFixed(1) : '0' };
  }, [submissions]);

  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) { const d = new Date(s.timestamp).toISOString().slice(0, 10); map.set(d, (map.get(d) || 0) + 1); }
    return [...map.entries()].map(([date, count]) => ({ date: date.slice(5), count })).sort((a, b) => a.date.localeCompare(b.date));
  }, [submissions]);
  const verdictData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of submissions) map.set(s.verdict, (map.get(s.verdict) || 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [submissions]);
  const weeklyData = useMemo(() => {
    const map = new Map<string, { total: number; ac: number }>();
    for (const s of submissions) {
      const d = new Date(s.timestamp); const mon = new Date(d); mon.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
      const key = mon.toISOString().slice(0, 10); const e = map.get(key) || { total: 0, ac: 0 };
      e.total++; if (s.verdict === 'AC') e.ac++; map.set(key, e);
    }
    return [...map.entries()].map(([week, d]) => ({ week: week.slice(5), '总提交': d.total, '通过': d.ac })).sort((a, b) => a.week.localeCompare(b.week));
  }, [submissions]);
  const diffData = useMemo(() => {
    const probMap = new Map(problems.map((p) => [p.id, p]));
    const attempted = new Set<string>(); const solved = new Set<string>();
    for (const s of submissions) { attempted.add(s.problemId); if (s.verdict === 'AC') solved.add(s.problemId); }
    return [{ label: '<1200', min: 0, max: 1199 }, { label: '1200-1600', min: 1200, max: 1600 }, { label: '1600-2000', min: 1600, max: 2000 }, { label: '2000-2400', min: 2000, max: 2400 }, { label: '2400+', min: 2400, max: Infinity }]
      .map((b) => { let att = 0, slv = 0; for (const id of attempted) { const p = probMap.get(id); if (p && p.rating >= b.min && p.rating < b.max) { att++; if (solved.has(id)) slv++; } } return { label: b.label, '尝试': att, '通过': slv }; });
  }, [submissions, problems]);

  if (submissions.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">数据分析</h2>
        <div className="card empty-state py-16"><LineChart className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm">还没有提交记录</p><p className="text-xs mt-1">去力扣或牛客网提交一道题</p></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">数据分析</h2>
      <div className="grid grid-cols-5 gap-3">
        {[{ label: '总提交', value: String(kpi.total), color: 'var(--color-text-primary)' }, { label: 'AC 率', value: `${kpi.acRate}%`, color: 'var(--color-success)' }, { label: '已解题目', value: String(kpi.solved), color: 'var(--color-info)' }, { label: '连续天数', value: `${kpi.streak} 天`, color: 'var(--color-warning)' }, { label: '效率', value: `${kpi.efficiency} 次/题`, color: 'var(--color-accent)' }]
          .map((k) => (<div key={k.label} className="card text-center"><p className="kpi-label">{k.label}</p><p className="kpi-value mt-0.5" style={{ color: k.color }}>{k.value}</p></div>))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="card"><h3 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">每日提交</h3>
          {dailyData.length <= 1 ? <p className="text-xs text-[var(--color-text-muted)] py-12 text-center">提交更多天后生成趋势</p> : (
            <ResponsiveContainer width="100%" height={200}><BarChart data={dailyData}><CartesianGrid stroke="#21262D" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#8B949E', fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: '#8B949E', fontSize: 10 }} /><Tooltip {...CHART_TOOLTIP} /><Bar dataKey="count" fill="#2EA043" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
          )}
        </div>
        <div className="card"><h3 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">结果分布</h3>
          <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={verdictData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2}>{verdictData.map((e) => <Cell key={e.name} fill={VERDICT_COLORS[e.name] || VERDICT_FALLBACK} />)}</Pie><Tooltip {...CHART_TOOLTIP} /><Legend wrapperStyle={{ fontSize: 10, color: '#8B949E' }} iconType="circle" iconSize={6} /></PieChart></ResponsiveContainer>
        </div>
        <div className="card"><h3 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">每周趋势</h3>
          {weeklyData.length <= 1 ? <p className="text-xs text-[var(--color-text-muted)] py-12 text-center">提交更多周后生成趋势</p> : (
            <ResponsiveContainer width="100%" height={200}><AreaChart data={weeklyData}><CartesianGrid stroke="#21262D" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" tick={{ fill: '#8B949E', fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: '#8B949E', fontSize: 10 }} /><Tooltip {...CHART_TOOLTIP} /><Legend wrapperStyle={{ fontSize: 10, color: '#8B949E' }} /><Area type="monotone" dataKey="总提交" stroke="#484F58" fill="#484F58" fillOpacity={0.15} /><Area type="monotone" dataKey="通过" stroke="#2EA043" fill="#2EA043" fillOpacity={0.3} /></AreaChart></ResponsiveContainer>
          )}
        </div>
        <div className="card"><h3 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">难度分布</h3>
          {diffData.every((d) => d['尝试'] === 0) ? <p className="text-xs text-[var(--color-text-muted)] py-12 text-center">暂无难度数据</p> : (
            <ResponsiveContainer width="100%" height={200}><BarChart data={diffData}><CartesianGrid stroke="#21262D" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#8B949E', fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: '#8B949E', fontSize: 10 }} /><Tooltip {...CHART_TOOLTIP} /><Legend wrapperStyle={{ fontSize: 10, color: '#8B949E' }} /><Bar dataKey="尝试" fill="#30363D" radius={[3, 3, 0, 0]} /><Bar dataKey="通过" fill="#2EA043" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AI 建议 ──

function RecommendationsPanel({ submissions, problems, targetCompId }: { submissions: Submission[]; problems: Problem[]; targetCompId: string }) {
  const skillProfiles = useLiveQuery(() => db.skillProfiles.toArray()) || [];
  const recs = useMemo(() => {
    if (skillProfiles.length === 0 || submissions.length === 0) return [];
    return getDailyRecommendations(skillProfiles, submissions, problems, targetCompId);
  }, [skillProfiles, submissions, problems, targetCompId]);

  if (recs.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">AI 学习建议</h2>
        <div className="card empty-state py-16"><TrendingUp className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm">提交更多题目后生成个性化建议</p></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">AI 学习建议</h2>
      <div className="space-y-3">
        {recs.map((rec) => (
          <div key={rec.tag} className="card border-l-[3px]" style={{ borderLeftColor: eloProgressColor(rec.currentElo, rec.targetElo) }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{rec.label}</span>
                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">Elo {rec.currentElo}→{rec.targetElo}</span>
              </div>
              <span className="text-[11px] text-[var(--color-warning)] font-semibold">紧急度 {Math.round(rec.urgency * 100)}%</span>
            </div>
            <div className="h-1.5 bg-[var(--color-border-muted)] rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full elo-bar" style={{ width: `${Math.max(Math.round((rec.currentElo / rec.targetElo) * 100), 3)}%`, backgroundColor: eloProgressColor(rec.currentElo, rec.targetElo) }} />
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">{rec.reason}</p>
            <div className="flex gap-4 mt-2 text-[10px] text-[var(--color-text-muted)]">
              <span>难度 {rec.suggestedDifficulty[0]}-{rec.suggestedDifficulty[1]}</span>
              <span>通过率 {rec.acRate}%</span>
              <span>{rec.daysSince}天前</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 比赛设置 ──

function SettingsPanel({ targetCompId, setTargetCompId }: { targetCompId: string; setTargetCompId: (v: string) => void }) {
  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">目标比赛设置</h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-5">选择你的目标比赛，系统为每个算法标签设定对应的目标 Elo。不同比赛对同一知识点的难度要求不同。</p>
      <div className="space-y-2">
        {COMPETITIONS.map((comp) => (
          <button key={comp.id} onClick={() => { setTargetCompId(comp.id); chrome.storage.local.set({ targetCompetition: comp.id }); }}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${targetCompId === comp.id ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/8' : 'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-overlay)]'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${targetCompId === comp.id ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-primary)]'}`}>{comp.name}</span>
              {targetCompId === comp.id && <span className="text-[10px] text-[var(--color-warning)] font-medium">当前选择</span>}
            </div>
            <span className="text-xs text-[var(--color-text-muted)] mt-0.5 block">{comp.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 主应用 ──

function OptionsApp() {
  const [activeTab, setActiveTab] = useState<'data' | 'analytics' | 'skills' | 'recommendations' | 'achievements' | 'settings' | 'github'>('data');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetCompId, setTargetCompId] = useState('lanqiao');
  const [ghToken, setGhToken] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghSaving, setGhSaving] = useState(false);
  const [ghStatus, setGhStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ghError, setGhError] = useState('');

  useEffect(() => {
    chrome.storage.local.get(['targetCompetition'], (r) => { if (typeof r.targetCompetition === 'string') setTargetCompId(r.targetCompetition); });
  }, []);

  const loadGhConfig = async () => { const c = await getGithubConfig(); setGhToken(c.token); setGhRepo(c.repo); };
  const handleTabChange = (tab: typeof activeTab) => { setActiveTab(tab); if (tab === 'github') loadGhConfig(); };

  const submissions = useLiveQuery(() => db.submissions.orderBy('timestamp').reverse().toArray()) || [];
  const problems = useLiveQuery(() => db.problems.toArray()) || [];
  const notes = useLiveQuery(() => db.notes.toArray()) || [];
  const compName = COMPETITIONS.find((c) => c.id === targetCompId)?.name || '蓝桥杯';

  const probMap: Record<string, Problem> = {}; for (const p of problems) probMap[p.id] = p;
  const noteMap: Record<string, any> = {}; for (const n of notes) noteMap[n.problemId] = n;

  const displayData = submissions.map((sub) => {
    const prob = probMap[sub.problemId];
    return { ...sub, title: prob?.title || sub.problemId.replace(/(?:leetcode-cn|nowcoder)_/, ''), url: prob?.url || '#', platform: prob?.platform || '?', noteContent: noteMap[sub.problemId]?.markdownContent || '', mistakeTags: noteMap[sub.problemId]?.mistakeTags || [] };
  });
  const selected = selectedId ? displayData.find((d) => d.id === selectedId) : null;

  const tabs = [
    { id: 'data' as const, label: '数据管理', icon: Database },
    { id: 'analytics' as const, label: '数据分析', icon: LineChart },
    { id: 'skills' as const, label: '能力评估', icon: Target },
    { id: 'recommendations' as const, label: 'AI 建议', icon: TrendingUp },
    { id: 'achievements' as const, label: '成就徽章', icon: Award },
    { id: 'settings' as const, label: '目标设置', icon: Settings },
    { id: 'github' as const, label: 'GitHub 同步', icon: Cloud },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-sans">
      {/* ═══ 顶部 ═══ */}
      <header className="border-b border-[var(--color-border-muted)] bg-[var(--color-bg-elevated)]/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-[var(--color-primary)]" />
            <div>
              <h1 className="text-xl font-bold text-[var(--color-primary)]">AlgoTracker</h1>
              <p className="text-[11px] text-[var(--color-text-muted)]">目标: <span className="text-[var(--color-warning)] font-medium">{compName}</span> · 精准攻克薄弱点</p>
            </div>
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)]">扩展 v1.0</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* ═══ 左侧导航 ═══ */}
        <nav className="w-48 shrink-0 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                className={`nav-item w-full ${activeTab === tab.id ? 'active' : ''}`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </nav>

        {/* ═══ 右侧内容 ═══ */}
        <main className="flex-1 min-w-0">
          {/* 数据管理 */}
          {activeTab === 'data' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">提交记录</h2>
                <span className="text-xs text-[var(--color-text-muted)]">{submissions.length} 条</span>
              </div>
              {displayData.length === 0 ? (
                <div className="card empty-state py-16"><Database className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm">暂无提交记录</p></div>
              ) : (
                <div className="flex gap-5">
                  <div className={selected ? 'w-3/5' : 'w-full'}>
                    <div className="card overflow-hidden">
                      <div className="overflow-x-auto max-h-[65vh] overflow-y-auto custom-scrollbar">
                        <table className="w-full data-table">
                          <thead className="sticky top-0 bg-[var(--color-bg-elevated)]"><tr><th className="pl-3 w-12">平台</th><th className="w-28">时间</th><th>题目</th><th className="w-14">结果</th><th className="w-16">语言</th><th className="w-16">耗时</th></tr></thead>
                          <tbody>
                            {displayData.map((item) => (
                              <tr key={item.id} onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                                className={`row-hover cursor-pointer ${selectedId === item.id ? 'bg-[var(--color-bg-overlay)]' : ''}`}>
                                <td className="pl-3"><span className="platform-chip">{item.platform === 'nowcoder' ? '牛客' : 'LC'}</span></td>
                                <td>{new Date(item.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                <td><a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[var(--color-info)] hover:underline truncate max-w-[240px] inline-block">{item.title}</a></td>
                                <td><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.verdict === 'AC' ? 'badge-ac' : 'badge-wa'}`}>{item.verdict}</span></td>
                                <td>{item.language || '-'}</td>
                                <td>{item.runtimeStr || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {selected && (
                    <div className="w-2/5 card max-h-[65vh] overflow-y-auto custom-scrollbar">
                      <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">{selected.title}</h3><button onClick={() => setSelectedId(null)} className="text-[var(--color-text-muted)] hover:text-white text-lg">✕</button></div>
                      <div className="flex items-center gap-2 mb-3 text-[11px] text-[var(--color-text-muted)]">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selected.verdict === 'AC' ? 'badge-ac' : 'badge-wa'}`}>{selected.verdict}</span>
                        {selected.language && <span>{selected.language}</span>}{selected.runtimeStr && <span>{selected.runtimeStr}</span>}{selected.memoryStr && <span>{selected.memoryStr}</span>}
                      </div>
                      {selected.codeUrl && <a href={selected.codeUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--color-info)] hover:underline block mb-3">查看提交详情 ↗</a>}
                      {selected.code && (<div className="mb-3"><p className="text-[10px] text-[var(--color-text-muted)] mb-1">代码</p><pre className="text-[10px] bg-[var(--color-bg-base)] border border-[var(--color-border-muted)] rounded p-2.5 overflow-x-auto max-h-48 font-mono whitespace-pre leading-snug">{selected.code}</pre></div>)}
                      {selected.noteContent && (<div className="mb-3"><p className="text-[10px] text-[var(--color-text-muted)] mb-1">笔记</p><pre className="text-[10px] bg-[var(--color-bg-base)] border border-[var(--color-border-muted)] rounded p-2.5 overflow-x-auto max-h-36 font-mono whitespace-pre-wrap leading-snug">{selected.noteContent}</pre></div>)}
                      {selected.mistakeTags.length > 0 && <div className="flex gap-1 flex-wrap">{selected.mistakeTags.map((t: string) => <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-full badge-wa">{t}</span>)}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && <AnalyticsTab submissions={submissions} problems={problems} />}
          {activeTab === 'skills' && <TagSkillsPanel submissions={submissions} problems={problems} targetCompId={targetCompId} />}
          {activeTab === 'recommendations' && <RecommendationsPanel submissions={submissions} problems={problems} targetCompId={targetCompId} />}
          {activeTab === 'achievements' && <AchievementGallery />}
          {activeTab === 'settings' && <SettingsPanel targetCompId={targetCompId} setTargetCompId={setTargetCompId} />}
          {activeTab === 'github' && <GithubTab token={ghToken} repo={ghRepo} saving={ghSaving} status={ghStatus} error={ghError} onTokenChange={setGhToken} onRepoChange={setGhRepo} onSave={(token, repo) => { setGhSaving(true); setGhStatus('idle'); setGhError(''); setGithubConfig({ token, repo, enabled: true }).then(() => { setGhStatus('success'); setGhSaving(false); }).catch((e: Error) => { setGhError(e.message || String(e)); setGhStatus('error'); setGhSaving(false); }); }} />}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><OptionsApp /></React.StrictMode>);
