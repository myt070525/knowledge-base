<script setup>
/**
 * 单任务组对比柱状图（small multiples 中的一小格）
 *
 * 设计要点：**一个任务组一张图**，绝不把不同量纲的任务混在一起。
 */
import { computed } from 'vue'
import EChart from './EChart.vue'
import { getTaskGroup, buildBarSeries, findBestRun } from '@/utils/metrics'

const props = defineProps({
  runs: { type: Array, required: true },
  groupId: { type: String, required: true },
  height: { type: String, default: '260px' },
})

const group = computed(() => getTaskGroup(props.groupId))

const series = computed(() => buildBarSeries(props.runs, props.groupId))

const bestRunId = computed(() => findBestRun(props.runs, props.groupId)?.run?.runId)

const unitText = computed(() => (group.value?.scale === 'score5' ? '分（1~5）' : '%'))

const option = computed(() => {
  const { xAxis, values, max } = series.value
  return {
    grid: { left: 48, right: 16, top: 28, bottom: 60 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => (v === null || v === undefined ? '未评测' : `${v}${unitText.value.slice(0, 1) === '分' ? ' 分' : '%'}`),
    },
    xAxis: {
      type: 'category',
      data: xAxis,
      axisLabel: {
        interval: 0,
        fontSize: 11,
        // 名称太长就竖排，避免互相遮挡
        formatter: (name) => (name.length > 6 ? name.replace(/(.{6})/g, '$1\n') : name),
      },
    },
    yAxis: {
      type: 'value',
      max,
      name: series.value.label,
      nameTextStyle: { fontSize: 11, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#eef0ee' } },
    },
    series: [
      {
        type: 'bar',
        data: values.map((value, index) => ({
          value,
          itemStyle: {
            color:
              props.runs[index]?.runId === bestRunId.value
                ? '#2e7d32'
                : '#a5d6a7',
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barMaxWidth: 46,
        label: {
          show: true,
          position: 'top',
          fontSize: 11,
          formatter: ({ value }) =>
            value === null || value === undefined ? '未评测' : String(value),
        },
      },
    ],
  }
})
</script>

<template>
  <div class="chart-card">
    <div class="chart-card__head">
      <div class="chart-card__title">{{ group?.name }}</div>
      <div class="chart-card__unit">{{ group?.primaryLabel }} · {{ unitText }}</div>
    </div>
    <EChart :option="option" :height="height" />
    <div class="chart-card__note">
      题型：{{ group?.questionTypes }} · test 集 {{ group?.n }} 题 · 深绿色为最优
    </div>
  </div>
</template>
