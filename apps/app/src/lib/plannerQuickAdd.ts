import type { AppLanguage, PlannerTaskPriority } from "../types";

export interface PlannerQuickAddResult {
  title: string;
  dueAt: number | null;
  scheduledStartAt: number | null;
  priority: PlannerTaskPriority | null;
  estimateMinutes: number | null;
  tagNames: string[];
  detectedTokens: string[];
}

const PRIORITY_MAP: Record<string, PlannerTaskPriority> = {
  p1: "urgent",
  p2: "high",
  p3: "medium"
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startOfLocalDay(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function withTime(date: Date, hours: number, minutes: number) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function getRelativeDateOffset(input: string) {
  const normalized = input.toLowerCase();

  if (normalized === "сегодня" || normalized === "today") {
    return 0;
  }

  if (normalized === "завтра" || normalized === "tomorrow") {
    return 1;
  }

  if (
    normalized === "послезавтра" ||
    normalized === "after tomorrow" ||
    normalized === "day after tomorrow"
  ) {
    return 2;
  }

  return null;
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, "")
    .trim();
}

export function normalizePlannerQuickAddTagName(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function parsePlannerQuickAdd(
  input: string,
  options: { now?: number; language?: AppLanguage } = {}
): PlannerQuickAddResult {
  const now = options.now ?? Date.now();
  let workingTitle = input.trim();
  const detectedTokens: string[] = [];
  const tagNames: string[] = [];
  let priority: PlannerTaskPriority | null = null;
  let estimateMinutes: number | null = null;
  let dateOffset: number | null = null;
  let parsedTime: { hours: number; minutes: number } | null = null;

  const relativeDateTokens = [
    "day after tomorrow",
    "after tomorrow",
    "послезавтра",
    "tomorrow",
    "завтра",
    "today",
    "сегодня"
  ];

  for (const token of relativeDateTokens) {
    const tokenPattern = new RegExp(`(^|\\s)${escapeRegExp(token)}(?=\\s|$)`, "iu");
    const match = workingTitle.match(tokenPattern);

    if (!match) {
      continue;
    }

    dateOffset = getRelativeDateOffset(token);
    detectedTokens.push(token);
    workingTitle = workingTitle.replace(tokenPattern, " ");
    break;
  }

  workingTitle = workingTitle.replace(/(^|\s)#([\p{L}\p{N}_-]+)/giu, (_match, prefix: string, rawName: string) => {
    const normalizedName = normalizePlannerQuickAddTagName(rawName);

    if (normalizedName) {
      tagNames.push(normalizedName);
      detectedTokens.push(`#${rawName}`);
    }

    return prefix;
  });

  workingTitle = workingTitle.replace(/(^|\s)(p[123])(?=\s|$)/giu, (_match, prefix: string, rawPriority: string) => {
    const nextPriority = PRIORITY_MAP[rawPriority.toLowerCase()];

    if (nextPriority) {
      priority = nextPriority;
      detectedTokens.push(rawPriority.toLowerCase());
    }

    return prefix;
  });

  workingTitle = workingTitle.replace(
    /(^|\s)(\d+(?:[.,]\d+)?)\s*(m|min|mins|minute|minutes|м|мин|минута|минуты|минут|h|hr|hrs|hour|hours|ч|час|часа|часов)(?=\s|$)/giu,
    (_match, prefix: string, rawAmount: string, rawUnit: string) => {
      const amount = Number(rawAmount.replace(",", "."));
      const unit = rawUnit.toLowerCase();

      if (Number.isFinite(amount) && amount > 0) {
        const isHours = ["h", "hr", "hrs", "hour", "hours", "ч", "час", "часа", "часов"].includes(unit);
        estimateMinutes = Math.max(1, Math.round(isHours ? amount * 60 : amount));
        detectedTokens.push(`${rawAmount}${rawUnit}`);
      }

      return prefix;
    }
  );

  const timePattern = /(^|\s)([01]?\d|2[0-3])[:.](\d{2})(?=\s|$)/u;
  const timeMatch = workingTitle.match(timePattern);

  if (timeMatch) {
    parsedTime = {
      hours: Number(timeMatch[2]),
      minutes: Number(timeMatch[3])
    };
    detectedTokens.push(`${timeMatch[2]}:${timeMatch[3]}`);
    workingTitle = workingTitle.replace(timePattern, "$1");
  }

  let dueAt: number | null = null;
  let scheduledStartAt: number | null = null;

  if (dateOffset !== null || parsedTime) {
    const baseDate = startOfLocalDay(now);
    const dayOffset = dateOffset ?? 0;
    baseDate.setDate(baseDate.getDate() + dayOffset);
    const scheduledDate = parsedTime
      ? withTime(baseDate, parsedTime.hours, parsedTime.minutes)
      : withTime(baseDate, 12, 0);

    if (parsedTime && dateOffset === null && scheduledDate.getTime() < now - 60_000) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    dueAt = scheduledDate.getTime();
    scheduledStartAt = parsedTime ? dueAt : null;
  }

  return {
    title: normalizeWhitespace(workingTitle) || input.trim(),
    dueAt,
    scheduledStartAt,
    priority,
    estimateMinutes,
    tagNames: Array.from(new Set(tagNames.map(normalizePlannerQuickAddTagName).filter(Boolean))),
    detectedTokens
  };
}
