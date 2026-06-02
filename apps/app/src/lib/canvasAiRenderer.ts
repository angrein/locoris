import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFileData, BinaryFiles, DataURL } from "@excalidraw/excalidraw/types";

import {
  DEFAULT_CANVAS_BACKGROUND,
  DEFAULT_CANVAS_FONT_FAMILY,
  normalizeCanvasHexColor
} from "./canvas";
import { DEFAULT_NOTE_COLOR } from "./palette";
import type { CanvasDiagramEdge, CanvasDiagramSpec, CanvasDiagramTone } from "./aiIntegration";

const CANVAS_AI_DEFAULT_COLOR_KEYS = new Set([
  "",
  "black",
  "#000",
  "#000000",
  "#1e1e1e",
  "#ffffff",
  "transparent"
]);

type CanvasAiImageElement = ExcalidrawElement & {
  type: "image";
  fileId?: string | null;
};

function normalizeCanvasUiColorValue(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseHexRgb(color: string) {
  const normalized = normalizeCanvasHexColor(color);

  if (!normalized) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function toHexChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function mixHexColors(color: string, target: string, colorWeight: number) {
  const first = parseHexRgb(color);
  const second = parseHexRgb(target);

  if (!first || !second) {
    return color;
  }

  const targetWeight = 1 - colorWeight;

  return `#${toHexChannel(first.r * colorWeight + second.r * targetWeight)}${toHexChannel(
    first.g * colorWeight + second.g * targetWeight
  )}${toHexChannel(first.b * colorWeight + second.b * targetWeight)}`;
}

function shouldRestyleCanvasAiColor(color: unknown) {
  return CANVAS_AI_DEFAULT_COLOR_KEYS.has(normalizeCanvasUiColorValue(color));
}

function getCanvasAiColorLuminance(color: unknown) {
  const rgb = parseHexRgb(normalizeCanvasUiColorValue(color));

  if (!rgb) {
    return null;
  }

  const toLinear = (value: number) => {
    const channel = value / 255;

    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function isLowContrastCanvasAiStroke(color: unknown) {
  const luminance = getCanvasAiColorLuminance(color);

  return luminance !== null && luminance < 0.34;
}

type CanvasAiVisualPalette = {
  canvasBackground: string;
  text: string;
  stroke: string;
  softStroke: string;
  nodeBackground: string;
  highlightBackground: string;
  groupBackground: string;
  warningBackground: string;
  successBackground: string;
  dangerBackground: string;
  mutedBackground: string;
  toneBackgrounds: Record<CanvasDiagramTone, string>;
  toneStrokes: Record<CanvasDiagramTone, string>;
  sliceBackgrounds: string[];
};

export function getCanvasAiVisualPalette(accentColor: string, canvasBackgroundColor?: string): CanvasAiVisualPalette {
  const accent = normalizeCanvasHexColor(accentColor) ?? DEFAULT_NOTE_COLOR;
  const canvasBackground =
    normalizeCanvasHexColor(canvasBackgroundColor || "") ?? DEFAULT_CANVAS_BACKGROUND;
  const backgroundLuminance = getCanvasAiColorLuminance(canvasBackground) ?? 0.05;
  const darkCanvas = backgroundLuminance < 0.48;
  const veryDarkCanvas = backgroundLuminance < 0.08;
  const baseSurface = darkCanvas
    ? veryDarkCanvas
      ? "#172033"
      : mixHexColors("#1f2937", canvasBackground, 0.34)
    : "#f8fafc";
  const text = darkCanvas ? "#f4f7ff" : "#111827";
  const lineTarget = darkCanvas ? "#e5f6ff" : "#172033";
  const stroke = mixHexColors(accent, lineTarget, darkCanvas ? 0.52 : 0.64);
  const softStroke = mixHexColors(accent, darkCanvas ? "#ffffff" : "#334155", darkCanvas ? 0.34 : 0.42);
  const makeBackground = (color: string, weight = 0.22) =>
    mixHexColors(color, baseSurface, darkCanvas ? weight : Math.max(0.12, weight - 0.08));
  const makeStroke = (color: string, weight = 0.62) =>
    mixHexColors(color, darkCanvas ? "#ffffff" : "#172033", darkCanvas ? weight : Math.max(0.42, weight - 0.14));
  const toneSeeds: Record<CanvasDiagramTone, string> = {
    primary: accent,
    accent: "#8b5cf6",
    muted: "#64748b",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#fb7185"
  };
  const sliceSeeds = [
    accent,
    "#38bdf8",
    "#a78bfa",
    "#34d399",
    "#fbbf24",
    "#fb7185",
    "#2dd4bf",
    "#f472b6",
    "#93c5fd",
    "#c084fc"
  ];
  const toneBackgrounds = Object.fromEntries(
    Object.entries(toneSeeds).map(([tone, color]) => [tone, makeBackground(color, tone === "muted" ? 0.12 : 0.24)])
  ) as Record<CanvasDiagramTone, string>;
  const toneStrokes = Object.fromEntries(
    Object.entries(toneSeeds).map(([tone, color]) => [tone, makeStroke(color, tone === "muted" ? 0.36 : 0.62)])
  ) as Record<CanvasDiagramTone, string>;

  return {
    canvasBackground,
    text,
    stroke,
    softStroke,
    nodeBackground: mixHexColors(accent, baseSurface, darkCanvas ? 0.2 : 0.12),
    highlightBackground: mixHexColors(accent, darkCanvas ? "#1e293b" : "#e0f2fe", darkCanvas ? 0.34 : 0.2),
    groupBackground: mixHexColors(accent, canvasBackground, darkCanvas ? 0.1 : 0.06),
    warningBackground: mixHexColors("#f59e0b", baseSurface, darkCanvas ? 0.2 : 0.16),
    successBackground: mixHexColors("#22c55e", baseSurface, darkCanvas ? 0.18 : 0.14),
    dangerBackground: mixHexColors("#ef4444", baseSurface, darkCanvas ? 0.18 : 0.14),
    mutedBackground: mixHexColors(accent, canvasBackground, darkCanvas ? 0.06 : 0.04),
    toneBackgrounds,
    toneStrokes,
    sliceBackgrounds: sliceSeeds.map((color, index) => makeBackground(color, 0.26 - Math.min(index, 4) * 0.015))
  };
}

export function getCanvasAiMermaidThemeVariables(palette: CanvasAiVisualPalette) {
  return {
    fontSize: "22px",
    lineColor: palette.softStroke,
    primaryTextColor: palette.text,
    secondaryTextColor: palette.text,
    tertiaryTextColor: palette.text,
    primaryBorderColor: palette.stroke,
    secondaryBorderColor: palette.softStroke,
    tertiaryBorderColor: palette.softStroke,
    primaryColor: palette.nodeBackground,
    secondaryColor: palette.highlightBackground,
    tertiaryColor: palette.groupBackground,
    noteTextColor: palette.text,
    noteBkgColor: palette.nodeBackground,
    noteBorderColor: palette.stroke,
    actorTextColor: palette.text,
    actorBorder: palette.stroke,
    actorBkg: palette.nodeBackground,
    signalColor: palette.softStroke,
    signalTextColor: palette.text,
    labelTextColor: palette.text
  };
}

function isCanvasAiSvgDataUrl(dataURL: unknown, mimeType: unknown) {
  const normalizedDataUrl = typeof dataURL === "string" ? dataURL.trim().toLowerCase() : "";
  const normalizedMimeType = typeof mimeType === "string" ? mimeType.trim().toLowerCase() : "";

  return normalizedMimeType === "image/svg+xml" || normalizedDataUrl.startsWith("data:image/svg+xml");
}

function loadCanvasAiImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("CANVAS_AI_IMAGE_LOAD_FAILED"));
    image.decoding = "async";
    image.src = source;
  });
}

