#!/usr/bin/env node
/**
 * 数据与指标逻辑校验脚本
 *
 * 为什么需要它？—— 看板跑在浏览器里，改一行代码要刷新页面才知道对不对。
 * 把"计算逻辑"抽成纯函数（src/utils/metrics.js）后，就可以用 Node 直接断言，
 * 几秒钟跑完，比手动点页面靠谱得多。
 *
 * 运行：npm run verify
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  TASK_GROUPS,
  getPrimaryValue,
  findBestRun,
  normalizeWithinGroup,
  toComparable,
  formatMetric,
  buildBarSeries,
  totalSamples,
  describeBest,
} from '../src/utils/metrics.js'

const here = dirname(fileURLToPath(import.meta.url))
const readJson = (name) =>
  JSON.parse(readFileSync(resolve(here, `../src/data/${name}`), 'utf-8'))

const table5 = readJson('paper-table5.json')
const table4 = readJson('paper-table4.json')

let passed = 0
let failed = 0
const problems = []

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    problems.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

// ---------------------------------------------------------------- 1. 数据结构
section('1. 数据结构完整性')

check('Table 5 有 5 个 run（5 种提示策略）', table5.runs.length === 5, `实际 ${table5.runs.length}`)
check('Table 4 有 6 个 run（6 个模型）', table4.runs.length === 6, `实际 ${table4.runs.length}`)

for (const dataset of [table5, table4]) {
  const label = dataset.meta.id
  const complete = dataset.runs.every((run) =>
    TASK_GROUPS.every((group) => run.metrics[group.id] !== undefined),
  )
  check(`${label}: 每条 run 都覆盖全部 5 个任务组`, complete)
}

check('test 集总题量 = 689', totalSamples(table5.runs) === 689, `实际 ${totalSamples(table5.runs)}`)

const groupSum = TASK_GROUPS.reduce((sum, group) => sum + group.n, 0)
check('5 个任务组题量之和 = 689', groupSum === 689, `实际 ${groupSum}`)

// ------------------------------------------------------- 2. 缺失值必须为 null
section('2. 缺失值安全（绝不能把"未评测"当成 0 分）')

check('不存在的任务组返回 null', getPrimaryValue({ metrics: {} }, 'closed_set') === null)
check('不存在的 run 返回 null', getPrimaryValue(null, 'closed_set') === null)
check('formatMetric(null) 显示为 —', formatMetric(null, 'percent') === '—')

const withMissing = {
  runId: 'x',
  metrics: { closed_set: { acc: null, n: 179 } },
}
check('指标值为 null 时返回 null 而不是 0', getPrimaryValue(withMissing, 'closed_set') === null)

// ---------------------------------------------------------- 3. 归一化与量纲
section('3. 量纲转换（1~5 分 → 0~100）')

check('toComparable(1, score5) = 0', toComparable(1, 'score5') === 0)
check('toComparable(5, score5) = 100', toComparable(5, 'score5') === 100)
check('toComparable(3, score5) = 50', toComparable(3, 'score5') === 50)
check('toComparable 对百分制原样返回', toComparable(65.9, 'percent') === 65.9)

// --------------------------------------------------------------- 4. 组内归一化
section('4. 组内归一化（热力图配色依据）')

const normalized = normalizeWithinGroup(table5.runs, 'closed_set')
const values = Object.values(normalized).filter((v) => v !== null)
check('归一化结果全部落在 [0,1]', values.every((v) => v >= 0 && v <= 1))
check('最小值归一化为 0', Math.min(...values) === 0)
check('最大值归一化为 1', Math.max(...values) === 1)

// 跨量纲必须分组归一化：推理组是 1~5 分，不能和百分制混算
const reasonNormalized = normalizeWithinGroup(table5.runs, 'reasoning')
check(
  '推理组（1~5 分）也能正确归一化到 [0,1]',
  Object.values(reasonNormalized).every((v) => v === null || (v >= 0 && v <= 1)),
)

// ------------------------------------------------------------- 5. 最优值判定
section('5. 最优判定（对照论文结论）')

const ml = findBestRun(table5.runs, 'multi_label')
check(
  'Table 5 多标签最优 = Few-shot Role（论文结论）',
  ml?.run.promptId === 'role_prompt',
  `实际 ${ml?.run.promptId} (${ml?.value})`,
)

const reason = findBestRun(table5.runs, 'reasoning')
check(
  'Table 5 推理最优 = Few-shot-CoT',
  reason?.run.promptId === 'few_shot_cot',
  `实际 ${reason?.run.promptId} (${reason?.value})`,
)

const closed = findBestRun(table5.runs, 'closed_set')
check(
  'Table 5 闭集最优 = Few-shot-CoT (65.9)',
  closed?.run.promptId === 'few_shot_cot' && closed.value === 65.9,
  `实际 ${closed?.run.promptId} (${closed?.value})`,
)

const modelClosed = findBestRun(table4.runs, 'closed_set')
check(
  'Table 4 闭集最优 = Agri-LoRA (67.0)',
  modelClosed?.run.modelId === 'qwen2_5_7b_agri_lora' && modelClosed.value === 67.0,
  `实际 ${modelClosed?.run.modelId} (${modelClosed?.value})`,
)

const modelCompletion = findBestRun(table4.runs, 'completion')
check(
  'Table 4 补全最优 = Agri-LoRA（论文称微调"持续提升输出质量"）',
  modelCompletion?.run.modelId === 'qwen2_5_7b_agri_lora',
  `实际 ${modelCompletion?.run.modelId} (${modelCompletion?.value})`,
)

// --------------------------------------------------------------- 6. 图表数据
section('6. 图表数据结构')

const bar = buildBarSeries(
  table5.runs.map((r) => ({ ...r, label: r.promptName })),
  'closed_set',
)
check('柱状图 x 轴 5 项', bar.xAxis.length === 5)
check('柱状图 y 轴 5 个值', bar.values.length === 5)
check('百分制任务组 y 轴上限 100', bar.max === 100)

const scoreBar = buildBarSeries(
  table5.runs.map((r) => ({ ...r, label: r.promptName })),
  'reasoning',
)
check('1~5 分任务组 y 轴上限 5（不是 100）', scoreBar.max === 5, `实际 ${scoreBar.max}`)

// ------------------------------------------------- 7. 交叉核对论文内部一致性
section('7. 论文内部一致性检查')

const lora = table4.runs.find((r) => r.modelId === 'qwen2_5_7b_agri_lora')
const qwen3 = table4.runs.find((r) => r.modelId === 'qwen3_8b')
const loraReason = getPrimaryValue(lora, 'reasoning')
const qwen3Reason = getPrimaryValue(qwen3, 'reasoning')

console.log(`  · Table 4 推理分数：Agri-LoRA ${loraReason} vs Qwen3-8B ${qwen3Reason}`)
if (loraReason === 4.6 && qwen3Reason === 4.5) {
  console.log(
    '  ⚠ 注意：论文正文写"Agri-LoRA 取得最高推理分 4.50"，但 Table 4 中 Agri-LoRA 是 4.60、' +
      'Qwen3-8B 才是 4.50 —— 正文与表格不一致。做复现实验时要留意，建议以原始 PDF 为准。',
  )
  problems.push('论文正文与 Table 4 的推理分数不一致（4.50 vs 4.60），需人工核对')
}

// ------------------------------------------------------------------- 汇总
console.log(`\n${'='.repeat(64)}`)
console.log(`通过 ${passed} 项，失败 ${failed} 项`)
if (problems.length) {
  console.log('\n需要关注：')
  problems.forEach((item) => console.log(`  - ${item}`))
}
console.log(`${'='.repeat(64)}\n`)

if (failed > 0) {
  console.error('校验未通过。')
  process.exit(1)
}
console.log('全部断言通过。')
