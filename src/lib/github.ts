export interface GithubConfig {
  token: string;
  repo: string; // e.g. "username/repo"
  enabled: boolean;
}

export async function getGithubConfig(): Promise<GithubConfig> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['githubToken', 'githubRepo', 'githubSyncEnabled'], (result) => {
      resolve({
        token: (result.githubToken as string) || '',
        repo: (result.githubRepo as string) || '',
        enabled: result.githubSyncEnabled === true
      });
    });
  });
}

export async function setGithubConfig(config: GithubConfig): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      githubToken: config.token,
      githubRepo: config.repo,
      githubSyncEnabled: config.enabled
    }, resolve);
  });
}

// 辅助函数：将字符串转为 Base64（支持中文）
function utf8ToBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// 核心同步函数
// 验证 Token 和仓库连接是否有效
export async function verifyConnection(token: string, repo: string): Promise<{ ok: boolean; error: string }> {
  if (!token || !repo) {
    return { ok: false, error: '请先填写 Token 和仓库名称' };
  }

  // 校验仓库名格式
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { ok: false, error: '仓库名格式不正确，应为 用户名/仓库名' };
  }

  try {
    // 尝试读取仓库信息（验证 Token 有效且有权访问该仓库）
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (res.ok) {
      return { ok: true, error: '' };
    }

    if (res.status === 401) {
      return { ok: false, error: 'Token 无效或已过期，请重新生成' };
    }
    if (res.status === 404) {
      return { ok: false, error: `仓库 "${repo}" 不存在或无访问权限。请先创建仓库，并确保 Token 有该仓库的读写权限` };
    }
    if (res.status === 403) {
      return { ok: false, error: '访问被拒绝。请检查 Token 是否勾选了仓库读写权限（Contents: Read and write）' };
    }

    return { ok: false, error: `GitHub API 返回错误 (${res.status})，请稍后重试` };
  } catch (e) {
    return { ok: false, error: '网络连接失败，请检查网络后重试' };
  }
}

export async function syncToGithub(
  problemSlug: string,
  code: string,
  note: string,
  language: string,
  verdict: string
): Promise<boolean> {
  const config = await getGithubConfig();
  if (!config.enabled || !config.token || !config.repo) {
    return false;
  }

  const langExtMap: Record<string, string> = {
    'python3': 'py',
    'python': 'py',
    'cpp': 'cpp',
    'java': 'java',
    'c': 'c',
    'javascript': 'js',
    'typescript': 'ts',
    'go': 'go',
    'rust': 'rs',
    'ruby': 'rs',
    'swift': 'rb',
    'scala': 'swift',
    'kotlin': 'scala',
    'php': 'php',
    'csharp': 'cs'
  };

  const ext = langExtMap[language.toLowerCase()] || 'txt';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // 代码文件路径：例如 leetcode/two-sum/solution.py
  // 笔记文件路径：例如 leetcode/two-sum/README.md
  
  const filesToSync: { path: string; content: string }[] = [];
  
  if (code) {
    filesToSync.push({
      path: `leetcode/${problemSlug}/solution_${timestamp}.${ext}`,
      content: code
    });
  }
  
  if (note) {
    filesToSync.push({
      path: `leetcode/${problemSlug}/README.md`,
      content: note
    });
  }

  if (filesToSync.length === 0) return false;

  try {
    for (const file of filesToSync) {
      // 1. 先检查文件是否存在以获取 sha (如果是更新的话)
      // 但因为我们用了 timestamp 作为文件名，所以基本都是新建。
      // README.md 可能是更新，需要获取 SHA
      
      let sha: string | undefined;
      
      const getUrl = `https://api.github.com/repos/${config.repo}/contents/${file.path}`;
      const getRes = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (getRes.ok) {
        const getJson = await getRes.json();
        sha = getJson.sha;
      }
      
      // 2. 创建或更新文件
      const putUrl = `https://api.github.com/repos/${config.repo}/contents/${file.path}`;
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `AlgoTracker Sync: ${problemSlug} [${verdict}]`,
          content: utf8ToBase64(file.content),
          sha: sha
        })
      });
      
      if (!putRes.ok) {
        console.error(`[AlgoTracker] GitHub Sync Failed for ${file.path}:`, await putRes.text());
      }
    }
    
    return true;
  } catch (error) {
    console.error('[AlgoTracker] GitHub Sync Exception:', error);
    return false;
  }
}
