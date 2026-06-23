import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type {
  AppLanguage,
  CanvasContent,
  Folder,
  Goal,
  Habit,
  HabitLog,
  Note,
  NoteContent,
  Project,
  StoredBlock,
  Tag,
  Task,
  TaskLink,
  TimeBlock
} from "../types";
import { buildCanvasExcerpt, extractCanvasPlainText, getCanvasRuntimeAppStateDefaults } from "../lib/canvas";
import { buildExcerpt, extractPlainText } from "../lib/notes";
import { COLOR_PALETTE, DEFAULT_NOTE_COLOR, DEFAULT_PROJECT_COLOR } from "../lib/palette";

const SORT_ORDER_STEP = 1024;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type DemoFolderKey = "start" | "notes" | "canvases" | "planner";
type DemoTagKey = "start" | "demo" | "idea" | "plan" | "local";

type DemoStrings = {
  projectName: string;
  folders: Record<DemoFolderKey, string>;
  tags: Record<DemoTagKey, string>;
  notes: {
    welcome: string;
    editor: string;
    vault: string;
    dailyReview: string;
    canvas: string;
  };
  planner: {
    readDemo: string;
    firstNote: string;
    sketchCanvas: string;
    weeklyReview: string;
    habitTitle: string;
    habitDescription: string;
    habitUnit: string;
    goalTitle: string;
    goalDescription: string;
    goalMetric: string;
    focusBlock: string;
    focusBlockDescription: string;
    habitLogNote: string;
  };
  canvas: {
    title: string;
    subtitle: string;
    notes: string;
    notesBody: string;
    canvas: string;
    canvasBody: string;
    planner: string;
    plannerBody: string;
    sync: string;
    syncBody: string;
  };
};

