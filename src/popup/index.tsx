import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { db, type Submission, type Problem, type Note } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ExternalLink, Activity, Target, Flame, Calendar, 
  ChevronDown, ChevronUp, LayoutDashboard
} from 'lucide-react';
import './index.css';

// ── 工具函数 ──

function tagLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface TagStat {
  tag: string;
  label: string;
  total: number;
  ac: number;
  acRate: number;
  lastAt: number;
  daysSince: number;
}

function useTagStats(
  submissions: Submission[],
  problems: Problem[]
): TagStat[] {
  return useMemo(() => {
    const probMap = new Map(problems.map((p) => [p.id, p]));
    const tagMap = new Map<
      string,
      { total: number; ac: number; lastAt: number }
    >();
    for (const sub of submissions) {
      const prob = probMap.get(sub.problemId);
      if (!prob || !prob.tags) continue;
      for (const tag of prob.tags) {
        const e = tagMap.get(tag) || { total: 0, ac: 0, lastAt: 0 };
        e.total++;
        if (sub.verdict === 'AC') e.ac++;
        if (sub.timestamp > e.lastAt) e.lastAt = sub.timestamp;
        tagMap.set(tag, e);
      }
    }
    return [...tagMap.entries()]
      .map(([tag, s]) => ({
        tag,
        label: tagLabel(tag),
        ...s,
        acRate: s.total ? Math.round((s.ac / s.total) * 100) : 0,
        daysSince: Math.round((Date.now() - s.lastAt) / 86400000),
      }))
      .sort((a, b) => b.total - a.total);
  }, [submissions, problems]);
}

// ── 紧凑建议 ──

