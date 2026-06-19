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

export interface PlannerReviewTaskProjectGroup {
  project: Project | null;
  tasks: Task[];
}

export interface PlannerReviewTaskProjectSignal {
  project: Project | null;
  activeTaskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  inboxTaskCount: number;
}

export interface PlannerReviewPrioritySignal {
  priority: Task["priority"];
  activeTaskCount: number;
  completedTaskCount: number;
}

export interface PlannerReviewTaskAnalytics {
  created: number;
  active: number;
  noDate: number;
  noProject: number;
  linked: number;
  recurring: number;
  completedByProject: PlannerReviewTaskProjectGroup[];
  projectSignals: PlannerReviewTaskProjectSignal[];
  prioritySignals: PlannerReviewPrioritySignal[];
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
  habitInsights: {
    atRisk: PlannerHabitSummary[];
    steady: PlannerHabitSummary[];
    newHabits: PlannerHabitSummary[];
  };
  taskAnalytics: PlannerReviewTaskAnalytics;
  stats: {
    completed: number;
    overdue: number;
    moved: number;
    inbox: number;
    habitsDoneToday: number;
    habitsDueToday: number;
    habitsAtRisk: number;
    habitsSteady: number;
    habitCompletionRate30: number | null;
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

function getProjectForTask(projectMap: Map<string, Project>, task: Task) {
  return task.projectId ? projectMap.get(task.projectId) ?? null : null;
}

function groupTasksByProject(tasks: Task[], projectMap: Map<string, Project>) {
  const groups = new Map<string, PlannerReviewTaskProjectGroup>();

  for (const task of tasks) {
    const project = getProjectForTask(projectMap, task);
    const key = project?.id ?? "inbox";
    const existing = groups.get(key);

    if (existing) {
      existing.tasks.push(task);
      continue;
    }

    groups.set(key, {
      project,
      tasks: [task]
    });
  }

  return [...groups.values()].sort((left, right) => right.tasks.length - left.tasks.length);
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
  const projectMap = new Map(input.projects.map((project) => [project.id, project]));
  const activeTasks = input.tasks.filter(isPlannerTaskActive);
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
  const inboxTasks = activeTasks
    .filter((task) => task.status === "inbox" || !task.projectId || !getTaskScheduleMarker(task))
    .sort((left, right) => right.createdAt - left.createdAt);
  const habitSummaries = buildPlannerHabitSummaries({
    habits: input.habits,
    habitLogs: input.habitLogs,
    projects: input.projects,
    now
  }).filter((summary) => summary.habit.status !== "archived");
  const activeHabitSummaries = habitSummaries.filter((summary) => summary.habit.status === "active");
  const habitInsights = {
    atRisk: activeHabitSummaries
      .filter((summary) => summary.health === "risk" || summary.health === "watch")
      .sort(
        (left, right) =>
          right.last30MissedCount - left.last30MissedCount ||
          (left.last30CompletionRate ?? 1) - (right.last30CompletionRate ?? 1)
      ),
    steady: activeHabitSummaries.filter((summary) => summary.health === "steady").sort((left, right) => right.streak - left.streak),
    newHabits: activeHabitSummaries.filter((summary) => summary.health === "new")
  };
  const habitRateInputs = activeHabitSummaries.filter((summary) => summary.last30DueCount > 0);
  const habitCompletionRate30 =
    habitRateInputs.length > 0
      ? habitRateInputs.reduce((sum, summary) => sum + (summary.last30CompletionRate ?? 0), 0) / habitRateInputs.length
      : null;
  const createdTasks = input.tasks.filter((task) => isInRange(task.createdAt, rangeStartAt, rangeEndAt));
  const completedByProject = groupTasksByProject(completedTasks, projectMap);
  const projectSignals = [
    {
      project: null,
      activeTaskCount: activeTasks.filter((task) => !task.projectId).length,
      completedTaskCount: completedTasks.filter((task) => !task.projectId).length,
      overdueTaskCount: overdueTasks.filter((task) => !task.projectId).length,
      inboxTaskCount: inboxTasks.filter((task) => !task.projectId).length
    } satisfies PlannerReviewTaskProjectSignal,
    ...input.projects.map((project) => ({
      project,
      activeTaskCount: activeTasks.filter((task) => task.projectId === project.id).length,
      completedTaskCount: completedTasks.filter((task) => task.projectId === project.id).length,
      overdueTaskCount: overdueTasks.filter((task) => task.projectId === project.id).length,
      inboxTaskCount: inboxTasks.filter((task) => task.projectId === project.id).length
    }))
  ]
    .filter((signal) => signal.activeTaskCount > 0 || signal.completedTaskCount > 0 || signal.overdueTaskCount > 0 || signal.inboxTaskCount > 0)
    .sort((left, right) => right.activeTaskCount + right.overdueTaskCount - (left.activeTaskCount + left.overdueTaskCount));
  const priorityOrder: Task["priority"][] = ["urgent", "high", "medium", "low", "none"];
  const prioritySignals = priorityOrder
    .map((priority) => ({
      priority,
      activeTaskCount: activeTasks.filter((task) => task.priority === priority).length,
      completedTaskCount: completedTasks.filter((task) => task.priority === priority).length
    }))
    .filter((signal) => signal.activeTaskCount > 0 || signal.completedTaskCount > 0);
  const taskAnalytics: PlannerReviewTaskAnalytics = {
    created: createdTasks.length,
    active: activeTasks.length,
    noDate: activeTasks.filter((task) => !getTaskScheduleMarker(task)).length,
    noProject: activeTasks.filter((task) => !task.projectId).length,
    linked: activeTasks.filter((task) => task.links.length > 0 || task.noteId || task.canvasId).length,
    recurring: activeTasks.filter((task) => Boolean(task.recurrenceRule)).length,
    completedByProject,
    projectSignals,
    prioritySignals
  };
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
    habitInsights,
    taskAnalytics,
    stats: {
      completed: completedTasks.length,
      overdue: overdueTasks.length,
      moved: movedTasks.length,
      inbox: inboxTasks.length,
      habitsDoneToday: habitSummaries.filter((summary) => summary.completedToday).length,
      habitsDueToday: habitSummaries.filter((summary) => summary.dueToday).length,
      habitsAtRisk: habitInsights.atRisk.length,
      habitsSteady: habitInsights.steady.length,
      habitCompletionRate30,
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
