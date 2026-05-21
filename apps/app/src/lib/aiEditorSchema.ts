import type { NoteContent, StoredBlock } from "../types";
import { isEditorStoredFontId } from "./blocknoteSchema";

export type AiStructuredEditIntent = "replace" | "insert";

export type AiStructuredEditPayload = {
  schemaVersion?: unknown;
  intent?: unknown;
  summary?: unknown;
  warnings?: unknown;
  blocks?: unknown;
};

export type SanitizedAiStructuredEdit = {
  summary: string;
  warnings: string[];
  blocks: NoteContent;
};

export type AiContentStats = {
  blocks: number;
  words: number;
  headings: number;
  tables: number;
  checklists: number;
  media: number;
};

const AI_EDITOR_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "quote",
  "codeBlock",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "table",
  "divider",
  "image",
  "file",
  "audio",
  "video"
] as const;

const INLINE_STYLE_KEYS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "textColor",
  "backgroundColor",
  "font"
] as const;

const DEFAULT_COLOR_NAMES = new Set([
  "default",
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink"
]);

const TEXT_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "codeBlock",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem"
]);

const MEDIA_BLOCK_TYPES = new Set(["image", "file", "audio", "video"]);
const MAX_BLOCK_DEPTH = 6;
const MAX_BLOCKS_PER_LEVEL = 160;
const MAX_TABLE_ROWS = 48;
const MAX_TABLE_COLS = 16;
const MAX_TEXT_LENGTH = 12_000;

const AI_EDITOR_STYLE_SCHEMA = {
  type: "object",
  properties: {
    bold: { type: "boolean" },
    italic: { type: "boolean" },
    underline: { type: "boolean" },
    strike: { type: "boolean" },
    code: { type: "boolean" },
    textColor: { type: "string" },
    backgroundColor: { type: "string" },
    font: {
      type: "string",
      enum: ["onest", "ibmPlexSans", "golosText", "ibmPlexSerif", "ibmPlexMono", "unbounded"]
    }
  }
} as const;

const AI_EDITOR_INLINE_TEXT_SCHEMA = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["text"]
    },
    text: { type: "string" },
    styles: AI_EDITOR_STYLE_SCHEMA
  },
  required: ["type", "text"]
} as const;

const AI_EDITOR_INLINE_NODE_SCHEMA = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["text", "link"]
    },
    text: { type: "string" },
    href: { type: "string" },
    styles: AI_EDITOR_STYLE_SCHEMA,
    content: {
      type: "array",
      items: AI_EDITOR_INLINE_TEXT_SCHEMA
    }
  },
  required: ["type"]
} as const;

const AI_EDITOR_INLINE_CONTENT_SCHEMA = {
  type: "array",
  items: AI_EDITOR_INLINE_NODE_SCHEMA
} as const;

const AI_EDITOR_BLOCK_PROPS_SCHEMA = {
  type: "object",
  properties: {
    textColor: { type: "string" },
    backgroundColor: { type: "string" },
    textAlignment: {
      type: "string",
      enum: ["left", "center", "right", "justify"]
    },
    level: {
      type: "integer",
      enum: [1, 2, 3, 4, 5, 6]
    },
    isToggleable: { type: "boolean" },
    language: { type: "string" },
    start: { type: "integer" },
    checked: { type: "boolean" },
    url: { type: "string" },
    name: { type: "string" },
    caption: { type: "string" },
    showPreview: { type: "boolean" },
    previewWidth: { type: "number" },
    colspan: { type: "integer" },
    rowspan: { type: "integer" }
  }
} as const;

const AI_EDITOR_TABLE_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["tableContent"]
    },
    columnWidths: {
      type: "array",
      items: {
        type: "number"
      }
    },
    headerRows: { type: "integer" },
    headerCols: { type: "integer" },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cells: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["tableCell"]
                },
                props: AI_EDITOR_BLOCK_PROPS_SCHEMA,
                content: AI_EDITOR_INLINE_CONTENT_SCHEMA
              },
              required: ["content"]
            }
          }
        },
        required: ["cells"]
      }
    }
  },
  required: ["type", "rows"]
} as const;

