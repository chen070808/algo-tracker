import { db } from './db';
import type { Submission, Problem } from './db';

const DEFAULT_RATING = 1500;
const ELO_K_NEW = 40;
const ELO_K_OLD = 20;

export function getExpectedProbability(userRating: number, problemRating: number): number {
  return 1 / (1 + Math.pow(10, (problemRating - userRating) / 400));
}

export async function updateSkillRating(tag: string, problemRating: number, isAC: boolean) {
  await db.transaction('rw', db.skillProfiles, async () => {
    let profile = await db.skillProfiles.get(tag);
    if (!profile) {
      profile = {
        tag,
        rating: DEFAULT_RATING,
        volatility: 0,
        lastPracticedAt: Date.now(),
        streak: 0,
        totalAttempted: 0,
        totalAC: 0,
      };
    }

    const expected = getExpectedProbability(profile.rating, problemRating);
    const actual = isAC ? 1 : 0;
    const K = profile.totalAttempted < 30 ? ELO_K_NEW : ELO_K_OLD;
    profile.rating = profile.rating + K * (actual - expected);
    profile.totalAttempted += 1;
    if (isAC) {
      profile.totalAC += 1;
      profile.streak += 1;
    } else {
      profile.streak = 0;
    }
    profile.lastPracticedAt = Date.now();

    await db.skillProfiles.put(profile);
  });
}

// ── 比赛目标定义 ──

export interface CompetitionDef {
  id: string;
  name: string;
  description: string;
  defaultTarget: number; // fallback Elo for topics not explicitly listed
}

export const COMPETITIONS: CompetitionDef[] = [
  { id: 'lanqiao', name: '蓝桥杯', description: '省赛/国赛', defaultTarget: 1500 },
  { id: 'noip', name: 'NOIP', description: '省级联赛', defaultTarget: 1750 },
  { id: 'interview', name: '面试/考研', description: '大厂机试', defaultTarget: 1650 },
  { id: 'icpc', name: 'ICPC', description: '区域赛/World Finals', defaultTarget: 2100 },
  { id: 'ioi', name: 'IOI', description: '国际信息学奥赛', defaultTarget: 2200 },
];

/**
 * 各比赛 × 各知识点的目标 Elo。
 * Key: unified KG node ID (e.g. 'binary_heap', 'dp')
 * 未列出的 topic 使用 competition.defaultTarget
 */
