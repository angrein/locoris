import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import {
  DEFAULT_CANVAS_BACKGROUND,
  DEFAULT_CANVAS_FONT_FAMILY,
  normalizeCanvasHexColor
} from "./canvas";
import { DEFAULT_NOTE_COLOR } from "./palette";
import type { CanvasDiagramSpec, CanvasDiagramTone } from "./aiIntegration";

const CANVAS_AI_DEFAULT_COLOR_KEYS = new Set([
  "",
  "black",
  "#000",
  "#000000",
  "#1e1e1e",
  "#ffffff",
  "transparent"
]);

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

  skeletonElements.push({
    type: "text",
    id: `${prefix}-title`,
    x: 0,
    y: -82,
    text: [spec.title, spec.summary].filter(Boolean).join("\n"),
    fontSize: spec.summary ? 22 : 26,
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

  skeletonElements.push({
    type: shape,
    id: card.id,
    x: card.x,
    y: card.y,
    width: card.width,
    height: card.height,
    strokeColor: card.strokeColor ?? getCanvasAiToneStroke(card.palette, card.tone, card.index),
    backgroundColor: card.backgroundColor ?? getCanvasAiToneBackground(card.palette, card.tone, card.index),
    fillStyle: "solid",
    roughness: 0,
    opacity: card.opacity ?? 96,
    roundness: shape === "rectangle" ? { type: 3 } : undefined,
    label: {
      text: getCanvasAiText(card.label, card.body),
      fontSize: card.fontSize ?? (card.body ? 18 : 20),
      fontFamily: DEFAULT_CANVAS_FONT_FAMILY,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: card.palette.text
    }
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
  }
) {
  if (!options.text.trim()) {
    return;
  }

  skeletonElements.push({
    type: "text",
    id: options.id,
    x: options.x,
    y: options.y,
    text: options.text,
    fontSize: options.fontSize ?? 18,
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
  const pointDelta = {
    x: edgePoints.end.x - edgePoints.start.x,
    y: edgePoints.end.y - edgePoints.start.y
  };

  if (Math.abs(pointDelta.x) < 8 && Math.abs(pointDelta.y) < 8) {
    return;
  }

  const geometry = normalizeCanvasAiLinearGeometry(edgePoints.start, [
    [0, 0],
    [pointDelta.x, pointDelta.y]
  ]);
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
  const groupIds = groups.map((group) => group.id);
  const groupIndex = new Map(groupIds.map((groupId, index) => [groupId, index]));
  const laneWidth = 360 * scale;
  const rowHeight = 176 * scale;

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  if (groups.length > 0) {
    groups.forEach((group, index) => {
      const laneSteps = spec.steps.filter((step) => step.groupId === group.id || group.nodeIds?.includes(step.id));
      const laneHeight = Math.max(280, 96 + laneSteps.length * rowHeight);

      skeletonElements.push({
        type: "rectangle",
        id: `${prefix}-lane-${index}`,
        x: index * laneWidth - 24,
        y: -18,
        width: laneWidth - 42,
        height: laneHeight,
        strokeColor: getCanvasAiToneStroke(palette, undefined, index),
        backgroundColor: palette.groupBackground,
        fillStyle: "solid",
        roughness: 0,
        opacity: 68,
        roundness: { type: 3 }
      });
      addCanvasAiText(skeletonElements, {
        id: `${prefix}-lane-title-${index}`,
        x: index * laneWidth,
        y: 2,
        text: group.title,
        palette,
        fontSize: 20
      });
    });
  }

  const rowByGroup = new Map<string, number>();
  spec.steps.forEach((step, index) => {
    const groupId = step.groupId && groupIndex.has(step.groupId) ? step.groupId : groupIds[index % Math.max(1, groupIds.length)];
    const column = groupId ? groupIndex.get(groupId) ?? 0 : Math.min(4, Math.floor(index / 5));
    const rowKey = groupId ?? String(column);
    const row = rowByGroup.get(rowKey) ?? 0;
    rowByGroup.set(rowKey, row + 1);
    const width = step.type === "decision" ? 250 : 286;
    const height = getCanvasAiBodyHeight(step.body, step.type === "decision" ? 126 : 96, 190);
    const card = {
      id: `${prefix}-step-${index}`,
      x: column * laneWidth,
      y: (groups.length ? 62 : 0) + row * rowHeight,
      width,
      height,
      tone: step.tone
    };
    const shape = step.type === "decision" || step.type === "risk"
      ? "diamond"
      : step.type === "start" || step.type === "end" || step.type === "data"
        ? "ellipse"
        : "rectangle";

    cards.set(step.id, card);
    addCanvasAiCard(skeletonElements, {
      ...card,
      label: step.label,
      body: step.body,
      palette,
      shape,
      index
    });
  });

  (spec.edges ?? []).forEach((edge, index) => {
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
  const rootCard = {
    id: `${prefix}-root`,
    x: -150,
    y: -80,
    width: 300,
    height: getCanvasAiBodyHeight(spec.root.body, 160, 220),
    tone: spec.root.tone ?? "primary"
  } satisfies CanvasAiDiagramCard;

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
    const radius = 390 + Math.min(branchCount, 8) * 12;
    const branchCard = {
      id: `${prefix}-branch-${branchIndex}`,
      x: Math.cos(angle) * radius - 140,
      y: Math.sin(angle) * radius - 56,
      width: 280,
      height: getCanvasAiBodyHeight(branch.body, 112, 168),
      tone: branch.tone
    };

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
      const itemRadius = radius + 260 + Math.floor(itemIndex / 4) * 130;
      const itemOffset = (itemIndex - ((branch.items?.length ?? 1) - 1) / 2) * 0.18;
      const itemAngle = angle + itemOffset;
      const itemCard = {
        id: `${prefix}-item-${branchIndex}-${itemIndex}`,
        x: Math.cos(itemAngle) * itemRadius - 120,
        y: Math.sin(itemAngle) * itemRadius - 48,
        width: 240,
        height: getCanvasAiBodyHeight(item.body, 94, 148),
        tone: item.tone ?? branch.tone
      };

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
        const childCard = {
          id: `${prefix}-child-${branchIndex}-${itemIndex}-${childIndex}`,
          x: itemCard.x + (Math.cos(angle) >= 0 ? 272 : -236),
          y: itemCard.y + childIndex * 102 - ((item.items?.length ?? 1) - 1) * 44,
          width: 216,
          height: getCanvasAiBodyHeight(child.body, 78, 120),
          tone: child.tone ?? item.tone ?? branch.tone
        };

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

  spec.slices.forEach((slice, index) => {
    const y = 18 + index * 86;
    const percent = Math.round((Math.max(0, slice.value) / total) * 100);
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
      text: `${slice.label} - ${slice.value} (${percent}%)${slice.body ? `\n${slice.body}` : ""}`,
      palette,
      fontSize: slice.body ? 16 : 18,
      tone: slice.tone
    });
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
  const columnWidth = 260;
  const messageHeight = 116;
  const top = 0;
  const bottom = top + 124 + spec.messages.length * messageHeight;

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  spec.participants.forEach((participant, index) => {
    const card = {
      id: `${prefix}-participant-${index}`,
      x: index * columnWidth,
      y: top,
      width: 210,
      height: getCanvasAiBodyHeight(participant.role, 90, 126),
      tone: participant.tone
    };

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
  });

  spec.messages.forEach((message, index) => {
    const from = participantCards.get(message.from);
    const to = participantCards.get(message.to);

    if (!from || !to) {
      return;
    }

    const y = top + 138 + index * messageHeight;
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
      addCanvasAiCard(skeletonElements, {
        id: `${prefix}-message-note-${index}`,
        x: Math.min(from.x, to.x) + Math.abs(to.x - from.x) / 2 - 92,
        y: y + 22,
        width: 184,
        height: getCanvasAiBodyHeight(message.note, 62, 100),
        label: message.kind === "loop" ? "Loop" : message.kind === "decision" ? "Decision" : "Note",
        body: message.note,
        palette,
        tone: message.kind === "decision" ? "warning" : "muted",
        index
      });
    }
  });

  (spec.notes ?? []).forEach((note, index) => {
    const participant = note.participantId ? participantCards.get(note.participantId) : undefined;
    const x = participant ? participant.x + participant.width + 26 : spec.participants.length * columnWidth + 20;
    const y = top + 112 + (note.at ?? index) * 86;

    addCanvasAiCard(skeletonElements, {
      id: `${prefix}-note-${index}`,
      x,
      y,
      width: 240,
      height: getCanvasAiBodyHeight(note.body, 84, 132),
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
  const phaseWidth = 330 * scale;
  const phaseGap = 46 * scale;

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  spec.phases.forEach((phase, phaseIndex) => {
    const milestoneCount = phase.milestones?.length ?? 0;
    const laneHeight = 220 + milestoneCount * 108 + (phase.risks?.length || phase.actions?.length ? 110 : 0);
    const laneX = phaseIndex * (phaseWidth + phaseGap);
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
      id: `${prefix}-phase-header-${phaseIndex}`,
      x: laneX + 20,
      y: 22,
      width: phaseWidth - 40,
      height: getCanvasAiBodyHeight(phase.goal, 112, 160),
      label: [phase.title, phase.timeframe].filter(Boolean).join("\n"),
      body: phase.goal,
      palette,
      tone: phase.tone ?? "primary",
      index: phaseIndex
    });

    (phase.milestones ?? []).forEach((milestone, milestoneIndex) => {
      const statusTone =
        milestone.tone ??
        (milestone.status === "done"
          ? "success"
          : milestone.status === "risk"
            ? "danger"
            : milestone.status === "active"
              ? "accent"
              : phase.tone);

      addCanvasAiCard(skeletonElements, {
        id: `${prefix}-milestone-${phaseIndex}-${milestoneIndex}`,
        x: laneX + 36,
        y: 158 + milestoneIndex * 108,
        width: phaseWidth - 72,
        height: getCanvasAiBodyHeight(milestone.body, 82, 118),
        label: [milestone.label, milestone.owner].filter(Boolean).join(" - "),
        body: milestone.body,
        palette,
        tone: statusTone,
        index: milestoneIndex
      });
    });

    const footerItems = [...(phase.risks ?? []).map((risk) => `Risk: ${risk}`), ...(phase.actions ?? []).map((action) => `Next: ${action}`)];

    if (footerItems.length > 0) {
      addCanvasAiCard(skeletonElements, {
        id: `${prefix}-phase-footer-${phaseIndex}`,
        x: laneX + 36,
        y: laneHeight - 96,
        width: phaseWidth - 72,
        height: 72,
        label: footerItems.slice(0, 3).join("\n"),
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
  const spacing = 290 * getCanvasAiDensityScale(spec);
  const axisY = 170;

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);
  skeletonElements.push({
    type: "line",
    id: `${prefix}-axis`,
    x: 0,
    y: axisY,
    points: [
      [0, 0],
      [Math.max(340, (spec.events.length - 1) * spacing + 160), 0]
    ],
    strokeColor: palette.softStroke,
    strokeWidth: 3,
    roughness: 0
  });

  spec.events.forEach((event, index) => {
    const x = index * spacing;
    const above = index % 2 === 0;
    const card = {
      id: `${prefix}-event-${index}`,
      x,
      y: above ? 0 : 236,
      width: 250,
      height: getCanvasAiBodyHeight(event.body, 104, 156),
      tone: event.tone
    };

    addCanvasAiCard(skeletonElements, {
      ...card,
      label: [event.date, event.label].filter(Boolean).join("\n"),
      body: event.body,
      palette,
      index,
      tone: event.tone
    });
    skeletonElements.push({
      type: "line",
      id: `${prefix}-event-pin-${index}`,
      x: x + card.width / 2,
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
        y: card.y + card.height + (above ? 6 : -32),
        text: event.group,
        palette,
        fontSize: 14,
        tone: "muted"
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
  const columnWidth = 308 * getCanvasAiDensityScale(spec);
  const cards = new Map<string, CanvasAiDiagramCard>();

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  spec.columns.forEach((column, columnIndex) => {
    const x = columnIndex * (columnWidth + 34);
    const cardCount = column.cards?.length ?? 0;
    const columnHeight = Math.max(330, 128 + cardCount * 112);

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
      text: column.summary ? `${column.title}\n${column.summary}` : column.title,
      palette,
      fontSize: column.summary ? 18 : 21,
      tone: column.tone
    });

    (column.cards ?? []).forEach((card, cardIndex) => {
      const renderedCard = {
        id: `${prefix}-card-${columnIndex}-${cardIndex}`,
        x: x + 20,
        y: 104 + cardIndex * 112,
        width: columnWidth - 40,
        height: getCanvasAiBodyHeight(card.body, 82, 106),
        tone: card.tone ?? column.tone
      };
      const tagLine = card.tags?.length ? `\n${card.tags.map((tag) => `#${tag}`).join(" ")}` : "";

      cards.set(card.id, renderedCard);
      addCanvasAiCard(skeletonElements, {
        ...renderedCard,
        label: card.label,
        body: card.body ? `${card.body}${tagLine}` : tagLine.trim() || undefined,
        palette,
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
  const islandWidth = 360;
  const islandGapX = 80;
  const islandGapY = 76;

  addCanvasAiTitle(skeletonElements, prefix, spec, palette);

  spec.islands.forEach((island, islandIndex) => {
    const column = islandIndex % columns;
    const row = Math.floor(islandIndex / columns);
    const itemCount = island.items?.length ?? 0;
    const height = Math.max(260, 112 + itemCount * 82);
    const islandCard = {
      id: `${prefix}-island-${islandIndex}`,
      x: column * (islandWidth + islandGapX),
      y: row * (height + islandGapY),
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
      text: island.summary ? `${island.title}\n${island.summary}` : island.title,
      palette,
      fontSize: island.summary ? 18 : 22,
      tone: island.tone
    });

    (island.items ?? []).forEach((item, itemIndex) => {
      addCanvasAiCard(skeletonElements, {
        id: `${prefix}-island-item-${islandIndex}-${itemIndex}`,
        x: islandCard.x + 24,
        y: islandCard.y + 96 + itemIndex * 82,
        width: islandWidth - 48,
        height: getCanvasAiBodyHeight(item.body, 62, 88),
        label: item.label,
        body: item.body,
        palette,
        tone: item.tone ?? island.tone,
        fontSize: 16,
        index: itemIndex
      });
    });
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
