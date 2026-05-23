import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { COMPETITIONS } from '../lib/elo';
import { getGithubConfig, setGithubConfig, verifyConnection } from '../lib/github';
import { getSyncConfig, clearAuth } from '../lib/sync';
import { Settings, Info, ExternalLink, Shield, Trash2, Download } from 'lucide-react';
import { db } from '../lib/db';
import '../popup/index.css';

function OptionsApp() {
  const [activeTab, setActiveTab] = useState<'settings' | 'about'>('settings');
  const [targetCompId, setTargetCompId] = useState('lanqiao');
  const [ghRepo, setGhRepo] = useState('');
  const [ghToken, setGhToken] = useState('');
  const [ghStatus, setGhStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [cloudStatus, setCloudStatus] = useState<{ connected: boolean; email?: string; lastSync?: string }>({ connected: false });

  useEffect(() => {
    chrome.storage.local.get(['targetCompetition'], (r) => {
      if (typeof r.targetCompetition === 'string') setTargetCompId(r.targetCompetition);
    });
    getGithubConfig().then((c) => {
      if (c.repo) setGhRepo(c.repo);
      if (c.token) setGhToken(c.token);
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
    await setGithubConfig({ repo: ghRepo, token: ghToken, enabled: true });
    const result = await verifyConnection(ghToken, ghRepo);
    setGhStatus({ ok: result.ok, msg: result.ok ? '连接成功' : result.error });
  }, [ghRepo, ghToken]);

  const handleExport = useCallback(async () => {
    const data = {
      submissions: await db.submissions.toArray(),
      skillProfiles: await db.skillProfiles.toArray(),
      achievements: await db.achievements.toArray(),
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
    await db.submissions.clear();
    await db.skillProfiles.clear();
    await db.achievements.clear();
    await db.notes.clear();
    await db.reviews.clear();
    alert('数据已清除。');
  }, []);

  const handleDisconnect = useCallback(async () => {
    await clearAuth();
    setCloudStatus({ connected: false });
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
                <h2 className="text-sm font-semibold mb-3">GitHub 同步</h2>
                <div className="space-y-3">
                  <input type="text" placeholder="仓库名 (如 username/repo)" value={ghRepo}
                    onChange={(e) => setGhRepo(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-default)] rounded-lg text-xs" />
                  <input type="password" placeholder="Personal Access Token" value={ghToken}
                    onChange={(e) => setGhToken(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-default)] rounded-lg text-xs" />
                  <div className="flex gap-2">
                    <button onClick={handleGhSave}
                      className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs rounded-lg hover:opacity-90">
                      保存并测试
                    </button>
                    {ghStatus && (
                      <span className={`text-xs self-center ${ghStatus.ok ? 'text-green-500' : 'text-red-500'}`}>
                        {ghStatus.msg}
                      </span>
                    )}
                  </div>
                </div>
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
                <p className="text-xs text-[var(--color-text-muted)] mb-3">从入门到 IOI 的 AI 教练。跨平台刷题追踪 + Elo 评分 + 知识图谱 + AI 个性化推荐。</p>
                <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                  <p>版本: 1.0.0</p>
                  <p>支持的平台: LeetCode CN, LeetCode, 牛客网</p>
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
