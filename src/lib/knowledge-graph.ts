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

/**
 * 洛谷 标签 → 统一主题映射
 * 洛谷标签体系与牛客网类似但更细，部分标签含数字编号
 */
const LUOGU_TAG_MAP: Record<string, string[]> = {
  '模拟': ['simulation'],
  '枚举': ['enumeration'],
  '排序': ['sorting', 'merge_sort', 'quick_sort'],
  '二分': ['binary_search', 'divide_conquer'],
  '二分答案': ['binary_search'],
  '贪心': ['greedy'],
  '构造': ['simulation'],
  '高精度': ['simulation'],
  '前缀和': ['prefix_sum', 'difference_array'],
  '差分': ['difference_array'],
  '递推': ['dp'],
  '递归': ['recursion', 'divide_conquer'],
  '分治': ['divide_conquer'],
  '倍增': ['binary_lifting'],
  '分块': ['sqrt_decomposition'],
  '莫队': ['sqrt_decomposition'],
  // 搜索
  'BFS': ['bfs', 'bidirectional_bfs', 'flood_fill'],
  'DFS': ['dfs', 'backtracking', 'flood_fill'],
  '搜索': ['dfs', 'bfs', 'backtracking'],
  '剪枝': ['backtracking', 'iterative_deepening'],
  '双向搜索': ['bidirectional_bfs'],
  '启发式搜索': ['heuristic_search'],
  '迭代加深': ['iterative_deepening'],
  '记忆化搜索': ['memoization', 'dp'],
  // 动态规划
  'DP': ['dp', 'memoization'],
  '区间DP': ['interval_dp'],
  '树形DP': ['tree_dp'],
  '状压DP': ['bitmask_dp'],
  '数位DP': ['dp'],
  '背包': ['knapsack'],
  '线性DP': ['dp'],
  '概率DP': ['probability', 'dp'],
  '期望DP': ['expected_value', 'dp'],
  'DP优化': ['dp_optimization', 'binary_lifting'],
  '单调队列优化': ['monotonic_queue', 'dp_optimization'],
  '斜率优化': ['dp_optimization'],
  '四边形不等式': ['dp_optimization'],
  // 字符串
  '字符串': ['kmp', 'trie', 'hash_table'],
  '哈希': ['hash_table'],
  'KMP': ['kmp'],
  'Trie树': ['trie', 'ac_automaton'],
  '字典树': ['trie', 'ac_automaton'],
  'AC自动机': ['ac_automaton'],
  '后缀数组': ['suffix_array', 'suffix_automaton'],
  '后缀自动机': ['suffix_automaton'],
  'Manacher': ['kmp'],
  'Z函数': ['kmp'],
  // 数据结构
  '数据结构': ['linked_list', 'stack', 'queue'],
  '栈': ['stack', 'monotonic_stack'],
  '单调栈': ['monotonic_stack'],
  '队列': ['queue', 'monotonic_queue'],
  '单调队列': ['monotonic_queue'],
  '链表': ['linked_list'],
  '堆': ['binary_heap'],
  '优先队列': ['binary_heap'],
  '并查集': ['disjoint_set'],
  '树状数组': ['fenwick'],
  '线段树': ['segment_tree', 'fenwick'],
  '平衡树': ['balanced_tree', 'bst'],
  'ST表': ['sparse_table'],
  '树链剖分': ['heavy_light_decomp'],
  'LCT': ['lct'],
  '可持久化': ['persistent_segtree'],
  '可持久化线段树': ['persistent_segtree'],
  '可持久化并查集': ['persistent_segtree', 'disjoint_set'],
  '珂朵莉树': ['balanced_tree'],
  // 图论
  '图论': ['graph', 'dag', 'bipartite_graph'],
  '树': ['tree', 'binary_tree'],
  '二叉树': ['binary_tree'],
  'LCA': ['lca'],
  '拓扑排序': ['topological_sort', 'dag'],
  '最短路': ['shortest_path', 'floyd'],
  '最小生成树': ['mst', 'disjoint_set'],
  '差分约束': ['shortest_path'],
  '连通性': ['scc', 'dfs'],
  '强连通分量': ['scc'],
  '双连通分量': ['graph', 'dfs'],
  '二分图': ['bipartite_graph', 'hungarian'],
  '网络流': ['network_flow', 'hungarian'],
  '费用流': ['network_flow'],
  '2-SAT': ['two_sat'],
  '欧拉回路': ['graph', 'dfs'],
  '哈密顿回路': ['graph', 'bitmask_dp'],
  '树的重心': ['tree', 'dfs'],
  '树的直径': ['tree', 'dfs'],
  // 数学
  '数学': ['number_theory', 'combinatorics'],
  '数论': ['number_theory', 'divisibility', 'gcd', 'prime_sieve', 'modular_arith', 'congruence'],
  '组合数学': ['combinatorics', 'permutation', 'combination'],
  '排列组合': ['permutation', 'combination'],
  '容斥': ['inclusion_exclusion'],
  '概率': ['probability', 'expected_value'],
  '期望': ['expected_value'],
  '矩阵': ['matrix', 'gaussian'],
  '线性代数': ['gaussian'],
  '高斯消元': ['gaussian'],
  '博弈论': ['nim'],
  '快速幂': ['binary_lifting'],
  '逆元': ['modular_inverse'],
  '素数': ['prime_sieve', 'divisibility'],
  '筛法': ['prime_sieve'],
  '欧拉函数': ['euler_theorem'],
  '欧拉定理': ['euler_theorem'],
  '费马小定理': ['fermat_little'],
  '中国剩余定理': ['crt'],
  '莫比乌斯反演': ['mobius'],
  'FFT': ['fft'],
  'NTT': ['fft'],
  '生成函数': ['generating_function'],
  '卡特兰数': ['catalan'],
  '斯特林数': ['stirling'],
  // 计算几何
  '计算几何': ['geometry'],
  '凸包': ['convex_hull'],
  // 其他
  '位运算': ['divisibility', 'number_bases'],
  '双指针': ['two_pointers'],
  '滑动窗口': ['sliding_window'],
  '扫描线': ['sweep_line', 'segment_tree'],
  '离散化': ['discretization'],
  '离线': ['discretization'],
  '随机化': ['probability'],
  '打表': ['enumeration'],
  'O2优化': [],
};

export function mapToUnifiedTopics(platform: string, rawTags: string[]): string[] {
  let tagMap: Record<string, string[]>;
  switch (platform) {
    case 'nowcoder':
      tagMap = NOWCODER_TAG_MAP;
      break;
    case 'luogu':
      tagMap = LUOGU_TAG_MAP;
      break;
    default:
      tagMap = LEETCODE_TAG_MAP;
  }
  const unified = new Set<string>();
  for (const raw of rawTags) {
    const mapped = tagMap[raw] || tagMap[raw.toLowerCase()];
    if (mapped) {
      for (const id of mapped) unified.add(id);
    }
  }
  return [...unified];
}
