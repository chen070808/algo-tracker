import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { db, type SkillProfile } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import './index.css';

function PopupApp() {
  const skillProfiles = useLiveQuery(() => db.skillProfiles.toArray()) || [];
  const recentSubmissions = useLiveQuery(() => db.submissions.orderBy('timestamp').reverse().limit(10).toArray()) || [];
  const allProblems = useLiveQuery(() => db.problems.toArray()) || [];

  // 构建待复习/最近做过的题目列表
  const reviewList = useMemo(() => {
    const map = new Map<string, any>();
    recentSubmissions.forEach(sub => {
      if (!map.has(sub.problemId)) {
        const prob = allProblems.find(p => p.id === sub.problemId);
        if (prob) {
          map.set(sub.problemId, {
            ...prob,
            lastVerdict: sub.verdict,
            lastTimestamp: sub.timestamp
          });
        }
      }
    });
    return Array.from(map.values()).slice(0, 5); // 最多展示 5 条
  }, [recentSubmissions, allProblems]);
  
  // 构造雷达图数据
  const defaultData = [
    { subject: 'dp', A: 0, fullMark: 3000 },
    { subject: 'graph', A: 0, fullMark: 3000 },
    { subject: 'tree', A: 0, fullMark: 3000 },
    { subject: 'string', A: 0, fullMark: 3000 },
    { subject: 'math', A: 0, fullMark: 3000 },
  ];
  
  const data = skillProfiles.length > 0 
    ? skillProfiles.filter(p => p.tag !== 'global').map((p: SkillProfile) => ({ subject: p.tag, A: Math.round(p.rating), fullMark: 3000 }))
    : defaultData;

  // 如果筛选后为空（比如数据库中只有 global），则退回默认值
  const radarData = data.length > 0 ? data : defaultData;

  return (
    <div className="p-4 w-[400px] bg-[#0D1117] text-gray-100 font-sans">
      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
        <h1 className="text-xl font-bold text-[#2EA043]">AlgoTracker</h1>
        <a href="/options.html" target="_blank" rel="noreferrer" className="text-sm text-gray-400 hover:text-white">数据管理 ↗</a>
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-2">能力画像 (Elo Rating)</h2>
        <div className="h-52 w-full bg-[#161B22] rounded-lg border border-gray-800 relative flex items-center justify-center overflow-hidden">
          {skillProfiles.length === 0 && (
            <div className="absolute inset-0 z-10 bg-[#0D1117]/80 flex items-center justify-center rounded-lg">
              <span className="text-sm text-gray-400 font-medium px-4 py-2 border border-gray-700 rounded-full bg-[#161B22]">
                提交题目以点亮画像
              </span>
            </div>
          )}
          <div style={{ width: 340, height: 200 }}>
            <ResponsiveContainer width={340} height={200}>
              <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarData}>
                <PolarGrid stroke="#30363D" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#8B949E', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 3000]} tick={false} axisLine={false} />
                <Radar name="Rating" dataKey="A" stroke="#2EA043" fill="#2EA043" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-2">待复习与近期记录</h2>
        <div className="space-y-2">
          {reviewList.map(item => (
            <a 
              key={item.id} 
              href={item.url} 
              target="_blank" 
              rel="noreferrer"
              className="block p-3 bg-[#161B22] rounded-lg border border-gray-800 hover:border-gray-600 transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-200 truncate pr-2">{item.title}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  item.lastVerdict === 'AC' ? 'bg-[#2EA043]/20 text-[#2EA043]' : 'bg-[#F85149]/20 text-[#F85149]'
                }`}>
                  {item.lastVerdict}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">难度: {Math.round(item.rating)}</span>
                <span className="text-xs text-gray-500">{new Date(item.lastTimestamp).toLocaleDateString()}</span>
              </div>
            </a>
          ))}
          
          {reviewList.length === 0 && (
            <div className="text-xs text-gray-500 text-center py-4 bg-[#161B22] rounded-lg border border-gray-800">
              去力扣提交一道题，建立你的初版画像吧！
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);