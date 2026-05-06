import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { getGithubConfig, setGithubConfig, verifyConnection } from '../lib/github';
import '../popup/index.css';

// ── GitHub 同步配置面板 ──

function GithubTab({
  token,
  repo,
  saving,
  status,
  error,
  onTokenChange,
  onRepoChange,
  onSave,
}: {
  token: string;
  repo: string;
  saving: boolean;
  status: 'idle' | 'success' | 'error';
  error: string;
  onTokenChange: (v: string) => void;
  onRepoChange: (v: string) => void;
  onSave: (token: string, repo: string) => void;
}) {
  const canSave = token.trim() && repo.trim() && !saving;
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [verifyMsg, setVerifyMsg] = useState('');

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult('idle');
    setVerifyMsg('');
    const { ok, error: errMsg } = await verifyConnection(token, repo);
    setVerifyResult(ok ? 'ok' : 'fail');
    setVerifyMsg(ok ? '连接成功！Token 有效，仓库可访问。' : errMsg);
    setVerifying(false);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-white mb-2">
        GitHub 自动同步配置
      </h2>
      <p className="text-sm text-gray-400 mb-8">
        将每次提交的代码和笔记自动推送到你的 GitHub 仓库，方便多设备查阅和备份。
      </p>

      {/* 步骤 1：创建 Token */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2EA043] text-white text-xs font-bold shrink-0">
            1
          </span>
          <h3 className="text-base font-semibold text-white">
            创建 GitHub Fine-grained Token（推荐）
          </h3>
        </div>

        <div className="bg-[#1A3A2A] border border-[#2EA043]/30 rounded-lg p-4 mb-4 text-sm text-gray-300 leading-relaxed">
          <p className="font-medium text-[#2EA043] mb-2">为什么推荐精细 Token？</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>权限可以限定到<strong className="text-gray-200">单个仓库</strong>，即使泄露也仅影响一个仓库</li>
            <li>可以精确控制每个权限（只读 / 读写），不像 Classic Token 的 `repo` 权限能访问所有仓库</li>
            <li>这是 GitHub 官方推荐的新标准</li>
          </ul>
        </div>

        <ol className="text-sm text-gray-300 space-y-2 mb-4 list-decimal list-inside leading-relaxed">
          <li>
            打开{' '}
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline"
            >
              GitHub Fine-grained Token 创建页面
            </a>
          </li>
          <li>
            在 <span className="text-gray-200 font-medium">Token name</span> 填入 <code className="bg-[#161B22] px-1.5 py-0.5 rounded text-xs text-gray-300">AlgoTracker</code>
          </li>
          <li>
            在 <span className="text-gray-200 font-medium">Expiration</span> 选择过期时间（建议选最长的自定义期限）
          </li>
          <li>
            在 <span className="text-gray-200 font-medium">Resource owner</span> 选择你的 GitHub 账号
          </li>
          <li>
            <span className="text-gray-200 font-medium">Repository access</span> → 选择 <strong className="text-white">Only select repositories</strong>，然后在下拉框中选中你准备用来同步的那个仓库
          </li>
          <li>
            <span className="text-gray-200 font-medium">Permissions</span> → <strong className="text-[#F85149]">Contents: Read and write</strong>（其他全部保持默认的 "No access"）
          </li>
          <li>点击底部的 <span className="text-gray-200 font-medium">Generate token</span></li>
          <li>
            <strong className="text-[#F85149]">立即复制生成的 Token</strong>（以 <code className="bg-[#161B22] px-1.5 py-0.5 rounded text-xs text-gray-300">github_pat_</code> 开头），离开页面后将无法再次查看
          </li>
        </ol>

        <p className="text-xs text-gray-500 mb-4">
          如果你更习惯旧版，也可以使用{' '}
          <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
            Classic Token
          </a>（勾选 `repo` 权限），两种都能用。
        </p>

        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-200">
              Token
            </label>
            <span className="text-xs text-gray-500">
              {token ? '已填写' : '未填写'}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#2EA043] placeholder:text-gray-600"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Token 仅保存在你浏览器的本地存储中，不会上传到任何第三方服务器。
          </p>
        </div>
      </div>

      {/* 步骤 2：仓库 */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2EA043] text-white text-xs font-bold shrink-0">
            2
          </span>
          <h3 className="text-base font-semibold text-white">
            准备 GitHub 仓库
          </h3>
        </div>

        <div className="text-sm text-gray-300 space-y-2 mb-4 leading-relaxed">
          <p>
            你需要一个<strong>已经存在的</strong> GitHub 仓库来存放同步文件。推荐创建一个<strong>私有仓库</strong>。
          </p>
          <p>
            如果还没有，点击这里创建：
            <a
              href="https://github.com/new"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline ml-1"
            >
              创建新仓库 ↗
            </a>
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-1 ml-2">
            <li>仓库名随意，比如 <code className="bg-[#161B22] px-1.5 py-0.5 rounded text-xs text-gray-300">algo-tracker-data</code></li>
            <li>建议设为 <span className="text-gray-200 font-medium">Private</span>（私有），避免代码泄露</li>
            <li>不需要勾选 "Add a README file"（空仓库或已有内容的仓库都可以）</li>
          </ul>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-200 mb-2">
            仓库全名
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-sm shrink-0">github.com/</span>
            <input
              type="text"
              value={repo}
              onChange={(e) => onRepoChange(e.target.value)}
              placeholder="你的用户名/仓库名"
              className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#2EA043] placeholder:text-gray-600"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            格式：<code className="bg-[#161B22] px-1.5 py-0.5 rounded text-xs text-gray-400">GitHub用户名/仓库名</code>，例如 <code className="bg-[#161B22] px-1.5 py-0.5 rounded text-xs text-gray-400">chen/algo-tracker-data</code>
          </p>
        </div>
      </div>

      {/* 步骤 3：同步说明 */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2EA043] text-white text-xs font-bold shrink-0">
            3
          </span>
          <h3 className="text-base font-semibold text-white">
            同步规则说明
          </h3>
        </div>
        <div className="text-sm text-gray-400 space-y-2 leading-relaxed">
          <p>
            配置完成后，每次你在力扣提交代码，AlgoTracker 会自动将以下内容推送到你的仓库：
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-gray-300">
            <li>
              代码文件 →{' '}
              <code className="bg-[#161B22] px-1.5 py-0.5 rounded text-xs text-gray-400">
                leetcode/题目名/solution_时间戳.py
              </code>
            </li>
            <li>
              复盘笔记 →{' '}
              <code className="bg-[#161B22] px-1.5 py-0.5 rounded text-xs text-gray-400">
                leetcode/题目名/README.md
              </code>
            </li>
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            首次同步前请确保仓库已存在，且 Token 有对应仓库的写入权限。
          </p>
        </div>
      </div>

      {/* 操作按钮 & 状态 */}
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={() => onSave(token, repo)}
          disabled={!canSave}
          className={`text-white font-bold py-2.5 px-8 rounded-lg transition-colors ${
            canSave
              ? 'bg-[#2EA043] hover:bg-green-600'
              : 'bg-[#30363D] text-gray-500 cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : '保存配置'}
        </button>

        <button
          onClick={handleVerify}
          disabled={!token.trim() || !repo.trim() || verifying}
          className={`text-sm font-medium py-2.5 px-6 rounded-lg border transition-colors ${
            token.trim() && repo.trim() && !verifying
              ? 'border-[#30363D] text-gray-300 hover:bg-[#30363D]'
              : 'border-[#30363D] text-gray-600 cursor-not-allowed'
          }`}
        >
          {verifying ? '测试中...' : '测试连接'}
        </button>

        {status === 'success' && (
          <span className="text-sm text-[#2EA043] font-medium flex items-center gap-1">
            <span>✓</span> 配置已保存
          </span>
        )}
        {status === 'error' && (
          <span className="text-sm text-[#F85149]">{error || '保存失败'}</span>
        )}
      </div>

      {/* 验证结果 */}
      {verifyResult !== 'idle' && (
        <div
          className={`text-sm p-3 rounded-lg mb-6 ${
            verifyResult === 'ok'
              ? 'bg-[#1A3A2A] border border-[#2EA043]/30 text-[#2EA043]'
              : 'bg-[#3A1A1A] border border-[#F85149]/30 text-[#F85149]'
          }`}
        >
          {verifyResult === 'ok' ? '✓' : '✗'} {verifyMsg}
        </div>
      )}

      {/* 安全说明 */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-[#30363D] text-gray-400 text-xs font-bold shrink-0">
            🔒
          </span>
          <h3 className="text-base font-semibold text-white">
            数据安全说明
          </h3>
        </div>
        <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
          <div className="flex gap-3">
            <span className="text-green-400 shrink-0 mt-0.5">✓</span>
            <div>
              <p className="text-gray-200 font-medium">Token 仅存本地</p>
              <p>Token 保存在你浏览器的 chrome.storage.local 中，不上传任何第三方服务器。Chrome 会按扩展 ID 隔离存储空间，<strong>其他扩展无法读取</strong>你的 Token。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-400 shrink-0 mt-0.5">✓</span>
            <div>
              <p className="text-gray-200 font-medium">数据直传 GitHub</p>
              <p>提交的代码和笔记直接从你的浏览器通过 HTTPS 加密传输到 api.github.com，不会经过中间服务器。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-400 shrink-0 mt-0.5">✓</span>
            <div>
              <p className="text-gray-200 font-medium">精细 Token 更安全</p>
              <p>使用 Fine-grained Token 可以将权限限定到单个仓库。即使 Token 意外泄露，影响范围也仅限于你指定的那个仓库。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionsApp() {
  const [activeTab, setActiveTab] = useState<'data' | 'github'>('data');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── GitHub 配置状态 ──
  const [ghToken, setGhToken] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghSaving, setGhSaving] = useState(false);
  const [ghStatus, setGhStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ghError, setGhError] = useState('');

  // 加载已保存的 GitHub 配置
  const loadGhConfig = async () => {
    const config = await getGithubConfig();
    setGhToken(config.token);
    setGhRepo(config.repo);
  };

  // 切换到 GitHub tab 时加载配置
  const handleTabChange = (tab: 'data' | 'github') => {
    setActiveTab(tab);
    if (tab === 'github') loadGhConfig();
  };

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
              onClick={() => handleTabChange('data')}
              className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'data'
                  ? 'bg-[#2EA043] text-white'
                  : 'text-gray-400 hover:bg-[#161B22] hover:text-white'
              }`}
            >
              数据管理
            </button>
            <button
              onClick={() => handleTabChange('github')}
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
              <GithubTab
                token={ghToken}
                repo={ghRepo}
                saving={ghSaving}
                status={ghStatus}
                error={ghError}
                onTokenChange={setGhToken}
                onRepoChange={setGhRepo}
                onSave={(token, repo) => {
                  setGhSaving(true);
                  setGhStatus('idle');
                  setGhError('');
                  setGithubConfig({ token, repo, enabled: true })
                    .then(() => {
                      setGhStatus('success');
                      setGhSaving(false);
                    })
                    .catch((e: Error) => {
                      setGhError(e.message || String(e));
                      setGhStatus('error');
                      setGhSaving(false);
                    });
                }}
              />
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
