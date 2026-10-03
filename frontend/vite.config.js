import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // 把第三方大库拆成独立 chunk：
    //   好处 1：浏览器可以并行下载、并长期缓存（业务代码改了不用重下 echarts）
    //   好处 2：避免出现单个 1MB+ 的巨型 bundle，首屏更快
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts'],
          'element-plus': ['element-plus'],
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
        },
      },
    },
    // 拆包后各 chunk 仍然偏大（ECharts/Element Plus 本身就有几百 KB），
    // 把告警阈值调高到 800KB，避免刷屏。进一步优化可用"按需引入"。
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      // 开发期跨域代理：
      //   前端请求 /api/qa/ask  →  实际转发到 http://localhost:8080/api/qa/ask
      // 这样浏览器看到的是同源请求，不会触发 CORS 限制。
      // 后端同学的服务端口如果不是 8080，改这里即可。
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