function CompactRec({ tagStats }: { tagStats: TagStat[] }) {
  const rec = useMemo(() => {
    if (tagStats.length === 0) return null;
    // 优先推荐通过率低且近期练过的（诊断可靠）、或间隔过久的
    let best: TagStat | null = null;
    let bestScore = -1;
    for (const t of tagStats) {
      if (t.total < 3) continue; // 样本太少，不做诊断
      const weakScore = 1 - t.acRate / 100;
      const forgetScore = Math.min(t.daysSince / 14, 1);
      const score = 0.6 * weakScore + 0.4 * forgetScore;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }, [tagStats]);

  if (!rec) return null;

  return (
    <div className="mb-3 text-xs text-gray-400 bg-[#161B22] rounded-lg border border-[#F0883E]/30 px-3 py-2.5 flex items-start gap-2">
      <Target className="w-4 h-4 text-[#F0883E] shrink-0 mt-0.5" />
      <div>
        <span className="text-gray-400">建议练习：</span>
        <span className="text-[#F0883E] font-medium">{rec.label}</span>
        <span className="text-gray-500">
          {' '}
          （通过率 {rec.acRate}%{rec.daysSince > 2 ? `，${rec.daysSince}天未练` : ''}）
        </span>
      </div>
    </div>
  );
}

// ── 主应用 ──

function PopupApp() {
  const skillProfiles =
    useLiveQuery(() => db.skillProfiles.toArray()) || [];
  const allSubs =
    useLiveQuery(
      () => db.submissions.orderBy('timestamp').reverse().toArray()
    ) || [];
  const recentSubs = allSubs.slice(0, 20);
  const problems = useLiveQuery(() => db.problems.toArray()) || [];
  const notes = useLiveQuery(() => db.notes.toArray()) || [];

  const [expanded, setExpanded] = useState<string | null>(null);

  // ── 标签统计 ──
  const tagStats = useTagStats(allSubs, problems);

  // ── 全局 Elo ──
  const globalRating = useMemo(() => {
    const g = skillProfiles.find((p) => p.tag === 'global');
    return g ? Math.round(g.rating) : 1500;
  }, [skillProfiles]);

  // ── 组装近期记录 ──
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
        title: prob?.title || s.problemId.replace('leetcode-cn_', ''),
        url:
          prob?.url ||
          `https://leetcode.cn/problems/${s.problemId.replace('leetcode-cn_', '')}/`,
        noteContent: note?.markdownContent || '',
        mistakeTags: note?.mistakeTags || [],
      };
    });
  }, [recentSubs, problems, notes]);

  // ── 统计 ──
  const stats = useMemo(() => {
    const ac = allSubs.filter((s) => s.verdict === 'AC').length;
    const total = allSubs.length || 1;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = Date.now() - 7 * 86400000;
    const todayCount = allSubs.filter(
      (s) => new Date(s.timestamp).toISOString().slice(0, 10) === today
    ).length;
    const weekCount = allSubs.filter((s) => s.timestamp >= weekAgo).length;

    const solved = new Set<string>();
    for (const s of allSubs) {
      if (s.verdict === 'AC') solved.add(s.problemId);
    }

    const daySet = new Set<string>();
    for (const s of allSubs) {
      daySet.add(new Date(s.timestamp).toISOString().slice(0, 10));
    }
    const sorted = [...daySet].sort().reverse();
    let streak = 0;
    if (sorted.length > 0) {
      const todayStr = today;
      const yestStr = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);
      if (sorted[0] === todayStr || sorted[0] === yestStr) {
        streak = 1;
        for (let i = 1; i < sorted.length; i++) {
          const diff =
            (new Date(sorted[i - 1]).getTime() -
              new Date(sorted[i]).getTime()) /
            86400000;
          if (Math.abs(diff - 1) < 0.1) streak++;
          else break;
        }
      }
    }

    return {
      ac,
      total,
      rate: Math.round((ac / total) * 100),
      todayCount,
      weekCount,
      solved: solved.size,
      streak,
    };
  }, [allSubs]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  const verdictBadge = (v: string) => {
    const isAC = v === 'AC';
    return (
      <span
        className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
          isAC
            ? 'bg-[#2EA043]/20 text-[#2EA043]'
            : 'bg-[#F85149]/20 text-[#F85149]'
        }`}
      >
        {v}
      </span>
    );
  };

  // AC 率颜色
  const acRateColor = (rate: number) => {
    if (rate >= 70) return 'bg-[#2EA043]';
    if (rate >= 40) return 'bg-[#F0883E]';
    return 'bg-[#F85149]';
  };

  return (
    <div className="p-4 w-[400px] bg-[#0D1117] text-gray-100 font-sans">
      {/* 头部 */}
      <div className="mb-4 border-b border-gray-800 pb-4">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-lg font-bold text-[#2EA043] flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            AlgoTracker
          </h1>
          <a
            href="/options.html"
            target="_blank"
            rel="noreferrer"
            className="text-xs flex items-center gap-1 bg-[#21262D] hover:bg-[#30363D] text-gray-300 px-2.5 py-1.5 rounded-md transition-colors"
          >
            控制台 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        {/* KPI 网格 */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#161B22] rounded-md p-2 border border-gray-800 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 mb-0.5">AC / 总数</span>
            <span className="text-sm font-semibold text-gray-200">{stats.ac} <span className="text-gray-500 text-xs font-normal">/ {stats.total}</span></span>
          </div>
          <div className="bg-[#161B22] rounded-md p-2 border border-gray-800 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 mb-0.5">已解题数</span>
            <span className="text-sm font-semibold text-gray-200">{stats.solved}</span>
          </div>
          <div className="bg-[#161B22] rounded-md p-2 border border-gray-800 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 mb-0.5">Rating</span>
            <span className="text-sm font-semibold text-[#F0883E]">{globalRating}</span>
          </div>
        </div>

        {/* 活跃统计 */}
        <div className="flex justify-between items-center px-1 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-blue-400" /> 今日 <span className="text-gray-200 font-medium">{stats.todayCount}</span></span>
          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-purple-400" /> 本周 <span className="text-gray-200 font-medium">{stats.weekCount}</span></span>
          <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-orange-400" /> 连续 <span className="text-gray-200 font-medium">{stats.streak}</span></span>
        </div>
      </div>

      {/* 标签能力分布 */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Target className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-300">
            能力分布
          </h2>
        </div>
        {tagStats.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-6 bg-[#161B22] rounded-lg border border-gray-800">
            去力扣提交题目以生成能力分布
          </div>
        ) : (
          <div className="bg-[#161B22] rounded-lg border border-gray-800 p-3 space-y-1.5">
            {tagStats.slice(0, 8).map((t) => (
              <div key={t.tag} className="flex items-center gap-2">
                <span className="w-24 text-xs text-gray-300 truncate shrink-0">
                  {t.label}
                </span>
                <div className="flex-1 h-2.5 bg-[#30363D] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${acRateColor(t.acRate)}`}
                    style={{ width: `${Math.max(t.acRate, 8)}%` }}
                  />
                </div>
                <span className="w-14 text-right text-xs text-gray-500">
                  {t.total}次 {t.acRate}%
                </span>
              </div>
            ))}
            {tagStats.length > 8 && (
              <p className="text-xs text-gray-600 text-center pt-1">
                +{tagStats.length - 8} 个标签，详见控制台
              </p>
            )}
          </div>
        )}
      </div>

      {/* 精简学习建议 */}
      <CompactRec tagStats={tagStats} />

      {/* 最近提交 */}
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-300">
          最近提交
        </h2>
      </div>
      {recentItems.length === 0 && (
        <div className="text-xs text-gray-500 text-center py-6 bg-[#161B22] rounded-lg border border-gray-800">
          去力扣提交一道题吧！
        </div>
      )}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {recentItems.map((item) => {
          const isOpen = expanded === item.id;
          return (
            <div
              key={item.id}
              className="bg-[#161B22] rounded-lg border border-gray-800 overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full text-left p-3 hover:bg-[#21262D] transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {verdictBadge(item.verdict)}
                    <span className="text-sm font-medium text-gray-200 truncate">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 mt-1">
                    {item.runtimeStr ? <span>{item.runtimeStr}</span> : null}
                    {item.memoryStr ? <span>{item.memoryStr}</span> : null}
                    {item.language ? <span>{item.language}</span> : null}
                    <span>
                      {new Date(item.timestamp).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <span className="text-gray-500 shrink-0 flex items-center justify-center w-6 h-6">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-800 p-3 space-y-3">
                  {item.codeUrl && (
                    <a
                      href={item.codeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-400 hover:underline block"
                    >
                      查看力扣提交详情 ↗
                    </a>
                  )}

                  {item.code && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        提交代码 ({item.language || '未知语言'})
                      </p>
                      <pre className="text-xs bg-[#0D1117] border border-gray-700 rounded p-2 overflow-x-auto max-h-48 text-gray-300 font-mono whitespace-pre">
                        {item.code}
                      </pre>
                    </div>
                  )}

                  {item.noteContent && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">笔记</p>
                      <pre className="text-xs bg-[#0D1117] border border-gray-700 rounded p-2 overflow-x-auto max-h-32 text-gray-300 font-mono whitespace-pre-wrap">
                        {item.noteContent}
                      </pre>
                    </div>
                  )}

                  {item.mistakeTags.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">错因</p>
                      <div className="flex gap-1 flex-wrap">
                        {item.mistakeTags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 text-xs rounded-full bg-[#F85149]/20 text-[#F85149]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
