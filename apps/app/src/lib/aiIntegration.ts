import { isTauri } from "@tauri-apps/api/core";

import type { AppLanguage, NoteContent } from "../types";
import {
  AI_EDITOR_STRUCTURED_OUTPUT_SCHEMA,
  prepareBlocksForAiPrompt,
  supportsStructuredEditorOutput,
  type AiStructuredEditPayload,
  type AiStructuredEditIntent
} from "./aiEditorSchema";
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
export type GeminiEditorFormat = "rich-json" | "markdown";

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
export const GEMINI_EDITOR_FORMAT_STORAGE_KEY = "locoris.ai.editor-format";
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
export const DEFAULT_GEMINI_EDITOR_FORMAT: GeminiEditorFormat = "rich-json";
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

type GenerateGeminiStructuredEditInput = GenerateGeminiMarkdownInput & {
  editorBlocks: NoteContent;
  intent: AiStructuredEditIntent;
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

type GeminiGenerationConfig = Record<string, unknown>;

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

export function readStoredGeminiEditorFormat(): GeminiEditorFormat {
  const storedFormat = readPersistentString(GEMINI_EDITOR_FORMAT_STORAGE_KEY);

  return storedFormat === "markdown" ? "markdown" : DEFAULT_GEMINI_EDITOR_FORMAT;
}

export function writeStoredGeminiEditorFormat(format: GeminiEditorFormat) {
  writePersistentString(
    GEMINI_EDITOR_FORMAT_STORAGE_KEY,
    format === "markdown" ? "markdown" : DEFAULT_GEMINI_EDITOR_FORMAT
  );
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
      "Add tasteful, context-aware emoji to headings or key list items when it improves warmth, scanability, or presentation. Keep it premium and not noisy.",
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

function buildStructuredActionInstruction(input: GenerateGeminiStructuredEditInput) {
  const scopeLabel = input.scope === "selection" ? "selected content" : "whole note";
  const customMode = input.customMode ?? "edit";

  if (input.action === "beautify") {
    return [
      `Transform the ${scopeLabel} into a polished premium Locoris note.`,
      "This action must create a visibly more beautiful rich note, not only a light rewrite.",
      "Add elegant hierarchy, expressive headings, concise sections, bullet lists, numbered lists, checklists, quotes, tables, links, and text styles when they improve clarity.",
      "Use tasteful, context-aware emoji in headings or key list items when it makes the note warmer, easier to scan, or more presentation-ready. Keep emoji premium and sparse, but do not omit them when the content naturally supports them.",
      "Use subtle text styles and color/background accents only when they help structure the result.",
      "Preserve the input language exactly unless the user explicitly asked for a different language.",
      "Keep meaning faithful. Do not invent facts."
    ].join("\n");
  }

  if (input.action === "improve") {
    return [
      `Improve the writing of the ${scopeLabel}.`,
      "Make it clearer, smoother, and more premium in tone while preserving structure, intent, language, links, tables, and useful styles."
    ].join("\n");
  }

  if (input.action === "fix") {
    return [
      `Fix spelling, grammar, punctuation, and obvious typos in the ${scopeLabel}.`,
      "Preserve wording, language, structure, block types, styles, links, tables, and checklist states as much as possible."
    ].join("\n");
  }

  if (input.action === "translate") {
    return [
      `Translate the ${scopeLabel} to: ${input.targetLanguage?.trim() || "the requested target language"}.`,
      "Preserve the rich editor structure, tables, checklists, links, media blocks, and useful styles."
    ].join("\n");
  }

  if (customMode === "generate") {
    return [
      "Create new rich note content from this user instruction:",
      input.customPrompt?.trim() || "",
      "Use the editor block types that best fit the request.",
      "Do not replace the existing note unless the instruction explicitly asks for that."
    ].join("\n");
  }

  return [
    `Apply this user instruction to the ${scopeLabel}:`,
    input.customPrompt?.trim() || "",
    "Preserve the input language unless the instruction explicitly asks for another language.",
    "Return the best resulting rich editor content."
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

function buildGeminiStructuredPrompt(input: GenerateGeminiStructuredEditInput) {
  const uiLanguage =
    input.appLanguage === "ru"
      ? "The Locoris interface language is Russian."
      : "The Locoris interface language is English.";
  const title = input.noteTitle?.trim()
    ? `Note title: ${input.noteTitle.trim()}`
    : "Note title: untitled";
  const editorBlocks = JSON.stringify(prepareBlocksForAiPrompt(input.editorBlocks));

  return [
    "You are an AI writing assistant built into Locoris, a premium dark-themed local-first rich notes editor.",
    `${uiLanguage} This is UI context only and must not determine the output language.`,
    title,
    "",
    "Return a single JSON object matching the provided response schema.",
    "Do not wrap JSON in Markdown fences. Do not add prose outside JSON.",
    "",
    "Supported editor block types:",
    "- paragraph, heading, quote, codeBlock",
    "- bulletListItem, numberedListItem, checkListItem, toggleListItem",
    "- table, divider",
    "- image, file, audio, video",
    "",
    "Supported inline content:",
    "- text nodes: { type: \"text\", text: string, styles: { bold, italic, underline, strike, code, textColor, backgroundColor, font } }",
    "- links: { type: \"link\", href: string, content: text[] }",
    "",
    "Supported block props:",
    "- textColor, backgroundColor, textAlignment",
    "- heading: level 1-6 and optional isToggleable",
    "- codeBlock: language",
    "- numberedListItem: start",
    "- checkListItem: checked",
    "- media blocks: url, name, caption, showPreview, previewWidth",
    "- table blocks: put tableContent on the block instead of content",
    "- table cells: textColor, backgroundColor, textAlignment, colspan, rowspan",
    "",
    "Style rules:",
    "- Use font only with one of: onest, ibmPlexSans, golosText, ibmPlexSerif, ibmPlexMono, unbounded.",
    "- Use textColor/backgroundColor as default color names or hex colors.",
    "- Preserve existing media block URLs. Do not invent downloadable file or media URLs.",
    "- Preserve links unless changing them is explicitly requested.",
    "- Preserve checklist checked states unless the task explicitly changes checklist semantics.",
    "- Use tables only when the information benefits from rows and columns.",
    "",
    `Requested edit intent: ${input.intent}.`,
    "",
    "Task:",
    buildStructuredActionInstruction(input),
    "",
    input.action === "custom" && input.customMode === "generate"
      ? "Context editor blocks for tone and continuity. Do not replace these unless explicitly requested:"
      : "Input editor blocks:",
    editorBlocks,
    "",
    input.markdown.trim()
      ? "Input Markdown/plain-text reference:"
      : "No Markdown/plain-text reference was provided.",
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function shouldRetryStructuredRequest(error: unknown) {
  const message = getErrorMessage(error);

  return !/api key|unauthenticated|permission_denied|resource_exhausted|quota|not found|not supported|unsupported|model/i.test(
    message
  );
}

function toGeminiResponseSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toGeminiResponseSchema);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
      if (key === "type" && typeof entryValue === "string") {
        return [key, entryValue.toUpperCase()];
      }

      return [key, toGeminiResponseSchema(entryValue)];
    })
  );
}

function buildStructuredGenerationConfigs(input: GenerateGeminiStructuredEditInput): GeminiGenerationConfig[] {
  const temperature =
    input.action === "beautify"
      ? 0.52
      : input.action === "custom"
        ? 0.42
        : 0.15;
  const baseConfig = {
    temperature,
    maxOutputTokens: 8192
  };

  return [
    {
      ...baseConfig,
      responseFormat: {
        text: {
          mimeType: "application/json",
          schema: AI_EDITOR_STRUCTURED_OUTPUT_SCHEMA
        }
      }
    },
    {
      ...baseConfig,
      responseMimeType: "application/json",
      responseJsonSchema: AI_EDITOR_STRUCTURED_OUTPUT_SCHEMA
    },
    {
      ...baseConfig,
      responseMimeType: "application/json",
      responseSchema: toGeminiResponseSchema(AI_EDITOR_STRUCTURED_OUTPUT_SCHEMA)
    }
  ];
}

async function requestGeminiGeneratedText(input: {
  apiKey: string;
  model: string;
  prompt: string;
  generationConfig: GeminiGenerationConfig;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: input.prompt
              }
            ]
          }
        ],
        generationConfig: input.generationConfig
      })
    }
  );

  const payload = (await response.json().catch(() => ({}))) as GeminiGenerateResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message || `GEMINI_HTTP_${response.status}`);
  }

  return extractGeminiText(payload);
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

  return requestGeminiGeneratedText({
    apiKey,
    model,
    prompt: buildGeminiPrompt(input),
    generationConfig: {
      temperature: input.action === "beautify" || input.action === "custom" ? 0.45 : 0.2,
      maxOutputTokens: 8192
    }
  });
}

