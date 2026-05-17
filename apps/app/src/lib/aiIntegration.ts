import { isTauri } from "@tauri-apps/api/core";

import type { AppLanguage } from "../types";
import {
  deleteSecureSecret,
  readSecureSecret,
  writeSecureSecret
} from "./secureSecretStore";
import {
  removePersistentString,
  readPersistentString,
  writePersistentString
} from "./persistentClientStorage";

export type GeminiAiAction = "beautify" | "improve" | "fix" | "translate" | "custom";
export type GeminiAiScope = "note" | "selection";
export type GeminiCustomMode = "edit" | "generate";

export type GeminiModelOption = {
  id: string;
  label: string;
  badgeKey: string;
  descriptionKey: string;
  bestForKey: string;
  limitKey: string;
  speed: number;
  quality: number;
  quota: number;
};

export const GEMINI_API_KEY_SECRET_KEY = "ai:gemini:api-key";
export const GEMINI_API_KEY_BROWSER_STORAGE_KEY = "zen:ai.gemini.api-key";
export const GEMINI_MODEL_STORAGE_KEY = "locoris.ai.gemini.model";
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
export const EDITOR_AI_OPEN_EVENT = "locoris:editor-ai-open";

export const GEMINI_MODEL_OPTIONS: readonly GeminiModelOption[] = [
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    badgeKey: "settings.aiModelBadgeDefault",
    descriptionKey: "settings.aiModelGemini31FlashLiteDescription",
    bestForKey: "settings.aiModelGemini31FlashLiteBestFor",
    limitKey: "settings.aiModelGemini31FlashLiteLimit",
    speed: 5,
    quality: 4,
    quota: 5
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    badgeKey: "settings.aiModelBadgeBalanced",
    descriptionKey: "settings.aiModelGemini25FlashDescription",
    bestForKey: "settings.aiModelGemini25FlashBestFor",
    limitKey: "settings.aiModelGemini25FlashLimit",
    speed: 4,
    quality: 4,
    quota: 3
  },
  {
    id: "gemma-4-31b-it",
    label: "Gemma 4 31B IT",
    badgeKey: "settings.aiModelBadgeGemma",
    descriptionKey: "settings.aiModelGemma431bDescription",
    bestForKey: "settings.aiModelGemma431bBestFor",
    limitKey: "settings.aiModelGemma431bLimit",
    speed: 3,
    quality: 4,
    quota: 4
  },
  {
    id: "gemma-4-26b-a4b-it",
    label: "Gemma 4 26B A4B IT",
    badgeKey: "settings.aiModelBadgeGemmaFast",
    descriptionKey: "settings.aiModelGemma426bDescription",
    bestForKey: "settings.aiModelGemma426bBestFor",
    limitKey: "settings.aiModelGemma426bLimit",
    speed: 4,
    quality: 3,
    quota: 4
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    badgeKey: "settings.aiModelBadgeFast",
    descriptionKey: "settings.aiModelGemini25FlashLiteDescription",
    bestForKey: "settings.aiModelGemini25FlashLiteBestFor",
    limitKey: "settings.aiModelGemini25FlashLiteLimit",
    speed: 5,
    quality: 3,
    quota: 4
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    badgeKey: "settings.aiModelBadgeSmart",
    descriptionKey: "settings.aiModelGemini25ProDescription",
    bestForKey: "settings.aiModelGemini25ProBestFor",
    limitKey: "settings.aiModelGemini25ProLimit",
    speed: 2,
    quality: 5,
    quota: 1
  }
] as const;

