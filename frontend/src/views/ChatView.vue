<script setup>
/**
 * 智能问答界面（骨架版）
 *
 * 当前状态：使用本地 Mock 数据模拟"流式输出"，**不依赖后端**就能看到效果。
 * 等后端接口就绪后，把 fakeStream() 换成真实请求即可（见下方 TODO）。
 *
 * 这里演示了三个关键交互模式，都是你后面要真正实现的：
 *   1. 打字机效果 —— 用定时器逐字追加（真流式要用 SSE，见 TODO）
 *   2. 引用来源卡片 —— RAG 的可解释性卖点，答辩加分项
 *   3. 加载 / 停止生成 —— 真实系统必须有的状态
 */
import { nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'

const messages = ref([
  {
    role: 'assistant',
    content:
      '你好！我是农业知识问答助手。可以问我作物栽培、病虫害防治、农业政策等问题。\n\n我的回答基于农业知识库检索，下方会展示参考的知识来源，方便你核对。',
    sources: [],
  },
])

const input = ref('')
const generating = ref(false)
const scrollArea = ref(null)

/** Mock 知识库：真实场景下这些来自 RAG 检索结果 */
const MOCK = [
  {
    keywords: ['水稻', '需水', '临界期', '灌溉'],
    answer:
      '水稻的需水临界期是**孕穗期**（约在抽穗前 10~15 天）。\n\n这个时期水稻对水分最敏感，缺水会直接影响花粉母细胞减数分裂，导致颖花退化、结实率下降。生产上要保证此期田间保持浅水层，避免断水。',
    sources: [
      { title: '作物栽培学 · 水稻水分管理', snippet: '孕穗期是水稻一生中对水分最敏感的时期，此期受旱将严重影响产量。', score: 0.92 },
      { title: '农业知识库 · 灌溉制度', snippet: '水稻灌溉应重点保证返青期、孕穗期和抽穗开花期的水分供应。', score: 0.85 },
    ],
  },
  {
    keywords: ['药害', '农药', '防治', '补救'],
    answer:
      '发生药害后应按以下步骤处理：\n\n1. **立即停止施药**，查明原因；\n2. **清水喷洗**：对受害植株用清水喷淋，冲掉叶面残留药剂；\n3. **加强管理**：适当追施速效氮肥，配合叶面肥促进植株恢复；\n4. **预防复发**：核对有效成分，避免同一成分重复用药；混用前先做小范围安全性试验。',
    sources: [
      { title: '植物保护技术 · 农药药害', snippet: '同一种有效成分在不同商品药剂中重复使用，易造成总剂量超标而产生药害。', score: 0.89 },
      { title: '农业知识库 · 农药安全使用规范', snippet: '混用农药前应先做小范围试验，确认无药害后再大面积使用。', score: 0.81 },
    ],
  },
]

const FALLBACK = {
  answer:
    '（这是骨架演示的固定回复）\n\n真实系统中，这里会显示 RAG 引擎检索农业知识库后、由大模型生成的答案。\n\n现在试试问我"水稻的需水临界期是什么时候"或"发生药害怎么办"。',
  sources: [
    { title: '演示数据', snippet: '当前为前端骨架，尚未连接后端 RAG 服务。', score: 1.0 },
  ],
}

function pickReply(question) {
  const hit = MOCK.find((item) => item.keywords.some((kw) => question.includes(kw)))
  return hit || FALLBACK
}

async function scrollToBottom() {
  await nextTick()
  const el = scrollArea.value
  if (el) el.scrollTop = el.scrollHeight
}

let timer = null

/** 模拟流式输出（打字机效果） */
function fakeStream(fullText, onChunk, onDone) {
  let index = 0
  const step = 2 // 每次吐 2 个字，看起来更自然
  timer = setInterval(() => {
    index += step
    onChunk(fullText.slice(0, index))
    if (index >= fullText.length) {
      clearInterval(timer)
      timer = null
      onDone()
    }
  }, 28)
}

async function send() {
  const question = input.value.trim()
  if (!question || generating.value) return

  messages.value.push({ role: 'user', content: question, sources: [] })
  input.value = ''
  generating.value = true
  await scrollToBottom()

  const reply = pickReply(question)
  const assistantMessage = { role: 'assistant', content: '', sources: [], streaming: true }
  messages.value.push(assistantMessage)

  // ---------------------------------------------------------------------
  // TODO（阶段 3 你要做的）—— 换成真实流式请求：
  //
  //   const resp = await fetch('/api/qa/ask/stream', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ question, sessionId }),
  //   })
  //   const reader = resp.body.getReader()
  //   const decoder = new TextDecoder('utf-8')
  //   while (true) {
  //     const { value, done } = await reader.read()
  //     if (done) break
  //     const text = decoder.decode(value, { stream: true })  // stream:true 防止半个汉字乱码
  //     // 按 SSE 格式解析 "data: {...}\n\n" 后再追加
  //     assistantMessage.content += text
  //     await scrollToBottom()
  //   }
  // ---------------------------------------------------------------------

  fakeStream(
    reply.answer,
    (partial) => {
      assistantMessage.content = partial
      scrollToBottom()
    },
    () => {
      assistantMessage.streaming = false
      assistantMessage.sources = reply.sources
      generating.value = false
      scrollToBottom()
    },
  )
}

function stopGenerating() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  const last = messages.value[messages.value.length - 1]
  if (last && last.streaming) {
    last.streaming = false
    last.content += '\n\n（已停止生成）'
  }
  generating.value = false
  ElMessage.info('已停止生成')
}

