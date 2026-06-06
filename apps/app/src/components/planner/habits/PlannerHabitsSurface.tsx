import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from "react";

import type { AppLanguage, Habit, HabitLog, Project } from "../../../types";
import {
  buildPlannerHabitFrequencyRule,
  buildPlannerHabitSummaries,
  getPlannerHabitCadenceLabel,
  type PlannerHabitCadencePreset,
  type PlannerHabitSummary
} from "../../../lib/plannerHabits";
import type { PlannerHabitCreateInput, PlannerHabitUpdateInput } from "../../../lib/planner";
import "./PlannerHabitsSurface.css";

interface PlannerHabitsSurfaceProps {
  habits: Habit[];
  habitLogs: HabitLog[];
  projects: Project[];
  language: AppLanguage;
  isMobile: boolean;
  onCreateHabit: (input: PlannerHabitCreateInput) => Promise<Habit>;
  onUpdateHabit: (habitId: string, patch: PlannerHabitUpdateInput) => Promise<Habit | null>;
  onDeleteHabit: (habitId: string) => Promise<void>;
  onToggleHabitLog: (habitId: string, dayAt?: number) => Promise<HabitLog | null>;
}

type HabitFilterId = "today" | "active" | "paused" | "missed";

const HABIT_FILTERS: HabitFilterId[] = ["today", "active", "paused", "missed"];
const CADENCE_PRESETS: PlannerHabitCadencePreset[] = ["daily", "weekdays", "weekly", "customDaily"];

function getHabitFilterLabel(filterId: HabitFilterId, language: AppLanguage) {
  if (language === "ru") {
    return {
      today: "Сегодня",
      active: "Активные",
      paused: "Пауза",
      missed: "Пропущенные"
    }[filterId];
  }

  return {
    today: "Today",
    active: "Active",
    paused: "Paused",
    missed: "Missed"
  }[filterId];
}

function getCadencePresetLabel(preset: PlannerHabitCadencePreset, intervalDays: number, language: AppLanguage) {
  if (language === "ru") {
    return {
      daily: "Каждый день",
      weekdays: "Будни",
      weekly: "Раз в неделю",
      customDaily: `Каждые ${intervalDays} дн.`
    }[preset];
  }

  return {
    daily: "Daily",
    weekdays: "Weekdays",
    weekly: "Weekly",
    customDaily: `Every ${intervalDays} days`
  }[preset];
}

function getLastLogLabel(value: number | null, language: AppLanguage) {
  if (!value) {
    return language === "ru" ? "Еще нет отметок" : "No check-ins yet";
  }

  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short"
  }).format(value);
}

function getWeekdayLabel(value: number, language: AppLanguage) {
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    weekday: "short"
  }).format(value);
}

function getTodayState(summary: PlannerHabitSummary, language: AppLanguage) {
  if (summary.habit.status === "paused") {
    return language === "ru" ? "На паузе" : "Paused";
  }

  if (summary.completedToday) {
    return language === "ru" ? "Сегодня отмечено" : "Checked in today";
  }

  if (summary.dueToday) {
    return language === "ru" ? "Ожидает сегодня" : "Due today";
  }

  return language === "ru" ? "Сегодня не по плану" : "Not scheduled today";
}

function getHabitActionLabel(summary: PlannerHabitSummary, language: AppLanguage) {
  if (summary.habit.status === "paused") {
    return language === "ru" ? "На паузе" : "Paused";
  }

  if (summary.completedToday) {
    return language === "ru" ? "Убрать отметку" : "Undo check-in";
  }

  return summary.dueToday
    ? language === "ru"
      ? "Отметить сегодня"
      : "Check in today"
    : language === "ru"
      ? "Отметить вне плана"
      : "Check in anyway";
}

