"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

import {
  Upload,
  Copy,
  Check,
  Trash2,
  History,
  Image as ImageIcon,
  Sparkles,
  X,
  Eraser,
  Code2,
  Braces,
  FunctionSquare,
  WrapText,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { useToast } from "../hooks/use-toast";
import { cn } from "../lib/utils";
import katex from "katex";

// ─── Format definitions (SimpleTex-like) ────────────────────────────
type FormatId =
  | "typora"
  | "block"
  | "display"
  | "equation"
  | "aligned"
  | "mathml"
  | "raw";

interface FormatOption {
  id: FormatId;
  label: string;
  icon: React.ReactNode;
  desc: string;
  transform: (latex: string) => string;
}

function generateMathML(latex: string): string {
  try {
    const html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      output: "mathml",
      strict: false,
    });
    return html;
  } catch {
    return latex;
  }
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "typora",
    label: "Typora",
    icon: <Braces className="w-3.5 h-3.5" />,
    desc: "$...$ 行内公式",
    transform: (l) => `$${l}$`,
  },
  {
    id: "block",
    label: "Block",
    icon: <WrapText className="w-3.5 h-3.5" />,
    desc: "$$...$$ 块级公式",
    transform: (l) => `$$\n${l}\n$$`,
  },
  {
    id: "display",
    label: "\\[\\]",
    icon: <FunctionSquare className="w-3.5 h-3.5" />,
    desc: "\\[...\\] LaTeX 显示模式",
    transform: (l) => `\\\[\n${l}\n\\\]`,
  },
  {
    id: "equation",
    label: "Equation",
    icon: <Code2 className="w-3.5 h-3.5" />,
    desc: "\\begin{equation} 环境",
    transform: (l) => `\\begin{equation}\n${l}\n\\end{equation}`,
  },
  {
    id: "aligned",
    label: "Aligned",
    icon: <Code2 className="w-3.5 h-3.5" />,
    desc: "\\begin{aligned} 环境",
    transform: (l) => `\\begin{aligned}\n${l}\n\\end{aligned}`,
  },
  {
    id: "mathml",
    label: "MathML",
    icon: <Code2 className="w-3.5 h-3.5" />,
    desc: "MathML 格式",
    transform: (l) => generateMathML(l),
  },
  {
    id: "raw",
    label: "LaTeX",
    icon: <Code2 className="w-3.5 h-3.5" />,
    desc: "纯 LaTeX 源码",
    transform: (l) => l,
  },
];

// ─── Data ────────────────────────────────────────────────────────────
interface FormulaRecord {
  id: string;
  imageData: string;
  latex: string;
  createdAt: number;
}