export const COMPETITION_TARGETS: Record<string, Record<string, number>> = {
  lanqiao: {
    'linked_list': 1500, 'stack': 1500, 'queue': 1500,
    'hash_table': 1600, 'binary_heap': 1400, 'tree': 1500,
    'binary_tree': 1550, 'bst': 1400, 'trie': 1300,
    'graph': 1400, 'sorting': 1600, 'binary_search': 1600,
    'two_pointers': 1550, 'sliding_window': 1500,
    'prefix_sum': 1550, 'difference_array': 1500,
    'bfs': 1500, 'dfs': 1550, 'backtracking': 1500,
    'dp': 1600, 'knapsack': 1550,
    'greedy': 1600, 'divide_conquer': 1450,
    'recursion': 1600, 'memoization': 1550,
    'number_theory': 1400, 'combinatorics': 1400, 'matrix': 1500,
    'monotonic_stack': 1400, 'monotonic_queue': 1400,
    'shortest_path': 1350, 'mst': 1300, 'topological_sort': 1400,
    'segment_tree': 1200, 'fenwick': 1200, 'disjoint_set': 1400,
    'interval_dp': 1350, 'tree_dp': 1300, 'bitmask_dp': 1200,
    'geometry': 1200, 'binary_lifting': 1400, 'probability': 1300,
    'state_machine': 1350, 'lca': 1200,
    'kmp': 1350, 'modular_arith': 1400, 'scc': 1200,
  },
  noip: {
    'linked_list': 1700, 'stack': 1750, 'queue': 1700,
    'hash_table': 1800, 'binary_heap': 1700, 'tree': 1800,
    'binary_tree': 1800, 'bst': 1700, 'trie': 1650,
    'graph': 1750, 'sorting': 1800, 'binary_search': 1850,
    'two_pointers': 1800, 'sliding_window': 1750,
    'prefix_sum': 1800, 'difference_array': 1750,
    'bfs': 1800, 'dfs': 1850, 'backtracking': 1800,
    'dp': 1900, 'knapsack': 1850,
    'greedy': 1850, 'divide_conquer': 1800,
    'recursion': 1800, 'memoization': 1850,
    'number_theory': 1800, 'combinatorics': 1800, 'matrix': 1750,
    'monotonic_stack': 1750, 'monotonic_queue': 1750,
    'shortest_path': 1750, 'mst': 1700, 'topological_sort': 1750,
    'segment_tree': 1700, 'fenwick': 1700, 'disjoint_set': 1750,
    'interval_dp': 1750, 'tree_dp': 1750, 'bitmask_dp': 1650,
    'geometry': 1650, 'binary_lifting': 1750, 'probability': 1700,
    'state_machine': 1700, 'lca': 1700,
    'kmp': 1700, 'modular_arith': 1750, 'scc': 1700,
  },
  interview: {
    'linked_list': 1750, 'stack': 1750, 'queue': 1700,
    'hash_table': 1850, 'binary_heap': 1700, 'tree': 1750,
    'binary_tree': 1800, 'bst': 1600, 'trie': 1500,
    'graph': 1650, 'sorting': 1700, 'binary_search': 1800,
    'two_pointers': 1800, 'sliding_window': 1750,
    'prefix_sum': 1750, 'difference_array': 1700,
    'bfs': 1750, 'dfs': 1800, 'backtracking': 1750,
    'dp': 1700, 'knapsack': 1650,
    'greedy': 1700, 'divide_conquer': 1650,
    'recursion': 1750, 'memoization': 1700,
    'number_theory': 1400, 'combinatorics': 1450, 'matrix': 1650,
    'monotonic_stack': 1600, 'monotonic_queue': 1550,
    'shortest_path': 1500, 'mst': 1400, 'topological_sort': 1500,
    'segment_tree': 1300, 'fenwick': 1250, 'disjoint_set': 1450,
    'interval_dp': 1400, 'tree_dp': 1350, 'bitmask_dp': 1200,
    'geometry': 1200, 'binary_lifting': 1400, 'probability': 1300,
    'state_machine': 1550, 'lca': 1200,
    'kmp': 1400, 'modular_arith': 1400,
  },
  icpc: {
    'linked_list': 2000, 'stack': 2000, 'queue': 2000,
    'hash_table': 2100, 'binary_heap': 2050, 'tree': 2100,
    'binary_tree': 2050, 'bst': 2000, 'trie': 2000,
    'graph': 2100, 'sorting': 2000, 'binary_search': 2100,
    'two_pointers': 2050, 'sliding_window': 2050,
    'prefix_sum': 2050, 'difference_array': 2000,
    'bfs': 2050, 'dfs': 2100, 'backtracking': 2100,
    'dp': 2200, 'knapsack': 2100,
    'greedy': 2100, 'divide_conquer': 2100,
    'recursion': 2000, 'memoization': 2100,
    'number_theory': 2100, 'combinatorics': 2150, 'matrix': 2000,
    'monotonic_stack': 2000, 'monotonic_queue': 2000,
    'shortest_path': 2100, 'mst': 2050, 'topological_sort': 2100,
    'segment_tree': 2100, 'fenwick': 2050, 'disjoint_set': 2050,
    'interval_dp': 2150, 'tree_dp': 2150, 'bitmask_dp': 2150,
    'geometry': 2100, 'binary_lifting': 2000, 'probability': 2050,
    'state_machine': 2000, 'lca': 2100,
    'kmp': 2050, 'modular_arith': 2050, 'scc': 2100,
  },
  ioi: {
    'linked_list': 2100, 'stack': 2100, 'queue': 2100,
    'hash_table': 2200, 'binary_heap': 2150, 'tree': 2250,
    'binary_tree': 2200, 'bst': 2150, 'trie': 2150,
    'graph': 2250, 'sorting': 2100, 'binary_search': 2200,
    'two_pointers': 2150, 'sliding_window': 2150,
    'prefix_sum': 2100, 'difference_array': 2100,
    'bfs': 2200, 'dfs': 2250, 'backtracking': 2250,
    'dp': 2300, 'knapsack': 2250,
    'greedy': 2250, 'divide_conquer': 2250,
    'recursion': 2100, 'memoization': 2200,
    'number_theory': 2300, 'combinatorics': 2300, 'matrix': 2100,
    'monotonic_stack': 2150, 'monotonic_queue': 2150,
    'shortest_path': 2250, 'mst': 2200, 'topological_sort': 2250,
    'segment_tree': 2300, 'fenwick': 2200, 'disjoint_set': 2200,
    'interval_dp': 2300, 'tree_dp': 2300, 'bitmask_dp': 2300,
    'geometry': 2250, 'binary_lifting': 2100, 'probability': 2200,
    'state_machine': 2150, 'lca': 2250,
    'kmp': 2200, 'modular_arith': 2250, 'scc': 2250,
  },
};