function HabitWeekStrip({ summary, language }: { summary: PlannerHabitSummary; language: AppLanguage }) {
  return (
    <div className="planner-habit-week-strip" aria-label={language === "ru" ? "Неделя привычки" : "Habit week"}>
      {summary.weekDays.map((day) => (
        <span
          key={day.dayAt}
          className={`${day.due ? "is-due" : ""} ${day.completed ? "is-complete" : ""} ${
            day.missed ? "is-missed" : ""
          } ${day.paused ? "is-paused" : ""} ${day.today ? "is-today" : ""} ${day.future ? "is-future" : ""}`}
          title={getWeekdayLabel(day.dayAt, language)}
        />
      ))}
    </div>
  );
}

function HabitCard({
  summary,
  language,
  selected,
  onSelect,
  onToggleToday
}: {
  summary: PlannerHabitSummary;
  language: AppLanguage;
  selected: boolean;
  onSelect: () => void;
  onToggleToday: () => void;
}) {
  const { habit } = summary;
  const checkDisabled = habit.status === "paused" || habit.status === "archived";

  return (
    <article
      className={`planner-habit-card ${selected ? "is-selected" : ""} ${
        summary.completedToday ? "is-complete" : ""
      } ${habit.status === "paused" ? "is-paused" : ""} ${summary.missed ? "is-missed" : ""}`}
      style={{ "--planner-habit-color": habit.color } as CSSProperties}
      onClick={onSelect}
    >
      <button
        type="button"
        className="planner-habit-check"
        aria-pressed={summary.completedToday}
        disabled={checkDisabled}
        onClick={(event) => {
          event.stopPropagation();

          if (!checkDisabled) {
            onToggleToday();
          }
        }}
      >
        <span />
      </button>
      <div className="planner-habit-card-main">
        <div className="planner-habit-card-title">
          <strong>{habit.title}</strong>
          {summary.project ? <em>{summary.project.name}</em> : null}
        </div>
        <div className="planner-habit-card-meta">
          <span>{getPlannerHabitCadenceLabel(habit.frequencyRule, language)}</span>
          <span>{getTodayState(summary, language)}</span>
          {summary.streak > 0 ? <span>{language === "ru" ? `${summary.streak} дн. streak` : `${summary.streak} day streak`}</span> : null}
          {summary.missed ? <span className="is-warning">{language === "ru" ? "Есть пропуск" : "Missed"}</span> : null}
        </div>
        <HabitWeekStrip summary={summary} language={language} />
      </div>
    </article>
  );
}

