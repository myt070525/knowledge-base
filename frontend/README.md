# 农业智能问答系统 · 前端

基于 **MCEval-AgriQA** 的中文农业智能问答系统，负责用户界面与数据可视化。

> 技术栈：Vue 3 + Vite + Element Plus + Axios + ECharts + Vue Router + Pinia

---

## 一、5 分钟跑起来

```powershell
cd frontend
npm install        # 首次运行需要，约 40 秒
npm run dev        # 启动开发服务器
```

浏览器打开 **http://127.0.0.1:5173** —— 默认进入「评测可视化看板」。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（改代码自动刷新） |
| `npm run build` | 打包生产版本到 `dist/` |
| `npm run preview` | 预览打包结果 |
| `npm run verify` | **校验指标计算逻辑**（27 项断言，秒级） |
| `node scripts/screenshot.mjs` | 真实浏览器渲染检查 + 自动截图 |

> 💡 `npm run dev` 必须保持运行，截图脚本才能在另一个终端工作。

---

## 二、现在完成了什么

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 评测可视化看板 | ✅ 可用 | 数据为论文 Table 4 / Table 5 的真实数字 |
| 智能问答界面 | 🟡 骨架 | 用 Mock 数据演示流式效果，**尚未接入后端** |
| 前后端联调 | ⬜ 未开始 | 等后端接口就绪 |

截图见 `screenshots/` 目录。

### 看板包含四层

1. **分组小图**（small multiples）—— 每个任务组一张柱状图，深绿色为最优
2. **全景热力图** —— 组内归一化配色，格子里显示真实分数
3. **自动结论表** —— 结论由数据实时计算，不是写死的文案
4. **指标说明表** —— 解释每个指标为什么存在

---

## 三、目录结构

```
frontend/
├── index.html
├── vite.config.js          # 别名 @、开发代理、构建拆包
├── package.json
├── scripts/
│   ├── verify-data.mjs     # 指标逻辑断言（npm run verify）
│   └── screenshot.mjs      # 无头浏览器渲染检查 + 截图
├── screenshots/            # 自动生成的页面截图
└── src/
    ├── main.js             # 应用入口
    ├── App.vue             # 顶部导航 + 路由出口
    ├── router/index.js     # 路由表
    ├── styles/main.css     # 全局样式与设计令牌（CSS 变量）
    ├── utils/metrics.js    # ★ 指标计算（纯函数，可 Node 直接测试）
    ├── data/               # 论文基线数据（与后端 metrics.json 同构）
    │   ├── paper-table4.json
    │   └── paper-table5.json
    ├── components/
    │   ├── EChart.vue           # ECharts 基础封装（init/resize/dispose）
    │   ├── TaskGroupBarChart.vue # 单任务组柱状图
    │   └── MetricHeatmap.vue     # 跨任务组热力图
    └── views/
        ├── DashboardView.vue # 评测看板
        └── ChatView.vue      # 智能问答
```

---

## 四、务必理解的两个设计原则

### 1. 不同题型的分数量纲不同，不能混在一张图里比大小

| 任务组 | 主指标 | 量纲 |
| --- | --- | --- |
| 闭集分类 | Accuracy | 0~100 % |
| 多标签分类 | EM | 0~100 % |
| 知识补全 | EM | 0~100 % |
| 开放生成 | LLM Score | **1~5 分** |
| 农业情景推理 | LLM Score | **1~5 分** |

所以看板按任务组分栏呈现；热力图的颜色使用**组内归一化**（`normalizeWithinGroup`），
保证不会拿百分比和 1~5 分直接比大小。

### 2. "未评测" 绝不能显示成 0 分

当某个指标是 `null`（例如没配 Judge API Key 时 `llm_score` 为 null），
界面必须显示 **"—"**，而不是 0。把 null 当 0 是评审一眼能看出的硬伤。

代码里所有取值函数在缺失时都返回 `null`，`formatMetric()` 负责显示成 `—`。
`npm run verify` 里有专门的断言守着这条规则。

---

## 五、接入真实实验数据

看板的数据结构（`src/data/paper-table5.json`）**刻意与后端接口保持一致**：

```json
{
  "meta": { "id": "...", "label": "...", "note": "..." },
  "runs": [{
    "runId": "...", "displayName": "...", "promptId": "...", "promptName": "...",
    "metrics": {
      "closed_set":      { "acc": 65.4, "macro_f1": 63.4, "n": 179 },
      "multi_label":     { "em": 37.5, "micro_f1": 86.7, "n": 24 },
      "completion":      { "em": 9.4,  "token_f1": 42.7, "n": 139 },
      "open_generation": { "llm_score": 2.96, "n": 327 },
      "reasoning":       { "llm_score": 4.15, "n": 20 }
    }
  }]
}
```

本机跑出的真实结果（`runs/*/*.metrics.json`）字段名基本一致，
可用 `utils/metrics.js` 里的 `runFromMetricsJson()` 转换后直接喂给看板。

---

## 六、下一步（按优先级）

1. **接后端**：把 `ChatView.vue` 里的 `fakeStream()` 换成真实 SSE 请求（代码里有 TODO 模板）；
2. **会话管理**：左侧会话列表 + Pinia 状态管理；
3. **问答历史持久化**：调用后端 `/api/sessions` 系列接口；
4. **看板下钻**：点击柱子查看该配置下的单题明细；
5. **按需引入**：Element Plus 与 ECharts 目前是全量引入（bundle 较大），
   后期可改成按需引入进一步减小体积。

---

## 七、学习建议

这个项目的代码量不大，但每个文件都写了详细注释，**建议按这个顺序读**：

1. `src/main.js` → `src/App.vue` → `src/router/index.js`（搞懂应用怎么启动、页面怎么切换）
2. `src/utils/metrics.js`（纯逻辑，最好懂，也是最重要的业务规则）
3. `src/components/EChart.vue`（学 Vue 生命周期 + 第三方库集成的标准套路）
4. `src/views/DashboardView.vue`（学数据 → 图表的映射）
5. `src/views/ChatView.vue`（学交互状态管理、流式效果）

遇到不懂的语法，查 [Vue3 官方中文文档](https://cn.vuejs.org/) —— 这是最权威也最快的资料。
