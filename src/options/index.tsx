import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import '../popup/index.css';

function OptionsApp() {
  const [activeTab, setActiveTab] = useState<'data' | 'github'>('data');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const submissions =
    useLiveQuery(() =>
      db.submissions.orderBy('timestamp').reverse().toArray()
    ) || [];
  const problems = useLiveQuery(() => db.problems.toArray()) || [];
  const notes = useLiveQuery(() => db.notes.toArray()) || [];

  // 构建字典
  const probMap: Record<string, (typeof problems)[number]> = {};
  for (const p of problems) probMap[p.id] = p;
  const noteMap: Record<string, (typeof notes)[number]> = {};
  for (const n of notes) noteMap[n.problemId] = n;

  const displayData = submissions.map((sub) => {
    const prob = probMap[sub.problemId];
    return {
      ...sub,
      title: prob?.title || sub.problemId.replace('leetcode-cn_', ''),
      url: prob?.url || '#',
      platform: prob?.platform || 'Unknown',
      noteContent: noteMap[sub.problemId]?.markdownContent || '',
      mistakeTags: noteMap[sub.problemId]?.mistakeTags || [],
    };
  });

  const selected =
    selectedId
      ? displayData.find((d) => d.id === selectedId)
      : null;

  const verdictBadge = (v: string) => {
    const isAC = v === 'AC';
    return (
      <span
        className={`text-xs font-bold px-2 py-0.5 rounded ${
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
    <div className="min-h-screen bg-[#0D1117] text-gray-200 font-sans p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[#2EA043] mb-8">
          AlgoTracker 控制台
        </h1>

        <div className="flex gap-6">
          {/* 左侧导航 */}
          <div className="w-48 shrink-0 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('data')}
              className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'data'
                  ? 'bg-[#2EA043] text-white'
                  : 'text-gray-400 hover:bg-[#161B22] hover:text-white'
              }`}
            >
              数据管理
            </button>
            <button
              onClick={() => setActiveTab('github')}
              className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'github'
                  ? 'bg-[#2EA043] text-white'
                  : 'text-gray-400 hover:bg-[#161B22] hover:text-white'
              }`}
            >
              GitHub 同步
            </button>
          </div>

          {/* 右侧内容区 */}
          <div className="flex-1 bg-[#161B22] border border-[#30363D] rounded-xl p-6 min-h-[600px]">
            {activeTab === 'data' && (
              <div className="flex gap-6">
                {/* 表格区 */}
                <div className={selected ? 'w-1/2' : 'w-full'}>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-white">
                      提交记录
                    </h2>
                    <div className="text-sm text-gray-400">
                      共 {submissions.length} 条
                    </div>
                  </div>

                  {displayData.length === 0 ? (
                    <div className="text-center text-gray-500 py-16">
                      暂无提交记录
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-[#161B22]">
                          <tr className="border-b border-[#30363D] text-sm text-gray-400">
                            <th className="pb-3 pl-2 w-32">时间</th>
                            <th className="pb-3">题目</th>
                            <th className="pb-3 w-16">结果</th>
                            <th className="pb-3 w-20">语言</th>
                            <th className="pb-3 w-20">耗时</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayData.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() =>
                                setSelectedId(
                                  selectedId === item.id ? null : item.id
                                )
                              }
                              className={`border-b border-[#30363D] hover:bg-[#21262D] transition-colors text-sm cursor-pointer ${
                                selectedId === item.id ? 'bg-[#21262D]' : ''
                              }`}
                            >
                              <td className="py-3 pl-2 text-gray-400 text-xs">
                                {new Date(item.timestamp).toLocaleString(
                                  'zh-CN',
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </td>
                              <td className="py-3">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-400 hover:underline truncate max-w-[200px] inline-block"
                                >
                                  {item.title}
                                </a>
                              </td>
                              <td className="py-3">{verdictBadge(item.verdict)}</td>
                              <td className="py-3 text-gray-400 text-xs">
                                {item.language || '-'}
                              </td>
                              <td className="py-3 text-gray-400 text-xs">
                                {item.runtimeStr || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 详情面板 */}
                {selected && (
                  <div className="w-1/2 border-l border-[#30363D] pl-6 overflow-y-auto max-h-[70vh]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        {selected.title}
                      </h3>
                      <button
                        onClick={() => setSelectedId(null)}
                        className="text-gray-400 hover:text-white text-xl"
                      >
                        ✕
                      </button>
                    </div>

                    {/* 基本信息 */}
                    <div className="flex items-center gap-2 mb-4 text-sm text-gray-400">
                      {verdictBadge(selected.verdict)}
                      {selected.language && <span>{selected.language}</span>}
                      {selected.runtimeStr && <span>{selected.runtimeStr}</span>}
                      {selected.memoryStr && <span>{selected.memoryStr}</span>}
                    </div>

                    {/* 力扣链接 */}
                    {selected.codeUrl && (
                      <a
                        href={selected.codeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 hover:underline block mb-4"
                      >
                        在力扣查看提交详情 ↗
                      </a>
                    )}

                    {/* 代码 */}
                    {selected.code && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">
                          提交代码
                        </p>
                        <pre className="text-xs bg-[#0D1117] border border-gray-700 rounded p-3 overflow-x-auto max-h-64 text-gray-300 font-mono whitespace-pre">
                          {selected.code}
                        </pre>
                      </div>
                    )}

                    {/* 笔记 */}
                    {selected.noteContent && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">
                          笔记与复盘
                        </p>
                        <pre className="text-xs bg-[#0D1117] border border-gray-700 rounded p-3 overflow-x-auto max-h-48 text-gray-300 font-mono whitespace-pre-wrap">
                          {selected.noteContent}
                        </pre>
                      </div>
                    )}

                    {/* 错因 */}
                    {selected.mistakeTags.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">错因标签</p>
                        <div className="flex gap-1 flex-wrap">
                          {selected.mistakeTags.map((t) => (
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

                    {/* 无详情时提示 */}
                    {!selected.code && !selected.noteContent && (
                      <p className="text-sm text-gray-500 mt-8">
                        此提交暂无代码或笔记记录
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'github' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">
                  GitHub 自动同步配置
                </h2>
                <div className="space-y-6 max-w-xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Personal Access Token (Classic)
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#2EA043]"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      需要勾选 `repo` 权限。Token 仅保存在浏览器本地。
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      仓库名称 (Repository)
                    </label>
                    <input
                      type="text"
                      placeholder="username/algo-tracker-sync"
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#2EA043]"
                    />
                  </div>

                  <button className="bg-[#2EA043] hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                    保存并验证连接
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
