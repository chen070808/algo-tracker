/**
 * 跨平台算法知识图谱 — NOI 2025 大纲驱动
 * 数据源: src/data/knowledge-graph.json (由 shared/ 同步而来)
 * 共 103 个主题节点, 覆盖数据结构/算法/数学/技巧四大类
 */
import kgJson from '../data/knowledge-graph.json';

export interface TopicProblem {
  platform: string;
  id: string;
  title: string;
  difficulty: number;
}

export interface TopicNode {
  id: string;
  labelCn: string;
  labelEn: string;
  category: 'data_structure' | 'algorithm' | 'math' | 'technique';
  difficulty: number;
  keywords: string[];
  prerequisites: string[];
  related: string[];
  problems: TopicProblem[];
  article: string;
}

function buildTopicNodes(): TopicNode[] {
  return Object.values(kgJson.nodes).map((n: any) => ({
    id: n.id,
    labelCn: n.label_cn,
    labelEn: n.label_en,
    category: n.category as TopicNode['category'],
    difficulty: n.difficulty,
    keywords: n.keywords,
    prerequisites: n.prerequisites || [],
    related: n.related || [],
    problems: n.problems || [],
    article: n.article || '',
  }));
}

export const TOPIC_TAXONOMY: TopicNode[] = buildTopicNodes();
const TOPIC_MAP = new Map(TOPIC_TAXONOMY.map((t) => [t.id, t]));

export function getTopicNode(topicId: string): TopicNode | undefined {
  return TOPIC_MAP.get(topicId);
}

export function getAllTopics(): TopicNode[] {
  return TOPIC_TAXONOMY;
}

export function getTopicPrerequisites(topicId: string): TopicNode[] {
  const node = TOPIC_MAP.get(topicId);
  if (!node) return [];
  return node.prerequisites.map((id) => TOPIC_MAP.get(id)).filter(Boolean) as TopicNode[];
}

export function getRelatedTopics(topicId: string): TopicNode[] {
  const node = TOPIC_MAP.get(topicId);
  if (!node) return [];
  return node.related.map((id) => TOPIC_MAP.get(id)).filter(Boolean) as TopicNode[];
}

export function getTopicProblems(topicId: string): TopicProblem[] {
  const node = TOPIC_MAP.get(topicId);
  return node?.problems || [];
}

export function getTopicArticle(topicId: string): string {
  const node = TOPIC_MAP.get(topicId);
  return node?.article || '';
}

/**
 * 获取从基础到目标主题的完整学习路径 (BFS 反向追溯)
 * 返回按学习顺序排列的主题列表 (基础在前)
 */
export function getLearningPath(topicId: string): TopicNode[] {
  const target = TOPIC_MAP.get(topicId);
  if (!target) return [];

  const visited = new Set<string>();
  const result: TopicNode[] = [];

  function collect(node: TopicNode): void {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    for (const prereqId of node.prerequisites) {
      const prereq = TOPIC_MAP.get(prereqId);
      if (prereq) collect(prereq);
    }
    result.push(node);
  }

  collect(target);
  return result;
}

/**
 * 获取所有前置知识都已掌握、可以直接学习的主题
 */
export function getUnlockedTopics(masteredTopicIds: Set<string>): TopicNode[] {
  return TOPIC_TAXONOMY.filter((t) => {
    if (t.prerequisites.length === 0) return true;
    return t.prerequisites.every((p) => masteredTopicIds.has(p));
  });
}

export function getTopicsByCategory(cat: TopicNode['category']): TopicNode[] {
  return TOPIC_TAXONOMY.filter((t) => t.category === cat);
}

/**
 * LeetCode 标签 → 统一主题映射 (基于 NOI 2025 大纲节点)
 */
