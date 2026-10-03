<script setup>
/**
 * 跨任务组热力图
 *
 * ⚠️ 核心设计：因为五个任务组的量纲不同（0~100 百分比 vs 1~5 分），
 *    这里的颜色使用**组内归一化**后的值（0~100），
 *    但格子里显示的文字仍是**该组的真实原始分数**。
 *    这样既能一眼看出"哪一行整体更强"，又不会把不同量纲混为一谈。
 */
import { computed } from 'vue'
import EChart from './EChart.vue'
import {
  TASK_GROUPS,
  getPrimaryValue,
  normalizeWithinGroup,
  formatMetric,
} from '@/utils/metrics'

const props = defineProps({
  runs: { type: Array, required: true },
  height: { type: String, default: '360px' },
})

const option = computed(() => {
  const rows = props.runs
  const cols = TASK_GROUPS

  // 每个任务组各自做组内归一化
  const normalizedByGroup = {}
  cols.forEach((group) => {
    normalizedByGroup[group.id] = normalizeWithinGroup(rows, group.id)
  })

  const data = []
  const rawText = []
  rows.forEach((run, rowIndex) => {
    cols.forEach((group, colIndex) => {
      const normalized = normalizedByGroup[group.id][run.runId]
      const raw = getPrimaryValue(run, group.id)
      data.push([colIndex, rowIndex, normalized === null ? null : Math.round(normalized * 100)])
      rawText.push({
        colIndex,
        rowIndex,
        text: formatMetric(raw, group.scale),
        missing: raw === null,
      })
    })
  })

  const textMap = {}
  rawText.forEach((item) => {
    textMap[`${item.colIndex}-${item.rowIndex}`] = item
  })

  return {
    grid: { left: 150, right: 90, top: 40, bottom: 60 },
    tooltip: {
      position: 'top',
      formatter: (params) => {
        const [colIndex, rowIndex] = params.data
        const group = cols[colIndex]
        const run = rows[rowIndex]
        const raw = getPrimaryValue(run, group.id)
        return [
          `<b>${run.label || run.displayName}</b>`,
          `${group.name}（${group.primaryLabel}）`,
          `分数：${formatMetric(raw, group.scale)}${group.scale === 'score5' ? ' 分' : '%'}`,
          raw === null ? '<span style="color:#ef6c00">未评测</span>' : '',
        ]
          .filter(Boolean)
          .join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: cols.map((group) => group.shortName),
      splitArea: { show: true },
      axisLabel: { fontSize: 12 },
    },
    yAxis: {
      type: 'category',
      data: rows.map((run) => run.label || run.displayName || run.runId),
      splitArea: { show: true },
      axisLabel: { fontSize: 12 },
      // ECharts 的类目轴默认从下往上排，inverse 让它与数据顺序一致（第一项在最上面）
      inverse: true,
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: 'vertical',
      right: 8,
      top: 'center',
      text: ['组内相对\n表现好', '差'],
      textStyle: { fontSize: 11 },
      inRange: { color: ['#fff3e0', '#ffe0b2', '#c8e6c9', '#66bb6a', '#2e7d32'] },
    },
    series: [
      {
        name: '组内相对表现',
        type: 'heatmap',
        data,
        label: {
          show: true,
          fontSize: 12,
          formatter: (params) => {
            const [colIndex, rowIndex] = params.data
            const item = textMap[`${colIndex}-${rowIndex}`]
            if (!item) return ''
            return item.missing ? '—' : item.text
          },
          color: '#1f2d1f',
        },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.3)' },
        },
      },
    ],
  }
})
</script>

<template>
  <div class="chart-card">
    <div class="chart-card__head">
      <div class="chart-card__title">任务组 × 配置 全景热力图</div>
      <div class="chart-card__unit">颜色 = 组内相对表现 · 数字 = 真实分数</div>
    </div>
    <EChart :option="option" :height="height" />
    <div class="chart-card__note">
      颜色在**每个任务组内部**单独归一化（0~100），因此横向看列内比较才有意义，
      <strong>不要跨列比颜色深浅</strong>——因为百分比和 1~5 分不是一回事。
    </div>
  </div>
</template>
