# Locoris Planner

This document freezes the first Planner data and UX contract before the UI is built. Planner is a first-class Locoris surface inside the orbital shell, not a settings panel or a detached task app.

## Product Model

Planner adds a time and execution layer to the existing knowledge base.

- `Task` is an actionable item. It can live in Inbox, belong to a project/folder, link back to a note block or canvas element, have schedule, due date, reminders, recurrence, priority, estimate, and tracked time.
- `Milestone` is represented as a `Task` with `kind: "milestone"`. It is important enough to appear on project timelines and the orbital temporal layer, but it is still managed by Planner.
- `Habit` is a recurring behavior with a cadence, reminders, streak/log history, and optional project or note context.
- `HabitLog` is one check-in or measured entry for a habit. Logs are separate records so streaks and analytics can be rebuilt without mutating the habit history.
- `Goal` is a larger outcome or OKR-style objective. It can group tasks, habits, milestones, or project progress.
- `TimeBlock` is a planned or tracked calendar interval. It can be attached to a task or directly to a project/note/canvas.
- `Reminder` is embedded into tasks and, later, habits/time blocks. It stores local notification intent; platform delivery is rebuilt locally through Tauri notifications on desktop/Android and browser Notification API fallback on web.
- `TaskLink` is embedded into a task to preserve backlinks to project, folder, note, note block, canvas, canvas element, or a URL.

## Statuses

Tasks use a compact status set:

- `inbox`: captured but not planned.
- `todo`: accepted into a plan.
- `scheduled`: has a calendar/time block.
- `inProgress`: actively being worked on.
- `waiting`: blocked by an external dependency.
- `done`: completed.
- `canceled`: intentionally abandoned.

Habits use `active`, `paused`, and `archived`.

Goals use `active`, `paused`, `completed`, and `archived`.

Time blocks use `planned`, `active`, `completed`, and `canceled`.

## Context Links

Planner records can point into the vault without owning the source content.

- `projectId` and `folderId` scope work to the hierarchy.
- `noteId` links a task to a note document.
- `canvasId` links a task to a canvas note.
- `sourceBlockId` links a task to a BlockNote block.
- `canvasElementId` links a task to a canvas object.

When a linked note, canvas, or project is deleted later, Planner UI should show a missing-context state instead of silently deleting the task. Cascading delete behavior can be added only for explicit user actions.

## Creation Entry Points

Planner tasks should be creatable from the user's current context, not only from Planner.

- From a note toolbar: create a task linked to the whole note.
- From selected note text: create a task whose title comes from the selection and whose description keeps the selected context.
- From a checklist item/current block: create a tracked task linked to the source block.
- From a canvas selection: create a task linked to the canvas and first selected element.
- From a project overview/map card: open Planner already filtered to that project.

The created task must keep backlinks to every known source: project, folder, note, block, canvas, and canvas element. The backlink list is visible in the task inspector so tasks never feel detached from the knowledge base.

## Quick Add

Quick Add accepts compact natural input and enriches the task locally before sync:

```text
созвон завтра 14:00 #клиент p1 45m
```

Initial heuristics:

- `сегодня`, `завтра`, `послезавтра`, `today`, `tomorrow`, `day after tomorrow` set the due date.
- `14:00` or `14.00` sets a planned start time; if no date is provided and the time has already passed, it schedules tomorrow.
- `#tag` links an existing tag or creates it if missing.
- `p1`, `p2`, `p3` map to urgent, high, and medium priority.
- `30m`, `45мин`, `2h`, `2ч` set the estimate.

Explicit fields in the quick add panel override parsed values. This keeps the fast path forgiving while still giving the user precise control.

## Calendar And Time Blocks

Planner calendar starts with first-party Locoris UI instead of a third-party desktop calendar dropped into the app.

- Calendar is a separate full-screen time surface, not one of the task category rail tabs. Task rail tabs filter work; calendar aggregates schedule, due dates, and time blocks.
- `Day` is the primary mobile mode and shows an agenda with tappable time slots.
- `Week` is the primary desktop mode and supports drag-to-schedule from unscheduled tasks.
- `Month` is a scanning mode; selecting a day routes into day agenda.
- `TimeBlock` stores planned work intervals and can be attached to a task, project, note, or canvas.
- Scheduling a task through a time block moves the task into `scheduled` and writes `scheduledStartAt` / `scheduledEndAt`.
- Deleting or reassigning a time block clears stale scheduled state from the previous linked task when that block was the source of the task schedule.
- Due-only tasks and scheduled tasks are visually distinct: due tasks communicate deadline pressure, time blocks communicate planned working time.

## Recurrence And Reminders

Recurring tasks use RRULE-compatible strings and local occurrence metadata.

- Presets cover daily, weekly, monthly, and interval-based recurrence.
- Custom RRULE is supported for advanced rules such as `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR`.
- `recurrenceExceptionDates` stores skipped occurrences.
- `recurrenceCompletedDates` stores completed individual occurrences.
- `recurrenceOverrides` stores rescheduled occurrence overrides.
- Actions must support current occurrence only, all future, skip, and reschedule without mutating unrelated future history.
- Reminders can be exact (`remindAt`) or relative (`offsetMinutes`) to the scheduled/due time.
- Reminder delivery is local runtime behavior; sync sends the reminder record but never server-side notification content.

## Map vs Planner

Planner owns detailed task lists, habits, calendar views, kanban views, time tracking, recurrence, review, and task inspection.

The orbital map shows only aggregated temporal signals:

- project deadline rings;
- `Today` and `Overdue` counters;
- active focus marker;
- milestone markers for important tasks;
- project health and workload accent;
- an optional `Temporal Layer` toggle.

The map must not render every task as a planet by default. A project with many tasks should stay visually calm and route details to Planner.

## Desktop UX Rules

- Desktop and wide web get a primary switch: `Map / Planner`.
- Planner uses a shell layout: rail, main planning surface, task inspector.
- Rail starts with `Inbox`, `Today`, `Upcoming`, `Projects`, `Habits`, and `Review`.
- Calendar opens from a dedicated calendar entry/button as a large overlay surface. Board and timeline can later follow the same “time surface” pattern if they become dense enough.
- Keyboard-first flows should exist for quick add, complete, schedule, move, and open linked context.

## Mobile UX Rules

- Mobile bottom navigation becomes `Vault / Docs / Plan / Map / Settings`.
- `Pinned/Favorites` belongs inside Docs, not as a primary mobile tab.
- `Plan` opens to Today by default.
- Mobile uses bottom sheets, explicit buttons, swipe actions, and long press menus.
- No Planner action may depend on hover.
- Calendar defaults to agenda/day; dense month and gantt views are secondary modes.

## Offline And Sync Rules

- Planner is local-first and stored in the same vault database as notes and canvases.
- Planner entities are sync payload entities, participate in tombstones, dirty entries, shadows, desktop/native backups, Locoris backup, and readable ZIP metadata.
- Recurrence is stored as an RRULE-compatible string plus local exception/completion/override metadata.
- Reminders are local intent records. Platform notification scheduling is derived from them and can be rebuilt after restore or sync.
