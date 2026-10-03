<script setup>
/**
 * 评测可视化看板
 *
 * 数据来源：论文《MCEval-AgriQA》Table 4 / Table 5
 * 数据结构刻意与后端 /api/eval/experiments/{id}/metrics 保持一致，
 * 将来把真实实验产物（runs/*.metrics.json）接进来即可，不用改视图代码。
 */
import { computed, ref } from 'vue'

import paperTable5 from '@/data/paper-table5.json'
import paperTable4 from '@/data/paper-table4.json'

import TaskGroupBarChart from '@/components/TaskGroupBarChart.vue'
import MetricHeatmap from '@/components/MetricHeatmap.vue'

import {
  TASK_GROUPS,
  describeBest,
  findBestRun,
  getPrimaryValue,
  getSpread,
  formatMetric,
} from '@/utils/metrics'

const activeTab = ref('prompt')

const promptDataset = paperTable5
const modelDataset = paperTable4

/** 提示策略对比：x 轴用提示策略名 */
const promptRuns = computed(() =>
  promptDataset.runs.map((run) => ({ ...run, label: run.promptName })),
)

/** 模型对比：x 轴用模型名 */
const modelRuns = computed(() =>
  modelDataset.runs.map((run) => ({ ...run, label: run.displayName })),
)

const currentRuns = computed(() =>
  activeTab.value === 'prompt' ? promptRuns.value : modelRuns.value,
)

const currentDataset = computed(() =>
  activeTab.value === 'prompt' ? promptDataset : modelDataset,
)

/** 自动生成每个任务组的结论 */
const insights = computed(() =>
  TASK_GROUPS.map((group) => ({
    group,
    text: describeBest(currentRuns.value, group.id),
    spread: getSpread(currentRuns.value, group.id),
  })),
)

/** 关键结论（来自论文，用数据说话而不是硬编） */
const keyFindings = computed(() => {
  const runs = currentRuns.value
  const lines = []

  const mlBest = findBestRun(runs, 'multi_label')
  if (mlBest) {
    lines.push({
      title: '多选题（多标签分类）',
      body: `最优配置是「${mlBest.run.label}」，EM ${formatMetric(mlBest.value, 'percent')}%。论文指出角色扮演（Few-shot Role）能促使模型"像农业专家一样思考"，特别适合多标签判断；而 CoT 会让模型逐个验证选项、过于保守反而漏选。`,
    })
  }

  const reasonBest = findBestRun(runs, 'reasoning')
  if (reasonBest) {
    lines.push({
      title: '农业情景推理',
      body: `最优配置是「${reasonBest.run.label}」，LLM Score ${formatMetric(reasonBest.value, 'score5')} 分。情景推理是复杂任务，显式的分步推理（CoT）能明显提升表现——这与闭集任务恰好相反。`,
    })
  }

  const closedBest = findBestRun(runs, 'closed_set')
  if (closedBest) {
    lines.push({
      title: '闭集分类（判断题 / 单选题）',
      body: `最优配置是「${closedBest.run.label}」，Accuracy ${formatMetric(closedBest.value, 'percent')}%。闭集题答案空间小，复杂提示带来的增益有限，简单清晰的输出约束反而更稳。`,
    })
  }

  return lines
})
</script>

