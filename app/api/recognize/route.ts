import { NextRequest, NextResponse } from "next/server";

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

    const baseUrl = (process.env.AI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4").replace(/\/+$/, "");
    const model = process.env.AI_MODEL || "glm-4v-flash";
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "未配置 AI_API_KEY 环境变量" },
        { status: 500 }
      );
    }

    const imageUrl = image.startsWith("data:") ? image : "data:image/png;base64," + image;

    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: model,
        stream: false,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
              {
                type: "text",
                text: FORMULA_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      var userMessage = "AI 接口返回错误 (" + response.status + ")";
      try {
        var errJson = JSON.parse(errText);
        var msg = (errJson.error && errJson.error.message) || errJson.message || errText;
        userMessage += ": " + msg;
      } catch (e) {
        userMessage += ": " + errText.slice(0, 200);
      }
      return NextResponse.json(
        { success: false, error: userMessage },
        { status: 500 }
      );
    }

    var data = await response.json();
    var latex = "";
    try {
      latex = data.choices[0].message.content || "";
    } catch (e) {
      latex = JSON.stringify(data).slice(0, 200);
      return NextResponse.json(
        { success: false, error: "AI 返回格式异常: " + latex },
        { status: 500 }
      );
    }

    if (!latex) {
      return NextResponse.json(
        { success: false, error: "AI 返回了空结果" },
        { status: 400 }
      );
    }

    latex = latex
      .replace(/```(?:latex|math)?\n?/g, "")
      .replace(/```/g, "")
      .replace(/^\$+|\$+$/gm, "")
      .trim();

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