export async function generateGeminiStructuredEdit(
  input: GenerateGeminiStructuredEditInput
): Promise<AiStructuredEditPayload> {
  const apiKey = input.apiKey.trim();
  const model = resolveModelId(input.model);
  const markdown = input.markdown.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  if (!supportsStructuredEditorOutput(model)) {
    throw new Error("GEMINI_STRUCTURED_UNSUPPORTED");
  }

  if (!markdown && input.editorBlocks.length === 0 && !(input.action === "custom" && input.customMode === "generate")) {
    throw new Error("GEMINI_INPUT_EMPTY");
  }

  const prompt = buildGeminiStructuredPrompt(input);
  const errors: string[] = [];

  for (const generationConfig of buildStructuredGenerationConfigs(input)) {
    try {
      const text = await requestGeminiGeneratedText({
        apiKey,
        model,
        prompt,
        generationConfig
      });

      return JSON.parse(text) as AiStructuredEditPayload;
    } catch (error) {
      errors.push(getErrorMessage(error));

      if (!shouldRetryStructuredRequest(error)) {
        break;
      }
    }
  }

  throw new Error(errors.length > 0 ? `GEMINI_STRUCTURED_FAILED: ${errors.join(" | ")}` : "GEMINI_STRUCTURED_FAILED");
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
