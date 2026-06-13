import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";

import type { AppLanguage, Habit, HabitLog, Note, PlannerTaskPriority, Project, Tag, Task, TimeBlock } from "../../types";
import {
  formatPlannerDate,
  formatPlannerTime,
  getEndOfLocalDay,
  getPlannerTimeBlocksForRange,
  getStartOfLocalDay,
  isPlannerTaskActive,
  isPlannerTaskCanceled,
  isPlannerTaskOverdue,
  type PlannerTimeBlockCreateInput,
  type PlannerTimeBlockUpdateInput,
  type PlannerTaskCreateInput,
  type PlannerTaskUpdateInput
} from "../../lib/planner";
import {
  buildRescheduleOccurrencePatch,
  buildRescheduleRecurringSeriesPatch,
  buildRecurringTaskPatch,
  getPlannerTaskOccurrencesForRange,
  isRecurringPlannerRule,
  normalizePlannerOccurrenceMarker,
  type PlannerTaskOccurrence
} from "../../lib/plannerRecurrence";
import {
  getPlannerHabitCadenceLabel,
  isPlannerHabitCompletedOnDay,
  isPlannerHabitDueOnDay
} from "../../lib/plannerHabits";
import "./PlannerCalendarSurface.css";

type CalendarMode = "day" | "week" | "month";
type CalendarEventVariant = "compact" | "wide" | "month";
type MobileCalendarPanel = "agenda" | "unscheduled" | null;

interface PlannerCalendarSurfaceProps {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  timeBlocks: TimeBlock[];
  projects: Project[];
  notes?: Note[];
  tags: Tag[];
  language: AppLanguage;
  isMobile: boolean;
  selectedTaskId: string | null;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
  onOpenNote?: (noteId: string) => void;
  onOpenProjectMap?: (projectId: string) => void;
  onCreateTag?: (name: string) => Promise<Tag>;
  onCreateTask: (input: PlannerTaskCreateInput) => Promise<Task>;
  onUpdateTask: (taskId: string, patch: PlannerTaskUpdateInput) => Promise<Task | null>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleHabitLog: (habitId: string, dayAt?: number) => Promise<HabitLog | null>;
  onCreateTimeBlock: (input: PlannerTimeBlockCreateInput) => Promise<TimeBlock>;
  onUpdateTimeBlock: (timeBlockId: string, patch: PlannerTimeBlockUpdateInput) => Promise<TimeBlock | null>;
  onDeleteTimeBlock: (timeBlockId: string) => Promise<void>;
}

interface CalendarDay {
  key: string;
  startAt: number;
  endAt: number;
  label: string;
  weekday: string;
  dayNumber: string;
  isToday: boolean;
  isOutsideMonth: boolean;
}

interface CalendarEventBase {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  color: string;
  isAllDay: boolean;
  taskId: string | null;
}

interface TimeBlockCalendarEvent extends CalendarEventBase {
  kind: "timeBlock";
  timeBlock: TimeBlock;
}

interface OccurrenceCalendarEvent extends CalendarEventBase {
  kind: "occurrence";
  occurrence: PlannerTaskOccurrence;
  isDueOnly: boolean;
}

interface HabitCalendarEvent extends CalendarEventBase {
  kind: "habit";
  habit: Habit;
  completed: boolean;
}

type CalendarEvent = TimeBlockCalendarEvent | OccurrenceCalendarEvent | HabitCalendarEvent;
type QuickCreateDraft = {
  title: string;
  startAt: number;
  endAt: number | null;
  mode: "date" | "time";
};
type CalendarOccurrenceScope = "this" | "future" | "all";
type CalendarScopedActionKind = "complete" | "remove" | "reschedule" | "resize";
type CalendarScopedAction = {
  kind: CalendarScopedActionKind;
  eventId: string;
  nextStartAt?: number;
  nextEndAt?: number | null;
};
type CalendarEventInspectorState = {
  eventId: string;
  anchor: { x: number; y: number; width: number; height: number } | null;
};
type CalendarUndoToast = {
  id: number;
  label: string;
  undo: () => Promise<void> | void;
};
type CalendarResizeState = {
  eventId: string;
  pointerId: number;
  edge: "start" | "end";
  startY: number;
  originalStartAt: number;
  originalEndAt: number;
  nextStartAt: number;
  nextEndAt: number;
};
type CalendarResizePreview = {
  eventId: string;
  startAt: number;
  endAt: number;
};

const QUICK_CREATE_DURATIONS = [30, 45, 60, 120] as const;
const TASK_PRIORITIES: PlannerTaskPriority[] = ["none", "low", "medium", "high", "urgent"];
const CALENDAR_REMINDER_PRESETS = ["none", "0", "15", "60", "1440"] as const;
type CalendarReminderPreset = (typeof CALENDAR_REMINDER_PRESETS)[number];
const PLANNER_INBOX_EVENT_COLOR = "var(--planner-calendar-inbox-color, var(--planner-calendar-accent))";
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const SNAP_MINUTES = 15;
const MIN_EVENT_DURATION_MS = 15 * MINUTE_MS;
const MANUAL_DRAG_THRESHOLD_PX = 8;

function addDays(value: number, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function addMonths(value: number, months: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.getTime();
}

function startOfWeek(value: number) {
  const date = new Date(getStartOfLocalDay(value));
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.getTime();
}

function startOfMonth(value: number) {
  const date = new Date(value);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getMonthDayCount(value: number) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getCalendarDays(startAt: number, count: number, language: AppLanguage, activeMonthAt?: number): CalendarDay[] {
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const todayStart = getStartOfLocalDay();
  const activeMonth = activeMonthAt ? new Date(activeMonthAt) : null;

  return Array.from({ length: count }, (_item, index) => {
    const dayStartAt = addDays(startAt, index);
    const dayEndAt = getEndOfLocalDay(dayStartAt);
    const dayDate = new Date(dayStartAt);

    return {
      key: String(dayStartAt),
      startAt: dayStartAt,
      endAt: dayEndAt,
      label: new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "short"
      }).format(dayStartAt),
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(dayStartAt),
      dayNumber: new Intl.DateTimeFormat(locale, { day: "numeric" }).format(dayStartAt),
      isToday: dayStartAt === todayStart,
      isOutsideMonth: activeMonth
        ? dayDate.getMonth() !== activeMonth.getMonth() || dayDate.getFullYear() !== activeMonth.getFullYear()
        : false
    };
  });
}

