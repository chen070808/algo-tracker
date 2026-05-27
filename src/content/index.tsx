/// <reference types="chrome"/>
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { CheckCircle2, XCircle, X, Edit3 } from 'lucide-react';
import '../popup/index.css';

console.log('[AlgoTracker] Content script loaded at:', window.location.href);

// ── 注入 MAIN world 检测脚本 ──
// 通过 <script> 标签注入，使得脚本能访问页面的 Monaco/CodeMirror 编辑器、
// MutationObserver、History API 等，从而用 DOM + API 方式检测提交结果

function detectPlatform(): 'leetcode' | 'nowcoder' | 'luogu' | null {
  const host = window.location.host;
  if (host.includes('leetcode')) return 'leetcode';
  if (host.includes('nowcoder')) return 'nowcoder';
  if (host.includes('luogu.com.cn')) return 'luogu';
  return null;
}

function getInjectScript(): string {
  switch (detectPlatform()) {
    case 'nowcoder':
      return 'src/content/nowcoder_inject.js';
    case 'luogu':
      return 'src/content/luogu_inject.js';
    default:
      return 'src/content/inject.js';
  }
}

function injectInterceptor() {
  const platform = detectPlatform();
  console.log('[AlgoTracker] 检测到平台:', platform);
  if (document.getElementById('algo-tracker-interceptor')) return;
  const script = document.createElement('script');
  script.id = 'algo-tracker-interceptor';
  script.src = chrome.runtime.getURL(getInjectScript());
  script.onload = function () {
    console.log('[AlgoTracker] MAIN world 检测脚本注入完成:', platform);
  };
  script.onerror = function () {
    console.error('[AlgoTracker] MAIN world 检测脚本注入失败！', platform);
  };
  (document.head || document.documentElement).appendChild(script);
}

injectInterceptor();

// ── 类型定义 ──

interface LeetCodeSubmission {
  id: string;
  status_display: string;
  lang: string;
  runtime: string;
  memory: string;
  titleSlug: string;
  code?: string;
  difficulty?: number;
  tags?: { slug: string; name: string }[];
}

// ── 安全调用 background（处理扩展重载后 context 失效的情况）──

function sendToBackground(type: string, payload: unknown) {
  // 扩展 context 失效时（比如扩展被重载），chrome.runtime.id 为 undefined
  if (!chrome?.runtime?.id) return Promise.resolve();
  return chrome.runtime.sendMessage({ type, payload });
}

// ── 抽屉 UI 组件 ──

const MISTAKE_TAGS = [
  '思路卡壳',
  '边界遗漏',
  '粗心大意',
  '算法未掌握',
  '超时',
  '空间超限',
  '暂不清楚',
];