const LEETCODE_TAG_MAP: Record<string, string[]> = {
  'array': ['linked_list', 'stack', 'queue', 'enumeration', 'sorting', 'two_pointers', 'sliding_window', 'prefix_sum'],
  'backtracking': ['backtracking', 'enumeration'],
  'biconnected-components': ['graph', 'dfs'],
  'binary-indexed-tree': ['fenwick'],
  'binary-search': ['binary_search', 'divide_conquer'],
  'binary-search-tree': ['bst', 'balanced_tree'],
  'binary-tree': ['binary_tree', 'binary_lifting', 'tree_dp', 'lca'],
  'bit-manipulation': ['divisibility', 'number_bases', 'fft'],
  'brainteaser': ['combinatorics', 'nim'],
  'breadth-first-search': ['bfs', 'bidirectional_bfs', 'flood_fill', 'shortest_path'],
  'bucket-sort': ['bucket_sort'],
  'combinatorics': ['combinatorics', 'permutation', 'combination', 'inclusion_exclusion', 'catalan', 'pigeonhole', 'stirling', 'generating_function'],
  'concurrency': ['state_machine'],
  'counting': ['combinatorics', 'bucket_sort'],
  'counting-sort': ['bucket_sort'],
  'data-stream': ['binary_heap', 'queue'],
  'database': ['simulation'],
  'depth-first-search': ['dfs', 'backtracking', 'scc', 'topological_sort', 'lca'],
  'design': ['simulation'],
  'divide-and-conquer': ['divide_conquer', 'binary_search', 'sqrt_decomposition'],
  'doubly-linked-list': ['linked_list'],
  'dynamic-programming': ['dp', 'memoization', 'knapsack', 'interval_dp', 'tree_dp', 'bitmask_dp', 'dp_optimization', 'state_machine'],
  'eulerian-circuit': ['graph', 'dfs'],
  'game-theory': ['nim', 'dp'],
  'geometry': ['geometry', 'convex_hull'],
  'graph': ['graph', 'dag', 'bipartite_graph'],
  'greedy': ['greedy'],
  'hash-table': ['hash_table'],
  'heap-priority-queue': ['binary_heap'],
  'interactive': ['simulation'],
  'iterator': ['simulation'],
  'kadanes-algorithm': ['dp', 'prefix_sum'],
  'line-sweep': ['sweep_line', 'segment_tree'],
  'linked-list': ['linked_list'],
  'math': ['number_theory', 'combinatorics', 'geometry', 'matrix', 'probability'],
  'matrix': ['matrix', 'gaussian'],
  'memoization': ['memoization', 'dp'],
  'merge-sort': ['merge_sort', 'divide_conquer'],
  'minimum-common-value': ['two_pointers', 'binary_search'],
  'minimum-spanning-tree': ['mst', 'disjoint_set'],
  'monotonic-queue': ['monotonic_queue'],
  'monotonic-stack': ['monotonic_stack'],
  'network-flow': ['network_flow', 'hungarian', 'two_sat'],
  'number-theory': ['number_theory', 'divisibility', 'gcd', 'prime_sieve', 'modular_arith', 'congruence', 'exgcd', 'modular_inverse', 'euler_theorem', 'fermat_little', 'crt'],
  'ordered-set': ['bst', 'balanced_tree'],
  'prefix-sum': ['prefix_sum', 'difference_array'],
  'probability-and-statistics': ['probability', 'expected_value'],
  'queue': ['queue', 'monotonic_queue'],
  'quickselect': ['quick_sort', 'divide_conquer'],
  'radix-sort': ['radix_sort'],
  'recursion': ['recursion', 'dp', 'backtracking', 'divide_conquer'],
  'rejection-sampling': ['probability'],
  'reservoir-sampling': ['probability'],
  'rolling-hash': ['hash_table', 'kmp'],
  'segment-tree': ['segment_tree', 'fenwick', 'sparse_table', 'sqrt_decomposition'],
  'shell': ['simulation'],
  'shortest-path': ['shortest_path', 'floyd'],
  'simulation': ['simulation'],
  'sliding-window': ['sliding_window'],
  'sorting': ['sorting', 'merge_sort', 'quick_sort', 'heap_sort', 'bucket_sort', 'radix_sort'],
  'stack': ['stack', 'monotonic_stack'],
  'string': ['kmp', 'trie', 'hash_table'],
  'string-matching': ['kmp', 'suffix_array', 'suffix_automaton', 'ac_automaton'],
  'strongly-connected-components': ['scc', 'graph', 'dfs'],
  'suffix-array': ['suffix_array', 'suffix_automaton'],
  'topological-sort': ['topological_sort'],
  'tree': ['tree', 'binary_tree', 'bst', 'huffman_tree', 'complete_btree'],
  'trie': ['trie', 'ac_automaton'],
  'two-pointers': ['two_pointers'],
  'union-find': ['disjoint_set'],
};

