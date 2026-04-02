import { NextRequest, NextResponse } from "next/server";

/**
 * 公式识别 API
 *
 * 支持任何 OpenAI 兼容的视觉模型 API，例如：
 * - OpenAI:           https://api.openai.com/v1/chat/completions        (模型: gpt-4o)
 * - 智谱 GLM-4V:      https://open.bigmodel.cn/api/paas/v4/chat/completions
 * - 阿里通义千问 VL:   https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions (模型: qwen-vl-max)
 * - DeepSeek:          https://api.deepseek.com/chat/completions
 * - SiliconFlow:       https://api.siliconflow.cn/v1/chat/completions     (模型: Qwen/Qwen2.5-VL-7B-Instruct)
 * - Groq:              https://api.groq.com/openai/v1/chat/completions
 *
 * 环境变量（在 Cloudflare 控制台设置）：
 *   AI_API_KEY    - API 密钥（必填）
 *   AI_BASE_URL   - API 地址（选填，默认 https://api.openai.com/v1）
 *   AI_MODEL      - 模型名（选填，默认 gpt-4o）
 */

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o";

const FORMULA_PROMPT = `You are a professional mathematical formula recognition expert. Your task is to identify mathematical formulas in the given image and convert them into LaTeX format.

Rules:
1. Only output the LaTeX formula code, do not include any other text, explanations or markdown formatting
2. Do NOT wrap the formula in $ or $$ symbols
3. For inline formulas, use standard LaTeX notation
4. Make sure the LaTeX is valid and can be compiled
5. Use standard LaTeX commands (e.g., \\frac, \\sqrt, \\sum, \\int, \\alpha, \\beta, etc.)
6. If there are multiple formulas, output them all, separated by newlines
7. Preserve the structure and nesting of the original formula exactly
8. If the image contains both text and formulas, only extract the formula parts

Now, please recognize the formula in this image:`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { success: false, error: "请提供图片数据" },
        { status: 400 }
      );
    }

    const baseUrl = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const model = process.env.AI_MODEL || DEFAULT_MODEL;
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "未配置 AI_API_KEY，请在部署平台的环境变量中添加",
        },
        { status: 500 }
      );
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: FORMULA_PROMPT },
              {
                type: "image_url",
                image_url: {
                  url: image.startsWith("data:")
                    ? image
                    : `data:image/png;base64,${image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      return NextResponse.json(
        {
          success: false,
          error: `AI 接口调用失败 (${response.status})，请检查 API Key 和模型配置`,
        },
        { status: 500 }
      );
    }

    const data = await response.json();
    let latex = data.choices?.[0]?.message?.content || "";

    // 清洗响应：去掉 $、代码块标记等
    latex = latex
      .replace(/```(?:latex|math)?\n?/g, "")
      .replace(/```/g, "")
      .replace(/^\$+|\$+$/gm, "")
      .trim();

    if (!latex) {
      return NextResponse.json(
        { success: false, error: "未能识别图片中的公式" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, latex });
  } catch (error) {
    console.error("Formula recognition error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "识别服务暂时不可用",
      },
      { status: 500 }
    );
  }
}
