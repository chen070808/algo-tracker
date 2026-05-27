import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { COMPETITIONS } from '../lib/elo';
import { getGithubConfig, setGithubConfig, verifyConnection } from '../lib/github';
import { getSyncConfig, clearAuth } from '../lib/sync';
import { Settings, Info, ExternalLink, Shield, Trash2, Download, ChevronDown, Check, AlertCircle, Key, FolderGit2 } from 'lucide-react';
import { db } from '../lib/db';
import '../popup/index.css';

function OptionsApp() {
  const [activeTab, setActiveTab] = useState<'settings' | 'about'>('settings');
  const [targetCompId, setTargetCompId] = useState('lanqiao');
  const [ghRepo, setGhRepo] = useState('');
  const [ghToken, setGhToken] = useState('');
  const [ghConnected, setGhConnected] = useState(false);
  const [ghStatus, setGhStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ghGuideOpen, setGhGuideOpen] = useState(false);
  const [ghTesting, setGhTesting] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ connected: boolean; email?: string; lastSync?: string }>({ connected: false });

  useEffect(() => {
    chrome.storage.local.get(['targetCompetition'], (r) => {
      if (typeof r.targetCompetition === 'string') setTargetCompId(r.targetCompetition);
    });
    getGithubConfig().then((c) => {
      if (c.repo) setGhRepo(c.repo);
      if (c.token) setGhToken(c.token);
      if (c.enabled && c.token && c.repo) setGhConnected(true);
    });
    getSyncConfig().then((c) => {
      setCloudStatus({ connected: !!c.token, email: undefined, lastSync: undefined });
    });
  }, []);

  const handleCompChange = useCallback((compId: string) => {
    setTargetCompId(compId);
    chrome.storage.local.set({ targetCompetition: compId });
  }, []);

  const handleGhSave = useCallback(async () => {
    if (!ghRepo || !ghToken) {
      setGhStatus({ ok: false, msg: '请填写仓库名和 Token' });
      return;
    }
    if (!/^[\w.-]+\/[\w.-]+$/.test(ghRepo)) {
      setGhStatus({ ok: false, msg: '仓库名格式不正确，应为 用户名/仓库名' });
      return;
    }
    setGhTesting(true);
    setGhStatus(null);
    await setGithubConfig({ repo: ghRepo, token: ghToken, enabled: true });
    const result = await verifyConnection(ghToken, ghRepo);
    setGhTesting(false);
    setGhStatus({ ok: result.ok, msg: result.ok ? '连接成功' : result.error });
    if (result.ok) setGhConnected(true);
  }, [ghRepo, ghToken]);

  const handleExport = useCallback(async () => {
    const data = {
      submissions: await db.submissions.toArray(),
      problems: await db.problems.toArray(),
      skillProfiles: await db.skillProfiles.toArray(),
      notes: await db.notes.toArray(),
      reviews: await db.reviews.toArray(),
      achievements: await db.achievements.toArray(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `oilife-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleClearData = useCallback(async () => {
    if (!confirm('确定要清除所有本地刷题数据？此操作不可撤销。')) return;
    if (!confirm('再次确认：这会清除提交、能力评分、笔记、复习计划和成就。建议先导出 JSON。')) return;
    await Promise.all([
      db.submissions.clear(),
      db.problems.clear(),
      db.skillProfiles.clear(),
      db.achievements.clear(),
      db.notes.clear(),
      db.reviews.clear(),
    ]);
    alert('数据已清除。');
  }, []);

  const handleDisconnect = useCallback(async () => {
    await clearAuth();
    setCloudStatus({ connected: false });
  }, []);

  const handleGhDisconnect = useCallback(async () => {
    await setGithubConfig({ repo: '', token: '', enabled: false });
    setGhRepo('');
    setGhToken('');
    setGhConnected(false);
    setGhStatus(null);
  }, []);

  const compName = COMPETITIONS.find((c) => c.id === targetCompId)?.name || '蓝桥杯';

  const tabs = [
    { id: 'settings' as const, label: '设置', icon: Settings },
    { id: 'about' as const, label: '关于', icon: Info },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-sans">
      <header className="border-b border-[var(--color-border-muted)] bg-[var(--color-bg-elevated)]/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-primary)]">OI Life</h1>
            <p className="text-[11px] text-[var(--color-text-muted)]">扩展设置</p>
          </div>
          <a href="http://localhost:5174/dashboard" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs rounded-lg hover:opacity-90 transition-opacity">
            <ExternalLink className="w-3 h-3" />打开 Web Console
          </a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 flex gap-6">
        <nav className="w-36 shrink-0 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`nav-item w-full ${activeTab === tab.id ? 'active' : ''}`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </nav>

        <main className="flex-1 min-w-0">
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Target Competition */}
              <div className="card">
                <h2 className="text-sm font-semibold mb-3">目标比赛</h2>
                <div className="flex gap-2 flex-wrap">
                  {COMPETITIONS.map((comp) => (
                    <button key={comp.id} onClick={() => handleCompChange(comp.id)}
                      className={`comp-tab ${targetCompId === comp.id ? 'active' : ''}`}>
                      {comp.name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-2">当前: {compName}</p>
              </div>

              {/* Cloud Connection */}
              <div className="card">
                <h2 className="text-sm font-semibold mb-3">云端连接</h2>
                {cloudStatus.connected ? (
                  <div>
                    <p className="text-xs text-green-600 mb-2">✅ 已连接到 OI Life</p>
                    <button onClick={handleDisconnect}
                      className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                      断开连接
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">未连接。在 Web Console 注册后，在 Popup 中点击同步按钮即可连接。</p>
                    <a href="http://localhost:5174/register" target="_blank" rel="noreferrer"
                      className="inline-block px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs rounded-lg hover:opacity-90">
                      注册 OI Life
                    </a>
                  </div>
                )}
              </div>

              {/* GitHub Sync */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4" />
                    GitHub 同步
                  </h2>
                  {ghConnected ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                      <Check className="w-3 h-3" />已连接
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                      <AlertCircle className="w-3 h-3" />未配置
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
                  AC（通过）后自动将代码和笔记同步到 GitHub 仓库。
                  文件结构：<code className="text-[10px] bg-[var(--color-bg-overlay)] px-1 py-0.5 rounded">leetcode/&lt;题目slug&gt;/solution_时间戳.ext</code>
                </p>

                {/* 配置指南 */}
                <button
                  onClick={() => setGhGuideOpen(!ghGuideOpen)}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-3 transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${ghGuideOpen ? 'rotate-180' : ''}`} />
                  配置步骤指南
                </button>

                {ghGuideOpen && (
                  <div className="space-y-3 mb-4 p-3 bg-[var(--color-bg-overlay)] rounded-lg border border-[var(--color-border-muted)]">
                    {/* Step 1: 创建仓库 */}
                    <div className="flex gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[11px] font-bold flex items-center justify-center mt-0.5">1</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">创建目标仓库</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          在 GitHub 新建一个仓库（公开或私有均可），用于存放同步的解题代码。
                        </p>
                        <a href="https://github.com/new" target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-info)] hover:underline mt-1.5">
                          <ExternalLink className="w-3 h-3" />去创建仓库
                        </a>
                      </div>
                    </div>

                    {/* Step 2: 创建 Token */}
                    <div className="flex gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[11px] font-bold flex items-center justify-center mt-0.5">2</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">创建 Personal Access Token</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          前往 GitHub Settings → Developer settings → Personal access tokens → <strong>Fine-grained tokens</strong>（推荐）
                        </p>
                        <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-info)] hover:underline mt-1.5">
                          <ExternalLink className="w-3 h-3" />去创建 Token（Fine-grained）
                        </a>

                        <div className="mt-2 p-2 bg-[var(--color-bg-base)] rounded border border-[var(--color-border-muted)] space-y-1.5">
                          <p className="text-[10px] font-medium text-[var(--color-text-primary)]">需要设置的权限：</p>
                          <div className="space-y-1">
                            <label className="flex items-start gap-1.5 text-[10px] text-[var(--color-text-muted)] cursor-default">
                              <input type="checkbox" checked readOnly className="mt-0.5 accent-[#2EA043]" />
                              <span><strong>Contents</strong>: Read and write — 用于创建/更新代码文件</span>
                            </label>
                            <label className="flex items-start gap-1.5 text-[10px] text-[var(--color-text-muted)] cursor-default">
                              <input type="checkbox" checked readOnly className="mt-0.5 accent-[#2EA043]" />
                              <span><strong>Repository access</strong>: Only select repositories → 选择你的目标仓库</span>
                            </label>
                          </div>
                        </div>

                        <div className="mt-2 flex items-start gap-1.5 p-2 bg-yellow-500/5 border border-yellow-500/15 rounded">
                          <AlertCircle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-yellow-600 dark:text-yellow-400">
                            如果使用 <strong>Classic token</strong>，需要勾选 <strong>repo</strong> 完整作用域。
                            如果是私有仓库或组织仓库，请确认 Token 已授权访问对应仓库。
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: 填写并测试 */}
                    <div className="flex gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[11px] font-bold flex items-center justify-center mt-0.5">3</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">填写信息并测试连接</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          仓库名格式为 <code className="text-[10px] bg-[var(--color-bg-overlay)] px-1 rounded">用户名/仓库名</code>，例如 chen070808/leetcode-solutions。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 表单 */}
                <div className="space-y-2.5">
                  <div>
                    <input
                      type="text"
                      placeholder="仓库名 (如 username/leetcode-solutions)"
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-default)] rounded-lg text-xs focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="github_pat_..."
                      value={ghToken}
                      onChange={(e) => setGhToken(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-default)] rounded-lg text-xs focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={handleGhSave}
                      disabled={ghTesting}
                      className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {ghTesting ? '测试中...' : '保存并测试'}
                    </button>
                    {ghStatus && (
                      <span className={`text-xs ${ghStatus.ok ? 'text-green-500' : 'text-red-500'}`}>
                        {ghStatus.ok ? '连接成功' : ghStatus.msg}
                      </span>
                    )}
                  </div>
                  {ghConnected && !ghStatus && (
                    <p className="text-[10px] text-green-600">上次验证通过，同步功能正常工作中。</p>
                  )}
                </div>

                {ghConnected && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border-muted)]">
                    <button
                      onClick={handleGhDisconnect}
                      className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      断开 GitHub 连接
                    </button>
                  </div>
                )}
              </div>

              {/* Data Management */}
              <div className="card">
                <h2 className="text-sm font-semibold mb-3">数据管理</h2>
                <div className="flex gap-2">
                  <button onClick={handleExport}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border-default)] hover:bg-[var(--color-bg-overlay)]">
                    <Download className="w-3 h-3" />导出 JSON
                  </button>
                  <button onClick={handleClearData}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />清除数据
                  </button>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" />所有数据仅存储在本地浏览器，不会自动上传。
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="card">
                <h2 className="text-sm font-semibold mb-2">OI Life</h2>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">自动追踪算法刷题能力，把提交记录转成 Elo、热力图、知识点弱项和下一步训练建议。</p>
                <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                  <p>版本: 1.0.0</p>
                  <p>支持的平台: LeetCode CN, LeetCode, 牛客网, 洛谷</p>
                </div>
              </div>
              <div className="card space-y-2">
                <a href="http://localhost:5174/dashboard" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-[var(--color-info)] hover:underline">
                  <ExternalLink className="w-4 h-4" />OI Life Web Console
                </a>
                <a href="https://github.com/chen070808/algo-tracker" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-[var(--color-info)] hover:underline">
                  <ExternalLink className="w-4 h-4" />GitHub 开源仓库
                </a>
                <a href="https://github.com/chen070808/knowledge-graph" target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-[var(--color-info)] hover:underline">
                  <ExternalLink className="w-4 h-4" />知识图谱 (CC BY-SA 4.0)
                </a>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<OptionsApp />);