function getDefaultTimeBlockRange(dayStartAt: number, hour = 9) {
  const startDate = new Date(dayStartAt);
  startDate.setHours(hour, 0, 0, 0);
  const startAt = startDate.getTime();

  return {
    startAt,
    endAt: startAt + 45 * 60_000
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapTimestamp(value: number, minutes = SNAP_MINUTES) {
  const snapMs = minutes * MINUTE_MS;
  return Math.round(value / snapMs) * snapMs;
}

function getTimeOnDay(dayStartAt: number, sourceAt: number) {
  const source = new Date(sourceAt);
  const date = new Date(dayStartAt);
  date.setHours(source.getHours(), source.getMinutes(), 0, 0);
  return date.getTime();
}

function getDropStartAt(dayStartAt: number, hour: number | null, fallbackAt: number) {
  if (hour !== null) {
    const date = new Date(dayStartAt);
    date.setHours(hour, 0, 0, 0);
    return date.getTime();
  }

  return getTimeOnDay(dayStartAt, fallbackAt);
}

function getCalendarEventDuration(event: CalendarEvent) {
  return Math.max(MIN_EVENT_DURATION_MS, event.endAt - event.startAt);
}

function getCalendarEventTimedDuration(event: CalendarEvent) {
  if (event.kind === "occurrence") {
    return getCalendarTaskDuration(event.occurrence.task);
  }

  if (event.kind === "timeBlock") {
    return getCalendarEventDuration(event);
  }

  return 45 * MINUTE_MS;
}

function getTaskUndoPatch(task: Task): PlannerTaskUpdateInput {
  return {
    title: task.title,
    description: task.description,
    kind: task.kind,
    status: task.status,
    priority: task.priority,
    projectId: task.projectId,
    folderId: task.folderId,
    noteId: task.noteId,
    canvasId: task.canvasId,
    sourceBlockId: task.sourceBlockId,
    canvasElementId: task.canvasElementId,
    tagIds: task.tagIds,
    links: task.links,
    reminders: task.reminders,
    startAt: task.startAt,
    dueAt: task.dueAt,
    scheduledStartAt: task.scheduledStartAt,
    scheduledEndAt: task.scheduledEndAt,
    completedAt: task.completedAt,
    canceledAt: task.canceledAt,
    recurrenceRule: task.recurrenceRule,
    recurrenceTimezone: task.recurrenceTimezone,
    recurrenceAnchorAt: task.recurrenceAnchorAt,
    recurrenceUntilAt: task.recurrenceUntilAt,
    recurrenceExceptionDates: task.recurrenceExceptionDates,
    recurrenceCompletedDates: task.recurrenceCompletedDates,
    recurrenceOverrides: task.recurrenceOverrides,
    estimateMinutes: task.estimateMinutes,
    spentMinutes: task.spentMinutes,
    sortOrder: task.sortOrder
  };
}

function getTagKey(value: string) {
  return value.trim().toLowerCase();
}

function getTimeBlockUndoPatch(timeBlock: TimeBlock): PlannerTimeBlockUpdateInput {
  return {
    title: timeBlock.title,
    description: timeBlock.description,
    status: timeBlock.status,
    taskId: timeBlock.taskId,
    projectId: timeBlock.projectId,
    noteId: timeBlock.noteId,
    canvasId: timeBlock.canvasId,
    startAt: timeBlock.startAt,
    endAt: timeBlock.endAt,
    actualStartAt: timeBlock.actualStartAt,
    actualEndAt: timeBlock.actualEndAt,
    color: timeBlock.color
  };
}

function buildTaskCalendarPatch(task: Task, startAt: number, endAt: number | null, isAllDay: boolean): PlannerTaskUpdateInput {
  if (isAllDay) {
    const dueAt = getStartOfLocalDay(startAt);
    return {
      dueAt,
      scheduledStartAt: null,
      scheduledEndAt: null,
      recurrenceAnchorAt: task.recurrenceRule ? dueAt : task.recurrenceAnchorAt,
      estimateMinutes: null,
      status: task.status === "inbox" || task.status === "scheduled" ? "todo" : task.status
    };
  }

  const normalizedEndAt = Math.max(startAt + MIN_EVENT_DURATION_MS, endAt ?? startAt + getCalendarTaskDuration(task));

  return {
    dueAt: null,
    scheduledStartAt: startAt,
    scheduledEndAt: normalizedEndAt,
    recurrenceAnchorAt: task.recurrenceRule ? startAt : task.recurrenceAnchorAt,
    estimateMinutes: Math.max(15, Math.round((normalizedEndAt - startAt) / MINUTE_MS)),
    status: task.status === "inbox" ? "scheduled" : task.status
  };
}

function getCalendarTaskDuration(task: Task) {
  if (task.scheduledStartAt && task.scheduledEndAt && task.scheduledEndAt > task.scheduledStartAt) {
    return task.scheduledEndAt - task.scheduledStartAt;
  }

  return Math.max(15, task.estimateMinutes ?? 45) * MINUTE_MS;
}

function getEventInspectorStyle(anchor: CalendarEventInspectorState["anchor"], isMobile: boolean): CSSProperties | undefined {
  if (isMobile || !anchor || typeof window === "undefined") {
    return undefined;
  }

  const gap = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(380, Math.max(280, viewportWidth - gap * 2));
  const height = Math.min(560, Math.max(320, viewportHeight - gap * 2));
  const canOpenRight = anchor.x + anchor.width + gap + width < viewportWidth;
  const preferredLeft = canOpenRight ? anchor.x + anchor.width + gap : anchor.x - width - gap;
  const belowTop = anchor.y + anchor.height + gap;
  const aboveTop = anchor.y - height - gap;
  const canOpenBelow = belowTop + height <= viewportHeight - gap;
  const preferredTop = canOpenBelow ? belowTop : aboveTop >= gap ? aboveTop : anchor.y;
  const maxLeft = Math.max(gap, viewportWidth - width - gap);
  const maxTop = Math.max(gap, viewportHeight - height - gap);

  return {
    left: clampNumber(preferredLeft, gap, maxLeft),
    top: clampNumber(preferredTop, gap, maxTop),
    width
  };
}

function getRangeTitle(cursorAt: number, mode: CalendarMode, language: AppLanguage) {
  const locale = language === "ru" ? "ru-RU" : "en-US";

  if (mode === "day") {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(cursorAt);
  }

  if (mode === "week") {
    const weekStart = startOfWeek(cursorAt);
    const weekEnd = addDays(weekStart, 6);
    const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric"
  }).format(cursorAt);
}

function getEventProjectColor(occurrence: PlannerTaskOccurrence, projectMap: Map<string, Project>) {
  return occurrence.task.projectId
    ? projectMap.get(occurrence.task.projectId)?.color ?? PLANNER_INBOX_EVENT_COLOR
    : PLANNER_INBOX_EVENT_COLOR;
}

function doRangesOverlap(leftStartAt: number, leftEndAt: number, rightStartAt: number, rightEndAt: number) {
  return leftStartAt < rightEndAt && leftEndAt > rightStartAt;
}

function getHour(value: number) {
  return new Date(value).getHours();
}

function getEventsForDay(events: CalendarEvent[], day: CalendarDay) {
  return events.filter((event) => doRangesOverlap(event.startAt, event.endAt, day.startAt, day.endAt));
}

function getVisibleHourRange(_events: CalendarEvent[]) {
  return { startHour: 0, endHour: 23 };
}

function getCalendarEventKindOrder(event: CalendarEvent) {
  if (event.kind === "habit") {
    return 2;
  }

  return 0;
}

function sortCalendarEvents(events: CalendarEvent[]) {
  return [...events].sort((left, right) => {
    const leftCompleted = isCalendarEventCompleted(left) ? 1 : 0;
    const rightCompleted = isCalendarEventCompleted(right) ? 1 : 0;

    if (leftCompleted !== rightCompleted) {
      return leftCompleted - rightCompleted;
    }

    if (left.startAt !== right.startAt) {
      return left.startAt - right.startAt;
    }

    const leftKindOrder = getCalendarEventKindOrder(left);
    const rightKindOrder = getCalendarEventKindOrder(right);

    if (leftKindOrder !== rightKindOrder) {
      return leftKindOrder - rightKindOrder;
    }

    return left.title.localeCompare(right.title);
  });
}

function getCalendarEventSubtitle(event: CalendarEvent, language: AppLanguage) {
  if (event.kind === "timeBlock") {
    return `${formatPlannerTime(event.startAt, language)} - ${formatPlannerTime(event.endAt, language)}`;
  }

  if (event.kind === "habit") {
    if (event.completed) {
      return language === "ru" ? "Привычка · отмечено" : "Habit · done";
    }

    return language === "ru" ? "Привычка · весь день" : "Habit · all day";
  }

  if (event.isAllDay) {
    const kindLabel = event.isDueOnly
      ? language === "ru"
        ? "срок"
        : "due"
      : language === "ru"
        ? "запланировано"
        : "scheduled";

    return `${language === "ru" ? "Весь день" : "All day"} · ${kindLabel}`;
  }

  const timeLabel =
    event.occurrence.scheduledEndAt && !event.isDueOnly
      ? `${formatPlannerTime(event.startAt, language)} - ${formatPlannerTime(event.endAt, language)}`
      : formatPlannerTime(event.startAt, language);
  const kindLabel = event.isDueOnly
    ? language === "ru"
      ? "срок"
      : "due"
    : language === "ru"
      ? "запланировано"
      : "scheduled";

  return `${timeLabel} · ${kindLabel}`;
}

function isOccurrenceAllDay(occurrence: PlannerTaskOccurrence) {
  if (!occurrence.scheduledStartAt) {
    return true;
  }

  const duration = occurrence.endAt - occurrence.startAt;
  const startsAtDayStart = occurrence.startAt === getStartOfLocalDay(occurrence.startAt);
  const endsAfterWorkday = occurrence.endAt >= getEndOfLocalDay(occurrence.startAt) - 15 * 60_000;

  return !occurrence.task.estimateMinutes && (duration >= DAY_MS - 30 * 60_000 || startsAtDayStart || endsAfterWorkday);
}

function getTimedEvents(events: CalendarEvent[]) {
  return events.filter((event) => !event.isAllDay);
}

function getAllDayEvents(events: CalendarEvent[]) {
  return events.filter((event) => event.isAllDay);
}

function getEventSlotHour(event: CalendarEvent, day: CalendarDay, firstVisibleHour: number) {
  if (event.startAt < day.startAt) {
    return firstVisibleHour;
  }

  if (event.startAt > day.endAt) {
    return null;
  }

  return getHour(event.startAt);
}

function getTaskHasCalendarDate(task: Task) {
  return Boolean(task.dueAt || task.scheduledStartAt || task.recurrenceAnchorAt || task.recurrenceRule);
}

function isCalendarEventCompleted(event: CalendarEvent) {
  if (event.kind === "timeBlock") {
    return event.timeBlock.status === "completed";
  }

  if (event.kind === "occurrence") {
    return event.occurrence.completed;
  }

  return event.completed;
}

function getReminderPreset(task: Task): CalendarReminderPreset {
  const enabledReminder = task.reminders.find((reminder) => reminder.enabled);

  if (!enabledReminder) {
    return "none";
  }

  if (enabledReminder.offsetMinutes !== null) {
    const offset = String(enabledReminder.offsetMinutes);
    return CALENDAR_REMINDER_PRESETS.includes(offset as CalendarReminderPreset) ? (offset as CalendarReminderPreset) : "15";
  }

  return "0";
}

function getReminderLabel(preset: CalendarReminderPreset, language: AppLanguage) {
  if (language === "ru") {
    return {
      none: "Нет",
      "0": "В момент",
      "15": "За 15 мин",
      "60": "За час",
      "1440": "За день"
    }[preset];
  }

  return {
    none: "None",
    "0": "At time",
    "15": "15 min",
    "60": "1 hour",
    "1440": "1 day"
  }[preset];
}

function isCalendarEventOverdue(event: CalendarEvent) {
  if (isCalendarEventCompleted(event) || event.kind === "habit") {
    return false;
  }

  if (event.kind === "occurrence") {
    return isPlannerTaskOverdue(event.occurrence.task);
  }

  return event.endAt < getStartOfLocalDay();
}

function isCalendarEventToday(event: CalendarEvent) {
  const todayStart = getStartOfLocalDay();
  const todayEnd = getEndOfLocalDay();
  return doRangesOverlap(event.startAt, event.endAt, todayStart, todayEnd);
}

function isCalendarEventRecurring(event: CalendarEvent) {
  return event.kind === "occurrence" && isRecurringPlannerRule(event.occurrence.task.recurrenceRule);
}

export default function PlannerCalendarSurface({
  tasks,
  habits,
  habitLogs,
  timeBlocks,
  projects,
  notes = [],
  tags,
  language,
  isMobile,
  selectedTaskId,
  onClose,
  onSelectTask,
  onOpenNote,
  onOpenProjectMap,
  onCreateTag,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onToggleHabitLog,
  onCreateTimeBlock,
  onUpdateTimeBlock,
  onDeleteTimeBlock
}: PlannerCalendarSurfaceProps) {
  const [mode, setMode] = useState<CalendarMode>(isMobile ? "day" : "week");
  const [cursorAt, setCursorAt] = useState(getStartOfLocalDay());
  const [selectedDayAt, setSelectedDayAt] = useState(getStartOfLocalDay());
  const [tapScheduleTaskId, setTapScheduleTaskId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobileCalendarPanel>(null);
  const [quickCreateDraft, setQuickCreateDraft] = useState<QuickCreateDraft | null>(null);
  const [eventInspector, setEventInspector] = useState<CalendarEventInspectorState | null>(null);
  const [scopedAction, setScopedAction] = useState<CalendarScopedAction | null>(null);
  const [undoToast, setUndoToast] = useState<CalendarUndoToast | null>(null);
  const [resizePreview, setResizePreview] = useState<CalendarResizePreview | null>(null);
  const [inspectorTitleDraft, setInspectorTitleDraft] = useState("");
  const [inspectorDescriptionDraft, setInspectorDescriptionDraft] = useState("");
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
  const [areTagsExpanded, setAreTagsExpanded] = useState(false);
  const [isTagCreatorOpen, setIsTagCreatorOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [manualDragTaskId, setManualDragTaskId] = useState<string | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const resizeRef = useRef<CalendarResizeState | null>(null);
  const manualDragRef = useRef<{
    taskId: string;
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressNextUnscheduledClickRef = useRef<string | null>(null);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const noteMap = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const range = useMemo(() => {
    if (mode === "month") {
      const startAt = startOfMonth(cursorAt);
      const dayCount = getMonthDayCount(cursorAt);
      return {
        startAt,
        endAt: addDays(startAt, dayCount),
        days: getCalendarDays(startAt, dayCount, language, cursorAt)
      };
    }

    if (mode === "week") {
      const startAt = startOfWeek(cursorAt);
      return {
        startAt,
        endAt: addDays(startAt, 7),
        days: getCalendarDays(startAt, 7, language)
      };
    }

    const startAt = getStartOfLocalDay(cursorAt);
    return {
      startAt,
      endAt: getEndOfLocalDay(cursorAt),
      days: getCalendarDays(startAt, 1, language)
    };
  }, [cursorAt, language, mode]);
  const visibleTimeBlocks = useMemo(
    () => getPlannerTimeBlocksForRange(timeBlocks, range.startAt, range.endAt),
    [range.endAt, range.startAt, timeBlocks]
  );
  const timeBlockTaskIds = useMemo(
    () => new Set(timeBlocks.map((timeBlock) => timeBlock.taskId).filter(Boolean) as string[]),
    [timeBlocks]
  );
  const visibleOccurrences = useMemo(
    () =>
      tasks
        .filter((task) => !isPlannerTaskCanceled(task) && getTaskHasCalendarDate(task))
        .flatMap((task) => getPlannerTaskOccurrencesForRange(task, range.startAt, range.endAt))
        .filter((occurrence) => {
          if (occurrence.skipped) {
            return false;
          }

          return !visibleTimeBlocks.some(
            (timeBlock) =>
              timeBlock.taskId === occurrence.task.id &&
              doRangesOverlap(timeBlock.startAt, timeBlock.endAt, occurrence.startAt, occurrence.endAt)
          );
        }),
    [range.endAt, range.startAt, tasks, visibleTimeBlocks]
  );
  const visibleHabitEvents = useMemo<CalendarEvent[]>(
    () =>
      range.days.flatMap((day) =>
        habits
          .filter((habit) => isPlannerHabitDueOnDay(habit, day.startAt))
          .map((habit) => ({
            id: `habit:${habit.id}:${day.startAt}`,
            kind: "habit" as const,
            habit,
            title: habit.title,
            startAt: day.startAt,
            endAt: day.endAt,
            color: habit.projectId
              ? projectMap.get(habit.projectId)?.color ?? habit.color
              : habit.color || PLANNER_INBOX_EVENT_COLOR,
            isAllDay: true,
            taskId: null,
            completed: isPlannerHabitCompletedOnDay(habit, habitLogs, day.startAt)
          }))
      ),
    [habitLogs, habits, projectMap, range.days]
  );
  const events = useMemo<CalendarEvent[]>(() => {
    const blockEvents = visibleTimeBlocks.map((timeBlock) => ({
      id: `timeBlock:${timeBlock.id}`,
      kind: "timeBlock" as const,
      timeBlock,
      title: timeBlock.title,
      startAt: timeBlock.startAt,
      endAt: timeBlock.endAt,
      color: timeBlock.projectId ? projectMap.get(timeBlock.projectId)?.color ?? timeBlock.color : timeBlock.color || PLANNER_INBOX_EVENT_COLOR,
      isAllDay: false,
      taskId: timeBlock.taskId
    }));
    const occurrenceEvents = visibleOccurrences.map((occurrence) => ({
      id: `occurrence:${occurrence.id}`,
      kind: "occurrence" as const,
      occurrence,
      title: occurrence.task.title,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      color: getEventProjectColor(occurrence, projectMap),
      isAllDay: isOccurrenceAllDay(occurrence),
      taskId: occurrence.task.id,
      isDueOnly: !occurrence.scheduledStartAt
    }));

    return sortCalendarEvents([...blockEvents, ...occurrenceEvents, ...visibleHabitEvents]);
  }, [projectMap, visibleHabitEvents, visibleOccurrences, visibleTimeBlocks]);
  const inspectedEvent = useMemo(
    () => (eventInspector ? events.find((event) => event.id === eventInspector.eventId) ?? null : null),
    [eventInspector, events]
  );
  const inspectedTask = inspectedEvent?.kind === "occurrence" ? inspectedEvent.occurrence.task : null;
  const inspectedTimeBlock = inspectedEvent?.kind === "timeBlock" ? inspectedEvent.timeBlock : null;
  const selectedTagKeys = useMemo(() => {
    const keys = new Set<string>();
    inspectedTask?.tagIds.forEach((tagId) => {
      const tag = tagMap.get(tagId);
      if (tag) {
        keys.add(getTagKey(tag.name));
      }
    });
    return keys;
  }, [inspectedTask?.tagIds, tagMap]);
  const uniqueTags = useMemo(() => {
    const uniqueTagMap = new Map<string, Tag>();
    tags.forEach((tag) => {
      const key = getTagKey(tag.name);
      if (key && !uniqueTagMap.has(key)) {
        uniqueTagMap.set(key, tag);
      }
    });
    return Array.from(uniqueTagMap.values()).sort((left, right) => {
      const leftSelected = selectedTagKeys.has(getTagKey(left.name));
      const rightSelected = selectedTagKeys.has(getTagKey(right.name));
      if (leftSelected !== rightSelected) {
        return leftSelected ? -1 : 1;
      }
      return left.name.localeCompare(right.name, language === "ru" ? "ru" : "en", { sensitivity: "base" });
    });
  }, [language, selectedTagKeys, tags]);
  const visibleInspectorTags = areTagsExpanded ? uniqueTags : uniqueTags.slice(0, isMobile ? 5 : 7);
  const hiddenInspectorTagCount = Math.max(0, uniqueTags.length - visibleInspectorTags.length);
  const scopedEvent = useMemo(
    () => (scopedAction ? events.find((event) => event.id === scopedAction.eventId) ?? null : null),
    [events, scopedAction]
  );
  const unscheduledTasks = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            isPlannerTaskActive(task) &&
            !getTaskHasCalendarDate(task) &&
            !timeBlockTaskIds.has(task.id)
        )
        .slice()
        .sort((left, right) => (left.sortOrder ?? left.createdAt) - (right.sortOrder ?? right.createdAt)),
    [tasks, timeBlockTaskIds]
  );
  const selectedDay = useMemo(
    () =>
      range.days.find((day) => selectedDayAt >= day.startAt && selectedDayAt <= day.endAt) ??
      range.days[0],
    [range.days, selectedDayAt]
  );
  const selectedDayEvents = useMemo(
    () => (selectedDay ? sortCalendarEvents(getEventsForDay(events, selectedDay)) : []),
    [events, selectedDay]
  );
  const dayModeEvents = useMemo(
    () => (range.days[0] ? sortCalendarEvents(getEventsForDay(events, range.days[0])) : []),
    [events, range.days]
  );
  const { startHour, endHour } = useMemo(() => getVisibleHourRange(getTimedEvents(mode === "day" ? dayModeEvents : selectedDayEvents)), [
    dayModeEvents,
    mode,
    selectedDayEvents
  ]);
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_item, index) => startHour + index),
    [endHour, startHour]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (scopedAction) {
          setScopedAction(null);
          return;
        }

        if (eventInspector) {
          setEventInspector(null);
          return;
        }

        if (quickCreateDraft) {
          setQuickCreateDraft(null);
          return;
        }

        if (mobilePanel) {
          setMobilePanel(null);
          return;
        }

        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [eventInspector, mobilePanel, onClose, quickCreateDraft, scopedAction]);

  useEffect(() => {
    if (eventInspector && !inspectedEvent) {
      setEventInspector(null);
    }
  }, [eventInspector, inspectedEvent]);

  useEffect(() => {
    if (!inspectedEvent) {
      setInspectorTitleDraft("");
      setInspectorDescriptionDraft("");
      setIsReminderPickerOpen(false);
      setAreTagsExpanded(false);
      setIsTagCreatorOpen(false);
      setTagDraft("");
      setIsCreatingTag(false);
      return;
    }

    setInspectorTitleDraft(inspectedEvent.title);
    setInspectorDescriptionDraft(
      inspectedEvent.kind === "occurrence"
        ? inspectedEvent.occurrence.task.description
        : inspectedEvent.kind === "timeBlock"
          ? inspectedEvent.timeBlock.description
          : inspectedEvent.habit.description
    );
    setIsReminderPickerOpen(false);
    setAreTagsExpanded(false);
    setIsTagCreatorOpen(false);
    setTagDraft("");
    setIsCreatingTag(false);
  }, [inspectedEvent?.id]);

  useEffect(
    () => () => {
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isMobile && mobilePanel) {
      setMobilePanel(null);
    }
  }, [isMobile, mobilePanel]);

  const scheduleTask = async (task: Task, dayStartAt: number, hour: number | null = null) => {
    const normalizedDayStartAt = getStartOfLocalDay(dayStartAt);

    if (hour === null) {
      await updateTaskWithUndo(
        task,
        {
          dueAt: normalizedDayStartAt,
          scheduledStartAt: null,
          scheduledEndAt: null,
          estimateMinutes: null,
          status: task.status === "inbox" ? "todo" : task.status
        },
        language === "ru" ? "Задача поставлена на день" : "Task scheduled for day"
      );
      onSelectTask(task.id);
      setTapScheduleTaskId(null);
      setSelectedDayAt(normalizedDayStartAt);
      return;
    }

    const taskProject = task.projectId ? projectMap.get(task.projectId) : null;
    const rangeForBlock = getDefaultTimeBlockRange(normalizedDayStartAt, hour);
    const createdBlock = await onCreateTimeBlock({
      title: task.title,
      taskId: task.id,
      projectId: task.projectId,
      noteId: task.noteId,
      canvasId: task.canvasId,
      startAt: rangeForBlock.startAt,
      endAt: rangeForBlock.endAt,
      color: taskProject?.color ?? PLANNER_INBOX_EVENT_COLOR
    });
    showUndoToast(language === "ru" ? "Задача поставлена в слот" : "Task scheduled in slot", () =>
      onDeleteTimeBlock(createdBlock.id)
    );
    onSelectTask(task.id);
    setTapScheduleTaskId(null);
    setSelectedDayAt(normalizedDayStartAt);
  };

  const handleCalendarDrop = async (event: DragEvent<HTMLElement>, dayStartAt: number, hour: number | null = null) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const calendarEventId = event.dataTransfer.getData("application/x-locoris-calendar-event-id");

    if (calendarEventId) {
      const calendarEvent = events.find((candidate) => candidate.id === calendarEventId);

      if (!calendarEvent || calendarEvent.kind === "habit") {
        return;
      }

      if (calendarEvent.kind === "occurrence" && hour === null) {
        await applyEventReschedule(calendarEvent, getStartOfLocalDay(dayStartAt), null);
        return;
      }

      if (calendarEvent.kind === "timeBlock" && hour === null && calendarEvent.timeBlock.taskId) {
        await convertTimeBlockTaskToAllDay(calendarEvent.timeBlock, dayStartAt);
        return;
      }

      const nextStartAt = snapTimestamp(getDropStartAt(getStartOfLocalDay(dayStartAt), hour, calendarEvent.startAt));
      const nextEndAt = nextStartAt + (calendarEvent.isAllDay ? getCalendarEventTimedDuration(calendarEvent) : getCalendarEventDuration(calendarEvent));
      await applyEventReschedule(calendarEvent, nextStartAt, nextEndAt);
      return;
    }

    const taskId =
      event.dataTransfer.getData("application/x-locoris-task-id") ||
      event.dataTransfer.getData("text/plain");
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (task) {
      await scheduleTask(task, dayStartAt, hour);
    }
  };

  const handleTaskDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleEventDragStart = (eventObject: DragEvent<HTMLElement>, calendarEvent: CalendarEvent) => {
    if (isMobile || calendarEvent.kind === "habit") {
      eventObject.preventDefault();
      return;
    }

    eventObject.dataTransfer.effectAllowed = "move";
    eventObject.dataTransfer.setData("application/x-locoris-calendar-event-id", calendarEvent.id);
    eventObject.dataTransfer.setData("text/plain", calendarEvent.id);
  };

  const handleResizeStart = (eventObject: PointerEvent<HTMLButtonElement>, calendarEvent: CalendarEvent, edge: "start" | "end") => {
    if (isMobile || calendarEvent.kind === "habit" || calendarEvent.isAllDay || eventObject.button !== 0) {
      return;
    }

    eventObject.preventDefault();
    eventObject.stopPropagation();
    resizeRef.current = {
      eventId: calendarEvent.id,
      pointerId: eventObject.pointerId,
      edge,
      startY: eventObject.clientY,
      originalStartAt: calendarEvent.startAt,
      originalEndAt: calendarEvent.endAt,
      nextStartAt: calendarEvent.startAt,
      nextEndAt: calendarEvent.endAt
    };
    eventObject.currentTarget.setPointerCapture?.(eventObject.pointerId);
    setResizePreview({ eventId: calendarEvent.id, startAt: calendarEvent.startAt, endAt: calendarEvent.endAt });
  };

  const handleResizeMove = (eventObject: PointerEvent<HTMLButtonElement>) => {
    const resizeState = resizeRef.current;

    if (!resizeState || resizeState.pointerId !== eventObject.pointerId) {
      return;
    }

    eventObject.preventDefault();
    eventObject.stopPropagation();
    const deltaMinutes = Math.round((eventObject.clientY - resizeState.startY) / 2);
    const calendarEvent = events.find((candidate) => candidate.id === resizeState.eventId);

    if (resizeState.edge === "start") {
      const maxStartAt = resizeState.originalEndAt - MIN_EVENT_DURATION_MS;
      resizeState.nextStartAt = Math.min(maxStartAt, snapTimestamp(resizeState.originalStartAt + deltaMinutes * MINUTE_MS));
      resizeState.nextEndAt = resizeState.originalEndAt;
    } else {
      const minEndAt = calendarEvent ? calendarEvent.startAt + MIN_EVENT_DURATION_MS : resizeState.originalEndAt;
      resizeState.nextStartAt = calendarEvent?.startAt ?? resizeState.originalStartAt;
      resizeState.nextEndAt = Math.max(minEndAt, snapTimestamp(resizeState.originalEndAt + deltaMinutes * MINUTE_MS));
    }

    setResizePreview({ eventId: resizeState.eventId, startAt: resizeState.nextStartAt, endAt: resizeState.nextEndAt });
  };

  const handleResizeEnd = async (eventObject: PointerEvent<HTMLButtonElement>) => {
    const resizeState = resizeRef.current;

    if (!resizeState || resizeState.pointerId !== eventObject.pointerId) {
      return;
    }

    eventObject.preventDefault();
    eventObject.stopPropagation();
    resizeRef.current = null;
    setResizePreview(null);
    eventObject.currentTarget.releasePointerCapture?.(eventObject.pointerId);

    const calendarEvent = events.find((candidate) => candidate.id === resizeState.eventId);

    if (
      !calendarEvent ||
      (resizeState.nextStartAt === resizeState.originalStartAt && resizeState.nextEndAt === resizeState.originalEndAt)
    ) {
      return;
    }

    if (resizeState.edge === "start") {
      await applyEventReschedule(calendarEvent, resizeState.nextStartAt, resizeState.nextEndAt);
      return;
    }

    await applyEventResize(calendarEvent, resizeState.nextEndAt);
  };

  const handleManualDragStart = (event: PointerEvent<HTMLElement>, taskId: string) => {
    if (isMobile || event.pointerType === "touch" || event.button !== 0) {
      return;
    }

    manualDragRef.current = {
      taskId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleManualDragMove = (event: PointerEvent<HTMLElement>) => {
    const dragState = manualDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);

    if (distance < MANUAL_DRAG_THRESHOLD_PX) {
      return;
    }

    if (!dragState.dragging) {
      dragState.dragging = true;
      setManualDragTaskId(dragState.taskId);
    }
  };

  const handleManualDragEnd = async (event: PointerEvent<HTMLElement>) => {
    const dragState = manualDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    manualDragRef.current = null;
    setManualDragTaskId(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (!dragState.dragging) {
      return;
    }

    suppressNextUnscheduledClickRef.current = dragState.taskId;
    event.preventDefault();
    event.stopPropagation();

    const task = tasks.find((candidate) => candidate.id === dragState.taskId);
    const dropTarget = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-planner-calendar-drop='true']");

    if (!task || !dropTarget) {
      return;
    }

    const dayStartAt = Number(dropTarget.dataset.plannerCalendarDay);
    const hour = dropTarget.dataset.plannerCalendarHour ? Number(dropTarget.dataset.plannerCalendarHour) : null;

    if (!Number.isFinite(dayStartAt)) {
      return;
    }

    await scheduleTask(task, dayStartAt, typeof hour === "number" && Number.isFinite(hour) ? hour : null);
  };

  const openQuickCreate = (dayStartAt = selectedDay?.startAt ?? getStartOfLocalDay(), hour: number | null = null) => {
    const normalizedDayStartAt = getStartOfLocalDay(dayStartAt);
    const rangeForBlock = getDefaultTimeBlockRange(normalizedDayStartAt, hour ?? 9);

    setSelectedDayAt(normalizedDayStartAt);
    setQuickCreateDraft({
      title: "",
      startAt: hour === null ? normalizedDayStartAt : rangeForBlock.startAt,
      endAt: hour === null ? null : rangeForBlock.endAt,
      mode: hour === null ? "date" : "time"
    });
  };

  const handleDayTap = async (dayStartAt: number, hour: number | null = null) => {
    const normalizedDayStartAt = getStartOfLocalDay(dayStartAt);
    setSelectedDayAt(normalizedDayStartAt);

    if (!tapScheduleTaskId) {
      return;
    }

    const task = tasks.find((candidate) => candidate.id === tapScheduleTaskId);

    if (task) {
      await scheduleTask(task, normalizedDayStartAt, hour);
    }
  };

  const shiftCursor = (direction: -1 | 1) => {
    setCursorAt((current) => {
      if (mode === "month") {
        return addMonths(current, direction);
      }

      return addDays(current, direction * (mode === "week" ? 7 : 1));
    });
  };

  const handleModeChange = (nextMode: CalendarMode) => {
    setMode(nextMode);

    if (nextMode === "day") {
      setCursorAt(selectedDayAt);
    }
  };

  const selectEventTask = (taskId: string | null) => {
    if (taskId) {
      onSelectTask(taskId);
    }
  };

  const showUndoToast = (label: string, undo: CalendarUndoToast["undo"]) => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }

    setUndoToast({
      id: Date.now(),
      label,
      undo
    });
    undoTimerRef.current = window.setTimeout(() => setUndoToast(null), 6200);
  };

  const openEventInspector = (calendarEvent: CalendarEvent, target: HTMLElement | null = null) => {
    const rect = target?.getBoundingClientRect();
    setScopedAction(null);
    setEventInspector({
      eventId: calendarEvent.id,
      anchor: rect
        ? {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          }
        : null
    });
    selectEventTask(calendarEvent.taskId);
  };

  const updateTaskWithUndo = async (task: Task, patch: PlannerTaskUpdateInput, label: string) => {
    const undoPatch = getTaskUndoPatch(task);
    await onUpdateTask(task.id, patch);
    showUndoToast(label, async () => {
      await onUpdateTask(task.id, undoPatch);
    });
  };

  const updateTimeBlockWithUndo = async (timeBlock: TimeBlock, patch: PlannerTimeBlockUpdateInput, label: string) => {
    const undoPatch = getTimeBlockUndoPatch(timeBlock);
    await onUpdateTimeBlock(timeBlock.id, patch);
    showUndoToast(label, async () => {
      await onUpdateTimeBlock(timeBlock.id, undoPatch);
    });
  };

  const convertTimeBlockTaskToAllDay = async (timeBlock: TimeBlock, dayStartAt: number) => {
    if (!timeBlock.taskId) {
      return false;
    }

    const task = tasks.find((candidate) => candidate.id === timeBlock.taskId);

    if (!task) {
      return false;
    }

    const dueAt = getStartOfLocalDay(dayStartAt);
    const taskUndoPatch = getTaskUndoPatch(task);
    const previousBlock = timeBlock;
    await onUpdateTask(task.id, {
      dueAt,
      scheduledStartAt: null,
      scheduledEndAt: null,
      estimateMinutes: null,
      status: task.status === "inbox" || task.status === "scheduled" ? "todo" : task.status
    });
    await onDeleteTimeBlock(previousBlock.id);
    showUndoToast(language === "ru" ? "Задача перенесена на весь день" : "Task moved to all-day", async () => {
      await onUpdateTask(task.id, taskUndoPatch);
      await onCreateTimeBlock({
        title: previousBlock.title,
        description: previousBlock.description,
        status: previousBlock.status,
        taskId: previousBlock.taskId,
        projectId: previousBlock.projectId,
        noteId: previousBlock.noteId,
        canvasId: previousBlock.canvasId,
        startAt: previousBlock.startAt,
        endAt: previousBlock.endAt,
        actualStartAt: previousBlock.actualStartAt,
        actualEndAt: previousBlock.actualEndAt,
        color: previousBlock.color
      });
    });
    onSelectTask(task.id);
    setSelectedDayAt(dueAt);
    return true;
  };

  const buildTaskReminder = (task: Task, preset: CalendarReminderPreset): Task["reminders"] => {
    if (preset === "none") {
      return [];
    }

    const offsetMinutes = Number(preset);
    const baseAt = task.scheduledStartAt ?? (task.dueAt ? task.dueAt + 9 * 60 * 60_000 : null);

    if (!baseAt) {
      return task.reminders;
    }

    const timestamp = Date.now();

    return [
      {
        id: crypto.randomUUID(),
        title: language === "ru" ? "Напоминание" : "Reminder",
        remindAt: task.scheduledStartAt ? null : baseAt - offsetMinutes * 60_000,
        offsetMinutes,
        channel: "system",
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];
  };

  const updateTaskReminder = async (task: Task, preset: CalendarReminderPreset) => {
    setIsReminderPickerOpen(false);
    await updateTaskWithUndo(
      task,
      { reminders: buildTaskReminder(task, preset) },
      language === "ru" ? "Напоминание изменено" : "Reminder changed"
    );
  };

  const applyOccurrenceStatus = async (
    event: OccurrenceCalendarEvent,
    done: boolean,
    scope: CalendarOccurrenceScope | null = null
  ) => {
    const task = event.occurrence.task;
    const marker = event.occurrence.originalStartAt;
    const isRecurring = isRecurringPlannerRule(task.recurrenceRule);

    if (isRecurring) {
      const effectiveScope = scope ?? "this";
      if (!done) {
        await updateTaskWithUndo(
          task,
          {
            recurrenceCompletedDates: (task.recurrenceCompletedDates ?? []).filter(
              (date) => normalizePlannerOccurrenceMarker(date) !== normalizePlannerOccurrenceMarker(marker)
            ),
            completedAt: null,
            status: task.status === "done" ? (task.scheduledStartAt ? "scheduled" : "todo") : task.status
          },
          language === "ru" ? "Отметка снята" : "Completion removed"
        );
        return;
      }

      const patch =
        effectiveScope === "all"
          ? ({ status: "done", completedAt: Date.now(), recurrenceUntilAt: task.recurrenceUntilAt ?? marker } satisfies PlannerTaskUpdateInput)
          : buildRecurringTaskPatch(task, effectiveScope === "future" ? "completeAllFuture" : "completeOccurrence", marker);

      await updateTaskWithUndo(task, patch, language === "ru" ? "Событие отмечено" : "Event completed");
      return;
    }

    await updateTaskWithUndo(
      task,
      {
        status: done ? "done" : task.scheduledStartAt ? "scheduled" : "todo",
        completedAt: done ? Date.now() : null
      },
      done ? (language === "ru" ? "Задача выполнена" : "Task completed") : language === "ru" ? "Задача возвращена" : "Task reopened"
    );
  };

  const removeOccurrenceFromCalendar = async (
    event: OccurrenceCalendarEvent,
    scope: CalendarOccurrenceScope | null = null
  ) => {
    const task = event.occurrence.task;
    const marker = event.occurrence.originalStartAt;
    const isRecurring = isRecurringPlannerRule(task.recurrenceRule);

    if (isRecurring && !scope) {
      setScopedAction({ kind: "remove", eventId: event.id });
      return;
    }

    if (isRecurring) {
      const patch =
        scope === "all"
          ? ({
              dueAt: null,
              scheduledStartAt: null,
              scheduledEndAt: null,
              recurrenceRule: null,
              recurrenceAnchorAt: null,
              recurrenceUntilAt: null,
              recurrenceExceptionDates: [],
              recurrenceCompletedDates: [],
              recurrenceOverrides: [],
              estimateMinutes: null,
              status: task.status === "scheduled" ? "todo" : task.status
            } satisfies PlannerTaskUpdateInput)
          : scope === "future"
            ? ({ recurrenceUntilAt: Math.max(0, marker - 1000) } satisfies PlannerTaskUpdateInput)
            : buildRecurringTaskPatch(task, "skipOccurrence", marker);

      await updateTaskWithUndo(task, patch, language === "ru" ? "Событие убрано" : "Event removed");
      return;
    }

    await updateTaskWithUndo(
      task,
      {
        dueAt: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        estimateMinutes: null,
        status: task.status === "scheduled" ? "todo" : task.status
      },
      language === "ru" ? "Задача убрана из календаря" : "Task removed from calendar"
    );
  };

  const applyEventReschedule = async (
    calendarEvent: CalendarEvent,
    nextStartAt: number,
    nextEndAt: number | null,
    scope: CalendarOccurrenceScope | null = null
  ) => {
    if (calendarEvent.kind === "habit") {
      return;
    }

    if (calendarEvent.kind === "timeBlock") {
      const nextProject = calendarEvent.timeBlock.projectId ? projectMap.get(calendarEvent.timeBlock.projectId) : null;
      await updateTimeBlockWithUndo(
        calendarEvent.timeBlock,
        {
          startAt: nextStartAt,
          endAt: Math.max(nextStartAt + MIN_EVENT_DURATION_MS, nextEndAt ?? nextStartAt + getCalendarEventDuration(calendarEvent)),
          color: nextProject?.color ?? calendarEvent.timeBlock.color
        },
        language === "ru" ? "Блок перенесен" : "Block moved"
      );
      return;
    }

    const task = calendarEvent.occurrence.task;
    const isAllDay = nextEndAt === null;

    const recurrenceScope = isRecurringPlannerRule(task.recurrenceRule) ? scope ?? "this" : null;

    if (recurrenceScope === "future" || recurrenceScope === "all") {
      await updateTaskWithUndo(
        task,
        buildRescheduleRecurringSeriesPatch(
          task,
          calendarEvent.occurrence.originalStartAt,
          nextStartAt,
          nextEndAt,
          recurrenceScope,
          calendarEvent.startAt
        ),
        recurrenceScope === "future"
          ? language === "ru"
            ? "Будущие события перенесены"
            : "Future events moved"
          : language === "ru"
            ? "Серия перенесена"
            : "Series moved"
      );
      return;
    }

    const patch =
      recurrenceScope === "this"
        ? buildRescheduleOccurrencePatch(task, calendarEvent.occurrence.originalStartAt, nextStartAt, nextEndAt)
        : buildTaskCalendarPatch(task, nextStartAt, nextEndAt, isAllDay);

    await updateTaskWithUndo(task, patch, language === "ru" ? "Событие перенесено" : "Event moved");
  };

  const applyEventResize = async (
    calendarEvent: CalendarEvent,
    nextEndAt: number,
    scope: CalendarOccurrenceScope | null = null
  ) => {
    if (calendarEvent.kind === "habit" || calendarEvent.isAllDay) {
      return;
    }

    const normalizedEndAt = Math.max(calendarEvent.startAt + MIN_EVENT_DURATION_MS, snapTimestamp(nextEndAt));

    if (calendarEvent.kind === "timeBlock") {
      await updateTimeBlockWithUndo(
        calendarEvent.timeBlock,
        { endAt: normalizedEndAt },
        language === "ru" ? "Длительность изменена" : "Duration changed"
      );
      return;
    }

    const task = calendarEvent.occurrence.task;

    const recurrenceScope = isRecurringPlannerRule(task.recurrenceRule) ? scope ?? "this" : null;

    if (recurrenceScope === "future") {
      await applyEventReschedule(calendarEvent, calendarEvent.startAt, normalizedEndAt, "future");
      return;
    }

    const patch =
      recurrenceScope === "this"
        ? buildRescheduleOccurrencePatch(task, calendarEvent.occurrence.originalStartAt, calendarEvent.startAt, normalizedEndAt)
        : buildTaskCalendarPatch(task, calendarEvent.startAt, normalizedEndAt, false);

    await updateTaskWithUndo(task, patch, language === "ru" ? "Длительность изменена" : "Duration changed");
  };

  const applyScopedAction = async (scope: CalendarOccurrenceScope) => {
    if (!scopedAction || !scopedEvent || scopedEvent.kind !== "occurrence") {
      setScopedAction(null);
      return;
    }

    const action = scopedAction;
    setScopedAction(null);

    if (action.kind === "complete") {
      await applyOccurrenceStatus(scopedEvent, true, scope);
      return;
    }

    if (action.kind === "remove") {
      await removeOccurrenceFromCalendar(scopedEvent, scope);
      return;
    }

    if (action.kind === "reschedule" && typeof action.nextStartAt === "number") {
      await applyEventReschedule(scopedEvent, action.nextStartAt, action.nextEndAt ?? null, scope);
      return;
    }

    if (action.kind === "resize" && typeof action.nextEndAt === "number") {
      await applyEventResize(scopedEvent, action.nextEndAt, scope);
    }
  };

  const toggleCalendarEventDone = async (calendarEvent: CalendarEvent) => {
    if (calendarEvent.kind === "timeBlock") {
      await updateTimeBlockWithUndo(
        calendarEvent.timeBlock,
        {
          status: calendarEvent.timeBlock.status === "completed" ? "planned" : "completed",
          actualEndAt: calendarEvent.timeBlock.status === "completed" ? null : Date.now()
        },
        calendarEvent.timeBlock.status === "completed"
          ? language === "ru"
            ? "Блок возвращен"
            : "Block reopened"
          : language === "ru"
            ? "Блок выполнен"
            : "Block completed"
      );
      return;
    }

    if (calendarEvent.kind === "habit") {
      await onToggleHabitLog(calendarEvent.habit.id, calendarEvent.startAt);
      showUndoToast(language === "ru" ? "Отметка привычки изменена" : "Habit check changed", async () => {
        await onToggleHabitLog(calendarEvent.habit.id, calendarEvent.startAt);
      });
      return;
    }

    await applyOccurrenceStatus(calendarEvent, !calendarEvent.occurrence.completed);
  };

  const removeCalendarEvent = async (calendarEvent: CalendarEvent) => {
    if (calendarEvent.kind === "habit") {
      return;
    }

    if (calendarEvent.kind === "timeBlock") {
      const previous = calendarEvent.timeBlock;
      await onDeleteTimeBlock(previous.id);
      showUndoToast(language === "ru" ? "Блок удален" : "Block deleted", async () => {
        await onCreateTimeBlock({
          title: previous.title,
          description: previous.description,
          status: previous.status,
          taskId: previous.taskId,
          projectId: previous.projectId,
          noteId: previous.noteId,
          canvasId: previous.canvasId,
          startAt: previous.startAt,
          endAt: previous.endAt,
          actualStartAt: previous.actualStartAt,
          actualEndAt: previous.actualEndAt,
          color: previous.color
        });
      });
      return;
    }

    await removeOccurrenceFromCalendar(calendarEvent);
  };

  const createQuickTask = async () => {
    const normalizedTitle = quickCreateDraft?.title.trim();

    if (!quickCreateDraft || !normalizedTitle) {
      return;
    }

    const createdTask = await onCreateTask({
      title: normalizedTitle,
      status: quickCreateDraft.mode === "time" ? "scheduled" : "todo",
      priority: "none",
      dueAt: quickCreateDraft.mode === "date" ? quickCreateDraft.startAt : null,
      scheduledStartAt: quickCreateDraft.mode === "time" ? quickCreateDraft.startAt : null,
      scheduledEndAt: quickCreateDraft.mode === "time" ? quickCreateDraft.endAt : null,
      estimateMinutes:
        quickCreateDraft.mode === "time" && quickCreateDraft.endAt
          ? Math.max(15, Math.round((quickCreateDraft.endAt - quickCreateDraft.startAt) / 60_000))
          : null
    });

    setQuickCreateDraft(null);
    onSelectTask(createdTask.id);
  };

  const updateQuickCreateDuration = (durationMinutes: number) => {
    setQuickCreateDraft((current) => {
      if (!current || current.mode !== "time") {
        return current;
      }

      return {
        ...current,
        endAt: current.startAt + durationMinutes * 60_000
      };
    });
  };

  const renderCalendarEvent = (event: CalendarEvent, variant: CalendarEventVariant = "compact") => {
    const isCompleted = isCalendarEventCompleted(event);
    const isOverdue = isCalendarEventOverdue(event);
    const isToday = isCalendarEventToday(event);
    const isRecurring = isCalendarEventRecurring(event);
    const showEventActions = variant === "wide" || variant === "month";
    const previewRange = resizePreview?.eventId === event.id ? resizePreview : null;

    return (
      <article
        key={event.id}
        className={`planner-calendar-event is-${event.kind} is-${variant} ${
          isCompleted ? "is-completed" : ""
        } ${isOverdue ? "is-overdue" : ""} ${isToday ? "is-today" : ""} ${isRecurring ? "is-recurring" : ""} ${
          event.taskId && event.taskId === selectedTaskId ? "is-selected" : ""
        }`}
        style={{ "--planner-calendar-event-color": event.color } as CSSProperties}
        role="button"
        tabIndex={0}
        draggable={!isMobile && event.kind !== "habit"}
        onDragStart={(eventObject) => handleEventDragStart(eventObject, event)}
        onClick={(eventObject) => {
          eventObject.stopPropagation();
          openEventInspector(event, eventObject.currentTarget);
        }}
        onKeyDown={(eventObject) => {
          if (eventObject.key !== "Enter" && eventObject.key !== " ") {
            return;
          }

          eventObject.preventDefault();
          openEventInspector(event, eventObject.currentTarget);
        }}
      >
        <span className="planner-calendar-event-dot" aria-hidden="true" />
        <span className="planner-calendar-event-copy">
          <strong>{event.title}</strong>
          <small>
            {previewRange
              ? `${formatPlannerTime(previewRange.startAt, language)} - ${formatPlannerTime(previewRange.endAt, language)}`
              : getCalendarEventSubtitle(event, language)}
          </small>
        </span>
        {showEventActions ? (
          <span className="planner-calendar-event-actions">
            <button
              type="button"
              onClick={(eventObject) => {
                eventObject.stopPropagation();
                void toggleCalendarEventDone(event);
              }}
              title={
                isCompleted
                  ? language === "ru"
                    ? "Вернуть"
                    : "Reopen"
                  : language === "ru"
                    ? "Отметить выполненным"
                    : "Mark done"
              }
              aria-label={language === "ru" ? "Изменить статус события" : "Toggle event status"}
            >
              <span className="planner-calendar-event-action-icon is-done" aria-hidden="true" />
            </button>
            {event.kind !== "habit" ? (
              <button
                type="button"
                onClick={(eventObject) => {
                  eventObject.stopPropagation();
                  void removeCalendarEvent(event);
                }}
                title={language === "ru" ? "Убрать из календаря" : "Remove from calendar"}
                aria-label={language === "ru" ? "Убрать из календаря" : "Remove from calendar"}
              >
                <span className="planner-calendar-event-action-icon is-remove" aria-hidden="true" />
              </button>
            ) : null}
          </span>
        ) : null}
        {!isMobile && !event.isAllDay && event.kind !== "habit" ? (
          <>
            <button
              type="button"
              className="planner-calendar-event-resize is-start"
              onClick={(eventObject) => eventObject.stopPropagation()}
              onPointerDown={(eventObject) => handleResizeStart(eventObject, event, "start")}
              onPointerMove={handleResizeMove}
              onPointerCancel={() => {
                resizeRef.current = null;
                setResizePreview(null);
              }}
              onPointerUp={(eventObject) => void handleResizeEnd(eventObject)}
              aria-label={language === "ru" ? "Изменить начало" : "Resize start"}
              title={language === "ru" ? "Изменить начало" : "Resize start"}
            />
            <button
              type="button"
              className="planner-calendar-event-resize is-end"
              onClick={(eventObject) => eventObject.stopPropagation()}
              onPointerDown={(eventObject) => handleResizeStart(eventObject, event, "end")}
              onPointerMove={handleResizeMove}
              onPointerCancel={() => {
                resizeRef.current = null;
                setResizePreview(null);
              }}
              onPointerUp={(eventObject) => void handleResizeEnd(eventObject)}
              aria-label={language === "ru" ? "Изменить окончание" : "Resize end"}
              title={language === "ru" ? "Изменить окончание" : "Resize end"}
            />
          </>
        ) : null}
      </article>
    );
  };

  const renderDayAgenda = (day: CalendarDay, dayEvents: CalendarEvent[]) => {
    const allDayEvents = getAllDayEvents(dayEvents);
    const timedEvents = getTimedEvents(dayEvents);

    return (
      <div className="planner-calendar-day-agenda">
        <section
          className={`planner-calendar-all-day-slot ${allDayEvents.length > 0 ? "has-events" : ""}`}
          data-planner-calendar-drop="true"
          data-planner-calendar-day={day.startAt}
          onDragOver={handleTaskDragOver}
          onDrop={(event) => void handleCalendarDrop(event, day.startAt)}
          onClick={() => void handleDayTap(day.startAt)}
          onDoubleClick={() => openQuickCreate(day.startAt, null)}
        >
          <time>{language === "ru" ? "Весь день" : "All day"}</time>
          <div>
            {allDayEvents.length > 0 ? (
              allDayEvents.map((event) => renderCalendarEvent(event, "wide"))
            ) : (
              <span className="planner-calendar-empty-slot">
                {tapScheduleTaskId
                  ? language === "ru"
                    ? "Тапни, чтобы поставить на день"
                    : "Tap to schedule for the day"
                  : language === "ru"
                    ? "Нет событий на весь день"
                    : "No all-day events"}
              </span>
            )}
          </div>
        </section>
        {hours.map((hour) => {
          const slotEvents = timedEvents.filter((event) => getEventSlotHour(event, day, startHour) === hour);

          return (
            <section
              key={hour}
              className={`planner-calendar-time-slot ${slotEvents.length > 0 ? "has-events" : ""}`}
              data-planner-calendar-drop="true"
              data-planner-calendar-day={day.startAt}
              data-planner-calendar-hour={hour}
              onDragOver={handleTaskDragOver}
              onDrop={(event) => void handleCalendarDrop(event, day.startAt, hour)}
              onClick={() => void handleDayTap(day.startAt, hour)}
              onDoubleClick={() => openQuickCreate(day.startAt, hour)}
            >
              <time>{String(hour).padStart(2, "0")}:00</time>
              <div>
                {slotEvents.length > 0 ? (
                  slotEvents.map((event) => renderCalendarEvent(event, "wide"))
                ) : (
                  <span className="planner-calendar-empty-slot">
                    {tapScheduleTaskId
                      ? language === "ru"
                        ? "Тапни, чтобы поставить сюда"
                        : "Tap to schedule here"
                      : language === "ru"
                        ? "Свободно"
                        : "Free"}
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const renderCalendarGrid = () => (
    <div className={`planner-calendar-grid is-${mode}`}>
      {range.days.map((day) => {
        const dayEvents = sortCalendarEvents(getEventsForDay(events, day));
        const visibleEvents = dayEvents.slice(0, mode === "month" ? 3 : 6);
        const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length);
        const eventVariant: CalendarEventVariant = mode === "week" ? "wide" : "month";

        return (
          <section
            key={day.key}
            className={`planner-calendar-day-cell ${day.isToday ? "is-today" : ""} ${
              day.isOutsideMonth ? "is-outside-month" : ""
            } ${
              selectedDayAt >= day.startAt && selectedDayAt <= day.endAt ? "is-selected" : ""
            }`}
            data-planner-calendar-drop="true"
            data-planner-calendar-day={day.startAt}
            onDragOver={handleTaskDragOver}
            onDrop={(event) => void handleCalendarDrop(event, day.startAt)}
            onClick={() => {
              if (mode === "month" && day.isOutsideMonth) {
                setCursorAt(day.startAt);
              }
              void handleDayTap(day.startAt);
            }}
            onDoubleClick={() => {
              if (!tapScheduleTaskId) {
                if (mode === "month" && day.isOutsideMonth) {
                  setCursorAt(day.startAt);
                }
                openQuickCreate(day.startAt, null);
              }
            }}
          >
            <header>
              <span>{day.weekday}</span>
              <strong>{mode === "week" ? day.label : day.dayNumber}</strong>
            </header>
            <div className="planner-calendar-day-stack">
              {visibleEvents.map((event) => renderCalendarEvent(event, eventVariant))}
              {hiddenCount > 0 ? (
                <span className="planner-calendar-more">
                  +{hiddenCount} {language === "ru" ? "еще" : "more"}
                </span>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );

  const renderAgendaList = () => (
    <div className="planner-calendar-agenda-list">
      {selectedDayEvents.length > 0 ? (
        selectedDayEvents.map((event) => renderCalendarEvent(event, "wide"))
      ) : (
        <p>{language === "ru" ? "На выбранный день ничего не запланировано." : "Nothing scheduled for the selected day."}</p>
      )}
    </div>
  );

  const renderUnscheduledList = () => (
    <>
      <p>
        {isMobile
          ? language === "ru"
            ? "Выбери задачу, затем тапни день или слот."
            : "Select a task, then tap a day or slot."
          : language === "ru"
            ? "Перетащи задачу на день или час."
            : "Drag a task onto a day or hour."}
      </p>
      <div className="planner-calendar-unscheduled-list">
        {unscheduledTasks.slice(0, 12).map((task) => (
          <button
            key={task.id}
            type="button"
            className={tapScheduleTaskId === task.id ? "is-armed" : ""}
            data-manual-dragging={manualDragTaskId === task.id ? "true" : undefined}
            draggable={!isMobile}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-locoris-task-id", task.id);
              event.dataTransfer.setData("text/plain", task.id);
            }}
            onPointerDown={(event) => handleManualDragStart(event, task.id)}
            onPointerMove={handleManualDragMove}
            onPointerCancel={() => {
              manualDragRef.current = null;
              setManualDragTaskId(null);
            }}
            onPointerUp={(event) => void handleManualDragEnd(event)}
            onClick={() => {
              if (suppressNextUnscheduledClickRef.current === task.id) {
                suppressNextUnscheduledClickRef.current = null;
                return;
              }

              onSelectTask(task.id);
              setTapScheduleTaskId((current) => (current === task.id ? null : task.id));
              if (isMobile) {
                setMobilePanel(null);
              }
            }}
          >
            <strong>{task.title}</strong>
            <small>{language === "ru" ? "без даты" : "no date"}</small>
          </button>
        ))}
        {unscheduledTasks.length === 0 ? (
          <p>{language === "ru" ? "Все активные задачи уже имеют дату." : "All active tasks already have a date."}</p>
        ) : null}
      </div>
    </>
  );

  const renderEventProjectChips = (calendarEvent: CalendarEvent) => {
    if (calendarEvent.kind === "habit") {
      return null;
    }

    const selectedProjectId = calendarEvent.kind === "timeBlock" ? calendarEvent.timeBlock.projectId : calendarEvent.occurrence.task.projectId;
    const updateProject = async (projectId: string | null) => {
      const project = projectId ? projectMap.get(projectId) : null;

      if (calendarEvent.kind === "timeBlock") {
        await updateTimeBlockWithUndo(
          calendarEvent.timeBlock,
          {
            projectId,
            color: project?.color ?? PLANNER_INBOX_EVENT_COLOR
          },
          language === "ru" ? "Проект изменен" : "Project changed"
        );
        return;
      }

      await updateTaskWithUndo(
        calendarEvent.occurrence.task,
        { projectId },
        language === "ru" ? "Проект изменен" : "Project changed"
      );
    };

    return (
      <section className="planner-calendar-inspector-section">
        <span className="planner-calendar-inspector-label">{language === "ru" ? "Проект" : "Project"}</span>
        <div className="planner-calendar-inspector-chip-row">
          <button
            type="button"
            className={!selectedProjectId ? "is-active" : ""}
            onClick={() => void updateProject(null)}
          >
            <span className="planner-calendar-project-dot" style={{ "--project-color": PLANNER_INBOX_EVENT_COLOR } as CSSProperties} />
            Inbox
          </button>
          {projects.slice(0, 8).map((project) => (
            <button
              key={project.id}
              type="button"
              className={selectedProjectId === project.id ? "is-active" : ""}
              onClick={() => void updateProject(project.id)}
            >
              <span className="planner-calendar-project-dot" style={{ "--project-color": project.color } as CSSProperties} />
              {project.name}
            </button>
          ))}
        </div>
      </section>
    );
  };

  const renderEventPriorityChips = (calendarEvent: CalendarEvent) => {
    if (calendarEvent.kind !== "occurrence") {
      return null;
    }

    const task = calendarEvent.occurrence.task;
    const labels =
      language === "ru"
        ? {
            none: "Без приоритета",
            low: "Низкий",
            medium: "Средний",
            high: "Высокий",
            urgent: "Срочно"
          }
        : {
            none: "No priority",
            low: "Low",
            medium: "Medium",
            high: "High",
            urgent: "Urgent"
          };

    return (
      <section className="planner-calendar-inspector-section">
        <span className="planner-calendar-inspector-label">{language === "ru" ? "Приоритет" : "Priority"}</span>
        <div className="planner-calendar-inspector-chip-row is-priority">
          {TASK_PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              className={`is-priority-${priority} ${task.priority === priority ? "is-active" : ""}`}
              onClick={() =>
                void updateTaskWithUndo(
                  task,
                  { priority },
                  language === "ru" ? "Приоритет изменен" : "Priority changed"
                )
              }
            >
              {labels[priority]}
            </button>
          ))}
        </div>
      </section>
    );
  };

  const renderEventLinks = (calendarEvent: CalendarEvent) => {
    const projectId =
      calendarEvent.kind === "timeBlock"
        ? calendarEvent.timeBlock.projectId
        : calendarEvent.kind === "occurrence"
          ? calendarEvent.occurrence.task.projectId
          : calendarEvent.habit.projectId;
    const noteId =
      calendarEvent.kind === "timeBlock"
        ? calendarEvent.timeBlock.noteId
        : calendarEvent.kind === "occurrence"
          ? calendarEvent.occurrence.task.noteId
          : calendarEvent.habit.noteId;
    const canvasId =
      calendarEvent.kind === "timeBlock"
        ? calendarEvent.timeBlock.canvasId
        : calendarEvent.kind === "occurrence"
          ? calendarEvent.occurrence.task.canvasId
          : null;
    const project = projectId ? projectMap.get(projectId) : null;
    const note = noteId ? noteMap.get(noteId) : null;
    const canvas = canvasId ? noteMap.get(canvasId) : null;

    const deferAfterClose = (callback: () => void) => {
      setEventInspector(null);
      onClose();

      if (typeof window === "undefined") {
        callback();
        return;
      }

      window.setTimeout(callback, 0);
    };

    const openLinkedDocument = (linkedNoteId: string) => {
      if (!onOpenNote) {
        return;
      }

      deferAfterClose(() => onOpenNote(linkedNoteId));
    };

    const openLinkedProject = (linkedProjectId: string) => {
      if (!onOpenProjectMap) {
        return;
      }

      deferAfterClose(() => onOpenProjectMap(linkedProjectId));
    };

    if (!project && !noteId && !canvasId) {
      return null;
    }

    return (
      <section className="planner-calendar-inspector-section">
        <span className="planner-calendar-inspector-label">{language === "ru" ? "Связи" : "Links"}</span>
        <div className="planner-calendar-link-list">
          {project ? (
            onOpenProjectMap ? (
              <button type="button" onClick={() => openLinkedProject(project.id)}>
                <i style={{ "--project-color": project.color } as CSSProperties} />
                {language === "ru" ? "Проект" : "Project"} · {project.name}
              </button>
            ) : (
              <span>
                <i style={{ "--project-color": project.color } as CSSProperties} />
                {language === "ru" ? "Проект" : "Project"} · {project.name}
              </span>
            )
          ) : null}
          {noteId && noteId !== canvasId ? (
            <button type="button" onClick={() => openLinkedDocument(noteId)} disabled={!onOpenNote}>
              {language === "ru" ? "Заметка" : "Note"} · {note?.title || noteId}
            </button>
          ) : null}
          {canvasId ? (
            <button type="button" onClick={() => openLinkedDocument(canvasId)} disabled={!onOpenNote}>
              {project ? <i style={{ "--project-color": project.color } as CSSProperties} /> : null}
              {language === "ru" ? "Canvas" : "Canvas"} · {canvas?.title || canvasId}
            </button>
          ) : null}
        </div>
      </section>
    );
  };

  const renderEventInspectorBody = (calendarEvent: CalendarEvent) => {
    const isOccurrence = calendarEvent.kind === "occurrence";
    const task = isOccurrence ? calendarEvent.occurrence.task : null;
    const canEditDescription = calendarEvent.kind === "occurrence" || calendarEvent.kind === "timeBlock";
    const reminderPreset = task ? getReminderPreset(task) : "none";

    if (calendarEvent.kind === "habit") {
      const isPaused = calendarEvent.habit.status === "paused";
      const isArchived = calendarEvent.habit.status === "archived";
      const canToggleHabit = !isArchived && !isPaused;

      return (
        <>
          <header className="planner-calendar-inspector-head is-habit">
            <div className="planner-calendar-inspector-orb" style={{ "--planner-calendar-event-color": calendarEvent.color } as CSSProperties} />
            <div>
              <span className="planner-kicker">{language === "ru" ? "Привычка" : "Habit"}</span>
              <h3>{calendarEvent.title}</h3>
              <p>{getPlannerHabitCadenceLabel(calendarEvent.habit.frequencyRule, language)}</p>
            </div>
            <button type="button" onClick={() => setEventInspector(null)} aria-label={language === "ru" ? "Закрыть" : "Close"}>
              ×
            </button>
          </header>

          <div className="planner-calendar-inspector-scroll">
            <section className={`planner-calendar-habit-status ${calendarEvent.completed ? "is-complete" : ""}`}>
              <span className="planner-calendar-inspector-label">{language === "ru" ? "День привычки" : "Habit day"}</span>
              <strong>
                {formatPlannerDate(calendarEvent.startAt, language)}
                {" · "}
                {calendarEvent.completed
                  ? language === "ru"
                    ? "отмечено"
                    : "done"
                  : language === "ru"
                    ? "ожидает отметки"
                    : "waiting"}
              </strong>
              <button
                type="button"
                disabled={!canToggleHabit}
                onClick={() => void toggleCalendarEventDone(calendarEvent)}
              >
                {calendarEvent.completed
                  ? language === "ru"
                    ? "Убрать отметку"
                    : "Undo check-in"
                  : language === "ru"
                    ? "Отметить этот день"
                    : "Check in this day"}
              </button>
              {!canToggleHabit ? (
                <small>
                  {isArchived
                    ? language === "ru"
                      ? "Архивная привычка недоступна для отметок."
                      : "Archived habit cannot be checked in."
                    : language === "ru"
                      ? "Пауза сохраняет streak и блокирует отметки."
                      : "Paused habits keep the streak and block check-ins."}
                </small>
              ) : null}
            </section>

            <section className="planner-calendar-inspector-section">
              <span className="planner-calendar-inspector-label">{language === "ru" ? "Ритм" : "Cadence"}</span>
              <div className="planner-calendar-habit-facts">
                <span>
                  <small>{language === "ru" ? "Повтор" : "Repeat"}</small>
                  <strong>{getPlannerHabitCadenceLabel(calendarEvent.habit.frequencyRule, language)}</strong>
                </span>
                <span>
                  <small>{language === "ru" ? "Цель" : "Target"}</small>
                  <strong>
                    {calendarEvent.habit.targetCount} {calendarEvent.habit.targetUnit || (language === "ru" ? "раз" : "times")}
                  </strong>
                </span>
              </div>
            </section>

            {calendarEvent.habit.description.trim() ? (
              <section className="planner-calendar-inspector-section">
                <span className="planner-calendar-inspector-label">{language === "ru" ? "Описание" : "Description"}</span>
                <p className="planner-calendar-habit-description">{calendarEvent.habit.description}</p>
              </section>
            ) : null}

            {renderEventLinks(calendarEvent)}
          </div>
        </>
      );
    }

    const shiftDate = (days: number) => {
      const nextStartAt = addDays(calendarEvent.startAt, days);
      const nextEndAt = calendarEvent.isAllDay ? null : addDays(calendarEvent.endAt, days);
      if (calendarEvent.kind === "occurrence" && isRecurringPlannerRule(calendarEvent.occurrence.task.recurrenceRule)) {
        setScopedAction({
          kind: "reschedule",
          eventId: calendarEvent.id,
          nextStartAt,
          nextEndAt
        });
        return;
      }

      void applyEventReschedule(calendarEvent, nextStartAt, nextEndAt);
    };
    const convertDateMode = () => {
      if (calendarEvent.kind === "timeBlock") {
        void convertTimeBlockTaskToAllDay(calendarEvent.timeBlock, calendarEvent.startAt);
        return;
      }

      if (calendarEvent.kind !== "occurrence") {
        return;
      }

      if (calendarEvent.isAllDay) {
        const rangeForBlock = getDefaultTimeBlockRange(getStartOfLocalDay(calendarEvent.startAt), 9);
        void applyEventReschedule(calendarEvent, rangeForBlock.startAt, rangeForBlock.endAt);
        return;
      }

      void applyEventReschedule(calendarEvent, getStartOfLocalDay(calendarEvent.startAt), null);
    };
    const commitTitle = async () => {
      const normalizedTitle = inspectorTitleDraft.trim();

      if (!normalizedTitle) {
        setInspectorTitleDraft(calendarEvent.title);
        return;
      }

      if (calendarEvent.kind === "occurrence" && normalizedTitle !== calendarEvent.occurrence.task.title) {
        await updateTaskWithUndo(
          calendarEvent.occurrence.task,
          { title: normalizedTitle },
          language === "ru" ? "Название изменено" : "Title updated"
        );
        return;
      }

      if (calendarEvent.kind === "timeBlock" && normalizedTitle !== calendarEvent.timeBlock.title) {
        await updateTimeBlockWithUndo(
          calendarEvent.timeBlock,
          { title: normalizedTitle },
          language === "ru" ? "Название изменено" : "Title updated"
        );
      }
    };
    const commitDescription = async () => {
      const normalizedDescription = inspectorDescriptionDraft.trim();

      if (calendarEvent.kind === "occurrence" && normalizedDescription !== calendarEvent.occurrence.task.description) {
        await updateTaskWithUndo(
          calendarEvent.occurrence.task,
          { description: normalizedDescription },
          language === "ru" ? "Описание изменено" : "Description updated"
        );
        return;
      }

      if (calendarEvent.kind === "timeBlock" && normalizedDescription !== calendarEvent.timeBlock.description) {
        await updateTimeBlockWithUndo(
          calendarEvent.timeBlock,
          { description: normalizedDescription },
          language === "ru" ? "Описание изменено" : "Description updated"
        );
      }
    };
    const toggleTag = (tag: Tag) => {
      if (!task) {
        return;
      }

      const tagKey = getTagKey(tag.name);
      const nextTagIds = selectedTagKeys.has(tagKey)
        ? task.tagIds.filter((tagId) => getTagKey(tagMap.get(tagId)?.name ?? "") !== tagKey)
        : [...task.tagIds, tag.id];
      void updateTaskWithUndo(
        task,
        { tagIds: Array.from(new Set(nextTagIds)) },
        language === "ru" ? "Теги изменены" : "Tags updated"
      );
    };
    const createAndAttachTag = async () => {
      if (!task || !onCreateTag || isCreatingTag) {
        return;
      }

      const normalizedName = tagDraft.trim();
      if (!normalizedName) {
        setIsTagCreatorOpen(false);
        setTagDraft("");
        return;
      }

      setIsCreatingTag(true);
      try {
        const tag = await onCreateTag(normalizedName);
        const tagKey = getTagKey(tag.name);
        const nextTagIds = task.tagIds.filter((tagId) => getTagKey(tagMap.get(tagId)?.name ?? "") !== tagKey);
        await updateTaskWithUndo(
          task,
          { tagIds: Array.from(new Set([...nextTagIds, tag.id])) },
          language === "ru" ? "Тег добавлен" : "Tag added"
        );
        setTagDraft("");
        setIsTagCreatorOpen(false);
        setAreTagsExpanded(false);
      } finally {
        setIsCreatingTag(false);
      }
    };

    return (
      <>
        <header className="planner-calendar-inspector-head">
          <div className="planner-calendar-inspector-orb" style={{ "--planner-calendar-event-color": calendarEvent.color } as CSSProperties} />
          <div>
            <span className="planner-kicker">
              {calendarEvent.kind === "timeBlock"
                ? language === "ru"
                  ? "Блок времени"
                  : "Time block"
                : language === "ru"
                  ? "Событие"
                  : "Event"}
            </span>
            <input
              className="planner-calendar-inspector-title-input"
              value={inspectorTitleDraft}
              onChange={(event) => setInspectorTitleDraft(event.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              placeholder={language === "ru" ? "Название события" : "Event title"}
            />
            <p>{getCalendarEventSubtitle(calendarEvent, language)}</p>
          </div>
          <button type="button" onClick={() => setEventInspector(null)} aria-label={language === "ru" ? "Закрыть" : "Close"}>
            ×
          </button>
        </header>

        <div className="planner-calendar-inspector-scroll">
          <section className="planner-calendar-inspector-section">
            <span className="planner-calendar-inspector-label">{language === "ru" ? "Дата" : "Date"}</span>
            <div className="planner-calendar-inspector-date-grid">
              <button type="button" onClick={() => shiftDate(-1)}>{language === "ru" ? "− день" : "- day"}</button>
              <button type="button" onClick={() => shiftDate(1)}>{language === "ru" ? "+ день" : "+ day"}</button>
            </div>
            {isMobile && (calendarEvent.kind === "occurrence" || (calendarEvent.kind === "timeBlock" && calendarEvent.timeBlock.taskId)) ? (
              <button type="button" className="planner-calendar-date-mode-button" onClick={convertDateMode}>
                {calendarEvent.kind === "occurrence" && calendarEvent.isAllDay
                  ? language === "ru"
                    ? "Назначить время 09:00"
                    : "Set time 09:00"
                  : language === "ru"
                    ? "Сделать на весь день"
                    : "Make all-day"}
              </button>
            ) : null}
          </section>

          {renderEventProjectChips(calendarEvent)}
          {renderEventPriorityChips(calendarEvent)}

          {task ? (
            <section className="planner-calendar-inspector-section">
              <span className="planner-calendar-inspector-label">{language === "ru" ? "Напоминание" : "Reminder"}</span>
              <button
                type="button"
                className="planner-calendar-reminder-card"
                onClick={() => setIsReminderPickerOpen((current) => !current)}
              >
                <span className="planner-calendar-reminder-icon" aria-hidden="true" />
                <span>
                  <small>{reminderPreset === "none" ? (language === "ru" ? "Добавить" : "Add") : language === "ru" ? "Выбрано" : "Selected"}</small>
                  <strong>{getReminderLabel(reminderPreset, language)}</strong>
                </span>
              </button>
              {isReminderPickerOpen ? (
                <div className="planner-calendar-inspector-chip-row is-reminders">
                  {CALENDAR_REMINDER_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={reminderPreset === preset ? "is-active" : ""}
                      onClick={() => void updateTaskReminder(task, preset)}
                    >
                      {getReminderLabel(preset, language)}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {canEditDescription ? (
            <section className="planner-calendar-inspector-section">
              <span className="planner-calendar-inspector-label">{language === "ru" ? "Описание" : "Description"}</span>
              <textarea
                className="planner-calendar-inspector-description"
                value={inspectorDescriptionDraft}
                rows={inspectorDescriptionDraft ? 4 : 2}
                onChange={(event) => setInspectorDescriptionDraft(event.target.value)}
                onBlur={() => void commitDescription()}
                placeholder={language === "ru" ? "Контекст, критерии готовности, ссылки..." : "Context, notes, links..."}
              />
            </section>
          ) : null}

          {task ? (
            <section className="planner-calendar-inspector-section">
              <span className="planner-calendar-inspector-label">{language === "ru" ? "Теги" : "Tags"}</span>
              {uniqueTags.length > 0 ? (
                <div className="planner-calendar-tag-row">
                  {visibleInspectorTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={selectedTagKeys.has(getTagKey(tag.name)) ? "is-active" : ""}
                      onClick={() => toggleTag(tag)}
                      style={{ "--planner-calendar-tag-color": tag.color } as CSSProperties}
                    >
                      <span />
                      <strong>{tag.name}</strong>
                    </button>
                  ))}
                  {hiddenInspectorTagCount > 0 || areTagsExpanded ? (
                    <button type="button" className="is-more" onClick={() => setAreTagsExpanded((current) => !current)}>
                      {areTagsExpanded ? (language === "ru" ? "Свернуть" : "Less") : `+${hiddenInspectorTagCount}`}
                    </button>
                  ) : null}
                  {onCreateTag ? (
                    isTagCreatorOpen ? (
                      <span className="planner-calendar-tag-create">
                        <input
                          value={tagDraft}
                          autoFocus
                          disabled={isCreatingTag}
                          onChange={(event) => setTagDraft(event.target.value)}
                          onBlur={() => {
                            if (!tagDraft.trim()) {
                              setIsTagCreatorOpen(false);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void createAndAttachTag();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setTagDraft("");
                              setIsTagCreatorOpen(false);
                            }
                          }}
                          placeholder={language === "ru" ? "Новый тег" : "New tag"}
                        />
                        <button
                          type="button"
                          className="is-create-confirm"
                          disabled={isCreatingTag}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => void createAndAttachTag()}
                        >
                          +
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="is-create" onClick={() => setIsTagCreatorOpen(true)}>
                        + {language === "ru" ? "тег" : "tag"}
                      </button>
                    )
                  ) : null}
                </div>
              ) : (
                <div className="planner-calendar-tag-row">
                  {onCreateTag ? (
                    isTagCreatorOpen ? (
                      <span className="planner-calendar-tag-create">
                        <input
                          value={tagDraft}
                          autoFocus
                          disabled={isCreatingTag}
                          onChange={(event) => setTagDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void createAndAttachTag();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setTagDraft("");
                              setIsTagCreatorOpen(false);
                            }
                          }}
                          placeholder={language === "ru" ? "Новый тег" : "New tag"}
                        />
                        <button
                          type="button"
                          className="is-create-confirm"
                          disabled={isCreatingTag}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => void createAndAttachTag()}
                        >
                          +
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="is-create" onClick={() => setIsTagCreatorOpen(true)}>
                        + {language === "ru" ? "создать тег" : "create tag"}
                      </button>
                    )
                  ) : (
                    <p className="planner-calendar-inspector-muted">
                      {language === "ru" ? "Теги можно добавить в документах." : "Tags can be added in documents."}
                    </p>
                  )}
                </div>
              )}
            </section>
          ) : null}

          {renderEventLinks(calendarEvent)}
        </div>
      </>
    );
  };

  const renderEventInspector = () => {
    if (!eventInspector || !inspectedEvent) {
      return null;
    }

    return (
      <div className={`planner-calendar-inspector-layer ${isMobile ? "is-mobile" : "is-desktop"}`}>
        {isMobile ? (
          <button
            type="button"
            className="planner-calendar-inspector-backdrop"
            onClick={() => setEventInspector(null)}
            aria-label={language === "ru" ? "Закрыть инспектор" : "Close inspector"}
          />
        ) : null}
        <section
          className={`planner-calendar-event-inspector ${isMobile ? "is-mobile" : "is-desktop"}`}
          style={getEventInspectorStyle(eventInspector.anchor, isMobile)}
          role="dialog"
          aria-modal={isMobile}
        >
          {renderEventInspectorBody(inspectedEvent)}
        </section>
      </div>
    );
  };

  const renderScopedActionDialog = () => {
    if (!scopedAction || !scopedEvent || scopedEvent.kind !== "occurrence") {
      return null;
    }

    const title =
      scopedAction.kind === "complete"
        ? language === "ru"
          ? "Отметить повтор?"
          : "Complete repeating event?"
        : scopedAction.kind === "remove"
          ? language === "ru"
            ? "Убрать повтор?"
            : "Remove repeating event?"
          : scopedAction.kind === "resize"
            ? language === "ru"
              ? "Изменить длительность?"
              : "Change duration?"
            : language === "ru"
              ? "Перенести повтор?"
              : "Move repeating event?";

    return (
      <div className="planner-calendar-scope-layer" role="dialog" aria-modal="true">
        <button
          type="button"
          className="planner-calendar-scope-backdrop"
          onClick={() => setScopedAction(null)}
          aria-label={language === "ru" ? "Отмена" : "Cancel"}
        />
        <section className="planner-calendar-scope-dialog">
          <span className="planner-kicker">{language === "ru" ? "Повторяющаяся задача" : "Recurring task"}</span>
          <h3>{title}</h3>
          <p>
            {language === "ru"
              ? "Выбери, применить действие только к этому событию, ко всем будущим или ко всей серии."
              : "Choose whether to apply this to this occurrence, future events, or the whole series."}
          </p>
          <div>
            <button type="button" onClick={() => void applyScopedAction("this")}>
              <strong>{language === "ru" ? "Только это" : "Only this"}</strong>
              <small>{language === "ru" ? "Аккуратный override для выбранной даты" : "A precise override for this date"}</small>
            </button>
            <button type="button" onClick={() => void applyScopedAction("future")}>
              <strong>{language === "ru" ? "Это и будущие" : "This and future"}</strong>
              <small>{language === "ru" ? "Серия будет разделена с этой даты" : "Splits the series from this date"}</small>
            </button>
            <button type="button" onClick={() => void applyScopedAction("all")}>
              <strong>{language === "ru" ? "Вся серия" : "Whole series"}</strong>
              <small>{language === "ru" ? "Применить ко всем повторам" : "Apply to every occurrence"}</small>
            </button>
          </div>
        </section>
      </div>
    );
  };

  const renderUndoToast = () => {
    if (!undoToast) {
      return null;
    }

    return (
      <div className="planner-calendar-undo-toast" role="status">
        <span>{undoToast.label}</span>
        <button
          type="button"
          onClick={() => {
            const currentToast = undoToast;
            setUndoToast(null);
            if (undoTimerRef.current) {
              window.clearTimeout(undoTimerRef.current);
              undoTimerRef.current = null;
            }
            void currentToast.undo();
          }}
        >
          {language === "ru" ? "Отменить" : "Undo"}
        </button>
      </div>
    );
  };

  const renderMobilePanel = () => {
    if (!mobilePanel) {
      return null;
    }

    const isAgendaPanel = mobilePanel === "agenda";

    return (
      <div className="planner-calendar-mobile-sheet-layer" role="dialog" aria-modal="true">
        <button
          type="button"
          className="planner-calendar-mobile-sheet-backdrop"
          onClick={() => setMobilePanel(null)}
          aria-label={language === "ru" ? "Закрыть панель" : "Close panel"}
        />
        <section className={`planner-calendar-mobile-sheet is-${mobilePanel}`}>
          <div className="planner-calendar-mobile-sheet-handle" aria-hidden="true" />
          <header>
            <div>
              <span className="planner-kicker">
                {isAgendaPanel
                  ? language === "ru"
                    ? "Повестка"
                    : "Agenda"
                  : language === "ru"
                    ? "Планирование"
                    : "Scheduling"}
              </span>
              <h3>
                {isAgendaPanel
                  ? language === "ru"
                    ? "Повестка дня"
                    : "Day agenda"
                  : language === "ru"
                    ? "Без даты"
                    : "No date"}
              </h3>
            </div>
            <small>{isAgendaPanel ? selectedDayEvents.length : unscheduledTasks.length}</small>
            <button
              type="button"
              onClick={() => setMobilePanel(null)}
              aria-label={language === "ru" ? "Закрыть" : "Close"}
            >
              ×
            </button>
          </header>
          <div className="planner-calendar-mobile-sheet-scroll">
            {isAgendaPanel ? renderAgendaList() : renderUnscheduledList()}
          </div>
        </section>
      </div>
    );
  };

  const renderQuickCreate = () => {
    if (!quickCreateDraft) {
      return null;
    }

    return (
      <div className="planner-calendar-quick-create-layer" role="dialog" aria-modal="true">
        <button
          type="button"
          className="planner-calendar-quick-create-backdrop"
          onClick={() => setQuickCreateDraft(null)}
          aria-label={language === "ru" ? "Закрыть создание задачи" : "Close task creation"}
        />
        <form
          className="planner-calendar-quick-create"
          onSubmit={(event) => {
            event.preventDefault();
            void createQuickTask();
          }}
        >
          <header>
            <div>
              <span className="planner-kicker">{language === "ru" ? "Новая задача" : "New task"}</span>
              <h3>
                {quickCreateDraft.mode === "time"
                  ? `${formatPlannerTime(quickCreateDraft.startAt, language)} - ${formatPlannerTime(quickCreateDraft.endAt, language)}`
                  : formatPlannerDate(quickCreateDraft.startAt, language)}
              </h3>
            </div>
            <button type="button" onClick={() => setQuickCreateDraft(null)} aria-label={language === "ru" ? "Закрыть" : "Close"}>
              ×
            </button>
          </header>
          <label>
            <span>{language === "ru" ? "Название" : "Title"}</span>
            <input
              autoFocus
              value={quickCreateDraft.title}
              onChange={(event) => setQuickCreateDraft((current) => (current ? { ...current, title: event.target.value } : current))}
              placeholder={language === "ru" ? "Что запланировать?" : "What should be planned?"}
            />
          </label>
          {quickCreateDraft.mode === "time" ? (
            <section className="planner-calendar-quick-duration">
              <span>{language === "ru" ? "Длительность" : "Duration"}</span>
              <div>
                {QUICK_CREATE_DURATIONS.map((duration) => {
                  const currentDuration = quickCreateDraft.endAt
                    ? Math.round((quickCreateDraft.endAt - quickCreateDraft.startAt) / 60_000)
                    : null;

                  return (
                    <button
                      key={duration}
                      type="button"
                      className={currentDuration === duration ? "is-active" : ""}
                      onClick={() => updateQuickCreateDuration(duration)}
                    >
                      {duration < 60
                        ? language === "ru"
                          ? `${duration} мин`
                          : `${duration}m`
                        : language === "ru"
                          ? `${duration / 60} ч`
                          : `${duration / 60}h`}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
          <footer>
            <button type="button" onClick={() => setQuickCreateDraft(null)}>
              {language === "ru" ? "Отмена" : "Cancel"}
            </button>
            <button type="submit" className="is-primary" disabled={!quickCreateDraft.title.trim()}>
              {language === "ru" ? "Создать" : "Create"}
            </button>
          </footer>
        </form>
      </div>
    );
  };

  const calendarSurface = (
    <section className={`planner-calendar-layer ${isMobile ? "is-mobile" : "is-desktop"}`} role="dialog" aria-modal="true">
      <div className="planner-calendar-shell">
        <header className="planner-calendar-head">
          <div className="planner-calendar-title">
            <span className="planner-kicker">{language === "ru" ? "Календарь" : "Calendar"}</span>
            <h2>{getRangeTitle(cursorAt, mode, language)}</h2>
            <p>
              {language === "ru"
                ? "Планируй задачи как блоки времени: сроки остаются сроками, расписание становится видимым."
                : "Plan tasks as time blocks: due dates stay due dates, scheduled work becomes visible."}
            </p>
          </div>

          <div className="planner-calendar-head-actions">
            <div className="planner-calendar-mode-switch" role="radiogroup" aria-label={language === "ru" ? "Режим календаря" : "Calendar mode"}>
              {(["day", "week", "month"] as CalendarMode[]).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  className={mode === nextMode ? "is-active" : ""}
                  onClick={() => handleModeChange(nextMode)}
                  role="radio"
                  aria-checked={mode === nextMode}
                >
                  {nextMode === "day"
                    ? language === "ru"
                      ? "День"
                      : "Day"
                    : nextMode === "week"
                      ? language === "ru"
                        ? "Неделя"
                        : "Week"
                      : language === "ru"
                        ? "Месяц"
                        : "Month"}
                </button>
              ))}
            </div>

            <div className="planner-calendar-controls">
              <button type="button" onClick={() => shiftCursor(-1)} aria-label={language === "ru" ? "Назад" : "Previous"}>
                ‹
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = getStartOfLocalDay();
                  setCursorAt(today);
                  setSelectedDayAt(today);
                }}
              >
                {language === "ru" ? "Сегодня" : "Today"}
              </button>
              <button type="button" onClick={() => shiftCursor(1)} aria-label={language === "ru" ? "Вперед" : "Next"}>
                ›
              </button>
            </div>

            <button
              type="button"
              className="planner-calendar-create-button"
              onClick={() => openQuickCreate(selectedDay?.startAt ?? cursorAt, mode === "day" ? 9 : null)}
            >
              <span aria-hidden="true">+</span>
              {language === "ru" ? "Новая" : "New"}
            </button>

            <button type="button" className="planner-calendar-close" onClick={onClose} aria-label={language === "ru" ? "Закрыть календарь" : "Close calendar"}>
              ×
            </button>
          </div>
        </header>

        <div className="planner-calendar-workspace">
          <main className="planner-calendar-board" aria-label={language === "ru" ? "Рабочая область календаря" : "Calendar workspace"}>
            {mode === "day" ? renderDayAgenda(range.days[0], dayModeEvents) : renderCalendarGrid()}
          </main>

          <aside className="planner-calendar-side">
            <section className="planner-calendar-side-card is-agenda">
              <div className="planner-calendar-side-title">
                <span>{language === "ru" ? "Повестка дня" : "Day agenda"}</span>
                <small>{selectedDayEvents.length}</small>
              </div>
              {renderAgendaList()}
            </section>

            <section className="planner-calendar-side-card is-unscheduled">
              <div className="planner-calendar-side-title">
                <span>{language === "ru" ? "Без даты" : "No date"}</span>
                <small>{unscheduledTasks.length}</small>
              </div>
              {renderUnscheduledList()}
            </section>
          </aside>
        </div>

        {isMobile ? (
          <nav className="planner-calendar-mobile-dock" aria-label={language === "ru" ? "Панели календаря" : "Calendar panels"}>
            <button type="button" onClick={() => setMobilePanel("agenda")}>
              <span className="planner-calendar-mobile-dock-icon is-agenda" aria-hidden="true" />
              <span>
                <strong>{language === "ru" ? "Повестка" : "Agenda"}</strong>
                <small>{selectedDayEvents.length}</small>
              </span>
            </button>
            <button type="button" onClick={() => setMobilePanel("unscheduled")}>
              <span className="planner-calendar-mobile-dock-icon is-unscheduled" aria-hidden="true" />
              <span>
                <strong>{language === "ru" ? "Без даты" : "No date"}</strong>
                <small>{unscheduledTasks.length}</small>
              </span>
            </button>
            <button type="button" onClick={() => openQuickCreate(selectedDay?.startAt ?? cursorAt, null)}>
              <span className="planner-calendar-mobile-dock-icon is-create" aria-hidden="true" />
              <span>
                <strong>{language === "ru" ? "Новая" : "New"}</strong>
                <small>{selectedDay ? formatPlannerDate(selectedDay.startAt, language) : ""}</small>
              </span>
            </button>
          </nav>
        ) : null}

        {isMobile ? renderMobilePanel() : null}
        {renderQuickCreate()}
      </div>
      {renderEventInspector()}
      {renderScopedActionDialog()}
      {renderUndoToast()}
    </section>
  );

  if (typeof document === "undefined") {
    return calendarSurface;
  }

  return createPortal(calendarSurface, document.body);
}