export const AI_EDITOR_STRUCTURED_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    schemaVersion: {
      type: "integer",
      enum: [1]
    },
    intent: {
      type: "string",
      enum: ["replace", "insert"]
    },
    summary: {
      type: "string"
    },
    warnings: {
      type: "array",
      items: {
        type: "string"
      }
    },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [...AI_EDITOR_BLOCK_TYPES]
          },
          props: {
            ...AI_EDITOR_BLOCK_PROPS_SCHEMA
          },
          content: AI_EDITOR_INLINE_CONTENT_SCHEMA,
          tableContent: AI_EDITOR_TABLE_CONTENT_SCHEMA,
          children: {
            type: "array",
            items: {
              type: "object"
            }
          }
        },
        required: ["type"]
      }
    }
  },
  required: ["schemaVersion", "intent", "summary", "blocks"]
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, maxLength);
}

function asBoolean(value: unknown) {
  return value === true;
}

function asPositiveNumber(value: unknown, max = 4096) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(value, max)
    : undefined;
}

function createBlockId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isSafeColor(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const color = value.trim();

  return (
    DEFAULT_COLOR_NAMES.has(color) ||
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\(\s*[\d.\s,%]+\)$/i.test(color) ||
    /^hsla?\(\s*[\d.\s,%degturnrad]+\)$/i.test(color)
  );
}

function normalizeColor(value: unknown) {
  return isSafeColor(value) ? (value as string).trim() : undefined;
}

function normalizeTextAlignment(value: unknown) {
  return value === "left" || value === "center" || value === "right" || value === "justify"
    ? value
    : undefined;
}

function isSafeUrl(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const url = value.trim();

  return (
    url.length > 0 &&
    !/^javascript:/i.test(url) &&
    !/^vbscript:/i.test(url) &&
    !/^data:text\/html/i.test(url)
  );
}

function normalizeStyles(value: unknown) {
  const styles: Record<string, unknown> = {};

  if (!isRecord(value)) {
    return styles;
  }

  INLINE_STYLE_KEYS.forEach((key) => {
    const styleValue = value[key];

    if (
      key === "bold" ||
      key === "italic" ||
      key === "underline" ||
      key === "strike" ||
      key === "code"
    ) {
      if (styleValue === true) {
        styles[key] = true;
      }
      return;
    }

    if (key === "font") {
      if (typeof styleValue === "string" && isEditorStoredFontId(styleValue)) {
        styles[key] = styleValue;
      }
      return;
    }

    const color = normalizeColor(styleValue);

    if (color && color !== "default") {
      styles[key] = color;
    }
  });

  return styles;
}

type AiInlineTextNode = {
  type: "text";
  text: string;
  styles: Record<string, unknown>;
};

type AiInlineLinkNode = {
  type: "link";
  href: string;
  content: AiInlineTextNode[];
};

type AiInlineNode = AiInlineTextNode | AiInlineLinkNode;