export default function PlannerHabitsSurface({
  habits,
  habitLogs,
  projects,
  language,
  isMobile,
  onCreateHabit,
  onUpdateHabit,
  onDeleteHabit,
  onToggleHabitLog
}: PlannerHabitsSurfaceProps) {
  const [filterId, setFilterId] = useState<HabitFilterId>("today");
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [cadenceDraft, setCadenceDraft] = useState<PlannerHabitCadencePreset>("daily");
  const [intervalDraft, setIntervalDraft] = useState(2);
  const [isCreating, setIsCreating] = useState(false);
  const summaries = useMemo(
    () =>
      buildPlannerHabitSummaries({
        habits,
        habitLogs,
        projects
      }),
    [habitLogs, habits, projects]
  );
  const visibleSummaries = useMemo(
    () =>
      summaries.filter((summary) => {
        if (filterId === "today") {
          return summary.habit.status !== "archived" && summary.dueToday;
        }

        if (filterId === "paused") {
          return summary.habit.status === "paused";
        }

        if (filterId === "missed") {
          return summary.habit.status !== "archived" && summary.missed;
        }

        return summary.habit.status === "active";
      }),
    [filterId, summaries]
  );
  const selectedSummary = selectedHabitId
    ? summaries.find((summary) => summary.habit.id === selectedHabitId) ?? null
    : null;
  const activeCount = summaries.filter((summary) => summary.habit.status === "active").length;
  const doneTodayCount = summaries.filter((summary) => summary.completedToday).length;
  const dueTodayCount = summaries.filter((summary) => summary.dueToday).length;
  const missedCount = summaries.filter((summary) => summary.missed).length;

  const resetComposer = () => {
    setTitleDraft("");
    setProjectDraft("");
    setCadenceDraft("daily");
    setIntervalDraft(2);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    resetComposer();
  };

  useEffect(() => {
    if (!selectedHabitId) {
      return;
    }

    if (!visibleSummaries.some((summary) => summary.habit.id === selectedHabitId)) {
      setSelectedHabitId(null);
    }
  }, [selectedHabitId, visibleSummaries]);

  useEffect(() => {
    if (!isComposerOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeComposer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isComposerOpen]);

  const handleBlankPointerDown = (event: PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;

    if (
      target.closest(
        "button,input,select,textarea,a,.planner-habit-card,.planner-habit-composer,.planner-habit-detail,.planner-habit-mobile-sheet"
      )
    ) {
      return;
    }

    setSelectedHabitId(null);

    if (isComposerOpen) {
      closeComposer();
    }
  };

  const handleFilterChange = (nextFilterId: HabitFilterId) => {
    setFilterId(nextFilterId);
    setSelectedHabitId(null);

    if (isComposerOpen) {
      closeComposer();
    }
  };

  const handleCreateHabit = async () => {
    const title = titleDraft.trim();

    if (!title || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const project = projects.find((item) => item.id === projectDraft) ?? null;
      const habit = await onCreateHabit({
        title,
        projectId: project?.id ?? null,
        color: project?.color,
        frequencyRule: buildPlannerHabitFrequencyRule(cadenceDraft, intervalDraft),
        targetCount: 1,
        targetUnit: "count",
        targetPeriod: "day"
      });
      setSelectedHabitId(habit.id);
      closeComposer();
    } finally {
      setIsCreating(false);
    }
  };

  const renderComposer = (variant: "inline" | "sheet") => (
    <form
      className={`planner-habit-composer is-${variant}`}
      onSubmit={(event) => {
        event.preventDefault();
        void handleCreateHabit();
      }}
    >
      <div className="planner-habit-composer-head">
        <div>
          <span>{language === "ru" ? "Новая привычка" : "New habit"}</span>
          {variant === "sheet" ? (
            <strong>{language === "ru" ? "Настрой ритм и привязку" : "Set rhythm and context"}</strong>
          ) : null}
        </div>
        <button type="button" onClick={closeComposer} aria-label={language === "ru" ? "Закрыть" : "Close"} />
      </div>
      <div className="planner-habit-composer-body">
        <label className="planner-habit-title-field">
          <span>{language === "ru" ? "Название" : "Title"}</span>
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            placeholder={language === "ru" ? "Например: вечерний обзор" : "For example: evening review"}
            autoFocus
          />
        </label>
        <div className="planner-habit-composer-group is-cadence">
          <span>{language === "ru" ? "Ритм" : "Cadence"}</span>
          <div className="planner-habit-chip-row">
            {CADENCE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={cadenceDraft === preset ? "is-active" : ""}
                onClick={() => setCadenceDraft(preset)}
              >
                {getCadencePresetLabel(preset, intervalDraft, language)}
              </button>
            ))}
          </div>
          {cadenceDraft === "customDaily" ? (
            <div className="planner-habit-stepper" aria-label={language === "ru" ? "Интервал дней" : "Day interval"}>
              <button type="button" onClick={() => setIntervalDraft((value) => Math.max(2, value - 1))}>-</button>
              <strong>{intervalDraft}</strong>
              <button type="button" onClick={() => setIntervalDraft((value) => Math.min(365, value + 1))}>+</button>
            </div>
          ) : null}
        </div>
        <div className="planner-habit-composer-group is-project">
          <span>{language === "ru" ? "Проект" : "Project"}</span>
          <div className="planner-habit-chip-row is-projects">
            <button
              type="button"
              className={projectDraft === "" ? "is-active" : ""}
              onClick={() => setProjectDraft("")}
              style={{ "--planner-habit-chip-color": "var(--planner-accent-2)" } as CSSProperties}
            >
              <span className="planner-habit-project-dot" aria-hidden="true" />
              <span className="planner-habit-project-name">{language === "ru" ? "Без проекта" : "No project"}</span>
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={projectDraft === project.id ? "is-active" : ""}
                onClick={() => setProjectDraft(project.id)}
                style={{ "--planner-habit-chip-color": project.color } as CSSProperties}
              >
                <span className="planner-habit-project-dot" aria-hidden="true" />
                <span className="planner-habit-project-name">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="planner-habit-submit" disabled={!titleDraft.trim() || isCreating}>
          {language === "ru" ? "Создать" : "Create"}
        </button>
      </div>
    </form>
  );

  const renderDetailContent = (summary: PlannerHabitSummary, variant: "aside" | "sheet") => (
    <>
      {variant === "sheet" ? <div className="planner-habit-mobile-sheet-handle" aria-hidden="true" /> : null}
      <div className={`planner-habit-detail-content is-${variant}`}>
        <div className="planner-habit-detail-head" style={{ "--planner-habit-color": summary.habit.color } as CSSProperties}>
          <span />
          <div>
            <strong>{summary.habit.title}</strong>
            <em>{getPlannerHabitCadenceLabel(summary.habit.frequencyRule, language)}</em>
          </div>
          {variant === "sheet" ? (
            <button
              type="button"
              className="planner-habit-sheet-close"
              onClick={() => setSelectedHabitId(null)}
              aria-label={language === "ru" ? "Закрыть" : "Close"}
            />
          ) : null}
        </div>

        <div className={`planner-habit-today-card ${summary.completedToday ? "is-complete" : ""}`}>
          <div>
            <span>{language === "ru" ? "Сегодня" : "Today"}</span>
            <strong>{getTodayState(summary, language)}</strong>
          </div>
          <button
            type="button"
            disabled={summary.habit.status !== "active"}
            onClick={() => void onToggleHabitLog(summary.habit.id)}
          >
            {getHabitActionLabel(summary, language)}
          </button>
        </div>

        <div className="planner-habit-detail-grid">
          <div>
            <span>{language === "ru" ? "Streak" : "Streak"}</span>
            <strong>{summary.streak}</strong>
          </div>
          <div>
            <span>{language === "ru" ? "За неделю" : "This week"}</span>
            <strong>
              {summary.weekCompletedCount}/{summary.weekDueCount}
            </strong>
          </div>
          <div>
            <span>{language === "ru" ? "Последняя" : "Last"}</span>
            <strong>{getLastLogLabel(summary.lastLogAt, language)}</strong>
          </div>
        </div>

        <div className="planner-habit-detail-week">
          <div>
            <span>{language === "ru" ? "Неделя" : "Week"}</span>
            <strong>{language === "ru" ? "План и отметки" : "Schedule and check-ins"}</strong>
          </div>
          <HabitWeekStrip summary={summary} language={language} />
        </div>

        <div className="planner-habit-detail-actions">
          <button
            type="button"
            className="is-secondary"
            onClick={() =>
              void onUpdateHabit(summary.habit.id, {
                status: summary.habit.status === "paused" ? "active" : "paused"
              })
            }
          >
            <span className="planner-habit-action-icon is-pause" />
            {summary.habit.status === "paused"
              ? language === "ru"
                ? "Возобновить"
                : "Resume"
              : language === "ru"
                ? "Пауза"
                : "Pause"}
          </button>
          <button
            type="button"
            className="is-secondary"
            onClick={() =>
              void onUpdateHabit(summary.habit.id, {
                status: "archived"
              })
            }
          >
            <span className="planner-habit-action-icon is-archive" />
            {language === "ru" ? "В архив" : "Archive"}
          </button>
          <button type="button" className="is-danger" onClick={() => void onDeleteHabit(summary.habit.id)}>
            <span className="planner-habit-action-icon is-delete" />
            {language === "ru" ? "Удалить" : "Delete"}
          </button>
        </div>
        <div className="planner-habit-detail-note">
          {summary.habit.status === "paused"
            ? language === "ru"
              ? "Пауза не ломает streak: дни паузы пропускаются в расчете."
              : "Pause keeps the streak intact: paused days are skipped."
            : language === "ru"
              ? "Отметка хранится как событие конкретного дня. Завтра привычка снова появится в расписании, а сегодняшняя отметка останется в истории."
              : "Each check-in is stored for a specific day. Tomorrow the habit appears again, while today's log stays in history."}
        </div>
      </div>
    </>
  );

  return (
    <section
      className={`planner-habits-surface ${isMobile ? "is-mobile" : "is-desktop"} ${
        selectedSummary ? "has-selection" : "has-no-selection"
      }`}
      onPointerDown={handleBlankPointerDown}
    >
      <div className="planner-habits-board">
        <div className="planner-habits-stats">
          <div>
            <span>{language === "ru" ? "Сегодня" : "Today"}</span>
            <strong>
              {doneTodayCount}/{dueTodayCount}
            </strong>
          </div>
          <div>
            <span>{language === "ru" ? "Активные" : "Active"}</span>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <span>{language === "ru" ? "Пропуски" : "Missed"}</span>
            <strong>{missedCount}</strong>
          </div>
        </div>

        <div className="planner-habits-toolbar">
          <nav aria-label={language === "ru" ? "Фильтры привычек" : "Habit filters"}>
            {HABIT_FILTERS.map((nextFilterId) => (
              <button
                key={nextFilterId}
                type="button"
                className={filterId === nextFilterId ? "is-active" : ""}
                onClick={() => handleFilterChange(nextFilterId)}
              >
                {getHabitFilterLabel(nextFilterId, language)}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="planner-habit-new-button"
            onClick={() => {
              if (isComposerOpen) {
                closeComposer();
              } else {
                setSelectedHabitId(null);
                setIsComposerOpen(true);
              }
            }}
          >
            <span />
            {language === "ru" ? "Новая" : "New"}
          </button>
        </div>

        {isComposerOpen && !isMobile ? renderComposer("inline") : null}

        <div className="planner-habit-list">
          {visibleSummaries.length > 0 ? (
            visibleSummaries.map((summary) => (
              <HabitCard
                key={summary.habit.id}
                summary={summary}
                language={language}
                selected={selectedSummary?.habit.id === summary.habit.id}
                onSelect={() => {
                  setSelectedHabitId(summary.habit.id);
                  if (isComposerOpen) {
                    closeComposer();
                  }
                }}
                onToggleToday={() => void onToggleHabitLog(summary.habit.id)}
              />
            ))
          ) : (
            <div className="planner-habit-empty">
              <strong>{language === "ru" ? "Здесь пока тихо" : "Quiet here"}</strong>
              <span>{language === "ru" ? "Создай привычку или смени фильтр." : "Create a habit or change the filter."}</span>
            </div>
          )}
        </div>
      </div>

      {!isMobile ? (
        <aside className={`planner-habit-detail ${selectedSummary ? "" : "is-empty"}`}>
          {selectedSummary ? (
            renderDetailContent(selectedSummary, "aside")
          ) : (
            <div className="planner-habit-empty is-detail">
              <strong>{language === "ru" ? "Выбери привычку" : "Select a habit"}</strong>
              <span>{language === "ru" ? "Здесь появятся ритм, streak, неделя и действия." : "Cadence, streak, week, and actions will appear here."}</span>
            </div>
          )}
        </aside>
      ) : null}

      {isMobile && isComposerOpen ? (
        <div className="planner-habit-mobile-sheet-layer" role="dialog" aria-modal="true">
          <button type="button" className="planner-habit-mobile-sheet-backdrop" onClick={closeComposer} aria-label={language === "ru" ? "Закрыть" : "Close"} />
          <section className="planner-habit-mobile-sheet is-composer">
            <div className="planner-habit-mobile-sheet-handle" aria-hidden="true" />
            {renderComposer("sheet")}
          </section>
        </div>
      ) : null}

      {isMobile && selectedSummary ? (
        <div className="planner-habit-mobile-sheet-layer" role="dialog" aria-modal="true">
          <button
            type="button"
            className="planner-habit-mobile-sheet-backdrop"
            onClick={() => setSelectedHabitId(null)}
            aria-label={language === "ru" ? "Закрыть" : "Close"}
          />
          <section key={selectedSummary.habit.id} className="planner-habit-mobile-detail-sheet">
            {renderDetailContent(selectedSummary, "sheet")}
          </section>
        </div>
      ) : null}
    </section>
  );
}
