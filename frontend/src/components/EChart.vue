<script setup>
/**
 * ECharts 基础封装组件
 *
 * 为什么需要封装？—— 因为每个图表都要处理同样的四件事：
 *   1. 初始化（必须在 DOM 渲染之后）
 *   2. 数据变化时更新图表
 *   3. 容器尺寸变化时 resize（否则缩窗口图表就错位）
 *   4. 组件销毁时 dispose（否则内存泄漏）
 * 封装一次，所有图表复用。
 *
 * 用法：
 *   <EChart :option="chartOption" height="300px" />
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '260px' },
})

const container = ref(null)
// 用 shallowRef：ECharts 实例是个大对象，不需要 Vue 深度监听它
const chart = shallowRef(null)
let resizeObserver = null

function render() {
  if (!chart.value) return
  // notMerge = true：彻底替换配置，避免新旧数据混在一起
  chart.value.setOption(props.option, true)
}

function handleResize() {
  if (chart.value) chart.value.resize()
}

onMounted(() => {
  if (!container.value) return
  chart.value = echarts.init(container.value)
  render()

  // ResizeObserver 比监听 window.resize 更准：侧边栏收起等局部变化也能捕获
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container.value)
  }
  window.addEventListener('resize', handleResize)
})

watch(() => props.option, render, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (chart.value) {
    chart.value.dispose()
    chart.value = null
  }
})
</script>

<template>
  <div ref="container" :style="{ width: '100%', height }" />
</template>
