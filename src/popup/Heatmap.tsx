import { useMemo } from 'react';

interface DailyCount {
  date: string; // 'YYYY-MM-DD'
  count: number;
  acCount: number;
}

interface HeatmapProps {
  dailyStats: DailyCount[];
  year?: number;
}

// 52 columns × 7 rows, GitHub-style
const COLS = 52;
const ROWS = 7;
const CELL = 10;
const GAP = 2;
const LABEL_WIDTH = 28;

function getColor(count: number): string {
  if (count === 0) return '#ebedf0';
  if (count === 1) return '#9be9a8';
  if (count <= 3) return '#40c463';
  if (count <= 5) return '#30a14e';
  return '#216e39';
}

function getMonthLabels(year: number): { label: string; x: number }[] {
  const months: { label: string; x: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1);
    const dayOfYear = Math.floor((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000);
    const week = Math.floor((dayOfYear + new Date(year, 0, 1).getDay()) / 7);
    if (week < COLS) {
      months.push({ label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m], x: week });
    }
  }
  return months;
}

export default function Heatmap({ dailyStats, year = new Date().getFullYear() }: HeatmapProps) {
  const countMap = useMemo(() => {
    const m = new Map<string, DailyCount>();
    for (const d of dailyStats) m.set(d.date, d);
    return m;
  }, [dailyStats]);

  const startOfYear = new Date(year, 0, 1);
  const startDay = startOfYear.getDay(); // 0=Sun
  const totalWeeks = Math.ceil((365 + startDay) / 7);
  const actualCols = Math.min(totalWeeks, COLS);
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  const cells: { x: number; y: number; date: string; count: number }[] = [];
  for (let d = 0; d < 365; d++) {
    const date = new Date(year, 0, 1 + d);
    const ds = date.toISOString().slice(0, 10);
    const week = Math.floor((d + startDay) / 7);
    const day = (d + startDay) % 7;
    if (week < COLS) {
      cells.push({ x: week, y: day, date: ds, count: countMap.get(ds)?.count || 0 });
    }
  }

  const svgWidth = LABEL_WIDTH + actualCols * (CELL + GAP) + 20;
  const svgHeight = ROWS * (CELL + GAP) + 20;

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', maxWidth: svgWidth }}>
      {/* Month labels */}
      {getMonthLabels(year).map((m) => (
        <text key={m.label} x={LABEL_WIDTH + m.x * (CELL + GAP)} y={10} fontSize="9" fill="#767676">
          {m.label}
        </text>
      ))}
      {/* Day labels */}
      {dayLabels.map((label, i) => (
        <text key={i} x={0} y={18 + i * (CELL + GAP) + CELL / 2} fontSize="9" fill="#767676" textAnchor="end">
          {label}
        </text>
      ))}
      {/* Cells */}
      {cells.map((c) => (
        <rect
          key={c.date}
          x={LABEL_WIDTH + c.x * (CELL + GAP)}
          y={14 + c.y * (CELL + GAP)}
          width={CELL}
          height={CELL}
          rx={2}
          fill={getColor(c.count)}
        >
          <title>{`${c.date}: ${c.count} submissions`}</title>
        </rect>
      ))}
    </svg>
  );
}

export function MiniHeatmap({ dailyStats, days = 7 }: { dailyStats: DailyCount[]; days?: number }) {
  const countMap = useMemo(() => {
    const m = new Map<string, DailyCount>();
    for (const d of dailyStats) m.set(d.date, d);
    return m;
  }, [dailyStats]);

  const cells = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000);
    const key = date.toISOString().slice(0, 10);
    const stat = countMap.get(key);
    return {
      date: key,
      count: stat?.count || 0,
      acCount: stat?.acCount || 0,
      label: date.toLocaleDateString('zh-CN', { weekday: 'short' }),
    };
  });

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {cells.map((c) => (
        <div key={c.date} className="flex flex-col items-center gap-1">
          <div
            className="h-8 w-full rounded-md border border-[var(--color-border-muted)]"
            style={{ backgroundColor: getColor(c.count) }}
            title={`${c.date}: ${c.count} 次提交，${c.acCount} 次 AC`}
          />
          <span className="text-[9px] text-[var(--color-text-muted)]">{c.label}</span>
        </div>
      ))}
    </div>
  );
}
