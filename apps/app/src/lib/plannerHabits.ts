import { rrulestr } from "rrule";

import type { AppLanguage, Habit, HabitLog, Project } from "../types";
import { getEndOfLocalDay, getStartOfLocalDay } from "./planner";
import { buildPlannerRRule, normalizeRecurrenceRule } from "./plannerRecurrence";

export type PlannerHabitCadencePreset = "daily" | "weekdays" | "weekly" | "customDaily";

export interface PlannerHabitSummary {
  habit: Habit;
  project: Project | null;
  dueToday: boolean;
  completedToday: boolean;
  missed: boolean;
  streak: number;
  weekDueCount: number;
  weekCompletedCount: number;
  weekDays: PlannerHabitWeekDay[];
  lastLogAt: number | null;
}

const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR"];
const DAY_MS = 86_400_000;

export interface PlannerHabitWeekDay {
  dayAt: number;
  due: boolean;
  completed: boolean;
  paused: boolean;
  missed: boolean;
  today: boolean;
  future: boolean;
}

export function buildPlannerHabitFrequencyRule(preset: PlannerHabitCadencePreset, intervalDays = 2) {
  if (preset === "weekdays") {
    return "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR";
  }

  if (preset === "weekly") {
    return buildPlannerRRule({
      frequency: "weekly",
      interval: 1
    });
  }

  if (preset === "customDaily") {
    return buildPlannerRRule({
      frequency: "daily",
      interval: Math.max(2, Math.min(365, Math.round(intervalDays || 2)))
    });
  }

  return buildPlannerRRule({
    frequency: "daily",
    interval: 1
  });
}

export function getPlannerHabitCadencePreset(rule: string | null | undefined): PlannerHabitCadencePreset {
  const normalized = normalizeRecurrenceRule(rule) ?? "";
  const frequency = normalized.match(/FREQ=([A-Z]+)/)?.[1] ?? "";
  const interval = Number(normalized.match(/INTERVAL=(\d+)/)?.[1] ?? "1");
  const byDay = normalized.match(/BYDAY=([A-Z,]+)/)?.[1]?.split(",") ?? [];

  if (frequency === "WEEKLY" && WEEKDAY_CODES.every((day) => byDay.includes(day))) {
    return "weekdays";
  }

  if (frequency === "WEEKLY") {
    return "weekly";
  }

  if (frequency === "DAILY" && interval > 1) {
    return "customDaily";
  }

  return "daily";
}

export function getPlannerHabitIntervalDays(rule: string | null | undefined) {
  const normalized = normalizeRecurrenceRule(rule) ?? "";
  const interval = Number(normalized.match(/INTERVAL=(\d+)/)?.[1] ?? "2");
  return Number.isFinite(interval) ? Math.max(2, Math.min(365, Math.round(interval))) : 2;
}

export function getPlannerHabitCadenceLabel(rule: string | null | undefined, language: AppLanguage) {
  const preset = getPlannerHabitCadencePreset(rule);
  const interval = getPlannerHabitIntervalDays(rule);

  if (language === "ru") {
    return {
      daily: "Каждый день",
      weekdays: "По будням",
      weekly: "Раз в неделю",
      customDaily: `Каждые ${interval} дн.`
    }[preset];
  }

  return {
    daily: "Daily",
    weekdays: "Weekdays",
    weekly: "Weekly",
    customDaily: `Every ${interval} days`
  }[preset];
}

function getDayRange(dayAt: number) {
  return {
    startAt: getStartOfLocalDay(dayAt),
    endAt: getEndOfLocalDay(dayAt)
  };
}

function createHabitRule(habit: Habit) {
  const normalized = normalizeRecurrenceRule(habit.frequencyRule);

  if (!normalized) {
    return null;
  }

  try {
    return rrulestr(`RRULE:${normalized}`, {
      dtstart: new Date(getStartOfLocalDay(habit.createdAt))
    });
  } catch {
    return null;
  }
}

export function isPlannerHabitPausedOnDay(habit: Habit, dayAt: number) {
  if (habit.status === "paused") {
    return true;
  }

  const { startAt, endAt } = getDayRange(dayAt);
  return (habit.pauseRanges ?? []).some((range) => range.startAt <= endAt && (range.endAt ?? Number.POSITIVE_INFINITY) >= startAt);
}

export function isPlannerHabitDueOnDay(habit: Habit, dayAt: number) {
  if (habit.status === "archived" || isPlannerHabitPausedOnDay(habit, dayAt)) {
    return false;
  }

  const { startAt, endAt } = getDayRange(dayAt);
  const rule = createHabitRule(habit);

  if (!rule) {
    return true;
  }

  return rule.between(new Date(startAt), new Date(endAt), true).length > 0;
}

