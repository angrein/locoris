import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { createPortal } from "react-dom";

import type { AppLanguage, Habit, HabitLog, Project, Task, TimeBlock } from "../../types";
import {
  formatPlannerDate,
  formatPlannerTime,
  getEndOfLocalDay,
  getPlannerTimeBlocksForRange,
  getStartOfLocalDay,
  isPlannerTaskActive,
  type PlannerTimeBlockCreateInput,
  type PlannerTimeBlockUpdateInput,
  type PlannerTaskCreateInput,
  type PlannerTaskUpdateInput
} from "../../lib/planner";
import {
  buildRecurringTaskPatch,
  getPlannerTaskOccurrencesForRange,
  isRecurringPlannerRule,
  type PlannerTaskOccurrence
} from "../../lib/plannerRecurrence";
import {
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
  language: AppLanguage;
  isMobile: boolean;
  selectedTaskId: string | null;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
  onCreateTask: (input: PlannerTaskCreateInput) => Promise<Task>;
  onUpdateTask: (taskId: string, patch: PlannerTaskUpdateInput) => Promise<Task | null>;
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

const QUICK_CREATE_DURATIONS = [30, 45, 60, 120] as const;
const PLANNER_INBOX_EVENT_COLOR = "var(--planner-calendar-inbox-color, var(--planner-calendar-accent))";
const DAY_MS = 86_400_000;

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

function startOfMonthGrid(value: number) {
  const date = new Date(value);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return startOfWeek(date.getTime());
}

function getCalendarDays(startAt: number, count: number, language: AppLanguage): CalendarDay[] {
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const todayStart = getStartOfLocalDay();

  return Array.from({ length: count }, (_item, index) => {
    const dayStartAt = addDays(startAt, index);
    const dayEndAt = getEndOfLocalDay(dayStartAt);

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
      isToday: dayStartAt === todayStart
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

function getVisibleHourRange(events: CalendarEvent[]) {
  if (events.length === 0) {
    return { startHour: 7, endHour: 21 };
  }

  const startHour = Math.max(0, Math.min(7, ...events.map((event) => getHour(event.startAt))));
  const endHour = Math.min(23, Math.max(21, ...events.map((event) => getHour(event.endAt) + 1)));
  return { startHour, endHour };
}

function sortCalendarEvents(events: CalendarEvent[]) {
  return [...events].sort((left, right) => {
    if (left.startAt !== right.startAt) {
      return left.startAt - right.startAt;
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

export default function PlannerCalendarSurface({
  tasks,
  habits,
  habitLogs,
  timeBlocks,
  projects,
  language,
  isMobile,
  selectedTaskId,
  onClose,
  onSelectTask,
  onCreateTask,
  onUpdateTask,
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
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const range = useMemo(() => {
    if (mode === "month") {
      const startAt = startOfMonthGrid(cursorAt);
      return {
        startAt,
        endAt: addDays(startAt, 42),
        days: getCalendarDays(startAt, 42, language)
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
        .filter(isPlannerTaskActive)
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
  const unscheduledTasks = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            isPlannerTaskActive(task) &&
            !task.scheduledStartAt &&
            !timeBlockTaskIds.has(task.id)
        )
        .slice()
        .sort((left, right) => (left.dueAt ?? Number.POSITIVE_INFINITY) - (right.dueAt ?? Number.POSITIVE_INFINITY)),
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
        if (mobilePanel) {
          setMobilePanel(null);
          return;
        }

        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobilePanel, onClose]);

  useEffect(() => {
    if (!isMobile && mobilePanel) {
      setMobilePanel(null);
    }
  }, [isMobile, mobilePanel]);

  const scheduleTask = async (task: Task, dayStartAt: number, hour = 9) => {
    const taskProject = task.projectId ? projectMap.get(task.projectId) : null;
    const rangeForBlock = getDefaultTimeBlockRange(dayStartAt, hour);
    await onCreateTimeBlock({
      title: task.title,
      taskId: task.id,
      projectId: task.projectId,
      noteId: task.noteId,
      canvasId: task.canvasId,
      startAt: rangeForBlock.startAt,
      endAt: rangeForBlock.endAt,
      color: taskProject?.color ?? PLANNER_INBOX_EVENT_COLOR
    });
    onSelectTask(task.id);
    setTapScheduleTaskId(null);
    setSelectedDayAt(dayStartAt);
  };

  const handleTaskDrop = async (event: DragEvent<HTMLElement>, dayStartAt: number, hour = 9) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("application/x-locoris-task-id");
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (task) {
      await scheduleTask(task, dayStartAt, hour);
    }
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

  const handleDayTap = async (dayStartAt: number, hour = 9) => {
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

  const toggleOccurrenceDone = async (event: OccurrenceCalendarEvent) => {
    const task = event.occurrence.task;
    const marker = event.occurrence.originalStartAt;

    if (isRecurringPlannerRule(task.recurrenceRule)) {
      if (event.occurrence.completed) {
        await onUpdateTask(task.id, {
          recurrenceCompletedDates: (task.recurrenceCompletedDates ?? []).filter((date) => date !== marker),
          completedAt: null,
          status: task.status === "done" ? (task.scheduledStartAt ? "scheduled" : "todo") : task.status
        });
        return;
      }

      await onUpdateTask(task.id, buildRecurringTaskPatch(task, "completeOccurrence", marker));
      return;
    }

    await onUpdateTask(task.id, {
      status: event.occurrence.completed ? (task.scheduledStartAt ? "scheduled" : "todo") : "done",
      completedAt: event.occurrence.completed ? null : Date.now()
    });
  };

  const removeOccurrenceFromCalendar = async (event: OccurrenceCalendarEvent) => {
    const task = event.occurrence.task;

    if (isRecurringPlannerRule(task.recurrenceRule)) {
      await onUpdateTask(task.id, buildRecurringTaskPatch(task, "skipOccurrence", event.occurrence.originalStartAt));
      return;
    }

    await onUpdateTask(task.id, {
      dueAt: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      estimateMinutes: null,
      status: task.status === "scheduled" ? "todo" : task.status
    });
  };

  const renderCalendarEvent = (event: CalendarEvent, variant: CalendarEventVariant = "compact") => {
    const isCompleted =
      event.kind === "timeBlock"
        ? event.timeBlock.status === "completed"
        : event.kind === "occurrence"
          ? event.occurrence.completed
          : event.completed;
    const showEventActions = variant === "wide" || variant === "month";

    return (
      <article
        key={event.id}
        className={`planner-calendar-event is-${event.kind} is-${variant} ${
          isCompleted ? "is-completed" : ""
        } ${event.taskId && event.taskId === selectedTaskId ? "is-selected" : ""}`}
        style={{ "--planner-calendar-event-color": event.color } as CSSProperties}
        role="button"
        tabIndex={0}
        onClick={(eventObject) => {
          eventObject.stopPropagation();
          selectEventTask(event.taskId);
        }}
        onKeyDown={(eventObject) => {
          if (eventObject.key !== "Enter" && eventObject.key !== " ") {
            return;
          }

          eventObject.preventDefault();
          selectEventTask(event.taskId);
        }}
      >
        <span className="planner-calendar-event-dot" aria-hidden="true" />
        <span className="planner-calendar-event-copy">
          <strong>{event.title}</strong>
          <small>{getCalendarEventSubtitle(event, language)}</small>
        </span>
        {showEventActions ? (
          <span className="planner-calendar-event-actions">
            <button
              type="button"
              onClick={(eventObject) => {
                eventObject.stopPropagation();
                if (event.kind === "timeBlock") {
                  void onUpdateTimeBlock(event.timeBlock.id, {
                    status: event.timeBlock.status === "completed" ? "planned" : "completed",
                    actualEndAt: event.timeBlock.status === "completed" ? null : Date.now()
                  });
                  return;
                }

                if (event.kind === "habit") {
                  void onToggleHabitLog(event.habit.id, event.startAt);
                  return;
                }

                void toggleOccurrenceDone(event);
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
                  if (event.kind === "timeBlock") {
                    void onDeleteTimeBlock(event.timeBlock.id);
                    return;
                  }

                  void removeOccurrenceFromCalendar(event);
                }}
                title={language === "ru" ? "Убрать из календаря" : "Remove from calendar"}
                aria-label={language === "ru" ? "Убрать из календаря" : "Remove from calendar"}
              >
                <span className="planner-calendar-event-action-icon is-remove" aria-hidden="true" />
              </button>
            ) : null}
          </span>
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
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void handleTaskDrop(event, day.startAt, hour)}
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
              selectedDayAt >= day.startAt && selectedDayAt <= day.endAt ? "is-selected" : ""
            }`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void handleTaskDrop(event, day.startAt)}
            onClick={() => void handleDayTap(day.startAt)}
            onDoubleClick={() => {
              if (!tapScheduleTaskId) {
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
            draggable={!isMobile}
            onDragStart={(event) => event.dataTransfer.setData("application/x-locoris-task-id", task.id)}
            onClick={() => {
              onSelectTask(task.id);
              setTapScheduleTaskId((current) => (current === task.id ? null : task.id));
              if (isMobile) {
                setMobilePanel(null);
              }
            }}
          >
            <strong>{task.title}</strong>
            <small>{task.dueAt ? formatPlannerDate(task.dueAt, language) : language === "ru" ? "без срока" : "no due"}</small>
          </button>
        ))}
        {unscheduledTasks.length === 0 ? (
          <p>{language === "ru" ? "Все активные задачи уже имеют время." : "All active tasks already have time."}</p>
        ) : null}
      </div>
    </>
  );

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
                    ? "Без времени"
                    : "Unscheduled"}
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
                <span>{language === "ru" ? "Без времени" : "Unscheduled"}</span>
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
                <strong>{language === "ru" ? "Без времени" : "Unscheduled"}</strong>
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
    </section>
  );

  if (typeof document === "undefined") {
    return calendarSurface;
  }

  return createPortal(calendarSurface, document.body);
}
