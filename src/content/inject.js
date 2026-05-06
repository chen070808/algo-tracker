// DOM-based LeetCode submission detection
// Runs in MAIN world — injected via <script> tag from content script
// Uses the same approach as PMCA + CodeNote Helper: detect DOM result elements
// Does NOT intercept fetch/XHR — that interferes with LeetCode's own requests

(function () {
  if (window.__algoTrackerInjected) return;
  window.__algoTrackerInjected = true;
  console.log('[AlgoTracker] MAIN world DOM 检测引擎启动');

  // ============================================================
  // 1. DOM selectors for result elements
  // ============================================================

  const RESULT_SELECTORS = [
    // Stable data attributes (least likely to change)
    '[data-e2e-locator="submission-result"]',
    '[data-testid="submission-result"]',
    // New LeetCode.com + LeetCode.cn UI
    '.text-green-s.dark\\:text-dark-green-s',
    '.text-green-s',
    '.text-red-s.dark\\:text-dark-red-s',
    '.text-red-s',
    // Old LeetCode.com UI (legacy class names)
    '.success__3Ai7',
    '.error__2Ft1',
    '.error__10k9',
  ];

  const ACCEPTED_PATTERN = /^(Accepted|通过)$/i;
  const WRONG_PATTERN = /^(Wrong Answer|解答错误)$/i;
  const TLE_PATTERN = /^(Time Limit Exceeded|超出时间限制|超时)$/i;
  const CE_PATTERN = /^(Compile Error|编译错误)$/i;
  const RE_PATTERN = /^(Runtime Error|运行错误)$/i;
  const MLE_PATTERN = /^(Memory Limit Exceeded|内存超限|内存溢出)$/i;
  const ALL_RESULT_PATTERN =
    /Accepted|通过|Wrong Answer|解答错误|Time Limit Exceeded|超出时间限制|Compile Error|编译错误|Runtime Error|运行错误|Memory Limit Exceeded|内存超限|超时|内存溢出/i;

  // ============================================================
  // 2. Result detection helpers
  // ============================================================

  function findResultElement() {
    for (const selector of RESULT_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && isSubmissionResultText(el.textContent || '')) {
          return el;
        }
      } catch (_) {
        // Invalid selector (some CSS-in-JS classes may break querySelector)
      }
    }
    // Fallback: scan elements that look like result containers
    const candidates = document.querySelectorAll('[class*="text-green"], [class*="text-red"], [class*="success"], [class*="error"]');
    for (const el of candidates) {
      if (isSubmissionResultText(el.textContent || '')) {
        return el;
      }
    }
    return null;
  }

  function isSubmissionResultText(text) {
    return ALL_RESULT_PATTERN.test(text);
  }

  function normalizeVerdict(text) {
    const t = text.trim();
    if (ACCEPTED_PATTERN.test(t)) return 'Accepted';
    if (WRONG_PATTERN.test(t)) return 'Wrong Answer';
    if (TLE_PATTERN.test(t)) return 'Time Limit Exceeded';
    if (CE_PATTERN.test(t)) return 'Compile Error';
    if (RE_PATTERN.test(t)) return 'Runtime Error';
    if (MLE_PATTERN.test(t)) return 'Memory Limit Exceeded';
    return t;
  }

  // ============================================================
  // 3. Monaco code + language extraction
  // ============================================================

  function getMonacoCode() {
    try {
      const m = window.monaco;
      if (!m || !m.editor) return '';
      const models = m.editor.getModels();
      if (!models) return '';
      for (let i = models.length - 1; i >= 0; i--) {
        const v = models[i].getValue();
        if (v && v.trim().length > 0) return v;
      }
    } catch (_) {}
    // Fallback: try CodeMirror (older LeetCode UI)
    try {
      const cm = document.querySelector('.CodeMirror');
      if (cm && cm.CodeMirror) {
        return cm.CodeMirror.getValue();
      }
    } catch (_) {}
    // Last resort: try to read from the editor textarea
    const ta = document.querySelector('.monaco-editor textarea, .inputarea');
    if (ta && ta.value) return ta.value;
    return '';
  }

  function getCodeLanguage() {
    try {
      // Monaco editor model name (most reliable)
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
          const langId = models[models.length - 1].getLanguageId();
          if (langId) return langId;
        }
      }
    } catch (_) {}
    try {
      // LeetCode CN language selector button
      const sel = document.querySelector('[data-cy="lang-select"]');
      if (sel) return sel.textContent.trim();
    } catch (_) {}
    try {
      // Alternative: look for the language text near the editor
      const sel = document.querySelector('.ant-select-selection-item');
      if (sel) return sel.textContent.trim();
    } catch (_) {}
    try {
      // LeetCode new UI: language shown in a small button above editor
      const sel = document.querySelector('button.rounded.px-2.py-1.text-xs');
      if (sel) return sel.textContent.trim();
    } catch (_) {}
    return '';
  }

  function extractRuntimeMemory(resultEl) {
    let runtime = '';
    let memory = '';
    try {
      // Start from the result element, walk up to find the result panel
      let container = resultEl;
      for (let i = 0; i < 5; i++) {
        if (container.parentElement) container = container.parentElement;
      }
      // Search ONLY within the result panel, and only short text (real runtime/memory is < 20 chars)
      const candidates = container.querySelectorAll('span, div');
      for (const el of candidates) {
        const text = (el.textContent || '').trim();
        if (text.length > 20) continue; // Skip long text (page scripts, descriptions)
        if (!runtime && /^\d+\s*ms$/i.test(text)) {
          runtime = text;
        }
        if (!memory && /^\d+\.?\d*\s*MB$/i.test(text)) {
          memory = text;
        }
        if (runtime && memory) break;
      }
    } catch (_) {}
    return { runtime, memory };
  }

  // ============================================================
  // 4. Submission identity (slug + id)
  // ============================================================

  function getIdentity() {
    const m = window.location.pathname.match(/\/problems\/([^\/?#]+)(?:\/submissions\/(\d+))?/i);
    return {
      slug: m ? m[1] : '',
      submissionId: m && m[2] ? m[2] : '',
    };
  }

  // ============================================================
  // 5. Deduplication
  // ============================================================

  const processedKeys = {}; // key → timestamp
  const DEDUP_WINDOW_MS = 60000;
  const DEDUP_STORAGE_PREFIX = '__at_dedup_';

  function getDedupKey(slug, verdict) {
    return slug + '::' + verdict;
  }

  function isDuplicate(slug, verdict) {
    const key = getDedupKey(slug, verdict);
    // Check in-memory cache
    const ts = processedKeys[key];
    if (ts && Date.now() - ts < DEDUP_WINDOW_MS) return true;
    // Check sessionStorage (survives tab switches)
    if (sessionStorage.getItem(DEDUP_STORAGE_PREFIX + key)) return true;
    // Clean stale in-memory entries
    for (const k of Object.keys(processedKeys)) {
      if (Date.now() - processedKeys[k] > DEDUP_WINDOW_MS) delete processedKeys[k];
    }
    return false;
  }

  function markProcessed(slug, verdict) {
    const key = getDedupKey(slug, verdict);
    processedKeys[key] = Date.now();
    sessionStorage.setItem(DEDUP_STORAGE_PREFIX + key, '1');
    // Keep object bounded
    const keys = Object.keys(processedKeys);
    if (keys.length > 50) {
      for (let i = 0; i < 25; i++) delete processedKeys[keys[i]];
    }
  }

  function clearDedupCache() {
    // Clear in-memory
    for (const k of Object.keys(processedKeys)) {
      delete processedKeys[k];
    }
    // Clear sessionStorage dedup entries
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith(DEDUP_STORAGE_PREFIX)) sessionStorage.removeItem(k);
    }
  }

  // ============================================================
  // 6. Main detection + dispatch
  // ============================================================

  let detectionLock = false;

  function detectAndDispatch(source) {
    if (detectionLock) return;
    detectionLock = true;

    try {
      const resultEl = findResultElement();
      if (!resultEl) { detectionLock = false; return; }

      const rawText = (resultEl.textContent || '').trim();
      const verdict = normalizeVerdict(rawText);
      const { slug, submissionId } = getIdentity();

      if (!slug) { detectionLock = false; return; }
      if (!verdict) { detectionLock = false; return; }
      if (isDuplicate(slug, verdict)) { detectionLock = false; return; }

      markProcessed(slug, verdict);
      stopPolling();

      const code = getMonacoCode();
      const lang = getCodeLanguage();
      const { runtime, memory } = extractRuntimeMemory(resultEl);

      console.log(
        '[AlgoTracker] 检测到提交结果 (' + source + '):',
        verdict, '| slug:', slug, '| lang:', lang,
        '| runtime:', runtime, '| memory:', memory,
        '| code length:', code.length
      );

      window.postMessage(
        {
          type: 'ALGOTRACKER_SUBMISSION',
          data: {
            id: submissionId,
            status_display: verdict,
            lang: lang,
            runtime: runtime,
            memory: memory,
            titleSlug: slug,
            code: code,
          },
        },
        '*'
      );
    } catch (e) {
      console.error('[AlgoTracker] detectAndDispatch 出错:', e);
    } finally {
      // Keep lock for 3 seconds to prevent re-triggers
      setTimeout(() => { detectionLock = false; }, 3000);
    }
  }

  // ============================================================
  // 7. MutationObserver (always-on, lightweight)
  // ============================================================

  let mutationTimer = null;

  const observer = new MutationObserver(function (mutations) {
    // Skip if mutations are only from our own elements
    const hasRelevantChange = mutations.some(function (m) {
      return m.addedNodes.length > 0 || m.type === 'characterData';
    });
    if (!hasRelevantChange) return;

    // Debounce: check at most once per 300ms from mutations
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(function () {
      detectAndDispatch('mutation');
    }, 300);
  });

  function startObserver() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // ============================================================
  // 8. Polling fallback (triggers on submit click, runs temporarily)
  // ============================================================

  let pollTimer = null;
  let pollCount = 0;
  const MAX_POLL = 45; // 45 seconds max
  const POLL_MS = 1000;

  function startPolling() {
    if (pollTimer) return;
    pollCount = 0;
    console.log('[AlgoTracker] 开始轮询提交结果...');
    pollTimer = setInterval(function () {
      pollCount++;
      detectAndDispatch('poll');
      if (pollCount >= MAX_POLL) {
        stopPolling();
        console.log('[AlgoTracker] 轮询超时，停止');
      }
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ============================================================
  // 9. Submit button click listener
  // ============================================================

  function isSubmitButton(el) {
    return (
      el.getAttribute('data-e2e-locator') === 'console-submit-button' ||
      (el.tagName === 'BUTTON' &&
        /^(Submit|提交|提交代码|Run Code|执行代码)$/i.test(
          (el.textContent || '').trim()
        ))
    );
  }

  document.addEventListener(
    'click',
    function (e) {
      try {
        const target = e.target;
        // Check element + up to 3 ancestor levels (PMCA pattern)
        const candidates = [
          target,
          target.parentElement,
          target.parentElement && target.parentElement.parentElement,
          target.parentElement &&
            target.parentElement.parentElement &&
            target.parentElement.parentElement.parentElement,
        ];
        for (const el of candidates) {
          if (el && isSubmitButton(el)) {
            console.log('[AlgoTracker] 检测到 Submit 按钮点击');
            // Clear previous dedup cache so re-submission of same problem works
            clearDedupCache();
            // Start polling (result will appear after judge queue)
            startPolling();
            return;
          }
        }
      } catch (_) {}
    },
    true
  ); // capture phase

  // ============================================================
  // 10. Keyboard shortcut listener (Cmd+Enter / Ctrl+Enter)
  // ============================================================

  document.addEventListener(
    'keydown',
    function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        console.log('[AlgoTracker] 检测到键盘快捷键提交');
        clearDedupCache();
        startPolling();
      }
    },
    true
  );

  // ============================================================
  // 11. History API patching (SPA navigation fallback)
  // ============================================================

  const _pushState = history.pushState;
  const _replaceState = history.replaceState;

  history.pushState = function () {
    const r = _pushState.apply(this, arguments);
    window.dispatchEvent(new Event('_at_history_change'));
    return r;
  };

  history.replaceState = function () {
    const r = _replaceState.apply(this, arguments);
    window.dispatchEvent(new Event('_at_history_change'));
    return r;
  };

  window.addEventListener('_at_history_change', function () {
    setTimeout(function () {
      detectAndDispatch('history');
    }, 600);
  });

  window.addEventListener('popstate', function () {
    setTimeout(function () {
      detectAndDispatch('popstate');
    }, 600);
  });

  // ============================================================
  // 12. Initialization
  // ============================================================

  function init() {
    startObserver();

    // Handle direct navigation to submission detail page
    if (document.readyState === 'complete') {
      if (window.location.pathname.includes('/submissions/')) {
        setTimeout(function () {
          detectAndDispatch('init');
        }, 800);
      }
    } else {
      window.addEventListener('load', function () {
        if (window.location.pathname.includes('/submissions/')) {
          setTimeout(function () {
            detectAndDispatch('init');
          }, 800);
        }
      });
    }

    console.log('[AlgoTracker] DOM 检测引擎就绪');
  }

  init();
})();
