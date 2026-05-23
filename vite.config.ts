import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx, defineManifest } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'AlgoTracker',
  version: '1.0.0',
  description: '跨平台刷题伴侣：自动记录、复盘与基于 Elo Rating 的个性化推荐',
  action: {
    default_popup: 'index.html',
  },
  options_page: 'options.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: [
        '*://leetcode.cn/problems/*',
        '*://leetcode.com/problems/*',
        '*://www.nowcoder.com/practice/*',
        '*://www.nowcoder.com/question/*',
        '*://ac.nowcoder.com/acm/problem/*',
      ],
      js: ['src/content/index.tsx'],
      run_at: 'document_start'
    }
  ],
  web_accessible_resources: [
    {
      resources: ['src/content/inject.js', 'src/content/nowcoder_inject.js'],
      matches: [
        '*://leetcode.cn/*',
        '*://leetcode.com/*',
        '*://www.nowcoder.com/*',
        '*://ac.nowcoder.com/*',
      ]
    }
  ],
  permissions: ['storage', 'unlimitedStorage'],
  host_permissions: [
    '*://leetcode.cn/*',
    '*://leetcode.com/*',
    '*://www.nowcoder.com/*',
    '*://ac.nowcoder.com/*',
    '*://api.github.com/*',
  ],
});

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],
});