<template>
  <div>
    <!-- ============ 顶部说明 ============ -->
    <div class="section">
      <h2 class="section__title">评测可视化看板</h2>
      <p class="section__desc">
        把论文里两张静态表格，变成可交互、可下钻的可视化看板。
        数据为 <strong>MCEval-AgriQA</strong> 在 689 题 test 集上的结果。
      </p>

      <el-alert type="warning" :closable="false" show-icon>
        <template #title>看板设计的第一原则：不同题型的分数量纲不同，不能混在一张图里比大小</template>
        <div style="font-size: 13px; line-height: 1.8; margin-top: 4px">
          闭集 / 多标签 / 补全 → 百分制 <strong>0~100</strong>；
          开放生成 / 推理 → LLM 打分 <strong>1~5</strong>。
          所以本看板按<strong>任务组分栏</strong>呈现（small multiples）；
          全景热力图的颜色使用<strong>组内归一化</strong>，格子里仍显示真实分数。
        </div>
      </el-alert>
    </div>

    <!-- ============ 数据来源 ============ -->
    <div class="section">
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
        <el-radio-group v-model="activeTab">
          <el-radio-button value="prompt">同一模型 · 对比 5 种提示策略</el-radio-button>
          <el-radio-button value="model">同一提示 · 对比 6 个模型</el-radio-button>
        </el-radio-group>

        <el-tag class="badge--paper" effect="plain">
          {{ currentDataset.meta.label }}（论文数据）
        </el-tag>
        <span class="muted" style="font-size: 12px">
          {{ currentDataset.meta.note }}
        </span>
      </div>
    </div>

    <!-- ============ 分组柱状图（small multiples） ============ -->
    <div class="section">
      <h3 class="section__title">
        {{ activeTab === 'prompt' ? '提示策略 × 任务组' : '模型 × 任务组' }}
      </h3>
      <p class="section__desc">
        每个任务组独立成图，纵轴是该组的<strong>主指标</strong>。深绿色柱子为该组最优。
      </p>

      <div class="grid grid--3">
        <TaskGroupBarChart
          v-for="group in TASK_GROUPS"
          :key="group.id"
          :runs="currentRuns"
          :group-id="group.id"
        />
      </div>
    </div>

    <!-- ============ 热力图 ============ -->
    <div class="section">
      <h3 class="section__title">全景热力图</h3>
      <p class="section__desc">
        一屏看完所有配置在所有任务组上的相对表现。用于快速定位"哪套配置整体更均衡"。
      </p>
      <MetricHeatmap :runs="currentRuns" height="380px" />
    </div>

    <!-- ============ 自动结论 ============ -->
    <div class="section">
      <h3 class="section__title">数据说了什么</h3>
      <p class="section__desc">以下结论由当前数据自动计算得出，不是写死的文案。</p>

      <el-table :data="insights" stripe style="width: 100%">
        <el-table-column prop="group.name" label="任务组" width="150" />
        <el-table-column label="主指标" width="130">
          <template #default="{ row }">
            {{ row.group.primaryLabel }}
            <el-tag size="small" type="info" effect="plain">
              {{ row.group.scale === 'score5' ? '1~5 分' : '0~100 %' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最优配置" width="200">
          <template #default="{ row }">
            {{ findBestRun(currentRuns, row.group.id)?.run?.label || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="分数" width="100">
          <template #default="{ row }">
            {{
              formatMetric(getPrimaryValue(
                findBestRun(currentRuns, row.group.id)?.run,
                row.group.id,
              ), row.group.scale)
            }}{{ row.group.scale === 'score5' ? ' 分' : '%' }}
          </template>
        </el-table-column>
        <el-table-column label="配置间最大差距" width="140">
          <template #default="{ row }">
            <span v-if="row.spread === null">—</span>
            <span v-else>
              {{ row.spread.toFixed(1) }}{{ row.group.scale === 'score5' ? ' 分' : '%' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="text" label="结论" min-width="240" />
      </el-table>
    </div>

    <!-- ============ 论文核心发现 ============ -->
    <div class="section">
      <h3 class="section__title">论文核心发现（答辩护城河）</h3>
      <p class="section__desc">这几条是答辩时最可能被问到的"为什么"，建议背熟。</p>

      <div class="grid grid--2">
        <div v-for="item in keyFindings" :key="item.title" class="callout">
          <strong>{{ item.title }}</strong>
          <div style="margin-top: 6px">{{ item.body }}</div>
        </div>
      </div>
    </div>

    <!-- ============ 指标说明 ============ -->
    <div class="section">
      <h3 class="section__title">指标说明</h3>
      <p class="section__desc">
        为什么同一份答卷要用这么多不同的指标？因为不同题型的"对"不一样。
      </p>

      <el-table :data="TASK_GROUPS" stripe style="width: 100%">
        <el-table-column prop="name" label="任务组" width="150" />
        <el-table-column prop="questionTypes" label="包含题型" width="200" />
        <el-table-column prop="n" label="test 题量" width="100" align="right" />
        <el-table-column label="主指标" width="120">
          <template #default="{ row }">{{ row.primaryLabel }}</template>
        </el-table-column>
        <el-table-column label="次要指标" width="130">
          <template #default="{ row }">{{ row.secondaryLabel || '无' }}</template>
        </el-table-column>
        <el-table-column label="说明" min-width="280">
          <template #default="{ row }">
            <template v-if="row.id === 'closed_set'">
              单标签闭集。Accuracy 看整体命中率，Macro-F1 能暴露"只会猜高频答案"的问题。
            </template>
            <template v-else-if="row.id === 'multi_label'">
              多标签。EM 要求选项集合完全一致（严格），Micro-F1 给出部分分（宽容）。
            </template>
            <template v-else-if="row.id === 'completion'">
              填空。EM 先做归一化（去空格标点）再比对；Token-F1 衡量字词级重叠，
              避免"意思对但用词不同"被误判为 0 分。
            </template>
            <template v-else>
              开放题没有唯一答案，字符串比对无意义，改由 LLM Judge 按农业评分细则打 1~5 分
              （事实正确性、完整性、相关性、专业表达、推理质量、实用建议）。
            </template>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