/** Backward compat: old keys → KG node IDs */
const KEY_ALIASES: Record<string, string> = {
  'heap': 'binary_heap',
  'quick_pow': 'binary_lifting',
  'array': 'linked_list',       // closest KG node for generic array skills
  'string': 'kmp',              // closest KG node for string skills
  'lcs': 'dp',                  // LCS is a DP sub-problem
  'bit_manipulation': 'number_bases',
  'simulation': 'enumeration',
};

export function getCompetition(compId: string): CompetitionDef | undefined {
  return COMPETITIONS.find((c) => c.id === compId);
}

export function getTargetElo(compId: string, topicId: string): number {
  const targets = COMPETITION_TARGETS[compId];
  if (targets) {
    if (topicId in targets) return targets[topicId];
    // Try backward-compat alias
    const alias = KEY_ALIASES[topicId];
    if (alias && alias in targets) return targets[alias];
  }
  const comp = getCompetition(compId);
  return comp?.defaultTarget ?? 1500;
}

// ── 难度分带统计 ──

export type DifficultyBand = '<1500' | '1500-2000' | '2000+';

export interface BandStats {
  band: DifficultyBand;
  total: number;
  ac: number;
  acRate: number;
}

const BANDS: { band: DifficultyBand; min: number; max: number }[] = [
  { band: '<1500', min: 0, max: 1499 },
  { band: '1500-2000', min: 1500, max: 2000 },
  { band: '2000+', min: 2001, max: Infinity },
];

/**
 * 计算某个标签的难度分带 AC 率
 * @param tag 标签 slug（原始平台标签或统一主题ID）
 * @param submissions 所有提交
 * @param problems 所有题目
 */
export function computeBandStats(
  tag: string,
  submissions: Submission[],
  problems: Problem[]
): BandStats[] {
  const probMap = new Map(problems.map((p) => [p.id, p]));

  // Count per band
  const counts = new Map<DifficultyBand, { total: number; ac: number }>();
  for (const band of BANDS) {
    counts.set(band.band, { total: 0, ac: 0 });
  }

  for (const sub of submissions) {
    const prob = probMap.get(sub.problemId);
    if (!prob) continue;

    // Check if this problem has the tag (original tag OR unified topic)
    const tags = prob.tags || [];
    const unifiedTopics = prob.unifiedTopics || [];
    const hasTag = tags.includes(tag) || unifiedTopics.includes(tag);
    if (!hasTag) continue;

    const rating = prob.rating;
    const band = BANDS.find((b) => rating >= b.min && rating <= b.max);
    if (!band) continue;

    const c = counts.get(band.band)!;
    c.total++;
    if (sub.verdict === 'AC') c.ac++;
  }

  return BANDS.map((b) => {
    const c = counts.get(b.band)!;
    return {
      band: b.band,
      total: c.total,
      ac: c.ac,
      acRate: c.total > 0 ? Math.round((c.ac / c.total) * 100) : 0,
    };
  });
}

// Elo 进度条颜色
export function eloProgressColor(current: number, target: number): string {
  const ratio = current / target;
  if (ratio >= 1) return '#2EA043';  // 达标
  if (ratio >= 0.7) return '#D29922'; // 接近
  if (ratio >= 0.4) return '#F0883E'; // 努力中
  return '#F85149'; // 差距大
}