function normalizeTextNode(value: unknown): AiInlineTextNode | null {
  if (typeof value === "string") {
    return {
      type: "text",
      text: value.slice(0, MAX_TEXT_LENGTH),
      styles: {}
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const text = asString(value.text);

  if (!text) {
    return null;
  }

  return {
    type: "text",
    text,
    styles: normalizeStyles(value.styles)
  };
}

function normalizeInlineContent(value: unknown): AiInlineNode[] {
  if (typeof value === "string") {
    return value ? [{ type: "text", text: value.slice(0, MAX_TEXT_LENGTH), styles: {} }] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  const inline: AiInlineNode[] = [];

  value.forEach((item) => {
    const textNode = normalizeTextNode(item);

    if (textNode) {
      inline.push(textNode);
      return;
    }

    if (!isRecord(item) || item.type !== "link" || !isSafeUrl(item.href)) {
      return;
    }

    const content = normalizeInlineContent(item.content).filter(
      (node): node is AiInlineTextNode => node.type === "text"
    );

    if (content.length === 0) {
      return;
    }

    inline.push({
      type: "link",
      href: asString(item.href, 2048).trim(),
      content
    });
  });

  return inline;
}

function normalizeDefaultProps(props: unknown) {
  const record = isRecord(props) ? props : {};
  const normalized: Record<string, unknown> = {};
  const textColor = normalizeColor(record.textColor);
  const backgroundColor = normalizeColor(record.backgroundColor);
  const textAlignment = normalizeTextAlignment(record.textAlignment);

  if (textColor) {
    normalized.textColor = textColor;
  }

  if (backgroundColor) {
    normalized.backgroundColor = backgroundColor;
  }

  if (textAlignment) {
    normalized.textAlignment = textAlignment;
  }

  return normalized;
}

function normalizeTableCell(value: unknown): StoredBlock {
  const record = isRecord(value) ? value : {};
  const props = normalizeDefaultProps(record.props);
  const colSpan = asPositiveNumber((record.props as Record<string, unknown> | undefined)?.colspan, MAX_TABLE_COLS);
  const rowSpan = asPositiveNumber((record.props as Record<string, unknown> | undefined)?.rowspan, MAX_TABLE_ROWS);

  if (colSpan) {
    props.colspan = Math.round(colSpan);
  }

  if (rowSpan) {
    props.rowspan = Math.round(rowSpan);
  }

  return {
    type: "tableCell",
    props: {
      textColor: "default",
      backgroundColor: "default",
      textAlignment: "left",
      ...props
    },
    content: normalizeInlineContent(record.content)
  };
}

function normalizeTableContent(value: unknown) {
  const record = isRecord(value) ? value : {};
  const rawRows = Array.isArray(record.rows) ? record.rows.slice(0, MAX_TABLE_ROWS) : [];
  const rows = rawRows
    .map((row) => {
      const rowRecord = isRecord(row) ? row : {};
      const cells = Array.isArray(rowRecord.cells)
        ? rowRecord.cells.slice(0, MAX_TABLE_COLS).map(normalizeTableCell)
        : [];

      return cells.length > 0 ? { cells } : null;
    })
    .filter((row): row is { cells: StoredBlock[] } => row !== null);
  const columnCount = rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
  const columnWidths = Array.isArray(record.columnWidths)
    ? record.columnWidths
        .slice(0, columnCount)
        .map((width) => asPositiveNumber(width, 1600))
    : Array.from({ length: columnCount }, () => undefined);
  const headerRows = asPositiveNumber(record.headerRows, rows.length) ?? 0;
  const headerCols = asPositiveNumber(record.headerCols, columnCount) ?? 0;

  return {
    type: "tableContent",
    columnWidths,
    headerRows: Math.round(headerRows),
    headerCols: Math.round(headerCols),
    rows
  };
}

function normalizeMediaProps(type: string, props: unknown) {
  const record = isRecord(props) ? props : {};
  const normalized = normalizeDefaultProps(record);
  const url = asString(record.url, 4096).trim();
  const name = asString(record.name, 512).trim();
  const caption = asString(record.caption, 1024).trim();
  const previewWidth = asPositiveNumber(record.previewWidth, 2400);

  if (isSafeUrl(url)) {
    normalized.url = url;
  }

  if (name) {
    normalized.name = name;
  }

  if (caption) {
    normalized.caption = caption;
  }

  if (type !== "file") {
    normalized.showPreview = record.showPreview !== false;
  }

  if ((type === "image" || type === "video") && previewWidth) {
    normalized.previewWidth = Math.round(previewWidth);
  }

  return normalized;
}

function normalizeBlocks(value: unknown, depth = 0): StoredBlock[] {
  if (!Array.isArray(value) || depth > MAX_BLOCK_DEPTH) {
    return [];
  }

  return value
    .slice(0, MAX_BLOCKS_PER_LEVEL)
    .map((item) => normalizeBlock(item, depth))
    .filter((block): block is StoredBlock => block !== null);
}

function normalizeBlock(value: unknown, depth: number): StoredBlock | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  const type = value.type.trim();

  if (!AI_EDITOR_BLOCK_TYPES.includes(type as (typeof AI_EDITOR_BLOCK_TYPES)[number])) {
    return null;
  }

  const children = normalizeBlocks(value.children, depth + 1);

  if (TEXT_BLOCK_TYPES.has(type)) {
    const props = normalizeDefaultProps(value.props);

    if (type === "heading") {
      const level = isRecord(value.props) && typeof value.props.level === "number"
        ? Math.min(Math.max(Math.round(value.props.level), 1), 6)
        : 2;

      props.level = level;

      if (isRecord(value.props) && typeof value.props.isToggleable === "boolean") {
        props.isToggleable = value.props.isToggleable;
      }
    }

    if (type === "codeBlock") {
      props.language = isRecord(value.props) ? asString(value.props.language, 48).trim() || "text" : "text";
    }

    if (type === "numberedListItem" && isRecord(value.props)) {
      const start = asPositiveNumber(value.props.start, 9999);
      if (start) {
        props.start = Math.round(start);
      }
    }

    if (type === "checkListItem" && isRecord(value.props)) {
      props.checked = asBoolean(value.props.checked);
    }

    return {
      id: createBlockId(),
      type,
      props,
      content: normalizeInlineContent(value.content),
      children
    };
  }

  if (type === "table") {
    return {
      id: createBlockId(),
      type,
      props: normalizeDefaultProps(value.props),
      content: normalizeTableContent(value.tableContent ?? value.content),
      children
    };
  }

  if (type === "divider") {
    return {
      id: createBlockId(),
      type,
      props: {},
      children
    };
  }

  if (MEDIA_BLOCK_TYPES.has(type)) {
    const props = normalizeMediaProps(type, value.props);

    if (typeof props.url !== "string" || props.url.length === 0) {
      return null;
    }

    return {
      id: createBlockId(),
      type,
      props,
      children
    };
  }

  return null;
}

export function sanitizeAiStructuredEditPayload(
  payload: unknown,
  options: {
    fallbackSummary?: string;
  } = {}
): SanitizedAiStructuredEdit {
  const record = isRecord(payload) ? payload : {};
  const source = Array.isArray(payload) ? { blocks: payload } : record;
  const blocks = normalizeBlocks(source.blocks);

  if (blocks.length === 0) {
    throw new Error("GEMINI_EMPTY_RESPONSE");
  }

  const rawWarnings = Array.isArray(source.warnings) ? source.warnings : [];

  return {
    summary: asString(source.summary, 240).trim() || options.fallbackSummary || "",
    warnings: rawWarnings
      .map((warning) => asString(warning, 180).trim())
      .filter(Boolean)
      .slice(0, 4),
    blocks
  };
}

export function supportsStructuredEditorOutput(model: string) {
  const normalized = model.trim().toLowerCase().replace(/^models\//, "");

  return (
    normalized.startsWith("gemini-") &&
    !normalized.includes("embedding") &&
    !normalized.includes("audio") &&
    !normalized.includes("live")
  );
}

function collectText(content: unknown, parts: string[]) {
  if (typeof content === "string") {
    parts.push(content);
    return;
  }

  if (!Array.isArray(content)) {
    return;
  }

  content.forEach((node) => {
    if (typeof node === "string") {
      parts.push(node);
    } else if (isRecord(node) && typeof node.text === "string") {
      parts.push(node.text);
    } else if (isRecord(node) && Array.isArray(node.content)) {
      collectText(node.content, parts);
    }
  });
}

export function collectAiContentStats(blocks: NoteContent): AiContentStats {
  const stats: AiContentStats = {
    blocks: 0,
    words: 0,
    headings: 0,
    tables: 0,
    checklists: 0,
    media: 0
  };
  const textParts: string[] = [];

  const visit = (items: StoredBlock[]) => {
    items.forEach((block) => {
      stats.blocks += 1;

      if (block.type === "heading") {
        stats.headings += 1;
      }

      if (block.type === "table") {
        stats.tables += 1;
      }

      if (block.type === "checkListItem") {
        stats.checklists += 1;
      }

      if (block.type && MEDIA_BLOCK_TYPES.has(block.type)) {
        stats.media += 1;
      }

      collectText(block.content, textParts);

      if (Array.isArray(block.children)) {
        visit(block.children);
      }
    });
  };

  visit(blocks);
  stats.words = textParts.join(" ").trim().split(/\s+/).filter(Boolean).length;

  return stats;
}

export function prepareBlocksForAiPrompt(blocks: NoteContent) {
  const trimBlock = (block: StoredBlock): StoredBlock => {
    const next: StoredBlock = {
      type: block.type,
      props: block.props
    };

    if (block.type === "table") {
      next.tableContent = block.content;
    } else {
      next.content = block.content;
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      next.children = block.children.map(trimBlock);
    }

    return next;
  };

  return blocks.map(trimBlock);
}
