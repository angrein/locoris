import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { createPortal } from "react-dom";

import type { AppLanguage, Project, Task, TimeBlock } from "../../types";
import {
  formatPlannerDate,
  formatPlannerTime,
  getEndOfLocalDay,
  getPlannerTimeBlocksForRange,
  getStartOfLocalDay,
  isPlannerTaskActive,
  type PlannerTimeBlockCreateInput,
  type PlannerTimeBlockUpdateInput,
  type PlannerTaskCreateInput
} from "../../lib/planner";
import {
  getPlannerTaskOccurrencesForRange,
  type PlannerTaskOccurrence
} from "../../lib/plannerRecurrence";
import "./PlannerCalendarSurface.css";

type CalendarMode = "day" | "week" | "month";
type CalendarEventVariant = "compact" | "wide" | "month";
type MobileCalendarPanel = "agenda" | "unscheduled" | null;

interface PlannerCalendarSurfaceProps {
  tasks: Task[];
  timeBlocks: TimeBlock[];
  projects: Project[];
  language: AppLanguage;
  isMobile: boolean;
  selectedTaskId: string | null;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
  onCreateTask: (input: PlannerTaskCreateInput) => Promise<Task>;
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

type CalendarEvent = TimeBlockCalendarEvent | OccurrenceCalendarEvent;
type QuickCreateDraft = {
  title: string;
  startAt: number;
  endAt: number | null;
  mode: "date" | "time";
};

const QUICK_CREATE_DURATIONS = [30, 45, 60, 120] as const;
const PLANNER_INBOX_EVENT_COLOR = "var(--planner-calendar-inbox-color, var(--planner-calendar-accent))";

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
  timeBlocks,
  projects,
  language,
  isMobile,
  selectedTaskId,
  onClose,
  onSelectTask,
  onCreateTask,
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
  const events = useMemo<CalendarEvent[]>(() => {
    const blockEvents = visibleTimeBlocks.map((timeBlock) => ({
      id: `timeBlock:${timeBlock.id}`,
      kind: "timeBlock" as const,
      timeBlock,
      title: timeBlock.title,
      startAt: timeBlock.startAt,
      endAt: timeBlock.endAt,
      color: timeBlock.projectId ? projectMap.get(timeBlock.projectId)?.color ?? timeBlock.color : timeBlock.color || PLANNER_INBOX_EVENT_COLOR,
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
      taskId: occurrence.task.id,
      isDueOnly: !occurrence.scheduledStartAt
    }));

    return sortCalendarEvents([...blockEvents, ...occurrenceEvents]);
  }, [projectMap, visibleOccurrences, visibleTimeBlocks]);
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
  const { startHour, endHour } = useMemo(() => getVisibleHourRange(mode === "day" ? dayModeEvents : selectedDayEvents), [
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

  const handleDayTap = async (dayStartAt: number, hour = 9) => {
    setSelectedDayAt(dayStartAt);

    if (!tapScheduleTaskId) {
      const rangeForBlock = getDefaultTimeBlockRange(dayStartAt, hour);
      setQuickCreateDraft({
        title: "",
        startAt: mode === "day" ? rangeForBlock.startAt : new Date(dayStartAt).setHours(12, 0, 0, 0),
        endAt: mode === "day" ? rangeForBlock.endAt : null,
        mode: mode === "day" ? "time" : "date"
      });
      return;
    }

    const task = tasks.find((candidate) => candidate.id === tapScheduleTaskId);

    if (task) {
      await scheduleTask(task, dayStartAt, hour);
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

  const renderCalendarEvent = (event: CalendarEvent, variant: CalendarEventVariant = "compact") => {
    const isCompleted =
      event.kind === "timeBlock"
        ? event.timeBlock.status === "completed"
        : event.occurrence.completed;
    const showTimeBlockActions = event.kind === "timeBlock" && (variant === "wide" || variant === "month");

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
        {showTimeBlockActions ? (
          <span className="planner-calendar-event-actions">
            <button
              type="button"
              onClick={(eventObject) => {
                eventObject.stopPropagation();
                void onUpdateTimeBlock(event.timeBlock.id, {
                  status: event.timeBlock.status === "completed" ? "planned" : "completed",
                  actualEndAt: event.timeBlock.status === "completed" ? null : Date.now()
                });
              }}
              title={
                event.timeBlock.status === "completed"
                  ? language === "ru"
                    ? "Вернуть в план"
                    : "Reopen time block"
                  : language === "ru"
                    ? "Отметить выполненным"
                    : "Mark time block done"
              }
              aria-label={language === "ru" ? "Изменить статус блока времени" : "Toggle time block status"}
            >
              <span className="planner-calendar-event-action-icon is-done" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(eventObject) => {
                eventObject.stopPropagation();
                void onDeleteTimeBlock(event.timeBlock.id);
              }}
              title={language === "ru" ? "Убрать из календаря" : "Remove from calendar"}
              aria-label={language === "ru" ? "Удалить блок времени" : "Delete time block"}
            >
              <span className="planner-calendar-event-action-icon is-remove" aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </article>
    );
  };

  const renderDayAgenda = (day: CalendarDay, dayEvents: CalendarEvent[]) => (
    <div className="planner-calendar-day-agenda">
      {hours.map((hour) => {
        const slotEvents = dayEvents.filter((event) => getEventSlotHour(event, day, startHour) === hour);

        return (
          <section
            key={hour}
            className={`planner-calendar-time-slot ${slotEvents.length > 0 ? "has-events" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void handleTaskDrop(event, day.startAt, hour)}
            onClick={() => void handleDayTap(day.startAt, hour)}
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
