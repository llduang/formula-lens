import { NextRequest, NextResponse } from "next/server";

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

    const debugInfo = "model=" + model + ", baseUrl=" + baseUrl + ", key=" + (apiKey ? apiKey.slice(0, 8) + "..." : "未设置");

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "未配置 AI_API_KEY 环境变量。请在 Vercel 项目的 Settings - Environment Variables 中添加。当前: " + debugInfo,
        },
        { status: 500 }
      );
    }

    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: FORMULA_PROMPT },
              {
                type: "image_url",
                image_url: {
                  url: image.startsWith("data:") ? image : "data:image/png;base64," + image,
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
      var userMessage = "AI 接口返回错误 (" + response.status + ")";
      try {
        var errJson = JSON.parse(errText);
        var msg = (errJson.error && errJson.error.message) || errJson.message || errJson.msg || errText;
        userMessage += ": " + msg;
      } catch (e) {
        userMessage += ": " + errText.slice(0, 200);
      }
      userMessage += "\n\n配置: " + debugInfo;
      return NextResponse.json(
        { success: false, error: userMessage },
        { status: 500 }
      );
    }

    var data = await response.json();
    var latex = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";

    if (!latex) {
      return NextResponse.json(
        { success: false, error: "AI 返回了空结果，请检查模型配置: " + debugInfo },
        { status: 400 }
      );
    }

    latex = latex
      .replace(/```(?:latex|math)?\n?/g, "")
      .replace(/```/g, "")
      .replace(/^\$+|\$+$/gm, "")
      .trim();

    if (!latex) {
      return NextResponse.json(
        { success: false, error: "AI 返回内容为空" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, latex: latex });
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
