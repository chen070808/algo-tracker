// DOM + API-based LuoGu submission detection
// Runs in MAIN world — injected via <script> tag from content script
// Approach: intercept record page API response for reliability, DOM polling as fallback
//
// LuoGu flow: problem page → submit → redirect to /record/{id} → result appears
// Key insight: /record/{id}?_contentOnly=1 returns JSON with full submission data

(function () {
  if (window.__algoTrackerLuoguInjected) return;
  window.__algoTrackerLuoguInjected = true;
  console.log('[AlgoTracker] LuoGu MAIN world 检测引擎启动');

  var RECORD_URL_RE = /^https:\/\/www\.luogu\.com\.cn\/record\/(\d+)/;
  var PROBLEM_URL_RE = /^https:\/\/www\.luogu\.com\.cn\/problem\/(\w+)/;

  // ============================================================
  // 1. Cache code from problem page editor (before redirect)
  // ============================================================

  function captureEditorCode() {
    // Method 1: CodeMirror 6 (LuoGu's current editor)
    try {
      var cmContent = document.querySelector('.cm-content');
      if (cmContent) {
        var lines = cmContent.querySelectorAll('.cm-line');
        if (lines.length > 0) {
          var parts = [];
          for (var i = 0; i < lines.length; i++) {
            parts.push(lines[i].textContent || '');
          }
          return parts.join('\n');
        }
      }
    } catch (_) { /* ignore */ }

    // Method 2: CodeMirror 5 / older editor
    try {
      var cm = document.querySelector('.CodeMirror');
      if (cm && cm.CodeMirror) {
        return cm.CodeMirror.getValue();
      }
    } catch (_) { /* ignore */ }

    // Method 3: Monaco editor (less common on LuoGu)
    try {
      if (window.monaco && window.monaco.editor && window.monaco.editor.getModels) {
        var models = window.monaco.editor.getModels();
        if (models.length > 0) {
          return models[0].getValue();
        }
      }
    } catch (_) { /* ignore */ }

    // Method 4: Plain textarea
    var textarea = document.querySelector('textarea.code-editor, textarea[class*="code"]');
    if (textarea) return textarea.value;

    return '';
  }

  function detectLanguage() {
    var langEl = document.querySelector('.current-lang, [class*="lang-"] span');
    if (langEl) {
      var text = (langEl.textContent || '').trim();
      if (text) return text;
    }
    try {
      var cm2 = document.querySelector('.CodeMirror');
      if (cm2 && cm2.CodeMirror) {
        var mode = cm2.CodeMirror.getMode().name;
        var modeMap = {
          'text/x-c++src': 'C++',
          'text/x-csrc': 'C',
          'text/x-java': 'Java',
          'python': 'Python3',
        };
        return modeMap[mode] || mode;
      }
    } catch (_) { /* ignore */ }
    return '';
  }

  // ============================================================
  // 2. Record page: intercept API JSON response
  // ============================================================

  var recordData = null;

  // Intercept fetch for _contentOnly=1 requests
  var origFetch = window.fetch;
  window.fetch = function () {
    var args = arguments;
    var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    if (RECORD_URL_RE.test(url) && url.indexOf('_contentOnly') !== -1) {
      return origFetch.apply(this, args).then(function (resp) {
        var clone = resp.clone();
        clone.json().then(function (json) {
          recordData = json;
          console.log('[AlgoTracker] 拦截到 LuoGu record API 响应');
          processRecordData(json);
        }).catch(function () { /* not JSON */ });
        return resp;
      });
    }
    return origFetch.apply(this, args);
  };

  // Intercept XHR for _contentOnly requests
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    var method = arguments[0];
    var url = typeof arguments[1] === 'string' ? arguments[1] : arguments[1].toString();
    var rest = Array.prototype.slice.call(arguments, 2);
    if (RECORD_URL_RE.test(url) && url.indexOf('_contentOnly') !== -1) {
      this.addEventListener('load', function () {
        try {
          var json = JSON.parse(this.responseText);
          recordData = json;
          console.log('[AlgoTracker] 拦截到 LuoGu record XHR 响应');
          processRecordData(json);
        } catch (_) { /* not JSON */ }
      });
    }
    return origOpen.call(this, method, url, rest[0], rest[1], rest[2]);
  };

  function processRecordData(data) {
    var record = (data && data.currentData && data.currentData.record) || (data && data.record) || data;
    if (!record || !record.status) return;

    var verdict = normalizeLuoguVerdict(record.status);
    if (!verdict) return;

    var runtime = record.time !== undefined ? record.time + 'ms' : '';
    var memory = record.memory !== undefined ? (record.memory / 1024).toFixed(0) + 'MB' : '';
    var problemId = (record.problem && record.problem.pid) || '';
    var lang = detectLanguage() || '';

    var cached = getCachedSubmission(problemId);
    var code = (cached && cached.code) || record.sourceCode || '';

    var tags = (record.problem && record.problem.tags) || [];
    var mappedTags = [];
    for (var ti = 0; ti < tags.length; ti++) {
      var t = tags[ti];
      mappedTags.push({
        slug: String(t.id || t),
        name: typeof t === 'string' ? t : (t.name || String(t.id || t)),
      });
    }

    var submission = {
      id: String(record.id || ''),
      status_display: verdict,
      lang: lang || 'C++',
      runtime: runtime,
      memory: memory,
      titleSlug: problemId,
      difficulty: mapLuoguDifficulty(record.problem && record.problem.difficulty),
      tags: mappedTags,
      code: code,
    };

    // Dedup
    var dedupKey = 'luogu_' + problemId + '_' + verdict + '_' + record.id;
    var recent = sessionStorage.getItem('algoTracker_luogu_lastSent');
    if (recent === dedupKey) {
      console.log('[AlgoTracker] LuoGu 去重拦截:', dedupKey);
      return;
    }
    sessionStorage.setItem('algoTracker_luogu_lastSent', dedupKey);
    sessionStorage.removeItem('algoTracker_luogu_pendingCode');
    sessionStorage.removeItem('algoTracker_luogu_pendingPid');

    console.log('[AlgoTracker] LuoGu 提交数据:', submission);
    window.postMessage(
      { type: 'ALGOTRACKER_SUBMISSION_LUOGU', data: submission },
      window.location.origin
    );
  }

  // ============================================================
  // 3. Fallback: DOM polling (when API interception fails)
  // ============================================================

  var domPollTimer = null;

  function startDomPolling() {
    if (domPollTimer) return;
    var lastStatus = '';
    domPollTimer = setInterval(function () {
      var info = parseRecordPageDOM();
      if (info && info.status !== lastStatus) {
        lastStatus = info.status;
        if (!isPendingStatus(info.status)) {
          var problemId = extractProblemIdFromRecordPage();
          var cached = getCachedSubmission(problemId);
          var submission = {
            id: extractRecordId() || '',
            status_display: info.status,
            lang: info.language || '',
            runtime: info.runtime || '',
            memory: info.memory || '',
            titleSlug: problemId,
            difficulty: 0,
            tags: [],
            code: (cached && cached.code) || '',
          };
          var dedupKey = 'luogu_' + problemId + '_' + info.status + '_' + extractRecordId();
          var recent = sessionStorage.getItem('algoTracker_luogu_lastSent');
          if (recent !== dedupKey) {
            sessionStorage.setItem('algoTracker_luogu_lastSent', dedupKey);
            sessionStorage.removeItem('algoTracker_luogu_pendingCode');
            window.postMessage(
              { type: 'ALGOTRACKER_SUBMISSION_LUOGU', data: submission },
              window.location.origin
            );
          }
        }
      }
    }, 1000);
  }

  function parseRecordPageDOM() {
    var infoRows = document.querySelector('div.info-rows');
    if (!infoRows) return null;

    var status = '';
    var runtime = '';
    var memory = '';
    var language = '';

    var children = infoRows.children;
    for (var i = 0; i < children.length; i++) {
      var row = children[i];
      var labelEl = row.children && row.children[0] && row.children[0].children && row.children[0].children[0];
      var valueEl = row.children && row.children[1];
      if (!labelEl || !valueEl) continue;

      var label = (labelEl.innerText || '').trim();
      var value = (valueEl.innerText || '').trim();

      if (label.indexOf('评测状态') !== -1 || label.indexOf('Status') !== -1) {
        status = value;
      } else if (label.indexOf('运行时间') !== -1 || label.indexOf('Time') !== -1) {
        runtime = value;
      } else if (label.indexOf('内存') !== -1 || label.indexOf('Memory') !== -1) {
        memory = value;
      } else if (label.indexOf('语言') !== -1 || label.indexOf('Language') !== -1) {
        language = value;
      }
    }

    if (!status) return null;
    return { status: status, runtime: runtime, memory: memory, language: language };
  }

  function extractProblemIdFromRecordPage() {
    var links = document.querySelectorAll('a[href*="/problem/"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      // Prefer links in breadcrumb (not sidebar recommendations)
      if (href.indexOf('/problem/B') === -1 && href.indexOf('/problem/P') !== -1) {
        var match = href.match(/\/problem\/(\w+)/);
        if (match) return match[1];
      }
    }
    // Fallback: any problem link
    var firstLink = document.querySelector('a[href*="/problem/"]');
    if (firstLink) {
      var href2 = firstLink.getAttribute('href') || '';
      var match2 = href2.match(/\/problem\/(\w+)/);
      if (match2) return match2[1];
    }
    return '';
  }

  function extractRecordId() {
    var match = window.location.href.match(RECORD_URL_RE);
    return match ? match[1] : '';
  }

  function isPendingStatus(status) {
    var s = status.toLowerCase();
    return s.indexOf('judging') !== -1 || s.indexOf('waiting') !== -1 || s.indexOf('running') !== -1;
  }

  function normalizeLuoguVerdict(raw) {
    var s = String(raw).trim();
    // LuoGu API returns numeric status codes
    var statusMap = { 0: '', 1: '', 2: '', 12: 'Accepted', 14: 'Unaccepted' };
    var num = Number(raw);
    if (!isNaN(num) && statusMap[num]) return statusMap[num];

    if (/^(Accepted|AC)$/i.test(s)) return 'Accepted';
    if (/^(Unaccepted|Wrong Answer|WA)$/i.test(s)) return 'Wrong Answer';
    if (/^(Compile Error|CE)$/i.test(s)) return 'Compile Error';
    if (/^(Time Limit Exceeded|TLE)$/i.test(s)) return 'Time Limit Exceeded';
    if (/^(Runtime Error|RE)$/i.test(s)) return 'Runtime Error';
    if (/^(Memory Limit Exceeded|MLE)$/i.test(s)) return 'Memory Limit Exceeded';

    if (/^(Judging|Waiting|Compiling|Running|Queueing)$/i.test(s)) return '';
    if (s === '0' || s === '1' || s === '2') return '';

    if (s.toLowerCase().indexOf('error') !== -1) return 'Runtime Error';
    return s;
  }

  function mapLuoguDifficulty(diff) {
    if (!diff) return 1500;
    var map = { 1: 1000, 2: 1200, 3: 1400, 4: 1600, 5: 1800, 6: 2000, 7: 2200 };
    return map[diff] || 1500;
  }

  // ============================================================
  // 4. Code caching (problem page → record page bridge)
  // ============================================================

  function cacheCode(code, problemId) {
    if (!code || !problemId) return;
    sessionStorage.setItem('algoTracker_luogu_pendingCode', code);
    sessionStorage.setItem('algoTracker_luogu_pendingPid', problemId);
    sessionStorage.setItem('algoTracker_luogu_pendingTime', String(Date.now()));
    console.log('[AlgoTracker] LuoGu 代码已缓存:', problemId, code.length, 'chars');
  }

  function getCachedSubmission(problemId) {
    var code = sessionStorage.getItem('algoTracker_luogu_pendingCode');
    var pid = sessionStorage.getItem('algoTracker_luogu_pendingPid');
    var time = sessionStorage.getItem('algoTracker_luogu_pendingTime');
    if (!code || !pid) return null;

    // Expire after 5 minutes
    if (time && Date.now() - Number(time) > 300000) {
      sessionStorage.removeItem('algoTracker_luogu_pendingCode');
      sessionStorage.removeItem('algoTracker_luogu_pendingPid');
      sessionStorage.removeItem('algoTracker_luogu_pendingTime');
      return null;
    }

    if (!problemId || pid === problemId) {
      return { code: code, pid: pid };
    }
    return null;
  }

  // ============================================================
  // 5. Submit button listener (problem page → cache code)
  // ============================================================

  function setupSubmitListener() {
    var submitSelectors = [
      'button[class*="submit"]',
      'button[class*="primary"]',
      'a[class*="submit"]',
      '[class*="submit-btn"]',
    ];

    var handlePotentialSubmit = function () {
      var code = captureEditorCode();
      var problemId = extractProblemId();
      if (code && problemId) {
        cacheCode(code, problemId);
      }
    };

    document.addEventListener('click', function (e) {
      var target = e.target;
      for (var i = 0; i < submitSelectors.length; i++) {
        if (target.matches(submitSelectors[i]) || target.closest(submitSelectors[i])) {
          setTimeout(handlePotentialSubmit, 100);
          break;
        }
      }
    }, true);

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        setTimeout(handlePotentialSubmit, 100);
      }
    }, true);
  }

  function extractProblemId() {
    var match = window.location.href.match(PROBLEM_URL_RE);
    if (match) return match[1];

    var headerEl = document.querySelector('[class*="header"] [class*="pid"], .problem-id');
    if (headerEl) {
      var text = (headerEl.textContent || '').trim();
      var m = text.match(/P?\d+/);
      if (m) return m[0];
    }
    return '';
  }

  // ============================================================
  // 6. Init — route to correct mode
  // ============================================================

  function init() {
    var url = window.location.href;

    if (RECORD_URL_RE.test(url)) {
      console.log('[AlgoTracker] LuoGu 记录页检测模式');
      startDomPolling();
    } else if (PROBLEM_URL_RE.test(url)) {
      console.log('[AlgoTracker] LuoGu 题目页检测模式');
      setupSubmitListener();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
