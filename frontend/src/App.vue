<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeIndex = computed(() => route.path)
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__brand">🌾 农业智能问答系统</div>
      <div class="app-header__sub">基于 MCEval-AgriQA</div>

      <el-menu
        :default-active="activeIndex"
        mode="horizontal"
        router
        :ellipsis="false"
        class="app-header__nav"
      >
        <el-menu-item index="/dashboard">评测可视化看板</el-menu-item>
        <el-menu-item index="/chat">智能问答</el-menu-item>
      </el-menu>

      <div class="app-header__spacer" />
      <el-tag type="success" effect="plain" size="small">计算机设计大赛</el-tag>
    </header>

    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
}

.app-header__nav {
  border-bottom: none !important;
  height: 60px;
}
</style>