function clearAll() {
  messages.value = [
    {
      role: 'assistant',
      content: '会话已清空，可以开始新的提问。',
      sources: [],
    },
  ]
}

/**
 * 把 **加粗** 语法切成若干片段，交给 <strong> 渲染。
 *
 * ⚠️ 为什么不直接用 v-html？
 *    因为 v-html 会把字符串当 HTML 执行 —— 如果将来答案里混入了
 *    <script> 或 <img onerror=...>，就是 XSS 漏洞。
 *    用"分段 + 模板渲染"的方式，非加粗部分永远是纯文本，天然安全。
 */
function richSegments(text) {
  const segments = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match = regex.exec(text)
  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ bold: false, text: text.slice(lastIndex, match.index) })
    }
    segments.push({ bold: true, text: match[1] })
    lastIndex = match.index + match[0].length
    match = regex.exec(text)
  }
  if (lastIndex < text.length) {
    segments.push({ bold: false, text: text.slice(lastIndex) })
  }
  return segments
}
</script>

<template>
  <div class="chat-page">
    <div class="section" style="margin-bottom: 16px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap">
        <div>
          <h2 class="section__title" style="margin: 0">智能问答</h2>
          <p class="section__desc" style="margin: 4px 0 0">
            基于农业知识库的检索增强问答（RAG）。当前为<strong>前端骨架</strong>，
            用 Mock 数据演示流式效果，尚未接入后端。
          </p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center">
          <el-tag type="warning" effect="plain" size="small">Mock 数据</el-tag>
          <el-button size="small" @click="clearAll">清空会话</el-button>
        </div>
      </div>
    </div>

    <div class="section chat-panel">
      <div ref="scrollArea" class="chat-messages">
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="chat-row"
          :class="`chat-row--${message.role}`"
        >
          <div class="chat-avatar">
            {{ message.role === 'user' ? '我' : '🌾' }}
          </div>

          <div class="chat-bubble-wrap">
            <div class="chat-bubble" :class="`chat-bubble--${message.role}`">
              <div class="chat-content"><template
                v-for="(segment, segmentIndex) in richSegments(message.content)"
                :key="segmentIndex"
              ><strong v-if="segment.bold">{{ segment.text }}</strong><template v-else>{{ segment.text }}</template></template><span
                v-if="message.streaming"
                class="chat-cursor"
              >▋</span></div>
            </div>

            <!-- 引用来源：RAG 的可解释性卖点 -->
            <div v-if="message.sources && message.sources.length" class="chat-sources">
              <div class="chat-sources__title">
                📚 参考知识来源（{{ message.sources.length }} 条）
              </div>
              <div
                v-for="(source, sIndex) in message.sources"
                :key="sIndex"
                class="chat-source"
              >
                <div class="chat-source__head">
                  <span class="chat-source__name">{{ source.title }}</span>
                  <el-tag size="small" effect="plain" type="success">
                    相关度 {{ source.score.toFixed(2) }}
                  </el-tag>
                </div>
                <div class="chat-source__snippet">{{ source.snippet }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <el-input
          v-model="input"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="输入你的农业问题，例如：水稻的需水临界期是什么时候？（Enter 发送，Shift+Enter 换行）"
          @keydown.enter.exact.prevent="send"
        />
        <div class="chat-input__actions">
          <el-button v-if="generating" type="danger" plain @click="stopGenerating">
            停止生成
          </el-button>
          <el-button
            v-else
            type="primary"
            :disabled="!input.trim()"
            @click="send"
          >
            发送
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 260px);
  min-height: 420px;
  padding: 0;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fafbfa;
}

.chat-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.chat-row--user {
  flex-direction: row-reverse;
}

.chat-avatar {
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-primary-pale);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
}

.chat-row--user .chat-avatar {
  background: #e3f2fd;
  color: #1565c0;
}

.chat-bubble-wrap {
  max-width: 78%;
}

.chat-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-bubble--user {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.chat-cursor {
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.chat-sources {
  margin-top: 10px;
  border-left: 3px solid var(--color-primary-light);
  padding-left: 10px;
}

.chat-sources__title {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.chat-source {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 6px;
}

.chat-source__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-source__name {
  font-size: 13px;
  font-weight: 600;
}

.chat-source__snippet {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  line-height: 1.6;
}

.chat-input {
  border-top: 1px solid var(--color-border);
  padding: 12px 16px 16px;
  background: #fff;
}

.chat-input__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
