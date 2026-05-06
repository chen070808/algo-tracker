import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import '../popup/index.css';

function OptionsApp() {
  const [activeTab, setActiveTab] = useState<'data' | 'github'>('data');
  
  const submissions = useLiveQuery(() => db.submissions.orderBy('timestamp').reverse().toArray()) || [];
  const problems = useLiveQuery(() => db.problems.toArray()) || [];
  
  // 组装数据用于展示
  const displayData = submissions.map(sub => {
    const prob = problems.find(p => p.id === sub.problemId);
    return {
      id: sub.id,
      title: prob?.title || sub.problemId,
      url: prob?.url || '#',
      platform: prob?.platform || 'Unknown',
      verdict: sub.verdict,
      timestamp: sub.timestamp,
      language: sub.language
    };
  });

  return (
    <div className="min-h-screen bg-[#0D1117] text-gray-200 font-sans p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[#2EA043] mb-8">AlgoTracker 控制台</h1>
        
        <div className="flex gap-6">
          {/* 左侧导航 */}
          <div className="w-48 shrink-0 flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('data')}
              className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'data' ? 'bg-[#2EA043] text-white' : 'text-gray-400 hover:bg-[#161B22] hover:text-white'
              }`}
            >
              数据管理
            </button>
            <button 
              onClick={() => setActiveTab('github')}
              className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'github' ? 'bg-[#2EA043] text-white' : 'text-gray-400 hover:bg-[#161B22] hover:text-white'
              }`}
            >
              GitHub 同步
            </button>
          </div>

          {/* 右侧内容区 */}
          <div className="flex-1 bg-[#161B22] border border-[#30363D] rounded-xl p-6 min-h-[600px]">
            {activeTab === 'data' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-white">最近提交记录</h2>
                  <div className="text-sm text-gray-400">总计 {submissions.length} 条记录</div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#30363D] text-sm text-gray-400">
                        <th className="pb-3 pl-2">时间</th>
                        <th className="pb-3">平台</th>
                        <th className="pb-3">题目</th>
                        <th className="pb-3">状态</th>
                        <th className="pb-3">语言</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.map(item => (
                        <tr key={item.id} className="border-b border-[#30363D] hover:bg-[#21262D] transition-colors text-sm">
                          <td className="py-3 pl-2 text-gray-400">
                            {new Date(item.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-1 bg-gray-800 rounded text-xs">{item.platform}</span>
                          </td>
                          <td className="py-3">
                            <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                              {item.title}
                            </a>
                          </td>
                          <td className="py-3">
                            <span className={`font-bold ${item.verdict === 'AC' ? 'text-[#2EA043]' : 'text-[#F85149]'}`}>
                              {item.verdict}
                            </span>
                          </td>
                          <td className="py-3 text-gray-400">{item.language || '-'}</td>
                        </tr>
                      ))}
                      {displayData.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500">
                            暂无提交记录，去刷几道题吧！
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'github' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">GitHub 自动同步配置</h2>
                <div className="space-y-6 max-w-xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Personal Access Token (Classic)</label>
                    <input 
                      type="password" 
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" 
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#2EA043]"
                    />
                    <p className="text-xs text-gray-500 mt-2">需要勾选 `repo` 权限。你的 Token 仅保存在浏览器本地。</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">仓库名称 (Repository)</label>
                    <input 
                      type="text" 
                      placeholder="username/algo-tracker-sync" 
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#2EA043]"
                    />
                  </div>

                  <button className="bg-[#2EA043] hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                    保存并验证连接
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);