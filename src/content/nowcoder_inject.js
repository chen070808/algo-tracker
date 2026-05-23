// DOM-based 牛客网 (Nowcoder) submission detection
// Runs in MAIN world — injected via <script> tag from content script

(function () {
  if (window.__algoTrackerNowcoderInjected) return;
  window.__algoTrackerNowcoderInjected = true;
  console.log('[AlgoTracker] 牛客网 DOM 检测引擎启动');

  const RESULT_SELECTORS = [
    '[data-cy="result-status"]',
    '.result-status',
    '.compile-result',
    '.testcase-result',
    '[class*="result"]',
  ];

  const ACCEPTED_PATTERN = /^(Accepted|通过|答案正确|accepted)$/i;
  const WRONG_PATTERN = /^(Wrong Answer|答案错误|解答错误|wrong answer)$/i;
  const TLE_PATTERN = /^(Time Limit Exceeded|超时|运行超时|time limit exceeded)$/i;
  const CE_PATTERN = /^(Compile Error|编译错误|compile error)$/i;
  const RE_PATTERN = /^(Runtime Error|运行错误|段错误|runtime error)$/i;
  const MLE_PATTERN = /^(Memory Limit Exceeded|内存超限|memory limit exceeded)$/i;
  const ALL_RESULT_PATTERN =
    /Accepted|通过|答案正确|Wrong Answer|答案错误|解答错误|Time Limit Exceeded|超时|运行超时|Compile Error|编译错误|Runtime Error|运行错误|段错误|Memory Limit Exceeded|内存超限/i;

  function findResultElement() {
    for (const selector of RESULT_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && isSubmissionResultText(el.textContent || '')) return el;
      } catch (_) {}
    }
    // Fallback: text content scan in result panels
    const panels = document.querySelectorAll('[class*="result"], .test-result, .compile-info');
    for (const panel of panels) {
      if (isSubmissionResultText(panel.textContent || '')) return panel;
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

  function getCodeFromEditor() {
    try {
      // Nowcoder uses CodeMirror or Monaco
      const cm = document.querySelector('.CodeMirror');
      if (cm && cm.CodeMirror) return cm.CodeMirror.getValue();
    } catch (_) {}
    try {
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        for (let i = models.length - 1; i >= 0; i--) {
          const v = models[i].getValue();
          if (v && v.trim().length > 0) return v;
        }
      }
    } catch (_) {}
    return '';
  }

  function getLanguage() {
    try {
      const sel = document.querySelector('.language-select, [class*="lang"] .selected, .selected-lang');
      if (sel) return (sel.textContent || '').trim();
    } catch (_) {}
    // Check CodeMirror mode
    try {
      const cm = document.querySelector('.CodeMirror');
      if (cm?.CodeMirror) {
        const mode = cm.CodeMirror.getOption('mode');
        if (mode) return typeof mode === 'string' ? mode : mode.name || '';
      }
    } catch (_) {}
    return '';
  }

  const DIFFICULTY_MAP = {
    '简单': 1200, '入门': 1200, 'Easy': 1200,
    '中等': 1600, 'Medium': 1600,
    '较难': 2000, '困难': 2000, 'Hard': 2000,
  };

  function extractDifficulty() {
    try {
      const els = document.querySelectorAll('span, div, .difficulty, [class*="difficulty"]');
      for (const el of els) {
        const text = (el.textContent || '').trim();
        if (text in DIFFICULTY_MAP) return DIFFICULTY_MAP[text];
      }
    } catch (_) {}
    return 1500;
  }

  function extractTags() {
    const tags = [];
    const seen = new Set();
    try {
      const tagEls = document.querySelectorAll('.tag-item, .topic-tag, [class*="tag"]');
      for (const el of tagEls) {
        const text = (el.textContent || '').trim();
        if (text && text.length < 20 && !seen.has(text)) {
          seen.add(text);
          tags.push({ slug: text, name: text });
        }
      }
    } catch (_) {}
    return tags;
  }

  function getIdentity() {
    // Nowcoder URL patterns:
    // /practice/xxx (problem page)
    // /question/xxx (another pattern)
    const m = window.location.pathname.match(/\/(?:practice|question)\/([^\/?#]+)/i);
    // Try to find submission ID from the page
    const subIdEl = document.querySelector('[class*="submission-id"], .submit-id');
    const subId = subIdEl ? (subIdEl.textContent || '').trim() : '';
    return {
      slug: m ? m[1] : '',
      submissionId: subId,
    };
  }

  // Deduplication
  const processedKeys = {};
  const DEDUP_WINDOW_MS = 60000;
  const DEDUP_STORAGE_PREFIX = '__at_nc_dedup_';

  function isDuplicate(slug, verdict) {
    const key = slug + '::' + verdict;
    const ts = processedKeys[key];
    if (ts && Date.now() - ts < DEDUP_WINDOW_MS) return true;
    if (sessionStorage.getItem(DEDUP_STORAGE_PREFIX + key)) return true;
    for (const k of Object.keys(processedKeys)) {
      if (Date.now() - processedKeys[k] > DEDUP_WINDOW_MS) delete processedKeys[k];
    }
    return false;
  }

  function markProcessed(slug, verdict) {
    const key = slug + '::' + verdict;
    processedKeys[key] = Date.now();
    sessionStorage.setItem(DEDUP_STORAGE_PREFIX + key, '1');
    const keys = Object.keys(processedKeys);
    if (keys.length > 50) {
      for (let i = 0; i < 25; i++) delete processedKeys[keys[i]];
    }
  }

  function clearDedupCache(slug) {
    const prefix = slug ? DEDUP_STORAGE_PREFIX + slug + '::' : '';
    for (const k of Object.keys(processedKeys)) {
      if (!slug || k.startsWith(slug + '::')) delete processedKeys[k];
    }
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith(DEDUP_STORAGE_PREFIX) && (!slug || k.startsWith(prefix))) {
        sessionStorage.removeItem(k);
      }
    }
  }

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

      const code = getCodeFromEditor();
      const lang = getLanguage();
      const difficulty = extractDifficulty();
      const tags = extractTags();

      console.log(
        '[AlgoTracker/牛客] 检测到提交结果 (' + source + '):',
        verdict, '| slug:', slug, '| lang:', lang,
        '| difficulty:', difficulty, '| tags:', tags
      );

      window.postMessage(
        {
          type: 'ALGOTRACKER_NOWCODER_SUBMISSION',
          data: {
            id: submissionId,
            status_display: verdict,
            lang: lang,
            runtime: '',
            memory: '',
            titleSlug: slug,
            code: code,
            difficulty: difficulty,
            tags: tags,
          },
        },
        '*'
      );
    } catch (e) {
      console.error('[AlgoTracker/牛客] detectAndDispatch 出错:', e);
    } finally {
      setTimeout(() => { detectionLock = false; }, 3000);
    }
  }

  // MutationObserver
  let mutationTimer = null;
  const observer = new MutationObserver(function (mutations) {
    const hasRelevantChange = mutations.some(function (m) {
      return m.addedNodes.length > 0 || m.type === 'characterData';
    });
    if (!hasRelevantChange) return;
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

  // Polling fallback
  let pollTimer = null;
  let pollCount = 0;
  const MAX_POLL = 45;
  const POLL_MS = 1000;

  function startPolling() {
    if (pollTimer) return;
    pollCount = 0;
    console.log('[AlgoTracker/牛客] 开始轮询提交结果...');
    pollTimer = setInterval(function () {
      pollCount++;
      detectAndDispatch('poll');
      if (pollCount >= MAX_POLL) {
        stopPolling();
        console.log('[AlgoTracker/牛客] 轮询超时，停止');
      }
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Submit button listener
  function isSubmitButton(el) {
    return (
      el.tagName === 'BUTTON' &&
      /^(Submit|提交|提交代码|运行并提交|提交运行|Run|运行)$/i.test(
        (el.textContent || '').trim()
      )
    );
  }

  document.addEventListener('click', function (e) {
    try {
      const target = e.target;
      const candidates = [target, target.parentElement, target.parentElement?.parentElement];
      for (const el of candidates) {
        if (el && isSubmitButton(el)) {
          console.log('[AlgoTracker/牛客] 检测到 Submit 按钮点击');
          clearDedupCache(getIdentity().slug);
          startPolling();
          return;
        }
      }
    } catch (_) {}
  }, true);

  // Keyboard shortcut
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      console.log('[AlgoTracker/牛客] 检测到键盘快捷键提交');
      clearDedupCache(getIdentity().slug);
      startPolling();
    }
  }, true);

  function init() {
    startObserver();
    if (document.readyState === 'complete') {
      if (window.location.pathname.includes('/practice/') || window.location.pathname.includes('/question/')) {
        const hasResult = findResultElement();
        if (hasResult) {
          setTimeout(function () { detectAndDispatch('init'); }, 800);
        }
      }
    }
    console.log('[AlgoTracker/牛客] DOM 检测引擎就绪');
  }

  init();
})();
