console.log('[AlgoTracker] Content script loaded on', window.location.href);

const host = window.location.hostname;

// Inject appropriate detection script based on platform
if (host.includes('leetcode.cn') || host.includes('leetcode.com')) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/content/inject.js');
  script.type = 'module';
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // Listen for LeetCode submissions from MAIN world
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'ALGOTRACKER_SUBMISSION') {
      chrome.runtime.sendMessage({
        type: 'AUTO_SAVE_SUBMISSION',
        payload: {
          submission: event.data.data,
          platform: 'leetcode-cn',
        },
      });
    }
  });
}

if (host.includes('nowcoder.com')) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/content/nowcoder_inject.js');
  script.type = 'module';
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // Listen for Nowcoder submissions from MAIN world
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'ALGOTRACKER_NOWCODER_SUBMISSION') {
      chrome.runtime.sendMessage({
        type: 'AUTO_SAVE_SUBMISSION',
        payload: {
          submission: event.data.data,
          platform: 'nowcoder',
        },
      });
    }
  });
}
