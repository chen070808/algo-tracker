/**
 * GitHub 文件同步模块
 *
 * 安全注意: GitHub PAT 存储在 chrome.storage.local 中。
 * chrome.storage.local 对网页脚本隔离，但同设备上有 storage 权限的其他扩展可读取。
 * 建议: 使用 Fine-grained PAT 并仅授予单个仓库的 Contents 读写权限，定期轮换 Token。
 * 如需分发此扩展，应迁移至 chrome.identity.launchWebAuthFlow + OAuth App。
 */
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

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// 验证 Token 和仓库连接是否有效（含读写权限检查）
export async function verifyConnection(token: string, repo: string): Promise<{ ok: boolean; error: string }> {
  if (!token || !repo) {
    return { ok: false, error: '请先填写 Token 和仓库名称' };
  }

  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { ok: false, error: '仓库名格式不正确，应为 用户名/仓库名' };
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // 1. 检查仓库是否存在且可读
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });

    if (res.status === 401) {
      return { ok: false, error: 'Token 无效或已过期，请重新生成' };
    }
    if (res.status === 404) {
      return { ok: false, error: `仓库 "${repo}" 不存在或无访问权限` };
    }
    if (res.status === 403) {
      return { ok: false, error: 'Token 无权访问此仓库。请确认 Token 已授权给该仓库' };
    }
    if (!res.ok) {
      return { ok: false, error: `GitHub API 返回错误 (${res.status})，请稍后重试` };
    }

    // 2. 验证写权限：尝试创建测试文件
    const testPath = '.algotracker-test';
    let testSha = '';

    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${testPath}`,
      { headers }
    );
    if (getRes.ok) {
      const data = await getRes.json();
      testSha = data.sha;
    }

    const putBody: { message: string; content: string; sha?: string } = {
      message: 'AlgoTracker 连接测试',
      content: btoa('test'),
    };
    if (testSha) putBody.sha = testSha;

    const putRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${testPath}`,
      { method: 'PUT', headers, body: JSON.stringify(putBody) }
    );

    if (!putRes.ok) {
      if (putRes.status === 403) {
        return {
          ok: false,
          error: 'Token 缺少写入权限。请创建 Token 时勾选 Contents: Read and write',
        };
      }
      if (putRes.status === 404) {
        return {
          ok: false,
          error: 'Token 无权写入该仓库。请检查 Token 的仓库访问权限设置',
        };
      }
      return { ok: false, error: `写入测试失败 (${putRes.status})，请检查 Token 权限` };
    }

    return { ok: true, error: '' };
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
    'ruby': 'rb',
    'swift': 'swift',
    'scala': 'scala',
    'kotlin': 'kt',
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
        const errBody = await putRes.text();
        console.error(`[AlgoTracker] GitHub 同步失败 ${file.path}:`, errBody);
        if (putRes.status === 403) {
          console.error(
            '[AlgoTracker] Token 缺少写入权限。请前往 GitHub Settings → Developer settings → Personal access tokens，' +
            '编辑当前 Token，确保勾选 Contents: Read and write 权限'
          );
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('[AlgoTracker] GitHub Sync Exception:', error);
    return false;
  }
}
