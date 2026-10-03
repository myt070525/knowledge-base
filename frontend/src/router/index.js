import { createRouter, createWebHistory } from 'vue-router'

/**
 * 路由表
 * 用懒加载（() => import(...)）可以让首屏只加载当前页面，速度更快。
 */
const routes = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: '评测可视化看板' },
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/ChatView.vue'),
    meta: { title: '智能问答' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  document.title = to.meta?.title
    ? `${to.meta.title} · 农业智能问答系统`
    : '农业智能问答系统 · MCEval-AgriQA'
})

export default router
