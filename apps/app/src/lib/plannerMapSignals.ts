import type { Project, Task } from "../types";
import {
  getEndOfLocalDay,
  getStartOfLocalDay,
  isPlannerTaskActive
} from "./planner";
import { getPlannerTaskOccurrencesForRange } from "./plannerRecurrence";

export type PlannerProjectTemporalHealth = "calm" | "active" | "attention" | "critical";

export interface PlannerProjectTemporalSignal {
  projectId: string;
  todayCount: number;
  overdueCount: number;
  upcomingCount: number;
  focusCount: number;
  activeCount: number;
  nearestDueAt: number | null;
  milestoneTaskId: string | null;
  milestoneTitle: string | null;
  milestoneAt: number | null;
  health: PlannerProjectTemporalHealth;
}

export interface PlannerMapSignalsModel {
  byProjectId: Map<string, PlannerProjectTemporalSignal>;
  totalToday: number;
  totalOverdue: number;
  totalMilestones: number;
}

const UPCOMING_WINDOW_DAYS = 7;

const EMPTY_SIGNAL: Omit<PlannerProjectTemporalSignal, "projectId"> = {
  todayCount: 0,
  overdueCount: 0,
  upcomingCount: 0,
  focusCount: 0,
  activeCount: 0,
  nearestDueAt: null,
  milestoneTaskId: null,
  milestoneTitle: null,
  milestoneAt: null,
  health: "calm"
};

function getTaskPrimaryScheduleAt(task: Task) {
  return task.scheduledStartAt ?? task.dueAt ?? task.recurrenceAnchorAt ?? null;
}

function isMilestoneCandidate(task: Task) {
  return task.kind === "milestone" || task.priority === "urgent" || task.priority === "high";
}

function createSignal(projectId: string): PlannerProjectTemporalSignal {
  return {
    projectId,
    ...EMPTY_SIGNAL
  };
}

function resolveHealth(signal: PlannerProjectTemporalSignal): PlannerProjectTemporalHealth {
  if (signal.overdueCount >= 3 || (signal.overdueCount > 0 && signal.focusCount > 0)) {
    return "critical";
  }

  if (signal.overdueCount > 0) {
    return "attention";
  }

  if (signal.todayCount > 0 || signal.focusCount > 0 || signal.milestoneTaskId) {
    return "active";
  }

  return "calm";
}

export function buildPlannerMapSignals(input: {
  projects: Project[];
  tasks: Task[];
  now?: number;
}): PlannerMapSignalsModel {
  const now = input.now ?? Date.now();
  const startOfToday = getStartOfLocalDay(now);
  const endOfToday = getEndOfLocalDay(now);
  const upcomingEndAt = getEndOfLocalDay(
    startOfToday + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const projectIds = new Set(input.projects.map((project) => project.id));
  const byProjectId = new Map<string, PlannerProjectTemporalSignal>();
  const countedToday = new Map<string, Set<string>>();
  const countedUpcoming = new Map<string, Set<string>>();

  const ensureSignal = (projectId: string) => {
    const existing = byProjectId.get(projectId);

    if (existing) {
      return existing;
    }

    const signal = createSignal(projectId);
    byProjectId.set(projectId, signal);
    return signal;
  };

  const markSet = (map: Map<string, Set<string>>, projectId: string, taskId: string) => {
    const projectSet = map.get(projectId) ?? new Set<string>();
    const alreadyMarked = projectSet.has(taskId);
    projectSet.add(taskId);
    map.set(projectId, projectSet);
    return !alreadyMarked;
  };

  input.tasks.forEach((task) => {
    if (!isPlannerTaskActive(task) || !task.projectId || !projectIds.has(task.projectId)) {
      return;
    }

    const signal = ensureSignal(task.projectId);
    const scheduleAt = getTaskPrimaryScheduleAt(task);
    signal.activeCount += 1;

    if (task.status === "inProgress") {
      signal.focusCount += 1;
    }

    if (scheduleAt && scheduleAt < startOfToday) {
      signal.overdueCount += 1;
    }

    if (scheduleAt && scheduleAt <= upcomingEndAt) {
      signal.nearestDueAt =
        signal.nearestDueAt === null ? scheduleAt : Math.min(signal.nearestDueAt, scheduleAt);
    }

    if (isMilestoneCandidate(task) && scheduleAt && scheduleAt >= startOfToday) {
      const betterMilestone =
        signal.milestoneAt === null ||
        scheduleAt < signal.milestoneAt ||
        (scheduleAt === signal.milestoneAt && task.priority === "urgent");

      if (betterMilestone) {
        signal.milestoneTaskId = task.id;
        signal.milestoneTitle = task.title;
        signal.milestoneAt = scheduleAt;
      }
    }

    const occurrences = getPlannerTaskOccurrencesForRange(task, startOfToday, upcomingEndAt);
    occurrences.forEach((occurrence) => {
      if (occurrence.completed || occurrence.skipped) {
        return;
      }

      if (occurrence.startAt >= startOfToday && occurrence.startAt <= endOfToday) {
        if (markSet(countedToday, task.projectId!, task.id)) {
          signal.todayCount += 1;
        }
        return;
      }

      if (occurrence.startAt > endOfToday && occurrence.startAt <= upcomingEndAt) {
        if (markSet(countedUpcoming, task.projectId!, task.id)) {
          signal.upcomingCount += 1;
        }
      }
    });
  });

  byProjectId.forEach((signal) => {
    signal.health = resolveHealth(signal);
  });

  return {
    byProjectId,
    totalToday: Array.from(byProjectId.values()).reduce((sum, signal) => sum + signal.todayCount, 0),
    totalOverdue: Array.from(byProjectId.values()).reduce((sum, signal) => sum + signal.overdueCount, 0),
    totalMilestones: Array.from(byProjectId.values()).filter((signal) => signal.milestoneTaskId).length
  };
}
