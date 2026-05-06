import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { db, type SkillProfile, type Submission, type Note } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import './index.css';

function PopupApp() {
  const skillProfiles = useLiveQuery(() => db.skillProfiles.toArray()) || [];
  const submissions =
    useLiveQuery(() =>
      db.submissions.orderBy('timestamp').reverse().limit(20).toArray()
    ) || [];
  const problems = useLiveQuery(() => db.problems.toArray()) || [];
  const notes = useLiveQuery(() => db.notes.toArray()) || [];

  const [expanded, setExpanded] = useState<string | null>(null);

  // ── 雷达图数据 ──
  const defaultData = [
    { subject: 'dp', A: 0, fullMark: 3000 },
    { subject: 'graph', A: 0, fullMark: 3000 },
    { subject: 'tree', A: 0, fullMark: 3000 },
    { subject: 'string', A: 0, fullMark: 3000 },
    { subject: 'math', A: 0, fullMark: 3000 },
  ];

  const radarData = useMemo(() => {
    const filtered = skillProfiles
      .filter((p) => p.tag !== 'global')
      .map((p: SkillProfile) => ({
        subject: p.tag,
        A: Math.round(p.rating),
        fullMark: 3000,
      }));
    return filtered.length >= 3 ? filtered : defaultData;
  }, [skillProfiles]);

  // ── 组装近期记录 ──
  const recentItems = useMemo(() => {
    const noteMap = new Map<string, Note>();
    for (const n of notes) noteMap.set(n.problemId, n);
    const probMap = new Map<string, (typeof problems)[number]>();
    for (const p of problems) probMap.set(p.id, p);

    return submissions.map((s: Submission) => {
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
  }, [submissions, problems, notes]);

  // ── 统计 ──
  const stats = useMemo(() => {
    const ac = submissions.filter((s) => s.verdict === 'AC').length;
    const total = submissions.length || 1;
    return { ac, total, rate: Math.round((ac / total) * 100) };
  }, [submissions]);

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

  return (
    <div className="p-4 w-[400px] bg-[#0D1117] text-gray-100 font-sans">
      {/* 头部 */}
      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
        <div>
          <h1 className="text-lg font-bold text-[#2EA043]">AlgoTracker</h1>
          <p className="text-xs text-gray-500">
            {stats.ac} / {stats.total} AC ({stats.rate}%)
          </p>
        </div>
        <a
          href="/options.html"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-gray-400 hover:text-white"
        >
          全部数据 ↗
        </a>
      </div>

      {/* 能力画像 */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">能力画像</h2>
        <div className="h-52 w-full bg-[#161B22] rounded-lg border border-gray-800 relative flex items-center justify-center overflow-hidden">
          {skillProfiles.length === 0 && (
            <div className="absolute inset-0 z-10 bg-[#0D1117]/80 flex items-center justify-center rounded-lg">
              <span className="text-sm text-gray-400 font-medium px-4 py-2 border border-gray-700 rounded-full bg-[#161B22]">
                提交题目以点亮画像
              </span>
            </div>
          )}
          <div style={{ width: 340, height: 200 }}>
            <ResponsiveContainer width={340} height={200}>
              <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarData}>
                <PolarGrid stroke="#30363D" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#8B949E', fontSize: 10 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 3000]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="Rating"
                  dataKey="A"
                  stroke="#2EA043"
                  fill="#2EA043"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 最近提交 */}
      <h2 className="text-sm font-semibold text-gray-300 mb-2">最近提交</h2>
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
              {/* 卡片标题行 */}
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
                <span className="text-gray-500 text-xs shrink-0">
                  {isOpen ? '收起 ▲' : '详情 ▼'}
                </span>
              </button>

              {/* 展开区 */}
              {isOpen && (
                <div className="border-t border-gray-800 p-3 space-y-3">
                  {/* 跳转链接 */}
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

                  {/* 代码块 */}
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

                  {/* 笔记 */}
                  {item.noteContent && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">笔记</p>
                      <pre className="text-xs bg-[#0D1117] border border-gray-700 rounded p-2 overflow-x-auto max-h-32 text-gray-300 font-mono whitespace-pre-wrap">
                        {item.noteContent}
                      </pre>
                    </div>
                  )}

                  {/* 错因标签 */}
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
