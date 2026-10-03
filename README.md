# 知识库（Knowledge Base）

软件工程专业竞赛项目仓库。

> 状态：项目脚手架已就绪，功能开发待启动。

## 项目简介

本仓库用于承载「知识库」竞赛项目的全部源码、文档与交付物。

- **项目定位**：待补充
- **目标用户**：待补充
- **核心功能**：待补充
- **技术栈**：待补充

## 仓库结构

```
.
├── README.md          项目说明（本文件）
├── CHANGELOG.md       更新日志
├── .gitignore         版本控制忽略规则
├── .gitattributes     换行符与文件类型规范
├── docs/              设计文档、任务理解、上手指南
├── configs/           模型配置（含本地 llama.cpp 接入配置）
├── scripts/           自研脚本（如任务子集生成器）
├── src/               源代码
└── tests/             测试用例
```

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [01-任务理解与方案](docs/01-任务理解与方案.md) | 项目背景、数据统计、框架解析、论文基线、可行性评估 |
| [02-上手指南](docs/02-上手指南.md) | 手把手导览：数据长什么样、一次评测怎么跑、指标怎么算、代码改哪里 |

## 快速开始

本项目基于导师提供的 **MCEval-AgriQA**（中文农业问答多维能力评测框架）。
原始材料放在 `老师给的资料/`（**已 gitignore，不入库**），需先从导师处获取。

```powershell
# 0. 环境
$PY = "C:\Users\ABC\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
$env:PYTHONIOENCODING = "utf-8"

# 1. 启动本地模型（Qwen3-8B，注意关闭思考模式）
cd C:\Users\ABC\llama-cpp
$env:LLAMA_ARG_CHAT_TEMPLATE_KWARGS = '{"enable_thinking": false}'
.\llama-server.exe -m models\Qwen3-8B-Q4_K_M.gguf -ngl 99 --host 127.0.0.1 --port 8080 `
    -c 32768 -np 1 -b 2048 -ub 256 --alias qwen3-8b --api-key sk-local-qwen3

# 2. 生成任务子集（closed_set/multi_label/completion/open_generation/reasoning）
& $PY scripts\make_subsets.py --make-demo

# 3. 跑评测（示例：5 题冒烟测试）
$env:LLAMACPP_API_KEY = "sk-local-qwen3"
& $PY "老师给的资料\MCEval_AgriQA代码\runners\run_experiment.py" `
    --model-config configs\models\qwen3_8b_llamacpp_local.yaml `
    --prompt-config "老师给的资料\MCEval_AgriQA代码\configs\prompts\zero_shot.yaml" `
    --input-file data\subsets\demo.jsonl `
    --fewshot-file "老师给的资料\MCEval_AgriQA代码\dataset\dev.jsonl" `
    --split test --seed 8888 --model-seed 8888 `
    --output-dir runs\demo_zero_shot --overwrite
```

详见 [上手指南](docs/02-上手指南.md)。

> 目录结构为初始约定，随项目推进调整。

## 开发规范

### 提交信息约定

采用约定式提交（Conventional Commits），中文描述：

| 前缀 | 含义 |
| --- | --- |
| `feat:` | 新功能 |
| `fix:` | 缺陷修复 |
| `docs:` | 文档变更 |
| `refactor:` | 重构 |
| `test:` | 测试相关 |
| `chore:` | 构建、依赖、配置等杂项 |

示例：

```
feat: 实现知识条目全文检索接口
docs: 补充需求分析文档
```

### 分支约定

- `main`：稳定分支，始终保持可运行
- `dev`：日常开发集成分支
- `feature/xxx`：单个功能分支

## 开发环境

- Windows 10/11
- Git 2.53+
- 其他依赖待补充

## 许可

待定（尚未添加 LICENSE）。