export function getPlannerHabitLogsForDay(habitLogs: HabitLog[], habitId: string, dayAt: number) {
  const { startAt, endAt } = getDayRange(dayAt);
  return habitLogs.filter((log) => log.habitId === habitId && log.occurredAt >= startAt && log.occurredAt <= endAt);
}

export function isPlannerHabitCompletedOnDay(habit: Habit, habitLogs: HabitLog[], dayAt: number) {
  const logs = getPlannerHabitLogsForDay(habitLogs, habit.id, dayAt);
  const total = logs.reduce((sum, log) => sum + Math.max(0, log.value || 0), 0);
  return total >= Math.max(1, habit.targetCount || 1);
}

export function getPlannerHabitStreak(habit: Habit, habitLogs: HabitLog[], now = Date.now()) {
  let streak = 0;
  const cursor = getStartOfLocalDay(now);

  for (let index = 0; index < 370; index += 1) {
    const dayAt = cursor - index * 86_400_000;

    if (!isPlannerHabitDueOnDay(habit, dayAt)) {
      continue;
    }

    if (!isPlannerHabitCompletedOnDay(habit, habitLogs, dayAt)) {
      if (dayAt === cursor) {
        continue;
      }

      break;
    }

    streak += 1;
  }

  return streak;
}

export function getPlannerHabitWeekStats(habit: Habit, habitLogs: HabitLog[], now = Date.now()) {
  const cursor = new Date(getStartOfLocalDay(now));
  const day = cursor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  cursor.setDate(cursor.getDate() + mondayOffset);
  const weekStart = cursor.getTime();
  const todayStart = getStartOfLocalDay(now);
  const todayEnd = getEndOfLocalDay(now);
  let due = 0;
  let completed = 0;
  const days: PlannerHabitWeekDay[] = [];

  for (let index = 0; index < 7; index += 1) {
    const dayAt = weekStart + index * DAY_MS;
    const isFuture = dayAt > todayStart;
    const paused = isPlannerHabitPausedOnDay(habit, dayAt);
    const isDue = isPlannerHabitDueOnDay(habit, dayAt);
    const isCompleted = isDue && isPlannerHabitCompletedOnDay(habit, habitLogs, dayAt);
    const isMissed = isDue && !isCompleted && dayAt < todayStart;

    days.push({
      dayAt,
      due: isDue,
      completed: isCompleted,
      paused,
      missed: isMissed,
      today: dayAt === todayStart,
      future: isFuture
    });

    if (!isDue || dayAt > todayEnd) {
      continue;
    }

    due += 1;

    if (isCompleted) {
      completed += 1;
    }
  }

  return {
    due,
    completed,
    days,
    ratio: due > 0 ? completed / due : 1
  };
}

function getLatestPastDueDay(habit: Habit, now: number) {
  const todayStart = getStartOfLocalDay(now);

  for (let index = 1; index <= 90; index += 1) {
    const dayAt = todayStart - index * DAY_MS;

    if (isPlannerHabitDueOnDay(habit, dayAt)) {
      return dayAt;
    }
  }

  return null;
}

export function getPlannerHabitLastLogAt(habitLogs: HabitLog[], habitId: string) {
  return habitLogs
    .filter((log) => log.habitId === habitId)
    .reduce<number | null>((latest, log) => Math.max(latest ?? 0, log.occurredAt), null);
}

export function buildPlannerHabitSummaries(input: {
  habits: Habit[];
  habitLogs: HabitLog[];
  projects: Project[];
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const projectMap = new Map(input.projects.map((project) => [project.id, project]));

  return [...input.habits]
    .sort((left, right) => (left.sortOrder ?? left.createdAt) - (right.sortOrder ?? right.createdAt))
    .map((habit) => {
      const weekStats = getPlannerHabitWeekStats(habit, input.habitLogs, now);
      const dueToday = isPlannerHabitDueOnDay(habit, now);
      const completedToday = isPlannerHabitCompletedOnDay(habit, input.habitLogs, now);
      const latestPastDueDay = getLatestPastDueDay(habit, now);
      const missed = Boolean(
        latestPastDueDay && !isPlannerHabitCompletedOnDay(habit, input.habitLogs, latestPastDueDay)
      );

      return {
        habit,
        project: habit.projectId ? projectMap.get(habit.projectId) ?? null : null,
        dueToday,
        completedToday,
        missed,
        streak: getPlannerHabitStreak(habit, input.habitLogs, now),
        weekDueCount: weekStats.due,
        weekCompletedCount: weekStats.completed,
        weekDays: weekStats.days,
        lastLogAt: getPlannerHabitLastLogAt(input.habitLogs, habit.id)
      } satisfies PlannerHabitSummary;
    });
}