export type InitialDemoVaultSeed = {
  project: Project;
  folders: Folder[];
  tags: Tag[];
  notes: Note[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  timeBlocks: TimeBlock[];
  activeNoteId: string;
};

const DEMO_STRINGS: Record<AppLanguage, DemoStrings> = {
  ru: {
    projectName: "Демо-пространство Locoris",
    folders: {
      start: "Старт",
      notes: "Заметки",
      canvases: "Холсты",
      planner: "Планер"
    },
    tags: {
      start: "старт",
      demo: "пример",
      idea: "идея",
      plan: "план",
      local: "локально"
    },
    notes: {
      welcome: "Добро пожаловать в Locoris",
      editor: "Пример заметки: возможности редактора",
      vault: "Как устроено хранилище",
      dailyReview: "Рабочий обзор дня",
      canvas: "Карта возможностей Locoris"
    },
    planner: {
      readDemo: "Прочитать демо-заметку",
      firstNote: "Создать первую рабочую заметку",
      sketchCanvas: "Набросать карту идеи на холсте",
      weeklyReview: "Провести первый обзор недели",
      habitTitle: "Ежедневный обзор",
      habitDescription: "Короткая проверка заметок, задач и следующего фокусного шага.",
      habitUnit: "обзор",
      goalTitle: "Собрать личную систему знаний",
      goalDescription: "Пример цели, которая связывает проект, заметки, планер и обзор прогресса.",
      goalMetric: "%",
      focusBlock: "Обзор демо-пространства",
      focusBlockDescription: "Посмотреть заметки, холст и планер как единый рабочий цикл.",
      habitLogNote: "Демо-отметка за вчера: привычки показывают ритм, а не обычные задачи."
    },
    canvas: {
      title: "Locoris как система",
      subtitle: "Одна локальная база для заметок, холстов, планера, синхронизации и бэкапов.",
      notes: "Заметки",
      notesBody: "Идеи, документы,\nструктура и теги",
      canvas: "Холсты",
      canvasBody: "Схемы, связи,\nвизуальное мышление",
      planner: "Планер",
      plannerBody: "Задачи, привычки,\nкалендарь и обзор",
      sync: "Синхронизация и бэкап",
      syncBody: "Локальность,\nпереносимость,\nконтроль данных"
    }
  },
  en: {
    projectName: "Locoris Demo Space",
    folders: {
      start: "Start",
      notes: "Notes",
      canvases: "Canvases",
      planner: "Planner"
    },
    tags: {
      start: "start",
      demo: "demo",
      idea: "idea",
      plan: "plan",
      local: "local"
    },
    notes: {
      welcome: "Welcome to Locoris",
      editor: "Sample note: editor capabilities",
      vault: "How the vault is organized",
      dailyReview: "Daily work review",
      canvas: "Locoris capability map"
    },
    planner: {
      readDemo: "Read the demo note",
      firstNote: "Create the first working note",
      sketchCanvas: "Sketch an idea map on canvas",
      weeklyReview: "Run the first weekly review",
      habitTitle: "Daily review",
      habitDescription: "A short check-in for notes, tasks, and the next focus step.",
      habitUnit: "review",
      goalTitle: "Build a personal knowledge system",
      goalDescription: "A sample goal that connects a project, notes, planner, and progress review.",
      goalMetric: "%",
      focusBlock: "Review the demo space",
      focusBlockDescription: "Look at notes, canvas, and planner as one working loop.",
      habitLogNote: "Demo check-in from yesterday: habits show rhythm, not ordinary tasks."
    },
    canvas: {
      title: "Locoris as a system",
      subtitle: "One local base for notes, canvases, planner, sync, and backups.",
      notes: "Notes",
      notesBody: "Ideas, documents,\nstructure, and tags",
      canvas: "Canvases",
      canvasBody: "Diagrams, links,\nvisual thinking",
      planner: "Planner",
      plannerBody: "Tasks, habits,\ncalendar, and review",
      sync: "Sync and backup",
      syncBody: "Local-first data,\nportability,\ncontrol"
    }
  }
};

function createColor(seedIndex: number) {
  return COLOR_PALETTE[seedIndex % COLOR_PALETTE.length].hex;
}

function sortOrder(index: number) {
  return SORT_ORDER_STEP * index;
}

function text(value: string, styles: Record<string, unknown> = {}) {
  return {
    type: "text",
    text: value,
    styles
  };
}

function link(value: string, href: string) {
  return {
    type: "link",
    href,
    content: [text(value)]
  };
}

function block(
  type: string,
  content?: unknown,
  props: Record<string, unknown> = {},
  children: StoredBlock[] = []
): StoredBlock {
  return {
    id: crypto.randomUUID(),
    type,
    props,
    ...(typeof content === "undefined" ? {} : { content }),
    children
  };
}

function paragraph(content: unknown, props: Record<string, unknown> = {}) {
  return block("paragraph", content, { textColor: "default", ...props });
}

function heading(level: number, value: string) {
  return block("heading", [text(value)], { level });
}

function quote(value: string) {
  return block("quote", [text(value)], { textColor: "default" });
}

function bullet(value: string) {
  return block("bulletListItem", [text(value)], { textColor: "default" });
}

function numbered(value: string, start: number) {
  return block("numberedListItem", [text(value)], { textColor: "default", start });
}

function checklist(value: string, checked = false) {
  return block("checkListItem", [text(value)], { textColor: "default", checked });
}

function code(value: string, language = "markdown") {
  return block("codeBlock", [text(value)], { language });
}

function divider() {
  return block("divider");
}

function tableCell(value: string, styles: Record<string, unknown> = {}): StoredBlock {
  return {
    type: "tableCell",
    props: {
      textColor: "default",
      backgroundColor: "default",
      textAlignment: "left"
    },
    content: [text(value, styles)]
  };
}

function table(rows: string[][], headerRows = 1): StoredBlock {
  return block(
    "table",
    {
      type: "tableContent",
      columnWidths: rows[0]?.map(() => undefined) ?? [],
      headerRows,
      headerCols: 0,
      rows: rows.map((row, rowIndex) => ({
        cells: row.map((cell) =>
          tableCell(cell, rowIndex < headerRows ? { bold: true } : {})
        )
      }))
    },
    {}
  );
}

function buildWelcomeContent(language: AppLanguage, strings: DemoStrings): NoteContent {
  if (language === "ru") {
    return [
      heading(1, "Демо-пространство Locoris"),
      paragraph([
        text("Это аккуратный стартовый vault, который показывает Locoris как "),
        text("локальную рабочую систему", { bold: true }),
        text(": заметки, холсты, планер, теги, синхронизация и бэкапы.")
      ]),
      quote("Все данные лежат локально. Демо можно спокойно редактировать, переименовывать или удалить вместе с проектом."),
      heading(2, "Что посмотреть первым"),
      checklist("Открыть заметку с возможностями редактора", false),
      checklist("Посмотреть холст с картой возможностей", false),
      checklist("Открыть планер и увидеть задачи, привычку, цель и фокус-блок", false),
      divider(),
      heading(2, "Структура демо"),
      table([
        ["Раздел", "Что показывает"],
        [strings.folders.start, "Маршрут первого знакомства и общий смысл приложения."],
        [strings.folders.notes, "Редактор, форматирование, теги и структура знаний."],
        [strings.folders.canvases, "Визуальные связи между заметками, задачами и идеями."],
        [strings.folders.planner, "Задачи, привычки, цель, календарный фокус и обзор."]
      ]),
      heading(2, "Быстрый маршрут"),
      numbered("Создайте свою первую заметку рядом с демо.", 1),
      numbered("Свяжите важную идею с задачей в планере.", 2),
      numbered("Сделайте бэкап перед большим импортом или перестройкой хранилища.", 3)
    ];
  }

  return [
    heading(1, "Locoris Demo Space"),
    paragraph([
      text("This compact starter vault shows Locoris as a "),
      text("local working system", { bold: true }),
      text(": notes, canvases, planner, tags, sync, and backups.")
    ]),
    quote("Everything is local. You can edit, rename, or delete the demo together with its project."),
    heading(2, "Start here"),
    checklist("Open the editor capability note", false),
    checklist("View the capability map canvas", false),
    checklist("Open the planner and see tasks, habit, goal, and focus block", false),
    divider(),
    heading(2, "Demo structure"),
    table([
      ["Section", "What it shows"],
      [strings.folders.start, "The first route and the product idea."],
      [strings.folders.notes, "Editor, formatting, tags, and knowledge structure."],
      [strings.folders.canvases, "Visual links between notes, tasks, and ideas."],
      [strings.folders.planner, "Tasks, habits, goal, calendar focus, and review."]
    ]),
    heading(2, "Quick route"),
    numbered("Create your first note next to the demo.", 1),
    numbered("Connect an important idea to a planner task.", 2),
    numbered("Create a backup before a large import or vault rebuild.", 3)
  ];
}

function buildEditorDemoContent(language: AppLanguage): NoteContent {
  if (language === "ru") {
    return [
      heading(1, "Возможности редактора"),
      paragraph([
        text("Locoris хранит заметки как структурированные блоки: "),
        text("текст", { bold: true }),
        text(", "),
        text("акценты", { italic: true }),
        text(", "),
        text("подчёркивание", { underline: true }),
        text(", "),
        text("удалённый вариант", { strike: true }),
        text(", "),
        text("inline code", { code: true }),
        text(" и "),
        link("ссылки", "https://locoris.local/demo"),
        text(".")
      ]),
      heading(2, "Блоки"),
      bullet("Маркированные списки подходят для идей и быстрых заметок."),
      numbered("Нумерованные списки хороши для процессов.", 1),
      numbered("Каждый блок можно переставлять и развивать дальше.", 2),
      checklist("Чеклист можно превратить в рабочий маршрут.", false),
      checklist("Готовые шаги остаются в контексте заметки.", true),
      quote("Хорошая заметка не обязана быть длинной. Она должна помогать принять следующее решение."),
      code("## План\n- Сформулировать идею\n- Связать её с задачей\n- Вернуться к обзору дня", "markdown"),
      heading(2, "Таблица"),
      table([
        ["Объект", "Когда использовать", "Сигнал"],
        ["Заметка", "Нужно сохранить мысль или документ", "Контекст"],
        ["Холст", "Нужно увидеть связи", "Структура"],
        ["Задача", "Есть обязательство", "Следующее действие"]
      ]),
      heading(2, "Типографика"),
      paragraph([
        text("Авто", { bold: true }),
        text(" — базовый адаптивный стиль заметки: он следует текущему режиму чтения и теме.")
      ]),
      paragraph([text("Onest подходит для компактных интерфейсных фрагментов.", { font: "onest" })]),
      paragraph([text("IBM Plex Sans хорошо читается в рабочих заметках.", { font: "ibmPlexSans" })]),
      paragraph([text("Golos Text мягко смотрится в длинном чтении.", { font: "golosText" })]),
      paragraph([text("IBM Plex Serif добавляет редакционный тон.", { font: "ibmPlexSerif" })]),
      paragraph([text("IBM Plex Mono полезен для технических фрагментов.", { font: "ibmPlexMono" })]),
      paragraph([text("Unbounded лучше оставлять для коротких выразительных акцентов.", { font: "unbounded" })])
    ];
  }

  return [
    heading(1, "Editor capabilities"),
    paragraph([
      text("Locoris stores notes as structured blocks: "),
      text("text", { bold: true }),
      text(", "),
      text("emphasis", { italic: true }),
      text(", "),
      text("underline", { underline: true }),
      text(", "),
      text("removed option", { strike: true }),
      text(", "),
      text("inline code", { code: true }),
      text(", and "),
      link("links", "https://locoris.local/demo"),
      text(".")
    ]),
    heading(2, "Blocks"),
    bullet("Bullet lists are useful for ideas and quick notes."),
    numbered("Numbered lists are good for processes.", 1),
    numbered("Each block can be moved and expanded later.", 2),
    checklist("A checklist can become a working route.", false),
    checklist("Completed steps stay in the note context.", true),
    quote("A good note does not have to be long. It should help you choose the next decision."),
    code("## Plan\n- Shape the idea\n- Link it to a task\n- Return to the daily review", "markdown"),
    heading(2, "Table"),
    table([
      ["Object", "When to use", "Signal"],
      ["Note", "Capture a thought or document", "Context"],
      ["Canvas", "See relationships", "Structure"],
      ["Task", "Track a commitment", "Next action"]
    ]),
    heading(2, "Typography"),
    paragraph([
      text("Auto", { bold: true }),
      text(" is the adaptive note style: it follows the current reading mode and theme.")
    ]),
    paragraph([text("Onest works well for compact interface-like fragments.", { font: "onest" })]),
    paragraph([text("IBM Plex Sans stays crisp in working notes.", { font: "ibmPlexSans" })]),
    paragraph([text("Golos Text feels calm for long reading.", { font: "golosText" })]),
    paragraph([text("IBM Plex Serif adds an editorial tone.", { font: "ibmPlexSerif" })]),
    paragraph([text("IBM Plex Mono is useful for technical fragments.", { font: "ibmPlexMono" })]),
    paragraph([text("Unbounded is best for short expressive accents.", { font: "unbounded" })])
  ];
}

function buildVaultGuideContent(language: AppLanguage): NoteContent {
  if (language === "ru") {
    return [
      heading(1, "Как устроено хранилище"),
      paragraph("Проект собирает рядом папки, заметки, холсты, задачи и визуальные сигналы карты."),
      bullet("Папки дают спокойную иерархию."),
      bullet("Теги пересекают папки и помогают быстро собрать тему."),
      bullet("Избранное и закрепление выводят рабочие элементы наверх."),
      bullet("Бэкап сохраняет восстановимый файл и читаемый ZIP-экспорт."),
      heading(2, "Практика"),
      checklist("Оставить демо как песочницу для экспериментов.", false),
      checklist("Или удалить проект после знакомства и начать с чистого пространства.", false)
    ];
  }

  return [
    heading(1, "How the vault is organized"),
    paragraph("A project keeps folders, notes, canvases, tasks, and map signals in one place."),
    bullet("Folders provide calm hierarchy."),
    bullet("Tags cross folder boundaries and help collect a theme quickly."),
    bullet("Favorites and pinned notes lift active items to the top."),
    bullet("Backup creates a precise restore file and a readable ZIP export."),
    heading(2, "Practice"),
    checklist("Keep the demo as a sandbox for experiments.", false),
    checklist("Or delete the project after the tour and start from a clean space.", false)
  ];
}

function buildDailyReviewContent(language: AppLanguage): NoteContent {
  if (language === "ru") {
    return [
      heading(1, "Рабочий обзор дня"),
      paragraph("Эта заметка показывает, как связать спокойный обзор с задачами и привычками."),
      heading(2, "Сегодня"),
      checklist("Выбрать один главный фокус", false),
      checklist("Проверить просроченные задачи", false),
      checklist("Закрыть день короткой заметкой", false),
      heading(2, "Вопросы"),
      bullet("Что сегодня двигает проект вперёд?"),
      bullet("Где нужна не задача, а привычка или ритм?"),
      bullet("Что стоит вынести на холст, чтобы увидеть связи?")
    ];
  }

  return [
    heading(1, "Daily work review"),
    paragraph("This note shows how a calm review can connect tasks and habits."),
    heading(2, "Today"),
    checklist("Choose one main focus", false),
    checklist("Check overdue tasks", false),
    checklist("Close the day with a short note", false),
    heading(2, "Questions"),
    bullet("What moves the project forward today?"),
    bullet("Where do I need a rhythm instead of a task?"),
    bullet("What belongs on a canvas so relationships become visible?")
  ];
}

function buildDemoCanvasContent(strings: DemoStrings): CanvasContent {
  const cardStyle = {
    fillStyle: "solid",
    roughness: 0,
    opacity: 96,
    roundness: { type: 3 },
    strokeWidth: 2
  };
  const skeletonElements = [
    {
      type: "text",
      x: -480,
      y: -190,
      width: 640,
      height: 44,
      text: strings.canvas.title,
      fontSize: 36,
      strokeColor: "#f8fafc"
    },
    {
      type: "text",
      x: -478,
      y: -136,
      width: 760,
      height: 30,
      text: strings.canvas.subtitle,
      fontSize: 18,
      strokeColor: "#b8c7dd"
    },
    {
      ...cardStyle,
      type: "rectangle",
      id: "demo-notes",
      x: -500,
      y: -40,
      width: 220,
      height: 132,
      strokeColor: "#73f7ff",
      backgroundColor: "#102b34",
      label: {
        text: `${strings.canvas.notes}\n${strings.canvas.notesBody}`,
        fontSize: 18,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#f8fafc"
      }
    },
    {
      ...cardStyle,
      type: "rectangle",
      id: "demo-canvas",
      x: -130,
      y: -40,
      width: 220,
      height: 132,
      strokeColor: "#d189ff",
      backgroundColor: "#261c35",
      label: {
        text: `${strings.canvas.canvas}\n${strings.canvas.canvasBody}`,
        fontSize: 18,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#f8fafc"
      }
    },
    {
      ...cardStyle,
      type: "rectangle",
      id: "demo-planner",
      x: 240,
      y: -40,
      width: 220,
      height: 132,
      strokeColor: "#ffe08a",
      backgroundColor: "#332813",
      label: {
        text: `${strings.canvas.planner}\n${strings.canvas.plannerBody}`,
        fontSize: 18,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#f8fafc"
      }
    },
    {
      ...cardStyle,
      type: "rectangle",
      id: "demo-sync",
      x: -130,
      y: 180,
      width: 270,
      height: 142,
      strokeColor: "#66f0a4",
      backgroundColor: "#143126",
      label: {
        text: `${strings.canvas.sync}\n${strings.canvas.syncBody}`,
        fontSize: 18,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#f8fafc"
      }
    },
    {
      type: "arrow",
      x: -270,
      y: 26,
      points: [
        [0, 0],
        [130, 0]
      ],
      strokeColor: "#8edcff",
      strokeWidth: 2,
      roughness: 0,
      endArrowhead: "arrow"
    },
    {
      type: "arrow",
      x: 100,
      y: 26,
      points: [
        [0, 0],
        [130, 0]
      ],
      strokeColor: "#d9b8ff",
      strokeWidth: 2,
      roughness: 0,
      endArrowhead: "arrow"
    },
    {
      type: "arrow",
      x: 350,
      y: 104,
      points: [
        [0, 0],
        [-116, 130],
        [-205, 130]
      ],
      strokeColor: "#ffe08a",
      strokeWidth: 2,
      roughness: 0,
      endArrowhead: "arrow"
    },
    {
      type: "arrow",
      x: -140,
      y: 250,
      points: [
        [0, 0],
        [-248, 0],
        [-248, -146]
      ],
      strokeColor: "#66f0a4",
      strokeWidth: 2,
      roughness: 0,
      endArrowhead: "arrow"
    }
  ];

  return {
    elements: convertToExcalidrawElements(skeletonElements as any, {
      regenerateIds: true
    }) as unknown as CanvasContent["elements"],
    appState: {
      ...getCanvasRuntimeAppStateDefaults("#05070d"),
      scrollX: 578,
      scrollY: 260,
      zoom: {
        value: 0.88
      }
    }
  };
}

function createNote(input: {
  title: string;
  projectId: string;
  folderId: string;
  sortOrder: number;
  tagIds: string[];
  content: NoteContent;
  timestamp: number;
  pinned?: boolean;
  favorite?: boolean;
}): Note {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    contentType: "note",
    projectId: input.projectId,
    folderId: input.folderId,
    color: DEFAULT_NOTE_COLOR,
    sortOrder: input.sortOrder,
    tagIds: input.tagIds,
    content: input.content,
    canvasContent: null,
    excerpt: buildExcerpt(input.content),
    plainText: extractPlainText(input.content),
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    pinned: Boolean(input.pinned),
    favorite: Boolean(input.favorite),
    archived: false,
    trashedAt: null,
    syncState: "local",
    conflictOriginId: null
  };
}