type GenerateGeminiMarkdownInput = {
  apiKey: string;
  model: string;
  action: GeminiAiAction;
  scope: GeminiAiScope;
  markdown: string;
  appLanguage: AppLanguage;
  noteTitle?: string;
  customPrompt?: string;
  customMode?: GeminiCustomMode;
  targetLanguage?: string;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

export function sanitizeGeminiModelId(model: string | null | undefined) {
  return (typeof model === "string" ? model.trim() : "").replace(/^models\//i, "");
}

export function isValidGeminiModelId(model: string | null | undefined) {
  const normalized = sanitizeGeminiModelId(model);
  return /^[a-z0-9][a-z0-9._-]{1,159}$/i.test(normalized);
}

function resolveModelId(model: string | null | undefined) {
  const normalized = sanitizeGeminiModelId(model);

  if (!normalized) {
    return DEFAULT_GEMINI_MODEL;
  }

  if (!isValidGeminiModelId(normalized)) {
    throw new Error("GEMINI_MODEL_ID_INVALID");
  }

  return normalized;
}

export function readStoredGeminiModel() {
  try {
    return resolveModelId(readPersistentString(GEMINI_MODEL_STORAGE_KEY));
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

export function writeStoredGeminiModel(model: string) {
  writePersistentString(GEMINI_MODEL_STORAGE_KEY, resolveModelId(model));
}

function canUseBrowserGeminiKeyFallback() {
  return typeof window !== "undefined" && !isTauri();
}

export async function readGeminiApiKey() {
  const secureValue = await readSecureSecret(GEMINI_API_KEY_SECRET_KEY);

  if (secureValue || !canUseBrowserGeminiKeyFallback()) {
    return secureValue;
  }

  return readPersistentString(GEMINI_API_KEY_BROWSER_STORAGE_KEY)?.trim() ?? "";
}

export async function writeGeminiApiKey(apiKey: string) {
  await writeSecureSecret(GEMINI_API_KEY_SECRET_KEY, apiKey);

  if (canUseBrowserGeminiKeyFallback()) {
    writePersistentString(GEMINI_API_KEY_BROWSER_STORAGE_KEY, apiKey.trim());
  }
}

export async function deleteGeminiApiKey() {
  await deleteSecureSecret(GEMINI_API_KEY_SECRET_KEY);

  if (canUseBrowserGeminiKeyFallback()) {
    removePersistentString(GEMINI_API_KEY_BROWSER_STORAGE_KEY);
  }
}

function cleanGeminiMarkdown(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);

  return (fenced ? fenced[1] : trimmed).trim();
}

function buildActionInstruction(input: GenerateGeminiMarkdownInput) {
  const scopeLabel = input.scope === "selection" ? "selected text" : "whole note";
  const customMode = input.customMode ?? "edit";

  if (input.action === "beautify") {
    return [
      `Transform the ${scopeLabel} into polished, elegant Markdown.`,
      "Use headings, concise sections, bullet lists, numbered lists, checklists, quotes, and tables only when they genuinely improve clarity.",
      "Use emoji very sparingly and only when it fits the context. Never make the result noisy.",
      "Preserve the input language exactly unless the user explicitly asked for a different language.",
      "Keep the meaning faithful. Do not invent facts."
    ].join("\n");
  }

  if (input.action === "improve") {
    return [
      `Improve the writing of the ${scopeLabel}.`,
      "Make it clearer, smoother, and more premium in tone while preserving the author's intent.",
      "Keep the original language unless the user explicitly asked otherwise."
    ].join("\n");
  }

  if (input.action === "fix") {
    return [
      `Fix spelling, grammar, punctuation, and obvious typos in the ${scopeLabel}.`,
      "Preserve the wording, structure, language, and formatting as much as possible."
    ].join("\n");
  }

  if (input.action === "translate") {
    return [
      `Translate the ${scopeLabel} to: ${input.targetLanguage?.trim() || "the requested target language"}.`,
      "Preserve the structure and useful Markdown formatting.",
      "Do not add commentary."
    ].join("\n");
  }

  if (customMode === "generate") {
    return [
      "Create new Markdown content from this user instruction:",
      input.customPrompt?.trim() || "",
      "Do not rewrite or summarize the existing note unless the instruction explicitly asks for that.",
      "Return only the newly generated content."
    ].join("\n");
  }

  return [
    `Apply this user instruction to the ${scopeLabel}:`,
    input.customPrompt?.trim() || "",
    "Preserve the input language unless the user instruction explicitly asks for a different language.",
    "Return the best resulting Markdown only."
  ].join("\n");
}

function buildGeminiPrompt(input: GenerateGeminiMarkdownInput) {
  const uiLanguage =
    input.appLanguage === "ru"
      ? "The Locoris interface language is Russian."
      : "The Locoris interface language is English.";
  const title = input.noteTitle?.trim()
    ? `Note title: ${input.noteTitle.trim()}`
    : "Note title: untitled";

  const basePrompt = [
    "You are an AI writing assistant built into a premium dark-themed local-first notes editor called Locoris.",
    `${uiLanguage} This is UI context only and must not determine the output language.`,
    title,
    "",
    "Output rules:",
    "- Return only Markdown.",
    "- Do not wrap the result in a code fence.",
    "- Do not add explanations, prefaces, or afterwords.",
    "- For beautify, improve, fix, and custom edit tasks: keep the same language as the input Markdown. If the input mixes languages, preserve that mix.",
    "- Only change language when the action is translate or the user's custom instruction explicitly requests another language.",
    "- For custom generate tasks: use the language of the user's instruction unless the instruction names another language.",
    "- Preserve links, lists, checklists, tables, quotes, and code blocks when they matter.",
    "- If the input is already well formatted, refine it subtly instead of overdecorating it.",
    "",
    "Task:",
    buildActionInstruction(input)
  ];

  if (input.action === "custom" && input.customMode === "generate") {
    return [
      ...basePrompt,
      "",
      input.markdown.trim()
        ? "Context Markdown (optional tone and continuity reference; do not replace it):"
        : "No existing Markdown context was provided.",
      input.markdown.trim()
    ].join("\n");
  }

  return [
    ...basePrompt,
    "",
    "Input Markdown:",
    input.markdown.trim()
  ].join("\n");
}

function extractGeminiText(payload: GeminiGenerateResponse) {
  if (payload.error) {
    throw new Error(payload.error.message || payload.error.status || "GEMINI_REQUEST_FAILED");
  }

  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    throw new Error(payload.candidates?.[0]?.finishReason || "GEMINI_EMPTY_RESPONSE");
  }

  return cleanGeminiMarkdown(text);
}

export async function generateGeminiMarkdown(input: GenerateGeminiMarkdownInput) {
  const apiKey = input.apiKey.trim();
  const model = resolveModelId(input.model);
  const markdown = input.markdown.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  if (!markdown && !(input.action === "custom" && input.customMode === "generate")) {
    throw new Error("GEMINI_INPUT_EMPTY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildGeminiPrompt(input)
              }
            ]
          }
        ],
        generationConfig: {
          temperature: input.action === "beautify" || input.action === "custom" ? 0.45 : 0.2,
          maxOutputTokens: 8192
        }
      })
    }
  );

  const payload = (await response.json().catch(() => ({}))) as GeminiGenerateResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message || `GEMINI_HTTP_${response.status}`);
  }

  return extractGeminiText(payload);
}

export async function testGeminiConnection(apiKey: string, model: string) {
  const result = await generateGeminiMarkdown({
    apiKey,
    model,
    action: "custom",
    scope: "selection",
    markdown: "Locoris",
    appLanguage: "en",
    customPrompt: "Return the word Locoris unchanged."
  });

  return result.trim().length > 0;
}
