# FormulaLens - AI 公式识别工具

粘贴图片 → AI 自动识别 → 复制 LaTeX 公式到 Typora

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange)

## ✨ 功能

- **Ctrl+V 粘贴** — 截图后直接粘贴，自动识别
- **拖拽上传** — 拖拽图片到页面
- **7 种输出格式** — Typora / Block / Display / Equation / Aligned / MathML / LaTeX
- **公式预览** — KaTeX 实时渲染
- **历史记录** — 本地存储，随时回顾
- **深色模式** — 自动适配系统主题

## 🚀 快速部署到 Cloudflare（免费）

### 第一步：获取 AI API Key

你需要一个支持图片输入的 AI 模型 API Key，推荐免费/低价选项：

| 供应商 | 注册地址 | 免费额度 | 推荐模型 |
|--------|----------|----------|----------|
| **SiliconFlow** | https://cloud.siliconflow.cn | 注册送额度 | `Qwen/Qwen2.5-VL-7B-Instruct` |
| **智谱 AI** | https://open.bigmodel.cn | 新用户送额度 | `glm-4v-flash`（免费） |
| **阿里通义** | https://dashscope.console.aliyun.com | 有免费额度 | `qwen-vl-max` |
| **Groq** | https://console.groq.com | 免费额度 | `llama-3.2-90b-vision-preview` |

> 💡 **强烈推荐**：智谱的 `glm-4v-flash` 完全免费，注册即可使用！

### 第二步：Fork 或下载代码

1. 点击 GitHub 右上角 **Fork** 到你自己的仓库
2. 或者点击 **Code → Download ZIP** 下载压缩包

### 第三步：连接到 Cloudflare Pages

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → Create
2. 选择 **Pages → Connect to Git**
3. 授权 GitHub，选择你 Fork 的仓库
4. 构建配置如下：

```
框架预设:    Next.js
构建命令:    npx @cloudflare/next-on-pages
输出目录:    .vercel/output/static
```

5. 点击 **Save and Deploy**

### 第四步：设置环境变量

部署完成后（即使构建失败也没关系），进入：

**Cloudflare Dashboard → 你的项目 → Settings → Environment variables**

添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `AI_API_KEY` | 你的 API Key | **必填** |
| `AI_BASE_URL` | API 地址 | 选填，见下方 |
| `AI_MODEL` | 模型名称 | 选填，见下方 |

#### 各供应商配置示例

**智谱 AI（免费推荐）：**
```
AI_API_KEY = xxxxxxxxxx.xxxxxx
AI_BASE_URL = https://open.bigmodel.cn/api/paas/v4
AI_MODEL   = glm-4v-flash
```

**SiliconFlow（免费推荐）：**
```
AI_API_KEY = sk-xxxxxxxxxxxxxxxx
AI_BASE_URL = https://api.siliconflow.cn/v1
AI_MODEL   = Qwen/Qwen2.5-VL-7B-Instruct
```

**OpenAI：**
```
AI_API_KEY = sk-xxxxxxxxxxxxxxxx
AI_BASE_URL = https://api.openai.com/v1
AI_MODEL   = gpt-4o
```

### 第五步：重新部署

设置好环境变量后，进入 **Deployments → Retry deployment** 重新构建即可。

部署成功后会得到一个类似 `https://formula-lens.pages.dev` 的地址，永久免费使用！

---

## 💻 本地开发

```bash
# 1. 安装 Node.js 18+ (推荐使用 https://bun.sh)
# 2. 克隆代码
git clone https://github.com/你的用户名/formula-lens.git
cd formula-lens

# 3. 安装依赖
npm install

# 4. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 AI_API_KEY

# 5. 启动开发服务器
npm run dev

# 6. 打开 http://localhost:3000
```

## 📁 项目结构

```
formula-lens/
├── app/
│   ├── layout.tsx          # 全局布局
│   ├── page.tsx            # 主页面（全部前端逻辑）
│   ├── globals.css         # 全局样式
│   └── api/
│       └── recognize/
│           └── route.ts    # AI 识别后端接口
├── components/ui/          # UI 组件
├── hooks/use-toast.ts      # Toast 提示
├── lib/utils.ts            # 工具函数
├── wrangler.toml           # Cloudflare 配置
├── .env.example            # 环境变量模板
└── package.json
```

## 📝 License

MIT