function Drawer({
  submission,
  forceOpen,
}: {
  submission: LeetCodeSubmission | null;
  forceOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState('');
  const [mistakeTags, setMistakeTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const isAC = submission?.status_display === 'Accepted';

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [submission, forceOpen]);

  // 保存成功后 1.5s 自动关闭
  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => {
        setIsOpen(false);
        sessionStorage.removeItem('algoTracker_pendingSubmission');
        setSaved(false);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const toggleTag = (tag: string) => {
    setMistakeTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (submission) {
      const plat = detectPlatform() || 'leetcode-cn';
      sendToBackground('SAVE_SUBMISSION', { submission, note, mistakeTags, platform: plat });
    }
    setSaved(true);
  };

  const handleDismiss = () => {
    // 自动保存已在检测到提交时完成，此处仅关闭抽屉
    setIsOpen(false);
    sessionStorage.removeItem('algoTracker_pendingSubmission');
  };

  const verdictColor = isAC ? 'text-[#2EA043]' : 'text-[#F85149]';
  const verdictIcon = isAC ? <CheckCircle2 className="w-5 h-5 text-[#2EA043]" /> : <XCircle className="w-5 h-5 text-[#F85149]" />;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-[#2EA043] text-white px-5 py-3 rounded-full shadow-lg z-[9999] hover:bg-green-600 transition-all flex items-center gap-2 font-medium hover:scale-105 active:scale-95"
      >
        <Edit3 className="w-4 h-4" />
        AlgoTracker 复盘
      </button>
    );
  }

  // 保存成功态
  if (saved) {
    return (
      <div className="fixed top-0 right-0 h-full w-[400px] bg-[#0D1117] border-l border-[#30363D] shadow-2xl z-[9999] p-6 flex flex-col items-center justify-center text-gray-100 font-sans">
        <div className="bg-[#161B22] border border-[#2EA043]/30 p-8 rounded-2xl text-center shadow-xl w-full">
          <CheckCircle2 className="w-16 h-16 text-[#2EA043] mx-auto mb-4" />
          <p className="text-xl font-bold text-white">已保存</p>
          <p className="text-sm text-gray-400 mt-2">
            {mistakeTags.length > 0
              ? '错题已加入复习计划'
              : '提交记录已同步'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 right-0 h-full w-[400px] bg-[#0D1117] border-l border-[#30363D] shadow-2xl z-[9999] p-6 flex flex-col text-gray-100 font-sans overflow-y-auto">
      {/* 标题栏 */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1.5">
            {verdictIcon}
            {isAC ? '通过了！' : '提交复盘'}
          </h2>
          {submission && (
            <div className="flex flex-wrap gap-2 text-xs text-gray-400 mt-2">
              <span className={`font-medium ${verdictColor} bg-current/10 px-2 py-0.5 rounded`}>
                {submission.status_display}
              </span>
              {submission.runtime && <span className="bg-[#161B22] px-2 py-0.5 rounded border border-[#30363D]">{submission.runtime}</span>}
              {submission.memory && <span className="bg-[#161B22] px-2 py-0.5 rounded border border-[#30363D]">{submission.memory}</span>}
            </div>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-white hover:bg-[#30363D] rounded-full w-8 h-8 flex items-center justify-center transition-colors"
          title="关闭"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 错因标签 —— 仅非 AC 时显示 */}
      {!isAC && (
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            错因归类
            <span className="text-gray-600 ml-1">选填，可多选</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {MISTAKE_TAGS.map((tag) => {
              const isUnsure = tag === '暂不清楚';
              return (
                <span
                  key={tag}
                  onClick={() => {
                    if (isUnsure) {
                      // 点"暂不清楚"时清除其他标签
                      setMistakeTags((prev) =>
                        prev.includes('暂不清楚') ? [] : ['暂不清楚']
                      );
                    } else {
                      setMistakeTags((prev) =>
                        prev.filter((t) => t !== '暂不清楚')
                      );
                      toggleTag(tag);
                    }
                  }}
                  className={`px-3 py-1 border rounded-full text-xs cursor-pointer transition-colors ${
                    mistakeTags.includes(tag)
                      ? isUnsure
                        ? 'bg-yellow-600 border-yellow-600 text-white'
                        : 'bg-[#F85149]/30 border-[#F85149] text-[#F85149]'
                      : isUnsure
                        ? 'bg-[#161B22] border-yellow-700 text-yellow-500 hover:border-yellow-600'
                        : 'bg-[#161B22] border-[#30363D] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 笔记 */}
      <div className="flex-1 flex flex-col mb-4 min-h-[180px]">
        <label className="block text-sm text-gray-400 mb-2">
          {isAC ? '思路笔记' : '复盘笔记'}
          <span className="text-gray-600 ml-1">选填</span>
        </label>
        <textarea
          className="flex-1 w-full bg-[#161B22] border border-[#30363D] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#2EA043] resize-none"
          placeholder={
            isAC
              ? '解法思路、关键优化、值得记住的写法...'
              : '哪里卡住了？正确思路是什么？下次怎么避免？'
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* 操作按钮 */}
      <div className="space-y-2">
        <button
          className="w-full bg-[#2EA043] text-white font-bold py-3 rounded-lg hover:bg-green-600 transition-colors"
          onClick={handleSave}
        >
          保存{isAC ? '笔记' : '复盘'}并加入复习计划
        </button>
        {!isAC && (
          <button
            className="w-full bg-transparent border border-[#30363D] text-gray-400 py-2 rounded-lg hover:border-gray-500 hover:text-gray-300 transition-colors text-sm"
            onClick={handleDismiss}
          >
            仅保存记录，暂时跳过复盘
          </button>
        )}
      </div>
    </div>
  );
}

// ── 全局状态 ──

let currentSubmission: LeetCodeSubmission | null = null;
let root: ReactDOM.Root | null = null;
let lastAutoSavedKey = '';

function renderDrawer(forceOpen = false) {
  if (!root) return;
  root.render(
    <React.StrictMode>
      <Drawer submission={currentSubmission} forceOpen={forceOpen} />
    </React.StrictMode>
  );
}

// ── UI 初始化 ──

function initUI() {
  if (document.getElementById('algo-tracker-drawer-root')) return;
  const container = document.createElement('div');
  container.id = 'algo-tracker-drawer-root';
  document.body.appendChild(container);
  root = ReactDOM.createRoot(container);

  // 检查是否有跨页面跳转遗留的提交数据
  const pendingData = sessionStorage.getItem('algoTracker_pendingSubmission');
  if (pendingData) {
    try {
      const parsed = JSON.parse(pendingData);
      console.log(
        '[AlgoTracker] 恢复跨页面遗留的提交数据:',
        parsed
      );
      currentSubmission = parsed;
      renderDrawer(true);
    } catch (e) {
      console.error('[AlgoTracker] 恢复遗留数据失败:', e);
      renderDrawer();
    }
  } else {
    renderDrawer();
  }
}

// SPA 路由跳转后重新挂载 UI
const observer = new MutationObserver(() => {
  if (!document.getElementById('algo-tracker-drawer-root') && document.body) {
    console.log('[AlgoTracker] SPA 路由变化，重建 UI');
    initUI();
  }
});

if (document.body) {
  initUI();
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    initUI();
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// ── 监听来自 MAIN world 的提交消息 ──

window.addEventListener('message', (event) => {
  if (
    event.source !== window ||
    event.origin !== window.location.origin ||
    !event.data
  ) {
    return;
  }

  if (event.data.type === 'ALGOTRACKER_SUBMISSION') {
    handleLeetCodeSubmission(event.data.data);
  } else if (event.data.type === 'ALGOTRACKER_SUBMISSION_LUOGU') {
    handleLuoGuSubmission(event.data.data);
  }
});

function handleLeetCodeSubmission(data: any) {
  console.log('[AlgoTracker] 收到 LeetCode/Nowcoder 提交数据:', data);
  currentSubmission = data;
  persistAndMaybeShow(data, 'leetcode');
}

function handleLuoGuSubmission(data: any) {
  console.log('[AlgoTracker] 收到 LuoGu 提交数据:', data);
  currentSubmission = {
    id: data.id,
    status_display: data.status_display,
    lang: data.lang,
    runtime: data.runtime,
    memory: data.memory,
    titleSlug: data.titleSlug,
    difficulty: data.difficulty || 0,
    tags: data.tags || [],
    code: data.code || '',
  };
  persistAndMaybeShow(data, 'luogu');
}

function persistAndMaybeShow(_data: any, platform: string) {
  if (!currentSubmission) return;
  // 持久化到 sessionStorage，应对 SPA 路由跳转
  sessionStorage.setItem(
    'algoTracker_pendingSubmission',
    JSON.stringify(currentSubmission)
  );

  // 始终自动保存提交记录到 IndexedDB
  saveViaBackground(platform);

  // AC 静默保存，不弹窗；非 AC 弹出复盘抽屉
  if (currentSubmission.status_display !== 'Accepted') {
    renderDrawer(true);
  }
}

function saveViaBackground(platform?: string) {
  if (!currentSubmission) return;
  const dedupKey = `${currentSubmission.titleSlug}::${currentSubmission.status_display}`;
  if (dedupKey === lastAutoSavedKey) {
    console.log('[AlgoTracker] 跳过重复自动保存:', dedupKey);
    return;
  }
  lastAutoSavedKey = dedupKey;
  const plat = platform || 'leetcode-cn';
  sendToBackground('AUTO_SAVE_SUBMISSION', { submission: currentSubmission, platform: plat })
    .then(() => { /* 静默成功 */ })
    .catch(() => { /* context 失效，刷新页面即可恢复 */ });
}
