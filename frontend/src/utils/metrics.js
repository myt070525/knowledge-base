/**
 * MCEval-AgriQA 评测指标处理
 *
 * ⚠️ 本项目最容易犯的设计错误：
 *    不同任务组的**分数量纲不同**：
 *      · closed_set / multi_label / completion → 0~100 的百分制
 *      · open_generation / reasoning          → LLM 打的 1~5 分
 *    所以**绝不能**把五个任务组混在一张图里比大小，那会误导人。
 *    正确做法：分任务组做小图（small multiples）；若要跨组比较，
 *    必须先在**组内**做归一化（见 normalizeWithinGroup）。
 *
 * 数据结构（与后端 /api/eval/experiments/{id}/metrics 保持一致）：
 * {
 *   meta: { id, label, displayName, split, total, note },
 *   runs: [{
 *     runId, modelId, displayName, promptId, promptName,
 *     metrics: {
 *       closed_set:      { acc, macro_f1, n },
 *       multi_label:     { em, micro_f1, n },
 *       completion:      { em, token_f1, n },
 *       open_generation: { llm_score, n },
 *       reasoning:       { llm_score, n }
 *     }
 *   }]
 * }
 */

/** 五个任务组的元信息。primary 是该组的“主指标”。 */
export const TASK_GROUPS = [
  {
    id: 'closed_set',
    name: '闭集分类',
    shortName: '闭集',
    questionTypes: '判断题 + 单选题',
    primary: 'acc',
    primaryLabel: 'Accuracy',
    secondary: 'macro_f1',
    secondaryLabel: 'Macro-F1',
    scale: 'percent',
    n: 179,
  },
  {
    id: 'multi_label',
    name: '多标签分类',
    shortName: '多标签',
    questionTypes: '多选题',
    primary: 'em',
    primaryLabel: 'EM',
    secondary: 'micro_f1',
    secondaryLabel: 'Micro-F1',
    scale: 'percent',
    n: 24,
  },
  {
    id: 'completion',
    name: '知识补全',
    shortName: '补全',
    questionTypes: '填空题',
    primary: 'em',
    primaryLabel: 'EM',
    secondary: 'token_f1',
    secondaryLabel: 'Token-F1',
    scale: 'percent',
    n: 139,
  },
  {
    id: 'open_generation',
    name: '开放生成',
    shortName: '开放生成',
    questionTypes: '术语解释 + 简答题',
    primary: 'llm_score',
    primaryLabel: 'LLM Score',
    secondary: null,
    secondaryLabel: null,
    scale: 'score5',
    n: 327,
  },
  {
    id: 'reasoning',
    name: '农业情景推理',
    shortName: '推理',
    questionTypes: '情景推理题',
    primary: 'llm_score',
    primaryLabel: 'LLM Score',
    secondary: null,
    secondaryLabel: null,
    scale: 'score5',
    n: 20,
  },
]

/** 按 id 取任务组元信息 */
export function getTaskGroup(groupId) {
  return TASK_GROUPS.find((g) => g.id === groupId) || null
}

/**
 * 取某次实验在某个任务组上的主指标值。
 * 缺失或为 null 时返回 null —— 注意：**绝不返回 0**。
 * 把“未评测”(null) 显示成 0 分是评审一眼能看出的硬伤。
 */