/**
 * 牛客网 标签 → 统一主题映射
 */
const NOWCODER_TAG_MAP: Record<string, string[]> = {
  'AC自动机': ['ac_automaton', 'trie'],
  'BFS': ['bfs', 'bidirectional_bfs', 'flood_fill', 'shortest_path'],
  'DFS': ['dfs', 'backtracking', 'scc', 'topological_sort', 'lca'],
  'DP': ['dp', 'memoization'],
  '二分': ['binary_search', 'divide_conquer'],
  '二叉搜索树': ['bst', 'balanced_tree'],
  '二叉树': ['binary_tree', 'binary_lifting', 'tree_dp', 'lca'],
  '位运算': ['divisibility', 'number_bases'],
  '几何': ['geometry', 'convex_hull'],
  '分治': ['divide_conquer', 'binary_search', 'sqrt_decomposition'],
  '前缀和': ['prefix_sum', 'difference_array'],
  '动态规划': ['dp', 'memoization', 'knapsack', 'interval_dp', 'tree_dp', 'bitmask_dp', 'dp_optimization', 'state_machine'],
  '区间DP': ['interval_dp'],
  '单调栈': ['monotonic_stack'],
  '单调队列': ['monotonic_queue'],
  '博弈': ['nim', 'dp'],
  '双指针': ['two_pointers'],
  '哈希': ['hash_table'],
  '回溯': ['backtracking', 'enumeration'],
  '图': ['graph', 'dag', 'bipartite_graph'],
  '堆': ['binary_heap'],
  '字典树': ['trie', 'ac_automaton'],
  '字符串': ['kmp', 'trie', 'hash_table'],
  '并查集': ['disjoint_set'],
  '快速幂': ['binary_lifting'],
  '拓扑排序': ['topological_sort', 'dag'],
  '排序': ['sorting', 'merge_sort', 'quick_sort', 'heap_sort', 'bucket_sort', 'radix_sort'],
  '数学': ['number_theory', 'combinatorics', 'geometry', 'matrix', 'probability'],
  '数组': ['linked_list', 'stack', 'queue', 'enumeration', 'sorting', 'two_pointers', 'sliding_window', 'prefix_sum'],
  '数论': ['number_theory', 'divisibility', 'gcd', 'prime_sieve', 'modular_arith', 'congruence', 'exgcd', 'modular_inverse', 'euler_theorem', 'fermat_little', 'crt'],
  '最小生成树': ['mst', 'disjoint_set'],
  '最短路': ['shortest_path', 'floyd'],
  '栈': ['stack', 'monotonic_stack'],
  '树': ['tree', 'binary_tree', 'bst', 'huffman_tree', 'complete_btree'],
  '树形DP': ['tree_dp'],
  '树状数组': ['fenwick'],
  '概率': ['probability', 'expected_value'],
  '模拟': ['simulation'],
  '滑动窗口': ['sliding_window'],
  '状态压缩': ['bitmask_dp'],
  '矩阵': ['matrix', 'gaussian'],
  '线段树': ['segment_tree', 'fenwick', 'sparse_table'],
  '组合数学': ['combinatorics', 'permutation', 'combination', 'inclusion_exclusion', 'catalan', 'pigeonhole', 'stirling', 'generating_function'],
  '网络流': ['network_flow', 'hungarian'],
  '背包': ['knapsack'],
  '记忆化': ['memoization', 'dp'],
  '贪心': ['greedy'],
  '递归': ['recursion', 'dp', 'backtracking', 'divide_conquer'],
  '链表': ['linked_list'],
  '队列': ['queue', 'monotonic_queue'],
};

export function mapToUnifiedTopics(platform: string, rawTags: string[]): string[] {
  const tagMap = platform === 'nowcoder' ? NOWCODER_TAG_MAP : LEETCODE_TAG_MAP;
  const unified = new Set<string>();
  for (const raw of rawTags) {
    const mapped = tagMap[raw] || tagMap[raw.toLowerCase()];
    if (mapped) {
      for (const id of mapped) unified.add(id);
    }
  }
  return [...unified];
}
