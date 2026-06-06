import { RRule, rrulestr } from "rrule";

import type { AppLanguage, PlannerRecurrenceOverride, Task } from "../types";

export type PlannerRecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type PlannerRecurringTaskAction = "skipOccurrence" | "completeOccurrence" | "completeAllFuture";

const SUPPORTED_FREQUENCIES: Record<PlannerRecurrenceFrequency, string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY"
};

export function normalizeRecurrenceRule(rule: string | null | undefined) {
  const normalized = rule?.trim().toUpperCase() ?? "";

  if (!normalized) {
    return null;
  }

  return normalized.startsWith("RRULE:") ? normalized.slice("RRULE:".length) : normalized;
}

function normalizeOccurrenceMarker(value: number) {
  return Math.round(value / 1000) * 1000;
}

function getTaskRecurrenceAnchor(task: Task) {
  return task.recurrenceAnchorAt ?? task.scheduledStartAt ?? task.dueAt ?? task.createdAt;
}

function getTaskOccurrenceDuration(task: Task) {
  if (task.scheduledStartAt && task.scheduledEndAt && task.scheduledEndAt > task.scheduledStartAt) {
    return task.scheduledEndAt - task.scheduledStartAt;
  }

  return Math.max(15, task.estimateMinutes ?? 30) * 60_000;
}

function createRRuleFromTask(task: Task) {
  const normalized = normalizeRecurrenceRule(task.recurrenceRule);

  if (!normalized) {
    return null;
  }

  try {
    return rrulestr(`RRULE:${normalized}`, {
      dtstart: new Date(getTaskRecurrenceAnchor(task))
    }) as RRule;
  } catch {
    return null;
  }
}

export function buildPlannerRRule(input: {
  frequency: PlannerRecurrenceFrequency;
  interval?: number;
  untilAt?: number | null;
}) {
  const interval = Math.max(1, Math.floor(input.interval ?? 1));
  const chunks = [`FREQ=${SUPPORTED_FREQUENCIES[input.frequency]}`, `INTERVAL=${interval}`];

  if (input.untilAt) {
    const until = new Date(input.untilAt)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
    chunks.push(`UNTIL=${until}`);
  }

  return chunks.join(";");
}

export function isRecurringPlannerRule(rule: string | null | undefined) {
  return Boolean(normalizeRecurrenceRule(rule));
}

export function summarizePlannerRecurrence(rule: string | null | undefined, language: AppLanguage) {
  const normalized = normalizeRecurrenceRule(rule);

  if (!normalized) {
    return language === "ru" ? "Без повтора" : "No repeat";
  }

  const frequency = normalized.match(/FREQ=([A-Z]+)/)?.[1] ?? "";
  const interval = Number(normalized.match(/INTERVAL=(\d+)/)?.[1] ?? "1");
  const every = interval > 1 ? interval : 1;

  const labels =
    language === "ru"
      ? {
          DAILY: every === 1 ? "Каждый день" : `Каждые ${every} дн.`,
          WEEKLY: every === 1 ? "Каждую неделю" : `Каждые ${every} нед.`,
          MONTHLY: every === 1 ? "Каждый месяц" : `Каждые ${every} мес.`,
          YEARLY: every === 1 ? "Каждый год" : `Каждые ${every} г.`
        }
      : {
          DAILY: every === 1 ? "Daily" : `Every ${every} days`,
          WEEKLY: every === 1 ? "Weekly" : `Every ${every} weeks`,
          MONTHLY: every === 1 ? "Monthly" : `Every ${every} months`,
          YEARLY: every === 1 ? "Yearly" : `Every ${every} years`
        };

  return labels[frequency as keyof typeof labels] ?? normalized;
}

export interface PlannerTaskOccurrence {
  id: string;
  task: Task;
  originalStartAt: number;
  startAt: number;
  endAt: number;
  dueAt: number | null;
  scheduledStartAt: number | null;
  scheduledEndAt: number | null;
  completed: boolean;
  skipped: boolean;
  override: PlannerRecurrenceOverride | null;
}

export function getPlannerTaskOccurrenceId(taskId: string, originalStartAt: number) {
  return `${taskId}:${normalizeOccurrenceMarker(originalStartAt)}`;
}

