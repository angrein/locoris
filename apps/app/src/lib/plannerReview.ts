import type { Habit, HabitLog, Project, Task, TimeBlock } from "../types";
import {
  getEndOfLocalDay,
  getStartOfLocalDay,
  isPlannerTaskActive,
  isPlannerTaskCanceled,
  isPlannerTaskDone,
  isPlannerTaskOverdue
} from "./planner";
import { buildPlannerHabitSummaries, type PlannerHabitSummary } from "./plannerHabits";

export type PlannerReviewMode = "day" | "week";

export interface PlannerReviewProjectSignal {
  project: Project;
  activeTaskCount: number;
  lastMovementAt: number | null;
}

export interface PlannerReviewModel {
  mode: PlannerReviewMode;
  rangeStartAt: number;
  rangeEndAt: number;
  completedTasks: Task[];
  overdueTasks: Task[];
  movedTasks: Task[];
  inboxTasks: Task[];
  staleProjects: PlannerReviewProjectSignal[];
  habitSummaries: PlannerHabitSummary[];
  stats: {
    completed: number;
    overdue: number;
    moved: number;
    inbox: number;
    habitsDoneToday: number;
    habitsDueToday: number;
    staleProjects: number;
  };
}

function getReviewRange(mode: PlannerReviewMode, now: number) {
  if (mode === "day") {
    return {
      startAt: getStartOfLocalDay(now),
      endAt: getEndOfLocalDay(now)
    };
  }

  const cursor = new Date(getStartOfLocalDay(now));
  const day = cursor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  cursor.setDate(cursor.getDate() + mondayOffset);
  const startAt = cursor.getTime();

  return {
    startAt,
    endAt: startAt + 7 * 86_400_000 - 1
  };
}

function isInRange(value: number | null | undefined, rangeStartAt: number, rangeEndAt: number) {
  return Boolean(value && value >= rangeStartAt && value <= rangeEndAt);
}

function getTaskScheduleMarker(task: Task) {
  return task.scheduledStartAt ?? task.dueAt;
}

function getTaskMovementAt(task: Task) {
  return Math.max(task.updatedAt ?? 0, task.completedAt ?? 0, task.canceledAt ?? 0);
}

export function buildPlannerReview(input: {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  projects: Project[];
  timeBlocks: TimeBlock[];
  mode: PlannerReviewMode;
  now?: number;
}): PlannerReviewModel {
  const now = input.now ?? Date.now();
  const { startAt: rangeStartAt, endAt: rangeEndAt } = getReviewRange(input.mode, now);
  const completedTasks = input.tasks
    .filter((task) => isPlannerTaskDone(task) && isInRange(task.completedAt, rangeStartAt, rangeEndAt))
    .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0));
  const overdueTasks = input.tasks
    .filter((task) => isPlannerTaskOverdue(task, now))
    .sort((left, right) => (left.dueAt ?? 0) - (right.dueAt ?? 0));
  const movedTasks = input.tasks
    .filter((task) => {
      if (!isPlannerTaskActive(task)) {
        return false;
      }

      const scheduleMarker = getTaskScheduleMarker(task);
      return Boolean(scheduleMarker && scheduleMarker > rangeEndAt && isInRange(task.updatedAt, rangeStartAt, rangeEndAt));
    })
    .sort((left, right) => (getTaskScheduleMarker(left) ?? 0) - (getTaskScheduleMarker(right) ?? 0));
  const inboxTasks = input.tasks
    .filter((task) => task.status === "inbox" && isPlannerTaskActive(task))
    .sort((left, right) => right.createdAt - left.createdAt);
  const habitSummaries = buildPlannerHabitSummaries({
    habits: input.habits,
    habitLogs: input.habitLogs,
    projects: input.projects,
    now
  }).filter((summary) => summary.habit.status !== "archived");
  const staleProjects = input.projects
    .map((project) => {
      const projectTasks = input.tasks.filter((task) => task.projectId === project.id);
      const projectTimeBlocks = input.timeBlocks.filter((timeBlock) => timeBlock.projectId === project.id);
      const activeTaskCount = projectTasks.filter(isPlannerTaskActive).length;
      const lastTaskMovementAt = projectTasks.reduce((latest, task) => Math.max(latest, getTaskMovementAt(task)), 0);
      const lastBlockMovementAt = projectTimeBlocks.reduce(
        (latest, timeBlock) => Math.max(latest, timeBlock.updatedAt ?? timeBlock.createdAt),
        0
      );
      const lastMovementAt = Math.max(lastTaskMovementAt, lastBlockMovementAt, project.updatedAt ?? 0) || null;

      return {
        project,
        activeTaskCount,
        lastMovementAt
      } satisfies PlannerReviewProjectSignal;
    })
    .filter((signal) => signal.activeTaskCount > 0 && (!signal.lastMovementAt || signal.lastMovementAt < rangeStartAt))
    .sort((left, right) => right.activeTaskCount - left.activeTaskCount);

  return {
    mode: input.mode,
    rangeStartAt,
    rangeEndAt,
    completedTasks,
    overdueTasks,
    movedTasks,
    inboxTasks,
    staleProjects,
    habitSummaries,
    stats: {
      completed: completedTasks.length,
      overdue: overdueTasks.length,
      moved: movedTasks.length,
      inbox: inboxTasks.length,
      habitsDoneToday: habitSummaries.filter((summary) => summary.completedToday).length,
      habitsDueToday: habitSummaries.filter((summary) => summary.dueToday).length,
      staleProjects: staleProjects.length
    }
  };
}

export function isPlannerReviewQuiet(model: PlannerReviewModel) {
  return (
    model.stats.completed === 0 &&
    model.stats.overdue === 0 &&
    model.stats.moved === 0 &&
    model.stats.inbox === 0 &&
    model.stats.staleProjects === 0 &&
    model.stats.habitsDueToday === 0
  );
}