export default function Home() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawImageData, setRawImageData] = useState<string | null>(null);
  const [latexResult, setLatexResult] = useState<string>("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [history, setHistory] = useState<FormulaRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<FormatId>("typora");
  const pageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Derived: formatted output for selected format
  const formattedOutput = useMemo(() => {
    if (!latexResult) return "";
    const fmt = FORMAT_OPTIONS.find((f) => f.id === selectedFormat);
    return fmt ? fmt.transform(latexResult) : latexResult;
  }, [latexResult, selectedFormat]);

  // ─── History persistence ───────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("formula-history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const saveHistory = useCallback((records: FormulaRecord[]) => {
    try {
      localStorage.setItem(
        "formula-history",
        JSON.stringify(records.slice(0, 50))
      );
    } catch {
      /* ignore */
    }
  }, []);

  // ─── Paste handler ────────────────────────────────────────────────
  const processImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "格式错误",
          description: "请上传图片文件",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImagePreview(dataUrl);
        setRawImageData(dataUrl);
        setLatexResult("");
        setCopied(false);
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processImageFile(file);
          return;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [processImageFile]);

  // ─── Auto-recognize on image change ────────────────────────────────
  const recognizeFormula = useCallback(async () => {
    if (!rawImageData) return;
    setIsRecognizing(true);
    setLatexResult("");
    try {
      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: rawImageData }),
      });
      if (!res.ok) throw new Error("识别请求失败");
      const data = await res.json();
      if (data.success && data.latex) {
        setLatexResult(data.latex);
        const record: FormulaRecord = {
          id: Date.now().toString(),
          imageData: rawImageData,
          latex: data.latex,
          createdAt: Date.now(),
        };
        const next = [record, ...history];
        setHistory(next);
        saveHistory(next);
        toast({
          title: "识别成功",
          description: "选择需要的格式，点击复制即可粘贴",
        });
      } else {
        throw new Error(data.error || "未能识别图片中的公式");
      }
    } catch (error) {
      toast({
        title: "识别失败",
        description:
          error instanceof Error ? error.message : "请重试或更换图片",
        variant: "destructive",
      });
    } finally {
      setIsRecognizing(false);
    }
  }, [rawImageData, history, saveHistory, toast]);

  useEffect(() => {
    if (rawImageData) recognizeFormula();
  }, [rawImageData]);

  // ─── Drag & Drop ──────────────────────────────────────────────────
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImageFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [processImageFile]
  );
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processImageFile(file);
    },
    [processImageFile]
  );

  // ─── Copy ─────────────────────────────────────────────────────────
  const copyFormatted = useCallback(async () => {
    if (!formattedOutput) return;
    try {
      await navigator.clipboard.writeText(formattedOutput);
      setCopied(true);
      const fmt = FORMAT_OPTIONS.find((f) => f.id === selectedFormat);
      toast({
        title: "已复制",
        description: `已以「${fmt?.label ?? selectedFormat}」格式复制到剪贴板`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "复制失败",
        description: "请手动选择并复制",
        variant: "destructive",
      });
    }
  }, [formattedOutput, selectedFormat, toast]);

  // ─── Clear / History ──────────────────────────────────────────────
  const clearCurrent = useCallback(() => {
    setImagePreview(null);
    setRawImageData(null);
    setLatexResult("");
    setCopied(false);
    setSelectedFormat("typora");
  }, []);

  const deleteHistoryItem = useCallback(
    (id: string) => {
      const next = history.filter((h) => h.id !== id);
      setHistory(next);
      saveHistory(next);
    },
    [history, saveHistory]
  );
  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    toast({ title: "已清空", description: "历史记录已清空" });
  }, [saveHistory, toast]);

  const loadHistoryItem = useCallback((item: FormulaRecord) => {
    setImagePreview(item.imageData);
    setRawImageData(item.imageData);
    setLatexResult(item.latex);
    setCopied(false);
    setSelectedFormat("typora");
    setShowHistory(false);
  }, []);

  // ─── KaTeX preview ────────────────────────────────────────────────
  const { latexHtml, hasLatexError } = useMemo(() => {
    if (!latexResult) return { latexHtml: "", hasLatexError: false };
    try {
      const html = katex.renderToString(latexResult, {
        throwOnError: true,
        displayMode: true,
        output: "html",
        strict: false,
      });
      return { latexHtml: html, hasLatexError: false };
    } catch {
      return { latexHtml: null, hasLatexError: true };
    }
  }, [latexResult]);

  // ─── Helpers ──────────────────────────────────────────────────────
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return new Date(ts).toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <TooltipProvider>
      <div
        ref={pageRef}
        className="min-h-screen flex flex-col bg-gradient-to-br from-stone-50 via-white to-stone-50 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950"
        tabIndex={0}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-stone-900/80 border-b border-stone-200 dark:border-stone-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                FormulaLens
              </h1>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 font-normal hidden sm:inline-flex"
              >
                AI 公式识别
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground gap-1.5"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">历史记录</span>
              {history.length > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 px-1 text-[10px] rounded-full"
                >
                  {history.length}
                </Badge>
              )}
            </Button>
          </div>
        </header>

        {/* ── Main ────────────────────────────────────────────────── */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {/* Upload Area */}
          {!imagePreview && (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mb-3">
                  图片公式识别
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  粘贴、拖拽或上传图片，AI 自动识别公式并转为 LaTeX
                </p>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer",
                  "hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20",
                  isDragging
                    ? "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30 scale-[1.01]"
                    : "border-stone-300 dark:border-stone-700"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center mb-5">
                    {isDragging ? (
                      <ImageIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Upload className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <p className="text-base font-medium text-stone-700 dark:text-stone-300 mb-2">
                    {isDragging ? "松开鼠标上传图片" : "粘贴或上传公式图片"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    支持 Ctrl+V 粘贴 · 拖拽上传 · 点击选择文件
                  </p>
                  <div className="flex items-center gap-4 mt-4">
                    {["PNG", "JPG", "WebP", "GIF"].map((f) => (
                      <Badge
                        key={f}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Tips */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: "⌨️", title: "快捷粘贴", desc: "截图后直接 Ctrl+V" },
                  {
                    icon: "⚡",
                    title: "AI 识别",
                    desc: "自动提取公式转 LaTeX",
                  },
                  {
                    icon: "📋",
                    title: "多格式复制",
                    desc: "Typora / Block / MathML",
                  },
                ].map((tip) => (
                  <div
                    key={tip.title}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/40"
                  >
                    <span className="text-xl">{tip.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                        {tip.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tip.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Result Area ────────────────────────────────────────── */}
          {imagePreview && (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* Image Preview */}
              <Card className="overflow-hidden border-stone-200/80 dark:border-stone-700/50">
                <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200/80 dark:border-stone-700/50">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      原始图片
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      更换
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={clearCurrent}
                    >
                      <X className="w-3 h-3 mr-1" />
                      清除
                    </Button>
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-stone-900">
                  <div className="flex justify-center">
                    <img
                      src={imagePreview}
                      alt="公式图片"
                      className="max-h-56 max-w-full object-contain rounded-lg"
                    />
                  </div>
                  {isRecognizing && !latexResult && (
                    <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                      正在识别公式...
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </Card>

              {/* ── LaTeX Result (after recognition) ────────────────── */}
              {latexResult && (
                <>
                  {/* Formula Preview */}
                  <Card className="overflow-hidden border-stone-200/80 dark:border-stone-700/50">
                    <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200/80 dark:border-stone-700/50">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-medium text-muted-foreground">
                          公式预览
                        </span>
                        {hasLatexError && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] h-4 px-1"
                          >
                            渲染异常
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="p-6 bg-white dark:bg-stone-900">
                      <div
                        className="flex justify-center overflow-x-auto py-2"
                        dangerouslySetInnerHTML={{
                          __html:
                            latexHtml ||
                            `<span class="text-destructive text-sm font-mono">${latexResult}</span>`,
                        }}
                      />
                    </div>
                  </Card>

                  {/* ── Format Selector + Code Output ───────────────── */}
                  <Card className="overflow-hidden border-stone-200/80 dark:border-stone-700/50">
                    {/* Format bar */}
                    <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200/80 dark:border-stone-700/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                          {FORMAT_OPTIONS.map((fmt) => (
                            <Tooltip key={fmt.id}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() =>
                                    setSelectedFormat(fmt.id)
                                  }
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150",
                                    selectedFormat === fmt.id
                                      ? "bg-emerald-600 text-white shadow-sm"
                                      : "text-muted-foreground hover:text-foreground hover:bg-stone-200/60 dark:hover:bg-stone-700/60"
                                  )}
                                >
                                  {fmt.icon}
                                  {fmt.label}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p>{fmt.desc}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          className={cn(
                            "ml-3 h-8 px-3 text-xs font-medium gap-1.5 shrink-0 transition-all duration-200",
                            copied
                              ? "bg-emerald-600 text-white"
                              : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                          )}
                          onClick={copyFormatted}
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              已复制
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              复制
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Code display */}
                    <div className="p-4 bg-stone-950 dark:bg-black/30">
                      <div className="relative">
                        <pre className="font-mono text-sm text-emerald-400 break-all leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto pr-8">
                          {formattedOutput}
                        </pre>
                        {/* Inline copy button on the right */}
                        <button
                          onClick={copyFormatted}
                          className="absolute top-1 right-1 p-1.5 rounded-md text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors"
                          title="复制"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Format description bar */}
                    <div className="px-4 py-2 bg-stone-100/80 dark:bg-stone-800/30 border-t border-stone-200/60 dark:border-stone-700/40 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {FORMAT_OPTIONS.find((f) => f.id === selectedFormat)
                          ?.desc ?? ""}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        点击上方格式切换，再点击「复制」
                      </span>
                    </div>
                  </Card>

                  {/* Bottom actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={recognizeFormula}
                      disabled={isRecognizing}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      {isRecognizing ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          重新识别
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          重新识别
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      更换图片
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground gap-1.5"
                      onClick={clearCurrent}
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      清除
                    </Button>
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    选择格式后点击「复制」，可直接粘贴到 Typora、Obsidian、Notion
                    等编辑器
                  </p>
                </>
              )}
            </div>
          )}
        </main>

        {/* ── History Drawer ──────────────────────────────────────── */}
        {showHistory && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowHistory(false)}
            />
            <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-700 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between px-4 h-14 border-b border-stone-200 dark:border-stone-700 shrink-0">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">历史记录</h3>
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-4 px-1"
                  >
                    {history.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={clearHistory}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      清空
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowHistory(false)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-3">
                      <History className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      暂无历史记录
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      识别公式后会自动保存
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="group rounded-xl border border-stone-200 dark:border-stone-700 p-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer bg-white dark:bg-stone-800/50"
                        onClick={() => loadHistoryItem(item)}
                      >
                        <div className="flex gap-3">
                          <img
                            src={item.imageData}
                            alt="历史公式"
                            className="w-16 h-16 rounded-lg object-cover bg-stone-100 dark:bg-stone-700 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="overflow-hidden">
                              <p className="text-xs text-stone-600 dark:text-stone-400 truncate font-mono">
                                ${item.latex.length > 60
                                  ? `${item.latex.slice(0, 60)}...`
                                  : item.latex}
                                $
                              </p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2">
                              {formatTime(item.createdAt)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryItem(item.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="mt-auto border-t border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              FormulaLens · AI 公式识别工具 · 支持粘贴图片一键识别
            </p>
            <p className="text-xs text-muted-foreground">
              基于 AI 视觉模型 · 多格式 LaTeX 公式输出
            </p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