export function getPlannerTaskOccurrencesForRange(task: Task, rangeStartAt: number, rangeEndAt: number) {
  const rule = createRRuleFromTask(task);
  const duration = getTaskOccurrenceDuration(task);
  const exceptions = new Set((task.recurrenceExceptionDates ?? []).map(normalizeOccurrenceMarker));
  const completed = new Set((task.recurrenceCompletedDates ?? []).map(normalizeOccurrenceMarker));
  const overrides = new Map(
    (task.recurrenceOverrides ?? []).map((override) => [
      normalizeOccurrenceMarker(override.originalStartAt),
      override
    ])
  );

  if (!rule) {
    const startAt = task.scheduledStartAt ?? task.dueAt;

    if (!startAt) {
      return [];
    }

    const endAt = task.scheduledEndAt ?? startAt + duration;

    if (startAt >= rangeEndAt || endAt <= rangeStartAt) {
      return [];
    }

    return [
      {
        id: getPlannerTaskOccurrenceId(task.id, startAt),
        task,
        originalStartAt: startAt,
        startAt,
        endAt,
        dueAt: task.dueAt,
        scheduledStartAt: task.scheduledStartAt,
        scheduledEndAt: task.scheduledEndAt,
        completed: Boolean(task.completedAt),
        skipped: false,
        override: null
      }
    ] satisfies PlannerTaskOccurrence[];
  }

  const occurrenceDates = rule.between(
    new Date(rangeStartAt - duration),
    new Date(rangeEndAt + duration),
    true
  );

  return occurrenceDates
    .map((date) => {
      const originalStartAt = normalizeOccurrenceMarker(date.getTime());
      const override = overrides.get(originalStartAt) ?? null;
      const skipped = exceptions.has(originalStartAt) || Boolean(override?.skipped);
      const startAt = override?.startAt ?? originalStartAt;
      const endAt = override?.scheduledEndAt ?? startAt + duration;
      const scheduledStartAt = override?.scheduledStartAt ?? (task.scheduledStartAt ? startAt : null);
      const scheduledEndAt = override?.scheduledEndAt ?? (scheduledStartAt ? startAt + duration : null);
      const dueAt = override?.dueAt ?? (task.dueAt ? startAt : null);

      return {
        id: getPlannerTaskOccurrenceId(task.id, originalStartAt),
        task,
        originalStartAt,
        startAt,
        endAt,
        dueAt,
        scheduledStartAt,
        scheduledEndAt,
        completed: completed.has(originalStartAt),
        skipped,
        override
      } satisfies PlannerTaskOccurrence;
    })
    .filter((occurrence) => occurrence.startAt < rangeEndAt && occurrence.endAt > rangeStartAt);
}

export function getNextPlannerTaskOccurrenceStart(task: Task, afterAt: number) {
  const rule = createRRuleFromTask(task);

  if (!rule) {
    return null;
  }

  const next = rule.after(new Date(afterAt), false);
  return next ? normalizeOccurrenceMarker(next.getTime()) : null;
}

export function buildRecurringTaskPatch(
  task: Task,
  action: PlannerRecurringTaskAction,
  occurrenceStartAt: number,
  now = Date.now()
): Partial<Task> {
  const marker = normalizeOccurrenceMarker(occurrenceStartAt);
  const duration = getTaskOccurrenceDuration(task);
  const nextStartAt = getNextPlannerTaskOccurrenceStart(task, marker + 1000);
  const nextScheduledStartAt = nextStartAt && task.scheduledStartAt ? nextStartAt : task.scheduledStartAt;
  const nextScheduledEndAt = nextScheduledStartAt ? nextScheduledStartAt + duration : task.scheduledEndAt;
  const nextDueAt = nextStartAt && task.dueAt ? nextStartAt : task.dueAt;

  if (action === "completeAllFuture") {
    return {
      status: "done",
      completedAt: now,
      recurrenceUntilAt: marker
    };
  }

  if (action === "skipOccurrence") {
    return {
      recurrenceExceptionDates: Array.from(new Set([...(task.recurrenceExceptionDates ?? []), marker])),
      scheduledStartAt: nextScheduledStartAt,
      scheduledEndAt: nextScheduledEndAt,
      dueAt: nextDueAt
    };
  }

  return {
    recurrenceCompletedDates: Array.from(new Set([...(task.recurrenceCompletedDates ?? []), marker])),
    scheduledStartAt: nextScheduledStartAt,
    scheduledEndAt: nextScheduledEndAt,
    dueAt: nextDueAt,
    status: nextStartAt ? task.status : "done",
    completedAt: nextStartAt ? task.completedAt : now
  };
}

export function buildRescheduleOccurrencePatch(task: Task, occurrenceStartAt: number, nextStartAt: number) {
  const marker = normalizeOccurrenceMarker(occurrenceStartAt);
  const duration = getTaskOccurrenceDuration(task);
  const timestamp = Date.now();
  const previousOverrides = task.recurrenceOverrides ?? [];
  const nextOverride: PlannerRecurrenceOverride = {
    id: crypto.randomUUID(),
    originalStartAt: marker,
    startAt: nextStartAt,
    dueAt: task.dueAt ? nextStartAt : null,
    scheduledStartAt: task.scheduledStartAt ? nextStartAt : null,
    scheduledEndAt: task.scheduledStartAt ? nextStartAt + duration : null,
    skipped: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    recurrenceOverrides: [
      ...previousOverrides.filter((override) => normalizeOccurrenceMarker(override.originalStartAt) !== marker),
      nextOverride
    ]
  } satisfies Partial<Task>;
}