function createCanvasNote(input: {
  title: string;
  projectId: string;
  folderId: string;
  sortOrder: number;
  tagIds: string[];
  canvasContent: CanvasContent;
  timestamp: number;
  favorite?: boolean;
}): Note {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    contentType: "canvas",
    projectId: input.projectId,
    folderId: input.folderId,
    color: DEFAULT_NOTE_COLOR,
    sortOrder: input.sortOrder,
    tagIds: input.tagIds,
    content: [],
    canvasContent: input.canvasContent,
    excerpt: buildCanvasExcerpt(input.canvasContent),
    plainText: extractCanvasPlainText(input.canvasContent),
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    pinned: false,
    favorite: Boolean(input.favorite),
    archived: false,
    trashedAt: null,
    syncState: "local",
    conflictOriginId: null
  };
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function atLocalTime(baseTimestamp: number, dayOffset: number, hours: number, minutes = 0) {
  const date = new Date(startOfDay(baseTimestamp) + dayOffset * DAY);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

function nextHalfHour(timestamp: number) {
  const date = new Date(timestamp);
  const minutes = date.getMinutes();
  const nextMinutes = minutes <= 30 ? 30 : 60;
  date.setMinutes(nextMinutes, 0, 0);
  return date.getTime();
}

function createTaskLink(input: {
  kind: TaskLink["kind"];
  label: string;
  projectId: string | null;
  folderId: string | null;
  noteId?: string | null;
  canvasId?: string | null;
  createdAt: number;
}): TaskLink {
  return {
    id: crypto.randomUUID(),
    kind: input.kind,
    label: input.label,
    projectId: input.projectId,
    folderId: input.folderId,
    noteId: input.noteId ?? null,
    canvasId: input.canvasId ?? null,
    sourceBlockId: null,
    canvasElementId: null,
    url: null,
    createdAt: input.createdAt
  };
}

function createTask(input: {
  title: string;
  description?: string;
  kind?: Task["kind"];
  status?: Task["status"];
  priority?: Task["priority"];
  projectId: string | null;
  folderId: string | null;
  noteId?: string | null;
  canvasId?: string | null;
  tagIds: string[];
  links?: TaskLink[];
  dueAt?: number | null;
  scheduledStartAt?: number | null;
  scheduledEndAt?: number | null;
  estimateMinutes?: number | null;
  sortOrder: number;
  timestamp: number;
}): Task {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description ?? "",
    kind: input.kind ?? "task",
    status: input.status ?? "todo",
    priority: input.priority ?? "none",
    projectId: input.projectId,
    folderId: input.folderId,
    noteId: input.noteId ?? null,
    canvasId: input.canvasId ?? null,
    sourceBlockId: null,
    canvasElementId: null,
    tagIds: input.tagIds,
    links: input.links ?? [],
    reminders: [],
    startAt: null,
    dueAt: input.dueAt ?? null,
    scheduledStartAt: input.scheduledStartAt ?? null,
    scheduledEndAt: input.scheduledEndAt ?? null,
    completedAt: null,
    canceledAt: null,
    recurrenceRule: null,
    recurrenceTimezone: null,
    recurrenceAnchorAt: null,
    recurrenceUntilAt: null,
    recurrenceExceptionDates: [],
    recurrenceCompletedDates: [],
    recurrenceOverrides: [],
    estimateMinutes: input.estimateMinutes ?? null,
    spentMinutes: 0,
    sortOrder: input.sortOrder,
    createdAt: input.timestamp,
    updatedAt: input.timestamp
  };
}

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function buildInitialDemoVault(
  language: AppLanguage,
  timestamp = Date.now()
): InitialDemoVaultSeed {
  const strings = DEMO_STRINGS[language];
  const project: Project = {
    id: crypto.randomUUID(),
    name: strings.projectName,
    color: DEFAULT_PROJECT_COLOR,
    x: 0,
    y: 0,
    sortOrder: sortOrder(1),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const folderEntries: Array<[DemoFolderKey, string]> = [
    ["start", strings.folders.start],
    ["notes", strings.folders.notes],
    ["canvases", strings.folders.canvases],
    ["planner", strings.folders.planner]
  ];
  const foldersByKey = new Map<DemoFolderKey, Folder>();
  const folders = folderEntries.map(([key, name], index) => {
    const folder: Folder = {
      id: crypto.randomUUID(),
      projectId: project.id,
      name,
      parentId: null,
      color: createColor(index),
      sortOrder: sortOrder(index + 1),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    foldersByKey.set(key, folder);
    return folder;
  });

  const tagEntries: Array<[DemoTagKey, string]> = [
    ["start", strings.tags.start],
    ["demo", strings.tags.demo],
    ["idea", strings.tags.idea],
    ["plan", strings.tags.plan],
    ["local", strings.tags.local]
  ];
  const tagsByKey = new Map<DemoTagKey, Tag>();
  const tags = tagEntries.map(([key, name], index) => {
    const tag: Tag = {
      id: crypto.randomUUID(),
      name,
      color: createColor(index + 2),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    tagsByKey.set(key, tag);
    return tag;
  });

  const startFolder = foldersByKey.get("start")!;
  const notesFolder = foldersByKey.get("notes")!;
  const canvasesFolder = foldersByKey.get("canvases")!;
  const plannerFolder = foldersByKey.get("planner")!;
  const startTag = tagsByKey.get("start")!;
  const demoTag = tagsByKey.get("demo")!;
  const ideaTag = tagsByKey.get("idea")!;
  const planTag = tagsByKey.get("plan")!;
  const localTag = tagsByKey.get("local")!;

  const welcomeNote = createNote({
    title: strings.notes.welcome,
    projectId: project.id,
    folderId: startFolder.id,
    sortOrder: sortOrder(1),
    tagIds: [startTag.id, demoTag.id, localTag.id],
    content: buildWelcomeContent(language, strings),
    timestamp,
    pinned: true
  });
  const editorNote = createNote({
    title: strings.notes.editor,
    projectId: project.id,
    folderId: notesFolder.id,
    sortOrder: sortOrder(2),
    tagIds: [demoTag.id, ideaTag.id],
    content: buildEditorDemoContent(language),
    timestamp,
    favorite: true
  });
  const vaultNote = createNote({
    title: strings.notes.vault,
    projectId: project.id,
    folderId: notesFolder.id,
    sortOrder: sortOrder(3),
    tagIds: [demoTag.id, localTag.id],
    content: buildVaultGuideContent(language),
    timestamp
  });
  const dailyReviewNote = createNote({
    title: strings.notes.dailyReview,
    projectId: project.id,
    folderId: plannerFolder.id,
    sortOrder: sortOrder(4),
    tagIds: [demoTag.id, planTag.id],
    content: buildDailyReviewContent(language),
    timestamp
  });
  const canvasContent = buildDemoCanvasContent(strings);
  const canvasNote = createCanvasNote({
    title: strings.notes.canvas,
    projectId: project.id,
    folderId: canvasesFolder.id,
    sortOrder: sortOrder(5),
    tagIds: [demoTag.id, ideaTag.id],
    canvasContent,
    timestamp,
    favorite: true
  });

  const focusStartAt = nextHalfHour(timestamp + HOUR);
  const readDemoTask = createTask({
    title: strings.planner.readDemo,
    projectId: project.id,
    folderId: startFolder.id,
    noteId: welcomeNote.id,
    tagIds: [startTag.id, demoTag.id],
    links: [
      createTaskLink({
        kind: "note",
        label: welcomeNote.title,
        projectId: project.id,
        folderId: startFolder.id,
        noteId: welcomeNote.id,
        createdAt: timestamp
      })
    ],
    dueAt: atLocalTime(timestamp, 0, 18),
    estimateMinutes: 15,
    sortOrder: sortOrder(1),
    timestamp
  });
  const firstNoteTask = createTask({
    title: strings.planner.firstNote,
    status: "inbox",
    priority: "medium",
    projectId: project.id,
    folderId: notesFolder.id,
    noteId: editorNote.id,
    tagIds: [demoTag.id, ideaTag.id],
    links: [
      createTaskLink({
        kind: "note",
        label: editorNote.title,
        projectId: project.id,
        folderId: notesFolder.id,
        noteId: editorNote.id,
        createdAt: timestamp
      })
    ],
    dueAt: atLocalTime(timestamp, 1, 12),
    estimateMinutes: 25,
    sortOrder: sortOrder(2),
    timestamp
  });
  const sketchCanvasTask = createTask({
    title: strings.planner.sketchCanvas,
    status: "scheduled",
    priority: "low",
    projectId: project.id,
    folderId: canvasesFolder.id,
    canvasId: canvasNote.id,
    tagIds: [demoTag.id, ideaTag.id],
    links: [
      createTaskLink({
        kind: "canvas",
        label: canvasNote.title,
        projectId: project.id,
        folderId: canvasesFolder.id,
        canvasId: canvasNote.id,
        createdAt: timestamp
      })
    ],
    dueAt: atLocalTime(timestamp, 1, 17),
    scheduledStartAt: atLocalTime(timestamp, 1, 10),
    scheduledEndAt: atLocalTime(timestamp, 1, 10, 45),
    estimateMinutes: 45,
    sortOrder: sortOrder(3),
    timestamp
  });
  const weeklyReviewTask = createTask({
    title: strings.planner.weeklyReview,
    kind: "milestone",
    priority: "medium",
    projectId: project.id,
    folderId: plannerFolder.id,
    noteId: dailyReviewNote.id,
    tagIds: [demoTag.id, planTag.id],
    dueAt: atLocalTime(timestamp, 6, 17),
    estimateMinutes: 30,
    sortOrder: sortOrder(4),
    timestamp
  });

  const habit: Habit = {
    id: crypto.randomUUID(),
    title: strings.planner.habitTitle,
    description: strings.planner.habitDescription,
    status: "active",
    projectId: project.id,
    noteId: dailyReviewNote.id,
    color: createColor(3),
    icon: "spark",
    frequencyRule: "FREQ=DAILY;INTERVAL=1",
    frequencyTimezone: getTimeZone(),
    targetCount: 1,
    targetUnit: strings.planner.habitUnit,
    targetPeriod: "day",
    reminders: [],
    sortOrder: sortOrder(1),
    createdAt: timestamp,
    updatedAt: timestamp,
    pausedAt: null,
    archivedAt: null,
    pauseRanges: []
  };
  const habitLogs: HabitLog[] = [
    {
      id: crypto.randomUUID(),
      habitId: habit.id,
      occurredAt: atLocalTime(timestamp, -1, 18, 30),
      value: 1,
      unit: strings.planner.habitUnit,
      note: strings.planner.habitLogNote,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
  const goals: Goal[] = [
    {
      id: crypto.randomUUID(),
      title: strings.planner.goalTitle,
      description: strings.planner.goalDescription,
      status: "active",
      projectId: project.id,
      parentGoalId: null,
      color: createColor(5),
      metricLabel: strings.planner.goalMetric,
      targetValue: 100,
      currentValue: 15,
      startAt: startOfDay(timestamp),
      dueAt: atLocalTime(timestamp, 30, 18),
      completedAt: null,
      sortOrder: sortOrder(1),
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
  const timeBlocks: TimeBlock[] = [
    {
      id: crypto.randomUUID(),
      title: strings.planner.focusBlock,
      description: strings.planner.focusBlockDescription,
      status: "planned",
      taskId: readDemoTask.id,
      projectId: project.id,
      noteId: welcomeNote.id,
      canvasId: null,
      startAt: focusStartAt,
      endAt: focusStartAt + 45 * 60 * 1000,
      actualStartAt: null,
      actualEndAt: null,
      color: createColor(2),
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
  readDemoTask.status = "scheduled";
  readDemoTask.scheduledStartAt = timeBlocks[0].startAt;
  readDemoTask.scheduledEndAt = timeBlocks[0].endAt;

  return {
    project,
    folders,
    tags,
    notes: [welcomeNote, editorNote, vaultNote, dailyReviewNote, canvasNote],
    tasks: [readDemoTask, firstNoteTask, sketchCanvasTask, weeklyReviewTask],
    habits: [habit],
    habitLogs,
    goals,
    timeBlocks,
    activeNoteId: welcomeNote.id
  };
}