export function getPrimaryValue(run, groupId) {
  const group = getTaskGroup(groupId)
  if (!group || !run || !run.metrics) return null
  const bucket = run.metrics[groupId]
  if (!bucket) return null
  const value = bucket[group.primary]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 取次要指标值 */
export function getSecondaryValue(run, groupId) {
  const group = getTaskGroup(groupId)
  if (!group || !group.secondary || !run || !run.metrics) return null
  const bucket = run.metrics[groupId]
  if (!bucket) return null
  const value = bucket[group.secondary]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 格式化显示：null → “—” */
export function formatMetric(value, scale = 'percent') {
  if (value === null || value === undefined) return '—'
  if (scale === 'score5') return value.toFixed(2)
  return value.toFixed(1)
}

/**
 * 把某次实验的主指标转成 0~100 的“可比较分数”，用于热力图着色。
 * score5（1~5 分）线性映射到 0~100：score5 → (v - 1) / 4 * 100
 * percent 原样返回。
 */
export function toComparable(value, scale) {
  if (value === null || value === undefined) return null
  if (scale === 'score5') return ((value - 1) / 4) * 100
  return value
}

/**
 * 在一组 run 中，对某个任务组做组内 min-max 归一化，得到 0~1 的色阶值。
 * 只在**同一个任务组内部**比较，因此不会跨量纲出错。
 */
export function normalizeWithinGroup(runs, groupId) {
  const group = getTaskGroup(groupId)
  if (!group) return {}
  const raw = runs.map((run) => ({
    runId: run.runId,
    value: toComparable(getPrimaryValue(run, groupId), group.scale),
  }))
  const values = raw.filter((item) => item.value !== null).map((item) => item.value)
  const result = {}
  if (values.length === 0) {
    raw.forEach((item) => {
      result[item.runId] = null
    })
    return result
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  raw.forEach((item) => {
    if (item.value === null) {
      result[item.runId] = null
    } else if (span === 0) {
      result[item.runId] = 1
    } else {
      result[item.runId] = (item.value - min) / span
    }
  })
  return result
}

/** 找出某任务组上主指标最高的 run；缺失的跳过。 */
export function findBestRun(runs, groupId) {
  let best = null
  let bestValue = -Infinity
  runs.forEach((run) => {
    const value = getPrimaryValue(run, groupId)
    if (value !== null && value > bestValue) {
      bestValue = value
      best = run
    }
  })
  return best ? { run: best, value: bestValue } : null
}

/** 某任务组上，各 run 主指标的极差（最大值 - 最小值），用于描述“差异有多大”。 */
export function getSpread(runs, groupId) {
  const values = runs
    .map((run) => getPrimaryValue(run, groupId))
    .filter((value) => value !== null)
  if (values.length < 2) return null
  return Math.max(...values) - Math.min(...values)
}

/**
 * 为柱状图准备数据：x 轴是各 run 的显示名，y 轴是该任务组的主指标。
 * 返回 { xAxis: string[], values: (number|null)[], unit: string, max: number }
 */
export function buildBarSeries(runs, groupId) {
  const group = getTaskGroup(groupId)
  if (!group) return { xAxis: [], values: [], unit: '', max: 100, label: '' }
  return {
    xAxis: runs.map((run) => run.label || run.displayName || run.promptName || run.runId),
    values: runs.map((run) => getPrimaryValue(run, groupId)),
    unit: group.scale === 'score5' ? '分' : '%',
    max: group.scale === 'score5' ? 5 : 100,
    label: group.primaryLabel,
  }
}

/**
 * 生成一句自动结论，例如：
 * “提示策略对比：Few-shot-CoT 在 闭集分类 上最高（65.9%）”
 */
export function describeBest(runs, groupId) {
  const group = getTaskGroup(groupId)
  const best = findBestRun(runs, groupId)
  if (!group || !best) return `暂无数据`
  const unit = group.scale === 'score5' ? ' 分' : '%'
  return `${group.name}：${best.run.label || best.run.displayName || best.run.runId} 最高（${formatMetric(best.value, group.scale)}${unit}）`
}

/** 统计一次数据集里各任务组的样本量，用于顶部展示 */
export function totalSamples(runs) {
  const first = runs[0]
  if (!first || !first.metrics) return 0
  return TASK_GROUPS.reduce((sum, group) => {
    const bucket = first.metrics[group.id]
    return sum + (bucket && typeof bucket.n === 'number' ? bucket.n : 0)
  }, 0)
}

/**
 * 把后端的单次实验 metrics.json 归一化成 run 对象，
 * 便于把真实实验产物直接喂给看板。
 */
export function runFromMetricsJson(json) {
  return {
    runId: `${json.model_id}_${json.prompt_id}`,
    modelId: json.model_id,
    displayName: json.display_name || json.model_id,
    promptId: json.prompt_id,
    promptName: json.prompt_name || json.prompt_id,
    metrics: json.metrics || {},
  }
}