async function convertCanvasAiSvgDataUrlToPngDataUrl(
  dataURL: string,
  dimensions?: { width: number; height: number }
) {
  const blob = await fetch(dataURL).then((response) => {
    if (!response.ok) {
      throw new Error("CANVAS_AI_SVG_FETCH_FAILED");
    }

    return response.blob();
  });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadCanvasAiImage(objectUrl);
    const sourceWidth = dimensions?.width && dimensions.width > 0 ? dimensions.width : image.naturalWidth;
    const sourceHeight = dimensions?.height && dimensions.height > 0 ? dimensions.height : image.naturalHeight;
    const width = Math.max(1, Math.round(sourceWidth || 1024));
    const height = Math.max(1, Math.round(sourceHeight || 768));
    const scale = Math.min(2, 2400 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("CANVAS_AI_CANVAS_CONTEXT_UNAVAILABLE");
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/png") as DataURL;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function normalizeCanvasAiBinaryFiles(
  files: BinaryFiles,
  elements: readonly ExcalidrawElement[]
) {
  const now = Date.now();
  const imageDimensionsByFileId = new Map<string, { width: number; height: number }>();
  const normalizedFiles: BinaryFiles = {};

  elements.forEach((element) => {
    if (element.type !== "image") {
      return;
    }

    const imageElement = element as CanvasAiImageElement;

    if (!imageElement.fileId) {
      return;
    }

    imageDimensionsByFileId.set(imageElement.fileId, {
      width: imageElement.width,
      height: imageElement.height
    });
  });

  await Promise.all(
    Object.entries(files).map(async ([fileId, file]) => {
      const dataURL = typeof file.dataURL === "string" ? file.dataURL : "";
      const normalizedFile: BinaryFileData = {
        ...file,
        id: file.id ?? (fileId as BinaryFileData["id"]),
        dataURL: dataURL as DataURL,
        mimeType: file.mimeType,
        created: typeof file.created === "number" && Number.isFinite(file.created) ? file.created : now,
        lastRetrieved:
          typeof file.lastRetrieved === "number" && Number.isFinite(file.lastRetrieved)
            ? file.lastRetrieved
            : now,
        version: typeof file.version === "number" && Number.isFinite(file.version) ? file.version : 1
      };

      if (dataURL && isCanvasAiSvgDataUrl(dataURL, normalizedFile.mimeType)) {
        try {
          normalizedFile.dataURL = await convertCanvasAiSvgDataUrlToPngDataUrl(
            dataURL,
            imageDimensionsByFileId.get(fileId)
          );
          normalizedFile.mimeType = "image/png";
        } catch (error) {
          console.warn("Canvas AI SVG image normalization failed.", error);
        }
      }

      normalizedFiles[fileId] = normalizedFile;
    })
  );

  return normalizedFiles;
}

export function styleCanvasAiElements(
  elements: readonly ExcalidrawElement[],
  accentColor: string,
  canvasBackgroundColor?: string
) {
  const palette = getCanvasAiVisualPalette(accentColor, canvasBackgroundColor);

  return elements.map((element) => {
    const normalizedElement = normalizeCanvasAiElementLinearGeometry(element);
    const nextElement = { ...normalizedElement } as ExcalidrawElement & {
      backgroundColor?: string;
      strokeColor?: string;
      fillStyle?: string;
      roughness?: number;
      opacity?: number;
    };

    if ("strokeColor" in nextElement && shouldRestyleCanvasAiColor(nextElement.strokeColor)) {
      nextElement.strokeColor =
        normalizedElement.type === "text"
          ? palette.text
          : normalizedElement.type === "arrow"
            ? palette.softStroke
            : palette.stroke;
    }

    if (
      "strokeColor" in nextElement &&
      (normalizedElement.type === "arrow" || normalizedElement.type === "line") &&
      isLowContrastCanvasAiStroke(nextElement.strokeColor)
    ) {
      nextElement.strokeColor = palette.softStroke;
    }

    if (
      "strokeColor" in nextElement &&
      normalizedElement.type === "text" &&
      isLowContrastCanvasAiStroke(nextElement.strokeColor)
    ) {
      nextElement.strokeColor = palette.text;
    }

    if (
      "backgroundColor" in nextElement &&
      normalizedElement.type !== "text" &&
      normalizedElement.type !== "arrow" &&
      normalizedElement.type !== "line"
    ) {
      nextElement.backgroundColor = shouldRestyleCanvasAiColor(nextElement.backgroundColor)
        ? normalizedElement.type === "diamond"
          ? palette.highlightBackground
          : palette.nodeBackground
        : nextElement.backgroundColor;
    }

    if ("fillStyle" in nextElement && normalizedElement.type !== "text") {
      nextElement.fillStyle = "solid";
    }

    if ("roughness" in nextElement) {
      nextElement.roughness = Math.min(1, Math.max(0, nextElement.roughness ?? 0));
    }

    if ("opacity" in nextElement) {
      nextElement.opacity = Math.max(86, Math.min(100, nextElement.opacity ?? 100));
    }

    return nextElement;
  });
}


type CanvasAiSkeletonElement = Record<string, unknown>;
type CanvasAiLocalPoint = [number, number];

type CanvasAiDiagramCard = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tone?: CanvasDiagramTone;
};

const CANVAS_AI_CARD_PADDING_X = 34;
const CANVAS_AI_CARD_PADDING_Y = 28;
const CANVAS_AI_CARD_LINE_HEIGHT = 1.26;
const CANVAS_AI_TEXT_WIDTH_RATIO = 0.58;

function getCanvasAiDensityScale(spec: CanvasDiagramSpec) {
  if (spec.layout?.density === "compact") {
    return 0.9;
  }

  if (spec.layout?.density === "airy") {
    return 1.16;
  }

  return 1;
}

function getCanvasAiToneBackground(
  palette: CanvasAiVisualPalette,
  tone: CanvasDiagramTone | undefined,
  index = 0
) {
  return tone
    ? palette.toneBackgrounds[tone]
    : palette.sliceBackgrounds[index % palette.sliceBackgrounds.length] ?? palette.nodeBackground;
}

function getCanvasAiToneStroke(
  palette: CanvasAiVisualPalette,
  tone: CanvasDiagramTone | undefined,
  index = 0
) {
  return tone
    ? palette.toneStrokes[tone]
    : palette.toneStrokes[
        (["primary", "accent", "success", "warning", "danger", "muted"] as CanvasDiagramTone[])[
          index % 6
        ]
      ];
}

function getCanvasAiText(label: string, body?: string) {
  return body ? `${label}\n${body}` : label;
}

function clampCanvasAiValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeCanvasAiDisplayText(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function getCanvasAiEstimatedCharWidth(fontSize: number) {
  return fontSize * CANVAS_AI_TEXT_WIDTH_RATIO;
}

function splitCanvasAiLongWord(word: string, maxChars: number) {
  if (word.length <= maxChars) {
    return [word];
  }

  const chunks: string[] = [];

  for (let index = 0; index < word.length; index += maxChars) {
    chunks.push(word.slice(index, index + maxChars));
  }

  return chunks;
}

function wrapCanvasAiText(text: string, fontSize: number, maxWidth: number) {
  const normalized = normalizeCanvasAiDisplayText(text);

  if (!normalized) {
    return [];
  }

  const maxChars = Math.max(6, Math.floor(maxWidth / getCanvasAiEstimatedCharWidth(fontSize)));
  const lines: string[] = [];

  normalized.split("\n").forEach((sourceLine) => {
    let currentLine = "";

    sourceLine.split(/\s+/).forEach((word) => {
      splitCanvasAiLongWord(word, maxChars).forEach((part) => {
        const candidate = currentLine ? `${currentLine} ${part}` : part;

        if (candidate.length <= maxChars) {
          currentLine = candidate;
          return;
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        currentLine = part;
      });
    });

    if (currentLine) {
      lines.push(currentLine);
    }
  });

  return lines;
}

function measureCanvasAiWrappedText(
  text: string,
  width: number,
  fontSize: number,
  paddingX = 0,
  paddingY = 0
) {
  const lines = wrapCanvasAiText(text, fontSize, Math.max(24, width - paddingX * 2));
  const lineHeight = Math.ceil(fontSize * CANVAS_AI_CARD_LINE_HEIGHT);
  const longestLineLength = lines.reduce((longest, line) => Math.max(longest, line.length), 0);

  return {
    text: lines.join("\n"),
    lines,
    width: Math.ceil(longestLineLength * getCanvasAiEstimatedCharWidth(fontSize) + paddingX * 2),
    height: Math.max(lineHeight, lines.length * lineHeight) + paddingY * 2
  };
}

function getCanvasAiPreferredTextWidth(
  text: string,
  fontSize: number,
  minWidth: number,
  maxWidth: number,
  preferredChars = 32
) {
  const normalized = normalizeCanvasAiDisplayText(text);

  if (!normalized) {
    return minWidth;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const longestWordLength = words.reduce((longest, word) => Math.max(longest, word.length), 0);
  const sourceLines = normalized.split("\n");
  const longestSourceLine = sourceLines.reduce((longest, line) => Math.max(longest, line.length), 0);
  const charWidth = getCanvasAiEstimatedCharWidth(fontSize);
  const desiredChars = clampCanvasAiValue(
    Math.max(Math.min(longestSourceLine, preferredChars), Math.ceil(Math.sqrt(normalized.length) * 2.8)),
    Math.max(12, longestWordLength),
    preferredChars + 12
  );

  return clampCanvasAiValue(
    Math.ceil(Math.max(longestWordLength + 2, desiredChars) * charWidth + CANVAS_AI_CARD_PADDING_X * 2),
    minWidth,
    maxWidth
  );
}

function getCanvasAiCardTextLayout(label: string, body: string | undefined, width: number, fontSize: number) {
  return measureCanvasAiWrappedText(
    getCanvasAiText(label, body),
    width,
    fontSize,
    CANVAS_AI_CARD_PADDING_X,
    CANVAS_AI_CARD_PADDING_Y
  );
}

function fitCanvasAiCard(
  card: CanvasAiDiagramCard,
  label: string,
  body: string | undefined,
  options: {
    fontSize?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    preferredChars?: number;
  } = {}
) {
  const fontSize = options.fontSize ?? (body ? 18 : 20);
  const rawText = getCanvasAiText(label, body);
  const minWidth = Math.max(96, options.minWidth ?? card.width);
  const maxWidth = Math.max(minWidth, options.maxWidth ?? Math.max(card.width, 420));
  const width = getCanvasAiPreferredTextWidth(
    rawText,
    fontSize,
    minWidth,
    maxWidth,
    options.preferredChars
  );
  const textLayout = getCanvasAiCardTextLayout(label, body, width, fontSize);
  const height = Math.max(options.minHeight ?? card.height, card.height, textLayout.height);

  return {
    ...card,
    width,
    height
  };
}

function centerCanvasAiCard<T extends CanvasAiDiagramCard>(card: T, center: { x: number; y: number }): T {
  return {
    ...card,
    x: center.x - card.width / 2,
    y: center.y - card.height / 2
  };
}

function getCanvasAiFlowchartLevels(
  steps: Extract<CanvasDiagramSpec, { kind: "flowchart" }>["steps"],
  edges: readonly CanvasDiagramEdge[]
) {
  const stepIds = new Set(steps.map((step) => step.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, CanvasDiagramEdge[]>();
  const levels = new Map<string, number>();

  steps.forEach((step) => {
    incoming.set(step.id, 0);
    outgoing.set(step.id, []);
  });

  edges.forEach((edge) => {
    if (!stepIds.has(edge.from) || !stepIds.has(edge.to) || edge.from === edge.to) {
      return;
    }

    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge);
  });

  const queue = steps
    .filter((step) => (incoming.get(step.id) ?? 0) === 0)
    .map((step) => step.id);

  if (!queue.length && steps[0]) {
    queue.push(steps[0].id);
  }

  queue.forEach((id) => levels.set(id, 0));

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    const nextLevel = (levels.get(id) ?? 0) + 1;

    (outgoing.get(id) ?? []).forEach((edge) => {
      levels.set(edge.to, Math.max(levels.get(edge.to) ?? 0, nextLevel));
      incoming.set(edge.to, Math.max(0, (incoming.get(edge.to) ?? 0) - 1));

      if ((incoming.get(edge.to) ?? 0) === 0 && !queue.includes(edge.to)) {
        queue.push(edge.to);
      }
    });
  }

  let fallbackLevel = 0;

  steps.forEach((step, index) => {
    if (levels.has(step.id)) {
      fallbackLevel = Math.max(fallbackLevel, levels.get(step.id) ?? 0);
      return;
    }

    levels.set(step.id, Math.max(0, fallbackLevel + Math.floor(index / 4)));
  });

  return levels;
}

function normalizeCanvasAiLinearGeometry(
  origin: { x: number; y: number },
  points: CanvasAiLocalPoint[]
) {
  const minX = Math.min(...points.map((point) => point[0]));
  const minY = Math.min(...points.map((point) => point[1]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const maxY = Math.max(...points.map((point) => point[1]));

  return {
    x: origin.x + minX,
    y: origin.y + minY,
    width: maxX - minX,
    height: maxY - minY,
    points: points.map((point) => [point[0] - minX, point[1] - minY] as CanvasAiLocalPoint)
  };
}

function normalizeCanvasAiElementLinearGeometry<T extends ExcalidrawElement>(element: T): T {
  if (element.type !== "line" && element.type !== "arrow") {
    return element;
  }

  const points = (element as ExcalidrawElement & { points?: readonly unknown[] }).points;

  if (!Array.isArray(points) || points.length < 2) {
    return element;
  }

  const normalizedPoints = points
    .map((point) => {
      if (!Array.isArray(point)) {
        return null;
      }

      const x = Number(point[0]);
      const y = Number(point[1]);

      return Number.isFinite(x) && Number.isFinite(y) ? ([x, y] as CanvasAiLocalPoint) : null;
    })
    .filter((point): point is CanvasAiLocalPoint => Boolean(point));

  if (normalizedPoints.length < 2) {
    return element;
  }

  const geometry = normalizeCanvasAiLinearGeometry(
    { x: element.x, y: element.y },
    normalizedPoints
  );
  const hasChanged =
    geometry.x !== element.x ||
    geometry.y !== element.y ||
    geometry.width !== element.width ||
    geometry.height !== element.height ||
    geometry.points.some((point, index) => {
      const originalPoint = normalizedPoints[index];

      return !originalPoint || point[0] !== originalPoint[0] || point[1] !== originalPoint[1];
    });

  return hasChanged
    ? ({
        ...element,
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        points: geometry.points
      } as T)
    : element;
}

function getCanvasAiArrowLabel(label?: string) {
  const normalized = label?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const maxLineLength = 22;
  const maxLines = 2;
  const lines: string[] = [];
  let currentLine = "";

  normalized.split(" ").forEach((word) => {
    const nextWord = word.length > maxLineLength ? `${word.slice(0, maxLineLength - 3)}...` : word;
    const candidate = currentLine ? `${currentLine} ${nextWord}` : nextWord;

    if (candidate.length <= maxLineLength) {
      currentLine = candidate;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = nextWord;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= maxLines) {
    return lines.join("\n");
  }

  const visibleLines = lines.slice(0, maxLines);
  visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1].slice(0, maxLineLength - 3).trim()}...`;

  return visibleLines.join("\n");
}

function getCanvasAiBodyHeight(body?: string, base = 86, max = 190) {
  return Math.max(base, Math.min(max, base + (body?.length ?? 0) * 0.36));
}

function addCanvasAiTitle(
  skeletonElements: CanvasAiSkeletonElement[],
  prefix: string,
  spec: CanvasDiagramSpec,
  palette: CanvasAiVisualPalette
) {
  if (!spec.title && !spec.summary) {
    return;
  }

  const fontSize = spec.summary ? 22 : 26;
  const titleLayout = measureCanvasAiWrappedText(
    [spec.title, spec.summary].filter(Boolean).join("\n"),
    760,
    fontSize
  );

  skeletonElements.push({
    type: "text",
    id: `${prefix}-title`,
    x: 0,
    y: -82,
    text: titleLayout.text,
    width: titleLayout.width,
    height: titleLayout.height,
    fontSize,
    fontFamily: DEFAULT_CANVAS_FONT_FAMILY,
    strokeColor: palette.text
  });
}

function addCanvasAiCard(
  skeletonElements: CanvasAiSkeletonElement[],
  card: CanvasAiDiagramCard & {
    label: string;
    body?: string;
    palette: CanvasAiVisualPalette;
    shape?: "rectangle" | "diamond" | "ellipse";
    backgroundColor?: string;
    strokeColor?: string;
    fontSize?: number;
    index?: number;
    opacity?: number;
  }
) {
  const shape = card.shape ?? "rectangle";
  const fontSize = card.fontSize ?? (card.body ? 18 : 20);
  const textLayout = getCanvasAiCardTextLayout(card.label, card.body, card.width, fontSize);
  const hasLabel = Boolean(textLayout.text.trim());
  const renderedHeight = hasLabel ? Math.max(card.height, textLayout.height) : card.height;

  skeletonElements.push({
    type: shape,
    id: card.id,
    x: card.x,
    y: card.y,
    width: card.width,
    height: renderedHeight,
    strokeColor: card.strokeColor ?? getCanvasAiToneStroke(card.palette, card.tone, card.index),
    backgroundColor: card.backgroundColor ?? getCanvasAiToneBackground(card.palette, card.tone, card.index),
    fillStyle: "solid",
    roughness: 0,
    opacity: card.opacity ?? 96,
    roundness: shape === "rectangle" ? { type: 3 } : undefined,
    label: hasLabel
      ? {
          text: textLayout.text,
          fontSize,
          fontFamily: DEFAULT_CANVAS_FONT_FAMILY,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: card.palette.text
        }
      : undefined
  });
}

function addCanvasAiText(
  skeletonElements: CanvasAiSkeletonElement[],
  options: {
    id: string;
    x: number;
    y: number;
    text: string;
    palette: CanvasAiVisualPalette;
    fontSize?: number;
    tone?: CanvasDiagramTone;
    maxWidth?: number;
    angle?: number;
  }
) {
  if (!options.text.trim()) {
    return;
  }

  const fontSize = options.fontSize ?? 18;
  const textLayout = options.maxWidth
    ? measureCanvasAiWrappedText(options.text, options.maxWidth, fontSize)
    : {
        text: options.text,
        width: undefined,
        height: undefined
      };

  skeletonElements.push({
    type: "text",
    id: options.id,
    x: options.x,
    y: options.y,
    text: textLayout.text,
    width: textLayout.width,
    height: textLayout.height,
    angle: options.angle,
    fontSize,
    fontFamily: DEFAULT_CANVAS_FONT_FAMILY,
    strokeColor: options.tone ? getCanvasAiToneStroke(options.palette, options.tone) : options.palette.text
  });
}

function getCanvasAiEdgePoints(from: CanvasAiDiagramCard, to: CanvasAiDiagramCard) {
  const fromCenter = {
    x: from.x + from.width / 2,
    y: from.y + from.height / 2
  };
  const toCenter = {
    x: to.x + to.width / 2,
    y: to.y + to.height / 2
  };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      start: {
        x: from.x + (dx >= 0 ? from.width : 0),
        y: fromCenter.y
      },
      end: {
        x: to.x + (dx >= 0 ? 0 : to.width),
        y: toCenter.y
      }
    };
  }

  return {
    start: {
      x: fromCenter.x,
      y: from.y + (dy >= 0 ? from.height : 0)
    },
    end: {
      x: toCenter.x,
      y: to.y + (dy >= 0 ? 0 : to.height)
    }
  };
}

function getCanvasAiArrowRoute(
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) < 18 || Math.abs(dy) < 18) {
    return [start, end];
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = start.x + dx * 0.52;

    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end
    ];
  }

  const midY = start.y + dy * 0.52;

  return [
    start,
    { x: start.x, y: midY },
    { x: end.x, y: midY },
    end
  ];
}

function addCanvasAiArrow(
  skeletonElements: CanvasAiSkeletonElement[],
  options: {
    id: string;
    from: CanvasAiDiagramCard;
    to: CanvasAiDiagramCard;
    palette: CanvasAiVisualPalette;
    label?: string;
    tone?: CanvasDiagramTone;
    dashed?: boolean;
  }
) {
  const edgePoints = getCanvasAiEdgePoints(options.from, options.to);
  const route = getCanvasAiArrowRoute(edgePoints.start, edgePoints.end);
  const pointDelta = route.reduce(
    (delta, point, index) => {
      if (index === 0) {
        return delta;
      }

      const previous = route[index - 1];

      return {
        x: delta.x + point.x - previous.x,
        y: delta.y + point.y - previous.y
      };
    },
    { x: 0, y: 0 }
  );

  if (Math.abs(pointDelta.x) < 8 && Math.abs(pointDelta.y) < 8) {
    return;
  }

  const geometry = normalizeCanvasAiLinearGeometry(
    { x: 0, y: 0 },
    route.map((point) => [point.x, point.y] as CanvasAiLocalPoint)
  );
  const label = getCanvasAiArrowLabel(options.label);
  const arrowElement: CanvasAiSkeletonElement = {
    type: "arrow",
    id: options.id,
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    points: geometry.points,
    strokeColor: getCanvasAiToneStroke(options.palette, options.tone),
    strokeStyle: options.dashed ? "dashed" : "solid",
    strokeWidth: 2,
    roughness: 0,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false
  };

  if (label) {
    arrowElement.label = {
      text: label,
      fontSize: 13,
      fontFamily: DEFAULT_CANVAS_FONT_FAMILY,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: options.palette.text
    };
  }

  skeletonElements.push(arrowElement);
}

function renderCanvasAiFlowchartSpec(
  spec: Extract<CanvasDiagramSpec, { kind: "flowchart" }>,
  prefix: string,
  palette: CanvasAiVisualPalette
) {
  const scale = getCanvasAiDensityScale(spec);
  const skeletonElements: CanvasAiSkeletonElement[] = [];
  const cards = new Map<string, CanvasAiDiagramCard>();
  const groups: NonNullable<CanvasDiagramSpec["groups"]> = spec.groups?.length
    ? spec.groups
    : Array.from(new Set(spec.steps.map((step) => step.groupId).filter(Boolean))).map((groupId) => ({
        id: groupId!,
        title: groupId!,
        nodeIds: undefined
      }));
  const flowchartEdges = spec.edges ?? [];
  const renderedCards: Array<{
    step: (typeof spec.steps)[number];
    index: number;
    card: CanvasAiDiagramCard;
    shape: "rectangle" | "diamond" | "ellipse";
  }> = [];

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  const levels = getCanvasAiFlowchartLevels(spec.steps, flowchartEdges);
  const columns = new Map<number, typeof renderedCards>();
  const columnGap = 142 * scale;
  const rowGap = 92 * scale;
  const columnWidth = 440 * scale;

  spec.steps.forEach((step, index) => {
    const level = levels.get(step.id) ?? 0;
    const width = step.type === "decision" ? 292 : 336;
    const height = getCanvasAiBodyHeight(step.body, step.type === "decision" ? 148 : 112, 260);
    const baseCard = {
      id: `${prefix}-step-${index}`,
      x: 0,
      y: 0,
      width,
      height,
      tone: step.tone
    };
    const shape = step.type === "decision" || step.type === "risk"
      ? "diamond"
      : step.type === "start" || step.type === "end" || step.type === "data"
        ? "ellipse"
        : "rectangle";
    const fittedCard = fitCanvasAiCard(baseCard, step.label, step.body, {
      minWidth: width,
      maxWidth: Math.max(width, columnWidth),
      minHeight: height,
      fontSize: step.type === "decision" ? 17 : 18,
      preferredChars: step.type === "decision" ? 24 : 31
    });
    const columnCards = columns.get(level) ?? [];

    columnCards.push({
      step,
      index,
      card: fittedCard,
      shape
    });
    columns.set(level, columnCards);
  });

  const columnHeights = Array.from(columns.entries()).map(([level, columnCards]) => ({
    level,
    height:
      columnCards.reduce((sum, item) => sum + item.card.height, 0) +
      Math.max(0, columnCards.length - 1) * rowGap
  }));
  const maxColumnHeight = Math.max(0, ...columnHeights.map((column) => column.height));

  Array.from(columns.keys())
    .sort((first, second) => first - second)
    .forEach((level) => {
      const columnCards = columns.get(level) ?? [];
      const columnHeight =
        columnCards.reduce((sum, item) => sum + item.card.height, 0) +
        Math.max(0, columnCards.length - 1) * rowGap;
      let yCursor = Math.max(0, (maxColumnHeight - columnHeight) / 2);

      columnCards.forEach((item) => {
        const card = {
          ...item.card,
          x: level * (columnWidth + columnGap) + (columnWidth - item.card.width) / 2,
          y: yCursor
        };

        yCursor += card.height + rowGap;
        cards.set(item.step.id, card);
        renderedCards.push({
          ...item,
          card
        });
      });
    });

  groups.forEach((group, index) => {
    const memberCards = spec.steps
      .filter((step) => step.groupId === group.id || group.nodeIds?.includes(step.id))
      .map((step) => cards.get(step.id))
      .filter((card): card is CanvasAiDiagramCard => Boolean(card));

    if (!memberCards.length) {
      return;
    }

    const minX = Math.min(...memberCards.map((card) => card.x));
    const minY = Math.min(...memberCards.map((card) => card.y));
    const maxX = Math.max(...memberCards.map((card) => card.x + card.width));
    const maxY = Math.max(...memberCards.map((card) => card.y + card.height));
    const paddingX = 38;
    const paddingTop = 66;
    const paddingBottom = 34;

    skeletonElements.push({
      type: "rectangle",
      id: `${prefix}-group-${index}`,
      x: minX - paddingX,
      y: minY - paddingTop,
      width: maxX - minX + paddingX * 2,
      height: maxY - minY + paddingTop + paddingBottom,
      strokeColor: getCanvasAiToneStroke(palette, undefined, index),
      backgroundColor: palette.groupBackground,
      fillStyle: "solid",
      roughness: 0,
      opacity: 62,
      roundness: { type: 3 }
    });
    addCanvasAiText(skeletonElements, {
      id: `${prefix}-group-title-${index}`,
      x: minX - paddingX + 24,
      y: minY - paddingTop + 18,
      text: group.title,
      palette,
      fontSize: 20,
      maxWidth: maxX - minX + paddingX * 2 - 48
    });
  });

  renderedCards
    .sort((first, second) => first.index - second.index)
    .forEach(({ step, index, card, shape }) => {
      addCanvasAiCard(skeletonElements, {
        ...card,
        label: step.label,
        body: step.body,
        palette,
        shape,
        index
      });
    });

  flowchartEdges.forEach((edge, index) => {
    const from = cards.get(edge.from);
    const to = cards.get(edge.to);

    if (!from || !to) {
      return;
    }

    addCanvasAiArrow(skeletonElements, {
      id: `${prefix}-edge-${index}`,
      from,
      to,
      palette,
      label: edge.label,
      tone: edge.tone
    });
  });

  return skeletonElements;
}

function renderCanvasAiMindMapSpec(
  spec: Extract<CanvasDiagramSpec, { kind: "mindmap" }>,
  prefix: string,
  palette: CanvasAiVisualPalette
) {
  const skeletonElements: CanvasAiSkeletonElement[] = [];
  const cards = new Map<string, CanvasAiDiagramCard>();
  const branchCount = Math.max(1, spec.branches.length);
  const rootCard = centerCanvasAiCard(
    fitCanvasAiCard(
      {
        id: `${prefix}-root`,
        x: 0,
        y: 0,
        width: 320,
        height: getCanvasAiBodyHeight(spec.root.body, 170, 250),
        tone: spec.root.tone ?? "primary"
      },
      spec.root.label,
      spec.root.body,
      {
        fontSize: 22,
        minWidth: 320,
        maxWidth: 420,
        minHeight: 170,
        preferredChars: 24
      }
    ),
    { x: 0, y: 0 }
  );

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);
  cards.set("root", rootCard);
  addCanvasAiCard(skeletonElements, {
    ...rootCard,
    label: spec.root.label,
    body: spec.root.body,
    palette,
    shape: "ellipse",
    fontSize: 22
  });

  spec.branches.forEach((branch, branchIndex) => {
    const angle = -Math.PI / 2 + (branchIndex / branchCount) * Math.PI * 2;
    const branchRadius = 460 + Math.min(branchCount, 10) * 18;
    const branchCard = centerCanvasAiCard(
      fitCanvasAiCard(
        {
          id: `${prefix}-branch-${branchIndex}`,
          x: 0,
          y: 0,
          width: 292,
          height: getCanvasAiBodyHeight(branch.body, 122, 190),
          tone: branch.tone
        },
        branch.label,
        branch.body,
        {
          minWidth: 292,
          maxWidth: 380,
          minHeight: 122,
          preferredChars: 24
        }
      ),
      {
        x: Math.cos(angle) * branchRadius,
        y: Math.sin(angle) * branchRadius
      }
    );

    cards.set(branch.id, branchCard);
    addCanvasAiCard(skeletonElements, {
      ...branchCard,
      label: branch.label,
      body: branch.body,
      palette,
      shape: "ellipse",
      index: branchIndex
    });
    addCanvasAiArrow(skeletonElements, {
      id: `${prefix}-root-link-${branchIndex}`,
      from: rootCard,
      to: branchCard,
      palette,
      tone: branch.tone,
      dashed: true
    });

    (branch.items ?? []).forEach((item, itemIndex) => {
      const itemCount = branch.items?.length ?? 1;
      const itemRadius = branchRadius + 310 + Math.floor(itemIndex / 5) * 170;
      const spread = clampCanvasAiValue(itemCount * 0.055, 0.12, 0.46);
      const itemOffset = (itemIndex - (itemCount - 1) / 2) * spread;
      const itemAngle = angle + itemOffset;
      const itemCard = centerCanvasAiCard(
        fitCanvasAiCard(
          {
            id: `${prefix}-item-${branchIndex}-${itemIndex}`,
            x: 0,
            y: 0,
            width: 252,
            height: getCanvasAiBodyHeight(item.body, 104, 168),
            tone: item.tone ?? branch.tone
          },
          item.label,
          item.body,
          {
            minWidth: 252,
            maxWidth: 340,
            minHeight: 104,
            preferredChars: 23
          }
        ),
        {
          x: Math.cos(itemAngle) * itemRadius,
          y: Math.sin(itemAngle) * itemRadius
        }
      );

      cards.set(item.id, itemCard);
      addCanvasAiCard(skeletonElements, {
        ...itemCard,
        label: item.label,
        body: item.body,
        palette,
        index: branchIndex + itemIndex
      });
      addCanvasAiArrow(skeletonElements, {
        id: `${prefix}-branch-link-${branchIndex}-${itemIndex}`,
        from: branchCard,
        to: itemCard,
        palette,
        tone: item.tone ?? branch.tone,
        dashed: true
      });

      (item.items ?? []).forEach((child, childIndex) => {
        const childCount = item.items?.length ?? 1;
        const childDirection = {
          x: Math.cos(itemAngle),
          y: Math.sin(itemAngle)
        };
        const childPerpendicular = {
          x: -childDirection.y,
          y: childDirection.x
        };
        const childCard = centerCanvasAiCard(
          fitCanvasAiCard(
            {
              id: `${prefix}-child-${branchIndex}-${itemIndex}-${childIndex}`,
              x: 0,
              y: 0,
              width: 228,
              height: getCanvasAiBodyHeight(child.body, 84, 138),
              tone: child.tone ?? item.tone ?? branch.tone
            },
            child.label,
            child.body,
            {
              fontSize: 16,
              minWidth: 228,
              maxWidth: 316,
              minHeight: 84,
              preferredChars: 22
            }
          ),
          {
            x:
              itemCard.x +
              itemCard.width / 2 +
              childDirection.x * 292 +
              childPerpendicular.x * (childIndex - (childCount - 1) / 2) * 128,
            y:
              itemCard.y +
              itemCard.height / 2 +
              childDirection.y * 292 +
              childPerpendicular.y * (childIndex - (childCount - 1) / 2) * 128
          }
        );

        cards.set(child.id, childCard);
        addCanvasAiCard(skeletonElements, {
          ...childCard,
          label: child.label,
          body: child.body,
          palette,
          index: childIndex
        });
        addCanvasAiArrow(skeletonElements, {
          id: `${prefix}-child-link-${branchIndex}-${itemIndex}-${childIndex}`,
          from: itemCard,
          to: childCard,
          palette,
          tone: child.tone ?? item.tone ?? branch.tone,
          dashed: true
        });
      });
    });
  });

  (spec.crossLinks ?? []).forEach((link, index) => {
    const from = cards.get(link.from);
    const to = cards.get(link.to);

    if (!from || !to) {
      return;
    }

    addCanvasAiArrow(skeletonElements, {
      id: `${prefix}-cross-${index}`,
      from,
      to,
      palette,
      label: link.label,
      tone: link.tone ?? "muted",
      dashed: true
    });
  });

  return skeletonElements;
}

function renderCanvasAiPieSpec(
  spec: Extract<CanvasDiagramSpec, { kind: "pie" }>,
  prefix: string,
  palette: CanvasAiVisualPalette
) {
  const skeletonElements: CanvasAiSkeletonElement[] = [];
  const total = spec.slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0) || 1;
  const radius = 210;
  const center = { x: 230, y: 230 };
  let angleCursor = -Math.PI / 2;

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  spec.slices.forEach((slice, index) => {
    const value = Math.max(0, slice.value);
    const angleSize = (value / total) * Math.PI * 2;
    const points: CanvasAiLocalPoint[] = [[0, 0]];
    const steps = Math.max(5, Math.ceil(angleSize / 0.22));

    for (let step = 0; step <= steps; step += 1) {
      const angle = angleCursor + (angleSize * step) / steps;
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }

    points.push([0, 0]);
    const geometry = normalizeCanvasAiLinearGeometry(center, points);

    skeletonElements.push({
      type: "line",
      id: `${prefix}-slice-${index}`,
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
      points: geometry.points,
      strokeColor: getCanvasAiToneStroke(palette, slice.tone, index),
      backgroundColor: getCanvasAiToneBackground(palette, slice.tone, index),
      fillStyle: "solid",
      roughness: 0,
      roundness: null,
      strokeWidth: 3,
      startArrowhead: null,
      endArrowhead: null
    });

    const labelAngle = angleCursor + angleSize / 2;
    const percent = Math.round((value / total) * 100);
    addCanvasAiText(skeletonElements, {
      id: `${prefix}-slice-label-${index}`,
      x: center.x + Math.cos(labelAngle) * (radius + 34) - 56,
      y: center.y + Math.sin(labelAngle) * (radius + 34) - 18,
      text: `${percent}%`,
      palette,
      fontSize: 20,
      tone: slice.tone
    });

    angleCursor += angleSize;
  });

  let legendY = 18;

  spec.slices.forEach((slice, index) => {
    const y = legendY;
    const percent = Math.round((Math.max(0, slice.value) / total) * 100);
    const legendText = `${slice.label} - ${slice.value} (${percent}%)${slice.body ? `\n${slice.body}` : ""}`;
    const legendFontSize = slice.body ? 16 : 18;
    const legendLayout = measureCanvasAiWrappedText(legendText, 430, legendFontSize);
    const swatch = {
      id: `${prefix}-legend-swatch-${index}`,
      x: 560,
      y,
      width: 26,
      height: 26,
      tone: slice.tone
    };

    addCanvasAiCard(skeletonElements, {
      ...swatch,
      label: "",
      palette,
      backgroundColor: getCanvasAiToneBackground(palette, slice.tone, index),
      strokeColor: getCanvasAiToneStroke(palette, slice.tone, index)
    });
    addCanvasAiText(skeletonElements, {
      id: `${prefix}-legend-${index}`,
      x: 600,
      y: y - 8,
      text: legendText,
      palette,
      fontSize: legendFontSize,
      tone: slice.tone,
      maxWidth: 430
    });
    legendY += Math.max(72, legendLayout.height + 24);
  });

  return skeletonElements;
}

function renderCanvasAiSequenceSpec(
  spec: Extract<CanvasDiagramSpec, { kind: "sequence" }>,
  prefix: string,
  palette: CanvasAiVisualPalette
) {
  const skeletonElements: CanvasAiSkeletonElement[] = [];
  const participantCards = new Map<string, CanvasAiDiagramCard>();
  const top = 0;
  const participantGap = 86;
  let xCursor = 0;
  let messageCursor = top + 154;
  const messageRows = spec.messages.map((message) => {
    const labelLayout = measureCanvasAiWrappedText(
      getCanvasAiArrowLabel(message.label) || message.label,
      260,
      13
    );
    const noteLayout = message.note
      ? measureCanvasAiWrappedText(message.note, 230, 15, CANVAS_AI_CARD_PADDING_X, CANVAS_AI_CARD_PADDING_Y)
      : null;
    const height = Math.max(
      112,
      labelLayout.height + 86,
      noteLayout ? labelLayout.height + noteLayout.height + 72 : 0
    );
    const row = {
      y: messageCursor,
      height
    };

    messageCursor += height;

    return row;
  });
  const bottom = Math.max(360, messageCursor + 42);

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  spec.participants.forEach((participant, index) => {
    const card = fitCanvasAiCard(
      {
        id: `${prefix}-participant-${index}`,
        x: xCursor,
        y: top,
        width: 226,
        height: getCanvasAiBodyHeight(participant.role, 96, 146),
        tone: participant.tone
      },
      participant.label,
      participant.role,
      {
        minWidth: 226,
        maxWidth: 320,
        minHeight: 96,
        preferredChars: 20
      }
    );

    participantCards.set(participant.id, card);
    addCanvasAiCard(skeletonElements, {
      ...card,
      label: participant.label,
      body: participant.role,
      palette,
      shape: "ellipse",
      index
    });
    skeletonElements.push({
      type: "line",
      id: `${prefix}-lifeline-${index}`,
      x: card.x + card.width / 2,
      y: card.y + card.height + 16,
      points: [
        [0, 0],
        [0, bottom - card.height]
      ],
      strokeColor: getCanvasAiToneStroke(palette, participant.tone, index),
      strokeStyle: "dashed",
      roughness: 0
    });
    xCursor += card.width + participantGap;
  });

  spec.messages.forEach((message, index) => {
    const from = participantCards.get(message.from);
    const to = participantCards.get(message.to);

    if (!from || !to) {
      return;
    }

    const y = messageRows[index]?.y ?? top + 138 + index * 120;
    const fromPoint = {
      ...from,
      y,
      height: 1
    };
    const toPoint = {
      ...to,
      y,
      height: 1
    };

    addCanvasAiArrow(skeletonElements, {
      id: `${prefix}-message-${index}`,
      from: fromPoint,
      to: toPoint,
      palette,
      label: message.label,
      tone: message.tone,
      dashed: message.kind === "return" || message.kind === "async"
    });

    if (message.note || message.kind === "decision" || message.kind === "loop") {
      const noteLabel = message.kind === "loop" ? "Loop" : message.kind === "decision" ? "Decision" : "Note";
      const noteCard = fitCanvasAiCard(
        {
          id: `${prefix}-message-note-${index}`,
          x: 0,
          y: y + 34,
          width: 220,
          height: getCanvasAiBodyHeight(message.note, 70, 130),
          tone: message.kind === "decision" ? "warning" : "muted"
        },
        noteLabel,
        message.note,
        {
          fontSize: 15,
          minWidth: 220,
          maxWidth: 320,
          minHeight: 70,
          preferredChars: 24
        }
      );
      const centerX = (Math.min(from.x, to.x) + Math.max(from.x + from.width, to.x + to.width)) / 2;

      addCanvasAiCard(skeletonElements, {
        ...noteCard,
        x: centerX - noteCard.width / 2,
        label: noteLabel,
        body: message.note,
        palette,
        tone: message.kind === "decision" ? "warning" : "muted",
        fontSize: 15,
        index
      });
    }
  });

  (spec.notes ?? []).forEach((note, index) => {
    const participant = note.participantId ? participantCards.get(note.participantId) : undefined;
    const x = participant ? participant.x + participant.width + 34 : xCursor + 18;
    const y = top + 122 + (note.at ?? index) * 124;
    const noteCard = fitCanvasAiCard(
      {
        id: `${prefix}-note-${index}`,
        x,
        y,
        width: 250,
        height: getCanvasAiBodyHeight(note.body, 90, 156),
        tone: note.tone ?? "muted"
      },
      note.label,
      note.body,
      {
        minWidth: 250,
        maxWidth: 360,
        minHeight: 90,
        preferredChars: 24
      }
    );

    addCanvasAiCard(skeletonElements, {
      ...noteCard,
      label: note.label,
      body: note.body,
      palette,
      tone: note.tone ?? "muted",
      index
    });
  });

  return skeletonElements;
}

function renderCanvasAiRoadmapSpec(
  spec: Extract<CanvasDiagramSpec, { kind: "roadmap" }>,
  prefix: string,
  palette: CanvasAiVisualPalette
) {
  const skeletonElements: CanvasAiSkeletonElement[] = [];
  const phaseCards = new Map<string, CanvasAiDiagramCard>();
  const scale = getCanvasAiDensityScale(spec);
  const phaseWidth = 392 * scale;
  const phaseGap = 72 * scale;

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  spec.phases.forEach((phase, phaseIndex) => {
    const laneX = phaseIndex * (phaseWidth + phaseGap);
    let yCursor = 22;
    const phaseHeader = fitCanvasAiCard(
      {
        id: `${prefix}-phase-header-${phaseIndex}`,
        x: laneX + 22,
        y: yCursor,
        width: phaseWidth - 44,
        height: getCanvasAiBodyHeight(phase.goal, 118, 184),
        tone: phase.tone ?? "primary"
      },
      [phase.title, phase.timeframe].filter(Boolean).join("\n"),
      phase.goal,
      {
        minWidth: phaseWidth - 44,
        maxWidth: phaseWidth - 44,
        minHeight: 118,
        preferredChars: 28
      }
    );
    yCursor = phaseHeader.y + phaseHeader.height + 24;
    const milestoneCards = (phase.milestones ?? []).map((milestone, milestoneIndex) => {
      const statusTone =
        milestone.tone ??
        (milestone.status === "done"
          ? "success"
          : milestone.status === "risk"
            ? "danger"
            : milestone.status === "active"
              ? "accent"
              : phase.tone);

      const card = fitCanvasAiCard(
        {
          id: `${prefix}-milestone-${phaseIndex}-${milestoneIndex}`,
          x: laneX + 34,
          y: yCursor,
          width: phaseWidth - 68,
          height: getCanvasAiBodyHeight(milestone.body, 88, 142),
          tone: statusTone
        },
        [milestone.label, milestone.owner].filter(Boolean).join(" - "),
        milestone.body,
        {
          fontSize: 17,
          minWidth: phaseWidth - 68,
          maxWidth: phaseWidth - 68,
          minHeight: 88,
          preferredChars: 27
        }
      );

      yCursor += card.height + 20;

      return {
        milestone,
        milestoneIndex,
        card,
        tone: statusTone
      };
    });
    const footerItems = [
      ...(phase.risks ?? []).map((risk) => `Risk: ${risk}`),
      ...(phase.actions ?? []).map((action) => `Next: ${action}`)
    ];
    const footerCard =
      footerItems.length > 0
        ? fitCanvasAiCard(
            {
              id: `${prefix}-phase-footer-${phaseIndex}`,
              x: laneX + 34,
              y: yCursor + 4,
              width: phaseWidth - 68,
              height: 82,
              tone: phase.risks?.length ? "warning" : "success"
            },
            footerItems.slice(0, 4).join("\n"),
            undefined,
            {
              fontSize: 15,
              minWidth: phaseWidth - 68,
              maxWidth: phaseWidth - 68,
              minHeight: 82,
              preferredChars: 34
            }
          )
        : null;
    const laneHeight = Math.max(
      340,
      (footerCard ? footerCard.y + footerCard.height : yCursor || phaseHeader.y + phaseHeader.height) + 28
    );
    const lane = {
      id: `${prefix}-phase-lane-${phaseIndex}`,
      x: laneX,
      y: 0,
      width: phaseWidth,
      height: laneHeight,
      tone: phase.tone
    };

    phaseCards.set(phase.id, lane);
    skeletonElements.push({
      type: "rectangle",
      id: lane.id,
      x: lane.x,
      y: lane.y,
      width: lane.width,
      height: lane.height,
      strokeColor: getCanvasAiToneStroke(palette, phase.tone, phaseIndex),
      backgroundColor: palette.groupBackground,
      fillStyle: "solid",
        roughness: 0,
        opacity: 70,
        roundness: { type: 3 }
      });
    addCanvasAiCard(skeletonElements, {
      ...phaseHeader,
      label: [phase.title, phase.timeframe].filter(Boolean).join("\n"),
      body: phase.goal,
      palette,
      tone: phase.tone ?? "primary",
      index: phaseIndex
    });

    milestoneCards.forEach(({ milestone, milestoneIndex, card, tone }) => {
      addCanvasAiCard(skeletonElements, {
        ...card,
        label: [milestone.label, milestone.owner].filter(Boolean).join(" - "),
        body: milestone.body,
        palette,
        tone,
        fontSize: 17,
        index: milestoneIndex
      });
    });

    if (footerCard) {
      addCanvasAiCard(skeletonElements, {
        ...footerCard,
        label: footerItems.slice(0, 4).join("\n"),
        palette,
        tone: phase.risks?.length ? "warning" : "success",
        fontSize: 15,
        index: phaseIndex
      });
    }
  });

  spec.phases.slice(1).forEach((phase, index) => {
    const from = phaseCards.get(spec.phases[index].id);
    const to = phaseCards.get(phase.id);

    if (!from || !to) {
      return;
    }

    addCanvasAiArrow(skeletonElements, {
      id: `${prefix}-phase-flow-${index}`,
      from,
      to,
      palette,
      label: "next",
      tone: phase.tone
    });
  });

  (spec.dependencies ?? []).forEach((dependency, index) => {
    const from = phaseCards.get(dependency.from);
    const to = phaseCards.get(dependency.to);

    if (!from || !to) {
      return;
    }

    addCanvasAiArrow(skeletonElements, {
      id: `${prefix}-dependency-${index}`,
      from,
      to,
      palette,
      label: dependency.label,
      tone: dependency.tone ?? "warning",
      dashed: true
    });
  });

  return skeletonElements;
}

function renderCanvasAiTimelineSpec(
  spec: Extract<CanvasDiagramSpec, { kind: "timeline" }>,
  prefix: string,
  palette: CanvasAiVisualPalette
) {
  const skeletonElements: CanvasAiSkeletonElement[] = [];
  const axisY = 170;
  const scale = getCanvasAiDensityScale(spec);
  const eventGap = 76 * scale;
  let xCursor = 0;
  const eventCards = spec.events.map((event, index) => {
    const card = fitCanvasAiCard(
      {
        id: `${prefix}-event-${index}`,
        x: xCursor,
        y: index % 2 === 0 ? 0 : 236,
        width: 268,
        height: getCanvasAiBodyHeight(event.body, 112, 176),
        tone: event.tone
      },
      [event.date, event.label].filter(Boolean).join("\n"),
      event.body,
      {
        fontSize: 17,
        minWidth: 268,
        maxWidth: 390,
        minHeight: 112,
        preferredChars: 28
      }
    );

    xCursor += card.width + eventGap;

    return {
      event,
      index,
      card,
      above: index % 2 === 0
    };
  });
  const axisWidth = Math.max(420, xCursor - eventGap + 160);

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);
  skeletonElements.push({
    type: "line",
    id: `${prefix}-axis`,
    x: 0,
    y: axisY,
    points: [
      [0, 0],
      [axisWidth, 0]
    ],
    strokeColor: palette.softStroke,
    strokeWidth: 3,
    roughness: 0
  });

  eventCards.forEach(({ event, index, card, above }) => {
    addCanvasAiCard(skeletonElements, {
      ...card,
      label: [event.date, event.label].filter(Boolean).join("\n"),
      body: event.body,
      palette,
      index,
      tone: event.tone,
      fontSize: 17
    });
    skeletonElements.push({
      type: "line",
      id: `${prefix}-event-pin-${index}`,
      x: card.x + card.width / 2,
      y: above ? card.y + card.height : axisY,
      points: [
        [0, 0],
        [0, above ? axisY - card.y - card.height : card.y - axisY]
      ],
      strokeColor: getCanvasAiToneStroke(palette, event.tone, index),
      strokeWidth: 2,
      roughness: 0
    });

    if (event.group) {
      addCanvasAiText(skeletonElements, {
        id: `${prefix}-event-group-${index}`,
        x: card.x + 18,
        y: above ? card.y + card.height + 8 : card.y - 30,
        text: event.group,
        palette,
        fontSize: 14,
        tone: "muted",
        maxWidth: card.width - 36
      });
    }
  });

  return skeletonElements;
}

function renderCanvasAiKanbanSpec(
  spec: Extract<CanvasDiagramSpec, { kind: "kanban" }>,
  prefix: string,
  palette: CanvasAiVisualPalette
) {
  const skeletonElements: CanvasAiSkeletonElement[] = [];
  const columnWidth = 364 * getCanvasAiDensityScale(spec);
  const cards = new Map<string, CanvasAiDiagramCard>();

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  spec.columns.forEach((column, columnIndex) => {
    const x = columnIndex * (columnWidth + 52);
    let yCursor = 96;
    const columnTitleText = column.summary ? `${column.title}\n${column.summary}` : column.title;
    const renderedCards = (column.cards ?? []).map((card, cardIndex) => {
      const tagLine = card.tags?.length ? `\n${card.tags.map((tag) => `#${tag}`).join(" ")}` : "";
      const body = card.body ? `${card.body}${tagLine}` : tagLine.trim() || undefined;
      const renderedCard = fitCanvasAiCard(
        {
          id: `${prefix}-card-${columnIndex}-${cardIndex}`,
          x: x + 22,
          y: yCursor,
          width: columnWidth - 44,
          height: getCanvasAiBodyHeight(body, 88, 148),
          tone: card.tone ?? column.tone
        },
        card.label,
        body,
        {
          fontSize: 16,
          minWidth: columnWidth - 44,
          maxWidth: columnWidth - 44,
          minHeight: 88,
          preferredChars: 30
        }
      );

      yCursor += renderedCard.height + 18;

      return {
        card,
        renderedCard,
        body,
        cardIndex
      };
    });
    const columnHeight = Math.max(340, yCursor + 24);

    skeletonElements.push({
      type: "rectangle",
      id: `${prefix}-column-${columnIndex}`,
      x,
      y: 0,
      width: columnWidth,
      height: columnHeight,
      strokeColor: getCanvasAiToneStroke(palette, column.tone, columnIndex),
      backgroundColor: palette.groupBackground,
      fillStyle: "solid",
      roughness: 0,
      opacity: 72,
      roundness: { type: 3 }
    });
    addCanvasAiText(skeletonElements, {
      id: `${prefix}-column-title-${columnIndex}`,
      x: x + 20,
      y: 18,
      text: columnTitleText,
      palette,
      fontSize: column.summary ? 18 : 21,
      tone: column.tone,
      maxWidth: columnWidth - 42
    });

    renderedCards.forEach(({ card, renderedCard, body, cardIndex }) => {
      cards.set(card.id, renderedCard);
      addCanvasAiCard(skeletonElements, {
        ...renderedCard,
        label: card.label,
        body,
        palette,
        fontSize: 16,
        index: cardIndex
      });
    });
  });

  (spec.links ?? []).forEach((link, index) => {
    const from = cards.get(link.from);
    const to = cards.get(link.to);

    if (!from || !to) {
      return;
    }

    addCanvasAiArrow(skeletonElements, {
      id: `${prefix}-kanban-link-${index}`,
      from,
      to,
      palette,
      label: link.label,
      tone: link.tone,
      dashed: true
    });
  });

  return skeletonElements;
}

function renderCanvasAiSemanticIslandsSpec(
  spec: Extract<CanvasDiagramSpec, { kind: "concept" }>,
  prefix: string,
  palette: CanvasAiVisualPalette
) {
  const skeletonElements: CanvasAiSkeletonElement[] = [];
  const islandCards = new Map<string, CanvasAiDiagramCard>();
  const columns = Math.max(2, Math.min(3, Math.ceil(Math.sqrt(spec.islands.length))));
  const islandWidth = 396;
  const islandGapX = 80;
  const islandGapY = 76;
  const columnY = Array.from({ length: columns }, () => 0);

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  spec.islands.forEach((island, islandIndex) => {
    const column = columnY.indexOf(Math.min(...columnY));
    const itemCards: Array<{
      item: NonNullable<(typeof island.items)>[number];
      itemIndex: number;
      card: CanvasAiDiagramCard;
    }> = [];
    const titleText = island.summary ? `${island.title}\n${island.summary}` : island.title;
    const titleLayout = measureCanvasAiWrappedText(titleText, islandWidth - 52, island.summary ? 18 : 22);
    let yCursor = 32 + titleLayout.height + 28;

    (island.items ?? []).forEach((item, itemIndex) => {
      const card = fitCanvasAiCard(
        {
          id: `${prefix}-island-item-${islandIndex}-${itemIndex}`,
          x: column * (islandWidth + islandGapX) + 24,
          y: columnY[column] + yCursor,
          width: islandWidth - 48,
          height: getCanvasAiBodyHeight(item.body, 68, 116),
          tone: item.tone ?? island.tone
        },
        item.label,
        item.body,
        {
          fontSize: 16,
          minWidth: islandWidth - 48,
          maxWidth: islandWidth - 48,
          minHeight: 68,
          preferredChars: 30
        }
      );

      itemCards.push({ item, itemIndex, card });
      yCursor += card.height + 16;
    });

    const height = Math.max(276, yCursor + 26);
    const islandCard = {
      id: `${prefix}-island-${islandIndex}`,
      x: column * (islandWidth + islandGapX),
      y: columnY[column],
      width: islandWidth,
      height,
      tone: island.tone
    };

    islandCards.set(island.id, islandCard);
    skeletonElements.push({
      type: "rectangle",
      id: islandCard.id,
      x: islandCard.x,
      y: islandCard.y,
      width: islandCard.width,
      height: islandCard.height,
      strokeColor: getCanvasAiToneStroke(palette, island.tone, islandIndex),
      backgroundColor: palette.groupBackground,
      fillStyle: "solid",
      roughness: 0,
      opacity: 74,
      roundness: { type: 3 }
    });
    addCanvasAiText(skeletonElements, {
      id: `${prefix}-island-title-${islandIndex}`,
      x: islandCard.x + 22,
      y: islandCard.y + 18,
      text: titleText,
      palette,
      fontSize: island.summary ? 18 : 22,
      tone: island.tone,
      maxWidth: islandWidth - 52
    });

    itemCards.forEach(({ item, itemIndex, card }) => {
      addCanvasAiCard(skeletonElements, {
        ...card,
        label: item.label,
        body: item.body,
        palette,
        tone: item.tone ?? island.tone,
        fontSize: 16,
        index: itemIndex
      });
    });
    columnY[column] += height + islandGapY;
  });

  (spec.links ?? []).forEach((link, index) => {
    const from = islandCards.get(link.from);
    const to = islandCards.get(link.to);

    if (!from || !to) {
      return;
    }

    addCanvasAiArrow(skeletonElements, {
      id: `${prefix}-island-link-${index}`,
      from,
      to,
      palette,
      label: link.label,
      tone: link.tone ?? "muted",
      dashed: true
    });
  });

  return skeletonElements;
}

export function buildCanvasAiSpecElements(
  spec: CanvasDiagramSpec,
  accentColor: string,
  canvasBackgroundColor?: string
) {
  const palette = getCanvasAiVisualPalette(accentColor, canvasBackgroundColor);
  const prefix = crypto.randomUUID();
  const skeletonElements =
    spec.kind === "flowchart"
      ? renderCanvasAiFlowchartSpec(spec, prefix, palette)
      : spec.kind === "mindmap"
        ? renderCanvasAiMindMapSpec(spec, prefix, palette)
        : spec.kind === "pie"
          ? renderCanvasAiPieSpec(spec, prefix, palette)
          : spec.kind === "sequence"
            ? renderCanvasAiSequenceSpec(spec, prefix, palette)
            : spec.kind === "roadmap"
              ? renderCanvasAiRoadmapSpec(spec, prefix, palette)
              : spec.kind === "timeline"
                ? renderCanvasAiTimelineSpec(spec, prefix, palette)
                : spec.kind === "kanban"
                  ? renderCanvasAiKanbanSpec(spec, prefix, palette)
                  : renderCanvasAiSemanticIslandsSpec(spec, prefix, palette);

  return (convertToExcalidrawElements(skeletonElements as any, {
    regenerateIds: true
  }) as unknown as ExcalidrawElement[]).map(normalizeCanvasAiElementLinearGeometry);
}
