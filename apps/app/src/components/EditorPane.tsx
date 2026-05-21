import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import { en, ru } from "@blocknote/core/locales";
import {
  FilePanelController,
  FormattingToolbarController,
  LinkToolbarController,
  useCreateBlockNote
} from "@blocknote/react";
import { TextSelection } from "prosemirror-state";
import { useTranslation } from "react-i18next";

import "./EditorPane.css";
import ConfirmDialog from "./ConfirmDialog";
import EditorFormattingToolbar from "./EditorFormattingToolbar";
import FolderPicker from "./FolderPicker";
import NoteStaticPreview from "./NoteStaticPreview";
import TagInputField from "./TagInputField";
import { getDisplayNoteTitle } from "../lib/displayNames";
import { COLOR_PALETTE, DEFAULT_NOTE_COLOR } from "../lib/palette";
import { editorBlockNoteSchema } from "../lib/blocknoteSchema";
import {
  readPersistentString,
  writePersistentString
} from "../lib/persistentClientStorage";
import {
  flattenFolderOptions,
  formatTimestamp,
  extractPlainText,
  normalizeChecklistOrdering,
  normalizeNoteContent,
  seedChecklistStableOrderMap
} from "../lib/notes";
import {
  EDITOR_AI_OPEN_EVENT,
  generateGeminiMarkdown,
  generateGeminiStructuredEdit,
  readGeminiApiKey,
  readStoredGeminiModel,
  type GeminiAiAction,
  type GeminiAiScope,
  type GeminiCustomMode
} from "../lib/aiIntegration";
import {
  collectAiContentStats,
  sanitizeAiStructuredEditPayload,
  type AiContentStats
} from "../lib/aiEditorSchema";
import {
  openTextFileWithDialog,
  saveTextFileWithDialog
} from "../lib/nativeFileIntegration";
import type { AppLanguage, Folder, Note, NoteContent, SaveState, StoredBlock, Tag } from "../types";

type MarkdownStatus = "copied" | "exported" | "imported" | "error" | null;
type EditorTypographyMode = "focus" | "reading";
type PendingMarkdownImport = {
  fileName: string;
  markdown: string;
};
type AiPanelState = {
  scope: GeminiAiScope;
  status: "idle" | "generating" | "applying" | "error";
  customMode: GeminiCustomMode;
  customPrompt: string;
  targetLanguage: string;
  error: string | null;
  targetBlockIds: string[];
  sourceMarkdown: string;
  sourceBlocks: NoteContent;
  targetBlocks: NoteContent;
  inlineRange: AiInlineRange | null;
  anchor: {
    top: number;
    left: number;
    placement: "top" | "bottom" | "left" | "right";
  } | null;
};
type AiInlineRange = {
  from: number;
  to: number;
};
type AiPreviewApplyMode = "replaceBlocks" | "insertBlocks" | "replaceInline";
type AiPreviewState = {
  status: "idle" | "applying" | "error";
  action: GeminiAiAction;
  scope: GeminiAiScope;
  applyMode: AiPreviewApplyMode;
  summary: string;
  warnings: string[];
  beforeBlocks: NoteContent;
  afterBlocks: NoteContent;
  beforeStats: AiContentStats;
  afterStats: AiContentStats;
  targetBlockIds: string[];
  referenceBlockId: string | null;
  inlineRange: AiInlineRange | null;
  inlineText: string | null;
  error: string | null;
  fallbackUsed: boolean;
};

const EDITOR_TYPOGRAPHY_MODE_STORAGE_KEY = "zen:editor-typography-mode";
const EMPTY_INLINE_PASTE_TARGET_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem"
]);
const LIST_CONTINUATION_TARGET_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem"
]);
const LIST_CONTINUATION_INLINE_STYLE_KEYS = [
  "font",
  "textColor",
  "backgroundColor"
] as const;
const LIST_CONTINUATION_BLOCK_PROP_KEYS = [
  "textColor",
  "backgroundColor",
  "textAlignment"
] as const;
const FLOATING_MEDIA_BLOCK_TYPES = new Set(["image", "file", "audio", "video"]);
const FLOATING_MEDIA_POPOVER_SELECTOR =
  ".editor-floating-toolbar-popover, .bn-formatting-toolbar, .bn-form-popover, .bn-panel-popover, .bn-menu-dropdown";
const FLOATING_MEDIA_BLOCK_SELECTOR =
  "[data-file-block], .bn-block-content[data-content-type='image'], .bn-block-content[data-content-type='video'], .bn-block-content[data-content-type='audio'], .bn-block-content[data-content-type='file']";
const INLINE_AI_REPLACE_ACTIONS = new Set<GeminiAiAction>([
  "fix",
  "improve",
  "translate",
  "custom"
]);
const AI_PANEL_WIDTH = 420;
const AI_PANEL_HEIGHT = 324;
const AI_PANEL_GAP = 10;
const AI_PANEL_MARGIN = 12;

type BlockNoteEditorInstance = ReturnType<typeof useCreateBlockNote>;
type EmptyInlineBlockPasteTarget = {
  block: StoredBlock & { id: string };
  plainText: string;
};
type EmptyInlinePasteRestoreSnapshot = {
  block: StoredBlock & { id: string };
  path: number[];
};
type ListContinuationStyleSeed = {
  sourceBlockId: string;
  sourceBlockType: string;
  styles: Record<string, unknown>;
  props: Record<string, unknown>;
};
type FloatingMediaSelectionSnapshot = {
  blockId: string;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function AiSparkleGlyph() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        d="M12 2.75l1.48 4.22a4.16 4.16 0 0 0 2.55 2.55L20.25 11l-4.22 1.48a4.16 4.16 0 0 0-2.55 2.55L12 19.25l-1.48-4.22a4.16 4.16 0 0 0-2.55-2.55L3.75 11l4.22-1.48a4.16 4.16 0 0 0 2.55-2.55L12 2.75Z"
        fill="currentColor"
      />
      <path
        d="M19 16.75l.58 1.67 1.67.58-1.67.58L19 21.25l-.58-1.67-1.67-.58 1.67-.58.58-1.67ZM5.25 3.5l.82 2.18 2.18.82-2.18.82L5.25 9.5l-.82-2.18-2.18-.82 2.18-.82.82-2.18Z"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  );
}

function AiTextGlyph() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        d="M5 5.75h14M12 5.75v12.5M8.25 18.25h7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function AiCheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        d="m5 12.5 4.1 4.1L19.25 6.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function AiGlobeGlyph() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3.95 12h16.1M12 3.75c2.15 2.2 3.1 4.9 3.1 8.25s-.95 6.05-3.1 8.25C9.85 18.05 8.9 15.35 8.9 12S9.85 5.95 12 3.75Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.55"
      />
    </svg>
  );
}

function AiArrowGlyph() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        d="M5 12h13.25m0 0-5.1-5.1m5.1 5.1-5.1 5.1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        d="m7.25 7.25 9.5 9.5m0-9.5-9.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function shouldCarryStyleValue(value: unknown) {
  return value !== undefined && value !== null && value !== "" && value !== "default";
}

function pickListContinuationInlineStyles(styles: unknown) {
  const picked: Record<string, unknown> = {};

  if (!styles || typeof styles !== "object") {
    return picked;
  }

  const record = styles as Record<string, unknown>;

  LIST_CONTINUATION_INLINE_STYLE_KEYS.forEach((key) => {
    const value = record[key];

    if (shouldCarryStyleValue(value)) {
      picked[key] = value;
    }
  });

  return picked;
}

function pickListContinuationBlockProps(props: unknown) {
  const picked: Record<string, unknown> = {};

  if (!props || typeof props !== "object") {
    return picked;
  }

  const record = props as Record<string, unknown>;

  LIST_CONTINUATION_BLOCK_PROP_KEYS.forEach((key) => {
    const value = record[key];

    if (shouldCarryStyleValue(value) && !(key === "textAlignment" && value === "left")) {
      picked[key] = value;
    }
  });

  return picked;
}

function getTrailingInlineStyles(content: unknown) {
  let trailingStyles: Record<string, unknown> = {};

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      if (value.length > 0) {
        trailingStyles = {};
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    const record = value as Record<string, unknown>;

    if (Array.isArray(record.content)) {
      visit(record.content);
    }

    if (typeof record.text === "string" && record.text.length > 0) {
      trailingStyles = pickListContinuationInlineStyles(record.styles);
    }
  };

  visit(content);
  return trailingStyles;
}

function isEmptyInlineEditorContent(content: unknown) {
  if (typeof content === "string") {
    return content.length === 0;
  }

  if (!Array.isArray(content)) {
    return content == null;
  }

  return content.every((entry) => {
    if (typeof entry === "string") {
      return entry.length === 0;
    }

    if (!entry || typeof entry !== "object") {
      return true;
    }

    const text = (entry as Record<string, unknown>).text;
    return typeof text === "string" ? text.length === 0 : false;
  });
}

function isInlinePasteTargetBlock(editor: BlockNoteEditorInstance, block: StoredBlock) {
  const blockType = block.type ?? "paragraph";
  const blockSchema = editor.schema.blockSchema as Record<string, { content?: string }>;

  return (
    typeof block.id === "string" &&
    blockSchema[blockType]?.content === "inline" &&
    EMPTY_INLINE_PASTE_TARGET_TYPES.has(blockType) &&
    isEmptyInlineEditorContent(block.content)
  );
}

function getListContinuationStyleSeed(
  editor: BlockNoteEditorInstance
): ListContinuationStyleSeed | null {
  let currentBlock: StoredBlock;

  try {
    currentBlock = editor.getTextCursorPosition().block as unknown as StoredBlock;
  } catch {
    return null;
  }

  const blockType = currentBlock.type ?? "paragraph";

  if (
    !LIST_CONTINUATION_TARGET_TYPES.has(blockType) ||
    typeof currentBlock.id !== "string" ||
    isEmptyInlineEditorContent(currentBlock.content)
  ) {
    return null;
  }

  const styles = {
    ...getTrailingInlineStyles(currentBlock.content),
    ...pickListContinuationInlineStyles(editor.getActiveStyles())
  };
  const props = pickListContinuationBlockProps(currentBlock.props);

  if (Object.keys(styles).length === 0 && Object.keys(props).length === 0) {
    return null;
  }

  return {
    sourceBlockId: currentBlock.id,
    sourceBlockType: blockType,
    styles,
    props
  };
}

function applyListContinuationStyleSeed(
  editor: BlockNoteEditorInstance,
  seed: ListContinuationStyleSeed
) {
  let currentBlock: StoredBlock;

  try {
    currentBlock = editor.getTextCursorPosition().block as unknown as StoredBlock;
  } catch {
    return false;
  }

  const blockType = currentBlock.type ?? "paragraph";

  if (
    blockType !== seed.sourceBlockType ||
    typeof currentBlock.id !== "string" ||
    currentBlock.id === seed.sourceBlockId ||
    !isEmptyInlineEditorContent(currentBlock.content)
  ) {
    return false;
  }

  const hasProps = Object.keys(seed.props).length > 0;
  const hasStyles = Object.keys(seed.styles).length > 0;

  if (hasProps) {
    editor.updateBlock(currentBlock.id, {
      props: {
        ...(currentBlock.props ?? {}),
        ...seed.props
      }
    });
    editor.setTextCursorPosition(currentBlock.id, "end");
  }

  if (hasStyles) {
    editor.addStyles(seed.styles as any);
  }

  return hasProps || hasStyles;
}

function findBlockPath(blocks: StoredBlock[], blockId: string): number[] | null {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.id === blockId) {
      return [index];
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      const childPath = findBlockPath(block.children, blockId);

      if (childPath) {
        return [index, ...childPath];
      }
    }
  }

  return null;
}

function getEmptyInlineBlockPasteTarget(
  editor: BlockNoteEditorInstance,
  event: ClipboardEvent
): EmptyInlineBlockPasteTarget | null {
  const clipboardData = event.clipboardData;
  const plainText = clipboardData?.getData("text/plain") ?? "";

  if (!clipboardData || plainText.length === 0) {
    return null;
  }

  const clipboardTypes = Array.from(clipboardData.types);

  if (
    clipboardTypes.includes("Files") ||
    clipboardTypes.includes("blocknote/html") ||
    clipboardTypes.includes("text/markdown")
  ) {
    return null;
  }

  let currentBlock: StoredBlock;

  try {
    currentBlock = editor.getTextCursorPosition().block as unknown as StoredBlock;
  } catch {
    return null;
  }

  if (
    !isInlinePasteTargetBlock(editor, currentBlock) ||
    typeof currentBlock.id !== "string"
  ) {
    return null;
  }

  return {
    block: currentBlock as StoredBlock & { id: string },
    plainText
  };
}

function pasteTextIntoEmptyInlineBlock(
  editor: BlockNoteEditorInstance,
  event: ClipboardEvent
) {
  const pasteTarget = getEmptyInlineBlockPasteTarget(editor, event);

  if (!pasteTarget) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const activeStyles = editor.getActiveStyles();
  const content =
    Object.keys(activeStyles).length > 0
      ? [
          {
            type: "text" as const,
            text: pasteTarget.plainText,
            styles: activeStyles
          }
        ]
      : pasteTarget.plainText;

  editor.updateBlock(pasteTarget.block.id, {
    content
  });
  editor.setTextCursorPosition(pasteTarget.block.id, "end");
  return true;
}

function getCurrentEmptyInlinePasteRestoreSnapshot(
  editor: BlockNoteEditorInstance
): EmptyInlinePasteRestoreSnapshot | null {
  let currentBlock: StoredBlock;

  try {
    currentBlock = editor.getTextCursorPosition().block as unknown as StoredBlock;
  } catch {
    return null;
  }

  if (
    !isInlinePasteTargetBlock(editor, currentBlock) ||
    typeof currentBlock.id !== "string" ||
    (currentBlock.type ?? "paragraph") === "paragraph"
  ) {
    return null;
  }

  const path = findBlockPath(editor.document as unknown as StoredBlock[], currentBlock.id);

  if (!path) {
    return null;
  }

  return {
    block: currentBlock as StoredBlock & { id: string },
    path
  };
}

function getBlockAtPath(blocks: StoredBlock[], path: number[]) {
  let currentBlocks = blocks;
  let currentBlock: StoredBlock | null = null;

  for (const index of path) {
    currentBlock = currentBlocks[index] ?? null;

    if (!currentBlock) {
      return null;
    }

    currentBlocks = Array.isArray(currentBlock.children) ? currentBlock.children : [];
  }

  return currentBlock;
}

function restorePastedEmptyInlineBlockType(
  blocks: NoteContent,
  snapshot: EmptyInlinePasteRestoreSnapshot | null
) {
  if (!snapshot) {
    return {
      blocks,
      changed: false
    };
  }

  const restoreBlock = (block: StoredBlock): StoredBlock | null => {
    const targetType = snapshot.block.type ?? "paragraph";
    const sourceProps = snapshot.block.props ?? {};
    const currentProps = block.props ?? {};
    const typeMatches = (block.type ?? "paragraph") === targetType;
    const propsMatch = Object.entries(sourceProps).every(
      ([key, value]) => currentProps[key as keyof typeof currentProps] === value
    );

    if (typeMatches && propsMatch) {
      return null;
    }

    return {
      ...block,
      type: targetType,
      props: {
        ...currentProps,
        ...sourceProps
      }
    };
  };

  const restoreById = (entries: StoredBlock[]): StoredBlock[] | null => {
    let changed = false;
    const nextEntries = entries.map((block) => {
      if (block.id === snapshot.block.id) {
        const restoredBlock = restoreBlock(block);

        if (restoredBlock) {
          changed = true;
          return restoredBlock;
        }
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        const restoredChildren = restoreById(block.children);

        if (restoredChildren) {
          changed = true;
          return {
            ...block,
            children: restoredChildren
          };
        }
      }

      return block;
    });

    return changed ? nextEntries : null;
  };

  const restoredById = restoreById(blocks);

  if (restoredById) {
    return {
      blocks: restoredById,
      changed: true
    };
  }

  const blockAtOriginalPath = getBlockAtPath(blocks, snapshot.path);
  const restoredBlockAtPath = blockAtOriginalPath ? restoreBlock(blockAtOriginalPath) : null;

  if (!restoredBlockAtPath) {
    return {
      blocks,
      changed: false
    };
  }

  const restoreByPath = (entries: StoredBlock[], path: number[]): StoredBlock[] => {
    const [index, ...restPath] = path;

    return entries.map((block, currentIndex) => {
      if (currentIndex !== index) {
        return block;
      }

      if (restPath.length === 0) {
        return restoredBlockAtPath;
      }

      return {
        ...block,
        children: restoreByPath(Array.isArray(block.children) ? block.children : [], restPath)
      };
    });
  };

  return {
    blocks: restoreByPath(blocks, snapshot.path),
    changed: true
  };
}

interface EditorPaneProps {
  note: Note;
  folders: Folder[];
  tags: Tag[];
  language: AppLanguage;
  saveState: SaveState;
  onTitleChange: (title: string) => void;
  onFolderChange: (folderId: string | null) => void;
  onNoteColorChange: (color: string) => void;
  onTagIdsChange: (tagIds: string[]) => Promise<void> | void;
  onCreateTag: (name: string) => Promise<Tag>;
  onDelete: () => void;
  onRestore: () => void;
  onTogglePin: () => void;
  onContentChange: (content: NoteContent, state: SaveState) => void;
  onUploadFile: (file: File) => Promise<string>;
  onResolveFileUrl: (url: string) => Promise<string>;
  immersive?: boolean;
}

export default function EditorPane({
  note,
  folders,
  tags,
  language,
  saveState,
  onTitleChange,
  onFolderChange,
  onNoteColorChange,
  onTagIdsChange,
  onCreateTag,
  onDelete,
  onRestore,
  onTogglePin,
  onContentChange,
  onUploadFile,
  onResolveFileUrl,
  immersive = false
}: EditorPaneProps) {
  const { t } = useTranslation();
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [typographyMode, setTypographyMode] = useState<EditorTypographyMode>(() => {
    const storedMode = readPersistentString(EDITOR_TYPOGRAPHY_MODE_STORAGE_KEY);

    return storedMode === "reading" ? "reading" : "focus";
  });
  const [markdownStatus, setMarkdownStatus] = useState<MarkdownStatus>(null);
  const [pendingMarkdownImport, setPendingMarkdownImport] =
    useState<PendingMarkdownImport | null>(null);
  const [aiPanel, setAiPanel] = useState<AiPanelState | null>(null);
  const [aiPreview, setAiPreview] = useState<AiPreviewState | null>(null);
  const aiPanelRef = useRef<HTMLDivElement | null>(null);
  const titleTimeoutRef = useRef<number | null>(null);
  const contentTimeoutRef = useRef<number | null>(null);
  const markdownStatusTimeoutRef = useRef<number | null>(null);
  const isTitleFieldFocusedRef = useRef(false);
  const isApplyingChecklistTransformRef = useRef(false);
  const pendingEmptyInlinePasteRestoreRef =
    useRef<EmptyInlinePasteRestoreSnapshot | null>(null);
  const checklistStableOrderRef = useRef(new Map<string, number>());
  const floatingMediaSelectionRef = useRef<FloatingMediaSelectionSnapshot | null>(null);
  const floatingMediaSelectionGraceUntilRef = useRef(0);
  const latestTitleDraftRef = useRef(titleDraft);
  const latestStoredTitleRef = useRef(note.title);
  const latestEditorRef = useRef<ReturnType<typeof useCreateBlockNote> | null>(null);
  const latestOnContentChangeRef = useRef(onContentChange);
  const latestOnTitleChangeRef = useRef(onTitleChange);
  const folderOptions = useMemo(
    () => flattenFolderOptions(folders.filter((folder) => folder.projectId === note.projectId)),
    [folders, note.projectId]
  );
  const currentFolder = useMemo(
    () => folderOptions.find((folder) => folder.id === note.folderId) ?? null,
    [folderOptions, note.folderId]
  );
  const normalizedContent = useMemo(() => normalizeNoteContent(note.content), [note.content]);

  useEffect(() => {
    isTitleFieldFocusedRef.current = false;
    setTitleDraft(note.title);
  }, [note.id]);

  useEffect(() => {
    if (!isTitleFieldFocusedRef.current) {
      setTitleDraft(note.title);
    }
  }, [note.title]);

  useEffect(() => {
    setPendingMarkdownImport(null);
    setAiPanel(null);
    setAiPreview(null);
    checklistStableOrderRef.current = new Map();
  }, [note.id]);

  useEffect(() => {
    writePersistentString(EDITOR_TYPOGRAPHY_MODE_STORAGE_KEY, typographyMode);
  }, [typographyMode]);

  const editorDictionary = language === "ru" ? ru : en;

  const editor = useCreateBlockNote(
    {
      schema: editorBlockNoteSchema,
      initialContent: normalizedContent.length > 0 ? (normalizedContent as any) : undefined,
      animations: true,
      dictionary: {
        ...editorDictionary,
        placeholders: {
          ...editorDictionary.placeholders,
          emptyDocument: t("note.editorPlaceholder"),
          default: t("note.editorPlaceholder")
        }
      },
      tables: {
        splitCells: true,
        cellBackgroundColor: true,
        cellTextColor: true,
        headers: true
      },
      tabBehavior: "prefer-indent",
      uploadFile: onUploadFile,
      resolveFileUrl: onResolveFileUrl,
      pasteHandler: ({ event, editor, defaultPasteHandler }) => {
        if (pasteTextIntoEmptyInlineBlock(editor, event)) {
          return true;
        }

        return defaultPasteHandler();
      },
      domAttributes: {
        editor: {
          class: "zen-editor-surface"
        }
      }
    },
    [note.id, language]
  );

  const readActiveFloatingMediaBlock = (): FloatingMediaSelectionSnapshot | null => {
    try {
      const block = editor.getTextCursorPosition().block as StoredBlock & { id?: string };
      const blockId = typeof block.id === "string" ? block.id : null;
      const blockType = typeof block.type === "string" ? block.type : "";

      if (!blockId || !FLOATING_MEDIA_BLOCK_TYPES.has(blockType)) {
        return null;
      }

      return {
        blockId
      };
    } catch {
      return null;
    }
  };

  const rememberFloatingMediaSelection = () => {
    const mediaBlock = readActiveFloatingMediaBlock();

    if (mediaBlock) {
      floatingMediaSelectionRef.current = mediaBlock;
      floatingMediaSelectionGraceUntilRef.current = Date.now() + 3000;
      return;
    }

    if (Date.now() > floatingMediaSelectionGraceUntilRef.current) {
      floatingMediaSelectionRef.current = null;
    }
  };

  const restoreFloatingMediaSelection = () => {
    const snapshot = floatingMediaSelectionRef.current;

    if (!snapshot || Date.now() > floatingMediaSelectionGraceUntilRef.current) {
      return;
    }

    try {
      const activeMediaBlock = readActiveFloatingMediaBlock();

      if (activeMediaBlock?.blockId !== snapshot.blockId) {
        editor.setTextCursorPosition(snapshot.blockId);
      }

      editor.getExtension(FormattingToolbarExtension)?.store.setState(true);
      floatingMediaSelectionGraceUntilRef.current = Date.now() + 3000;
    } catch {
      floatingMediaSelectionRef.current = null;
    }
  };

  const preserveFloatingMediaSelection = (
    event?: ReactMouseEvent<HTMLDivElement> | ReactPointerEvent<HTMLDivElement>
  ) => {
    restoreFloatingMediaSelection();
    event?.preventDefault();
  };

  useEffect(() => {
    rememberFloatingMediaSelection();

    const unsubscribeSelection = editor.onSelectionChange(() => {
      rememberFloatingMediaSelection();
    });

    const handleFloatingPointerMove = (event: PointerEvent) => {
      if (!floatingMediaSelectionRef.current) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest(FLOATING_MEDIA_POPOVER_SELECTOR)) {
        restoreFloatingMediaSelection();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest(FLOATING_MEDIA_POPOVER_SELECTOR) ||
        target.closest(FLOATING_MEDIA_BLOCK_SELECTOR)
      ) {
        return;
      }

      floatingMediaSelectionRef.current = null;
      floatingMediaSelectionGraceUntilRef.current = 0;
    };

    window.addEventListener("pointermove", handleFloatingPointerMove, true);
    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      unsubscribeSelection();
      window.removeEventListener("pointermove", handleFloatingPointerMove, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [editor]);

  const buildAiPanelAnchor = (
    scope: GeminiAiScope,
    triggerRect?: DOMRect | null
  ): AiPanelState["anchor"] => {
    if (typeof window === "undefined") {
      return null;
    }

    const box = triggerRect ?? (scope === "selection" ? editor.getSelectionBoundingBox() : null);

    if (!box) {
      return null;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = Math.min(AI_PANEL_WIDTH, viewportWidth - AI_PANEL_MARGIN * 2);
    const panelHeight = Math.min(AI_PANEL_HEIGHT, viewportHeight - AI_PANEL_MARGIN * 2);
    const maxLeft = viewportWidth - panelWidth - AI_PANEL_MARGIN;
    const maxTop = viewportHeight - panelHeight - AI_PANEL_MARGIN;
    const centeredLeft = clampNumber(
      box.left + box.width / 2 - panelWidth / 2,
      AI_PANEL_MARGIN,
      Math.max(AI_PANEL_MARGIN, maxLeft)
    );
    const centeredTop = clampNumber(
      box.top + box.height / 2 - panelHeight / 2,
      AI_PANEL_MARGIN,
      Math.max(AI_PANEL_MARGIN, maxTop)
    );
    const spaces = {
      bottom: viewportHeight - box.bottom - AI_PANEL_GAP - AI_PANEL_MARGIN,
      top: box.top - AI_PANEL_GAP - AI_PANEL_MARGIN,
      right: viewportWidth - box.right - AI_PANEL_GAP - AI_PANEL_MARGIN,
      left: box.left - AI_PANEL_GAP - AI_PANEL_MARGIN
    };
    const preferredPlacements: Array<"top" | "bottom" | "left" | "right"> =
      triggerRect && scope === "note"
        ? ["bottom", "right", "left", "top"]
        : ["bottom", "top", "right", "left"];
    const placement =
      preferredPlacements.find((candidate) =>
        candidate === "top" || candidate === "bottom"
          ? spaces[candidate] >= panelHeight
          : spaces[candidate] >= panelWidth
      ) ??
      preferredPlacements.reduce((best, candidate) => {
        const bestSpace =
          best === "top" || best === "bottom" ? spaces[best] : spaces[best];
        const candidateSpace =
          candidate === "top" || candidate === "bottom" ? spaces[candidate] : spaces[candidate];

        return candidateSpace > bestSpace ? candidate : best;
      }, preferredPlacements[0]);

    if (placement === "top") {
      return {
        placement,
        top: clampNumber(box.top - panelHeight - AI_PANEL_GAP, AI_PANEL_MARGIN, maxTop),
        left: centeredLeft
      };
    }

    if (placement === "right") {
      return {
        placement,
        top: centeredTop,
        left: clampNumber(box.right + AI_PANEL_GAP, AI_PANEL_MARGIN, maxLeft)
      };
    }

    if (placement === "left") {
      return {
        placement,
        top: centeredTop,
        left: clampNumber(box.left - panelWidth - AI_PANEL_GAP, AI_PANEL_MARGIN, maxLeft)
      };
    }

    return {
      placement,
      top: clampNumber(box.bottom + AI_PANEL_GAP, AI_PANEL_MARGIN, maxTop),
      left: centeredLeft
    };
  };

  const cloneNoteContent = (blocks: NoteContent): NoteContent =>
    normalizeNoteContent(JSON.parse(JSON.stringify(blocks)) as NoteContent);

  const readEditorDocumentBlocks = () =>
    cloneNoteContent(editor.document as unknown as NoteContent);

  const createPlainPreviewBlocks = (text: string): NoteContent =>
    text.trim()
      ? [
          {
            id: crypto.randomUUID(),
            type: "paragraph",
            props: {},
            content: [
              {
                type: "text",
                text,
                styles: {}
              }
            ],
            children: []
          }
        ]
      : [];

  const getRootBlockIds = () =>
    (editor.document as unknown as StoredBlock[])
      .map((block) => block.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

  const getAiSourceSnapshot = (scope: GeminiAiScope) => {
    if (scope === "note") {
      const documentBlocks = readEditorDocumentBlocks();

      return {
        markdown: editor.blocksToMarkdownLossy(editor.document as any).trim(),
        targetBlockIds: documentBlocks
          .map((block) => block.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
        sourceBlocks: documentBlocks,
        targetBlocks: documentBlocks,
        inlineRange: null
      };
    }

    const selection = editor.getSelection();
    const selectedText = editor.getSelectedText().trim();
    const selectedBlocks = cloneNoteContent((selection?.blocks ?? []) as unknown as NoteContent);
    const targetBlockIds =
      selectedBlocks
        .map((block) => block.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0) ?? [];
    let sourceBlocks = selectedBlocks;
    let inlineRange: AiInlineRange | null = null;
    let markdown = selectedText;

    try {
      const cutSelection = editor.getSelectionCutBlocks(false);
      const cutBlocks = cloneNoteContent(cutSelection.blocks as unknown as NoteContent);
      const cutMarkdown = editor.blocksToMarkdownLossy(cutBlocks as any).trim();

      if (cutBlocks.length > 0) {
        sourceBlocks = cutBlocks;
      }

      if (
        selectedText &&
        selectedBlocks.length === 1 &&
        cutBlocks.length === 1 &&
        targetBlockIds.length <= 1 &&
        (cutSelection.blockCutAtStart || cutSelection.blockCutAtEnd)
      ) {
        inlineRange = {
          from: cutSelection._meta.startPos,
          to: cutSelection._meta.endPos
        };
      }

      if (cutMarkdown) {
        markdown = cutMarkdown;
      }
    } catch {
      markdown = selectedText;
    }

    return {
      markdown,
      targetBlockIds,
      sourceBlocks,
      targetBlocks: selectedBlocks,
      inlineRange
    };
  };

  const openAiPanel = (scope: GeminiAiScope, triggerRect?: DOMRect | null) => {
    const snapshot = getAiSourceSnapshot(scope);

    setAiPanel({
      scope,
      status: "idle",
      customMode: snapshot.markdown ? "edit" : "generate",
      customPrompt: "",
      targetLanguage: language === "ru" ? "английский" : "Russian",
      error: null,
      targetBlockIds: snapshot.targetBlockIds,
      sourceMarkdown: snapshot.markdown,
      sourceBlocks: snapshot.sourceBlocks,
      targetBlocks: snapshot.targetBlocks,
      inlineRange: snapshot.inlineRange,
      anchor: buildAiPanelAnchor(scope, triggerRect)
    });
  };

  useEffect(() => {
    const handleOpenAi = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: GeminiAiScope }>).detail;
      openAiPanel(detail?.scope === "selection" ? "selection" : "note");
    };

    window.addEventListener(EDITOR_AI_OPEN_EVENT, handleOpenAi);
    return () => window.removeEventListener(EDITOR_AI_OPEN_EVENT, handleOpenAi);
  });

  useEffect(() => {
    if (!aiPanel) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (target && aiPanelRef.current?.contains(target)) {
        return;
      }

      setAiPanel(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAiPanel(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [aiPanel]);

  useEffect(() => {
    if (!aiPreview) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && aiPreview.status !== "applying") {
        setAiPreview(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aiPreview]);

  const persistEditorDocument = (state: SaveState = "saved") => {
    const nextDocument = normalizeNoteContent(editor.document as unknown as NoteContent);

    seedChecklistStableOrderMap(nextDocument, checklistStableOrderRef.current);

    if (contentTimeoutRef.current) {
      window.clearTimeout(contentTimeoutRef.current);
      contentTimeoutRef.current = null;
    }

    onContentChange(nextDocument, state);
  };

  const getAiErrorMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? "");

    if (message === "GEMINI_API_KEY_MISSING") {
      return t("note.aiMissingKey");
    }

    if (message === "GEMINI_INPUT_EMPTY") {
      return t("note.aiEmptyInput");
    }

    if (
      message.includes("API key not valid") ||
      message.includes("API_KEY_INVALID") ||
      message.includes("PERMISSION_DENIED")
    ) {
      return t("note.aiInvalidKey");
    }

    if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
      return t("note.aiQuota");
    }

    return t("note.aiFailed");
  };

  const parseAiMarkdownToBlocks = async (markdown: string) => {
    const blocks = await Promise.resolve(editor.tryParseMarkdownToBlocks(markdown));

    if (!blocks.length) {
      throw new Error("GEMINI_EMPTY_RESPONSE");
    }

    return blocks as unknown as NoteContent;
  };

  const getAiInsertReferenceBlockId = (targetBlockIds: string[]) => {
    const targetBlockId = targetBlockIds.at(-1);

    if (targetBlockId) {
      return targetBlockId;
    }

    const documentBlocks = editor.document as unknown as StoredBlock[];
    const lastBlockId = documentBlocks.at(-1)?.id;

    return typeof lastBlockId === "string" ? lastBlockId : null;
  };

  const isFatalAiRequestError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? "");

    return (
      message === "GEMINI_API_KEY_MISSING" ||
      message === "GEMINI_INPUT_EMPTY" ||
      message.includes("API key not valid") ||
      message.includes("API_KEY_INVALID") ||
      message.includes("PERMISSION_DENIED") ||
      message.includes("RESOURCE_EXHAUSTED") ||
      message.toLowerCase().includes("quota")
    );
  };

  const openAiPreview = (
    panelState: AiPanelState,
    blocks: NoteContent,
    intent: "replace" | "insert",
    action: GeminiAiAction,
    summary: string,
    warnings: string[],
    fallbackUsed: boolean
  ) => {
    const canReplaceInline =
      intent === "replace" &&
      panelState.scope === "selection" &&
      Boolean(panelState.inlineRange) &&
      INLINE_AI_REPLACE_ACTIONS.has(action) &&
      panelState.targetBlockIds.length <= 1 &&
      blocks.length === 1;
    const inlineText = canReplaceInline ? extractPlainText(blocks).trim() : "";
    const shouldReplaceInline = canReplaceInline && inlineText.length > 0 && !inlineText.includes("\n");
    const applyMode: AiPreviewApplyMode =
      shouldReplaceInline ? "replaceInline" : intent === "insert" ? "insertBlocks" : "replaceBlocks";
    const beforeBlocks =
      applyMode === "replaceInline"
        ? createPlainPreviewBlocks(panelState.sourceMarkdown)
        : intent === "insert"
          ? []
          : panelState.targetBlocks.length > 0
            ? panelState.targetBlocks
            : panelState.sourceBlocks;
    const afterBlocks =
      applyMode === "replaceInline" && inlineText
        ? createPlainPreviewBlocks(inlineText)
        : blocks;

    setAiPreview({
      status: "idle",
      action,
      scope: panelState.scope,
      applyMode,
      summary: summary || t("note.aiPreviewSummaryDefault"),
      warnings,
      beforeBlocks,
      afterBlocks,
      beforeStats: collectAiContentStats(beforeBlocks),
      afterStats: collectAiContentStats(afterBlocks),
      targetBlockIds: panelState.targetBlockIds,
      referenceBlockId:
        applyMode === "insertBlocks" ? getAiInsertReferenceBlockId(panelState.targetBlockIds) : null,
      inlineRange: applyMode === "replaceInline" ? panelState.inlineRange : null,
      inlineText: applyMode === "replaceInline" ? inlineText : null,
      error: null,
      fallbackUsed
    });
    setAiPanel(null);
  };

  const applyAiPreviewResult = () => {
    const preview = aiPreview;

    if (!preview || preview.status === "applying") {
      return;
    }

    setAiPreview({
      ...preview,
      status: "applying",
      error: null
    });

    try {
      editor.focus();
      editor.transact((tr) => {
        if (preview.applyMode === "replaceInline") {
          if (!preview.inlineRange || !preview.inlineText) {
            throw new Error("GEMINI_EMPTY_RESPONSE");
          }

          tr.setSelection(
            TextSelection.create(tr.doc, preview.inlineRange.from, preview.inlineRange.to)
          );
          editor.insertInlineContent(preview.inlineText, {
            updateSelection: true
          });
          return;
        }

        if (preview.applyMode === "insertBlocks") {
          if (preview.referenceBlockId) {
            editor.insertBlocks(preview.afterBlocks as any, preview.referenceBlockId, "after");
          } else {
            editor.replaceBlocks(editor.document as any, preview.afterBlocks as any);
          }
          return;
        }

        const targetBlockIds =
          preview.targetBlockIds.length > 0 ? preview.targetBlockIds : getRootBlockIds();

        if (targetBlockIds.length > 0) {
          editor.replaceBlocks(targetBlockIds, preview.afterBlocks as any);
        } else {
          editor.replaceBlocks(editor.document as any, preview.afterBlocks as any);
        }
      });

      persistEditorDocument("saved");
      setAiPreview(null);
    } catch (error) {
      setAiPreview((previous) =>
        previous
          ? {
              ...previous,
              status: "error",
              error: getAiErrorMessage(error)
            }
          : previous
      );
    }
  };

  const handleRunAiAction = async (action: GeminiAiAction) => {
    const currentPanel = aiPanel;

    if (
      !currentPanel ||
      currentPanel.status === "generating" ||
      currentPanel.status === "applying"
    ) {
      return;
    }

    const customPrompt = currentPanel.customPrompt.trim();
    const targetLanguage = currentPanel.targetLanguage.trim();
    const customMode = currentPanel.customMode;
    const shouldGenerateNew = action === "custom" && customMode === "generate";

    if (action === "custom" && !customPrompt) {
      setAiPanel({
        ...currentPanel,
        status: "error",
        error: t("note.aiPromptRequired")
      });
      return;
    }

    if (action === "translate" && !targetLanguage) {
      setAiPanel({
        ...currentPanel,
        status: "error",
        error: t("note.aiTargetLanguageRequired")
      });
      return;
    }

    const snapshot =
      currentPanel.scope === "note"
        ? getAiSourceSnapshot("note")
        : {
            markdown: currentPanel.sourceMarkdown,
            targetBlockIds: currentPanel.targetBlockIds,
            sourceBlocks: currentPanel.sourceBlocks,
            targetBlocks: currentPanel.targetBlocks,
            inlineRange: currentPanel.inlineRange
          };

    if (!shouldGenerateNew && !snapshot.markdown.trim()) {
      setAiPanel({
        ...currentPanel,
        status: "error",
        error: t("note.aiEmptyInput")
      });
      return;
    }

    const nextPanelState = {
      ...currentPanel,
      status: "generating" as const,
      sourceMarkdown: snapshot.markdown,
      targetBlockIds: snapshot.targetBlockIds,
      sourceBlocks: snapshot.sourceBlocks,
      targetBlocks: snapshot.targetBlocks,
      inlineRange: snapshot.inlineRange,
      error: null
    };

    setAiPanel(nextPanelState);

    try {
      const apiKey = await readGeminiApiKey();
      const model = readStoredGeminiModel();
      const intent = shouldGenerateNew ? "insert" : "replace";
      let resultBlocks: NoteContent;
      let resultSummary = "";
      let resultWarnings: string[] = [];
      let fallbackUsed = false;

      try {
        const structuredPayload = await generateGeminiStructuredEdit({
          apiKey,
          model,
          action,
          scope: currentPanel.scope,
          markdown: snapshot.markdown,
          appLanguage: language,
          noteTitle: titleDraft.trim() || note.title,
          customPrompt,
          customMode,
          targetLanguage,
          editorBlocks: snapshot.sourceBlocks,
          intent
        });
        const sanitizedPayload = sanitizeAiStructuredEditPayload(structuredPayload, {
          fallbackSummary: t("note.aiPreviewSummaryDefault")
        });

        resultBlocks = sanitizedPayload.blocks;
        resultSummary = sanitizedPayload.summary;
        resultWarnings = sanitizedPayload.warnings;
      } catch (structuredError) {
        if (isFatalAiRequestError(structuredError)) {
          throw structuredError;
        }

        console.warn("Gemini structured editor output failed; falling back to Markdown.", structuredError);

        const resultMarkdown = await generateGeminiMarkdown({
          apiKey,
          model,
          action,
          scope: currentPanel.scope,
          markdown: snapshot.markdown,
          appLanguage: language,
          noteTitle: titleDraft.trim() || note.title,
          customPrompt,
          customMode,
          targetLanguage
        });

        resultBlocks = await parseAiMarkdownToBlocks(resultMarkdown);
        resultWarnings = [t("note.aiPreviewMarkdownFallback")];
        fallbackUsed = true;
      }

      openAiPreview(
        nextPanelState,
        resultBlocks,
        intent,
        action,
        resultSummary,
        resultWarnings,
        fallbackUsed
      );
    } catch (error) {
      setAiPanel((previous) =>
        previous
          ? {
              ...previous,
              status: "error",
              error: getAiErrorMessage(error)
            }
          : previous
      );
    }
  };

  useEffect(() => {
    latestTitleDraftRef.current = titleDraft;
  }, [titleDraft]);

  useEffect(() => {
    return editor.onBeforeChange(({ getChanges }) => {
      if (!getChanges().some((change) => change.source.type === "paste")) {
        return;
      }

      pendingEmptyInlinePasteRestoreRef.current =
        getCurrentEmptyInlinePasteRestoreSnapshot(editor);
    });
  }, [editor]);

  useEffect(() => {
    let cancelled = false;
    let removeEditorDomListeners: (() => void) | null = null;
    let animationFrameId: number | null = null;
    let styleContinuationFrameId: number | null = null;

    const handlePasteCapture = (event: ClipboardEvent) => {
      pasteTextIntoEmptyInlineBlock(editor, event);
    };

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key !== "Enter" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const styleSeed = getListContinuationStyleSeed(editor);

      if (!styleSeed) {
        return;
      }

      if (styleContinuationFrameId !== null) {
        window.cancelAnimationFrame(styleContinuationFrameId);
      }

      styleContinuationFrameId = window.requestAnimationFrame(() => {
        styleContinuationFrameId = null;

        if (!cancelled) {
          applyListContinuationStyleSeed(editor, styleSeed);
        }
      });
    };

    const attachPasteCaptureListener = () => {
      if (cancelled || removeEditorDomListeners) {
        return;
      }

      const editorElement = editor.domElement;

      if (!editorElement) {
        animationFrameId = window.requestAnimationFrame(attachPasteCaptureListener);
        return;
      }

      editorElement.addEventListener("paste", handlePasteCapture, {
        capture: true
      });
      editorElement.addEventListener("keydown", handleKeyDownCapture, {
        capture: true
      });
      removeEditorDomListeners = () => {
        editorElement.removeEventListener("paste", handlePasteCapture, {
          capture: true
        });
        editorElement.removeEventListener("keydown", handleKeyDownCapture, {
          capture: true
        });
      };
    };

    attachPasteCaptureListener();

    return () => {
      cancelled = true;

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (styleContinuationFrameId !== null) {
        window.cancelAnimationFrame(styleContinuationFrameId);
      }

      removeEditorDomListeners?.();
    };
  }, [editor]);

  useEffect(() => {
    latestStoredTitleRef.current = note.title;
  }, [note.title]);

  useEffect(() => {
    latestEditorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    latestOnContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  useEffect(() => {
    latestOnTitleChangeRef.current = onTitleChange;
  }, [onTitleChange]);

  const handleEditorChange = () => {
    if (isApplyingChecklistTransformRef.current) {
      isApplyingChecklistTransformRef.current = false;
      return;
    }

    const pasteRestore = restorePastedEmptyInlineBlockType(
      editor.document as unknown as NoteContent,
      pendingEmptyInlinePasteRestoreRef.current
    );
    pendingEmptyInlinePasteRestoreRef.current = null;
    const nextDocument = pasteRestore.changed
      ? pasteRestore.blocks
      : (editor.document as unknown as NoteContent);
    seedChecklistStableOrderMap(nextDocument, checklistStableOrderRef.current);
    const checklistNormalization = normalizeChecklistOrdering(nextDocument, (block, fallbackIndex) => {
      const blockId = typeof block.id === "string" ? block.id : null;

      if (!blockId) {
        return fallbackIndex;
      }

      const knownOrder = checklistStableOrderRef.current.get(blockId);

      if (typeof knownOrder === "number") {
        return knownOrder;
      }

      const assignedOrder = checklistStableOrderRef.current.size;
      checklistStableOrderRef.current.set(blockId, assignedOrder);
      return assignedOrder;
    });
    const contentToPersist = checklistNormalization.changed
      ? checklistNormalization.blocks
      : nextDocument;

    if (contentTimeoutRef.current) {
      window.clearTimeout(contentTimeoutRef.current);
    }

    if (pasteRestore.changed || checklistNormalization.changed) {
      isApplyingChecklistTransformRef.current = true;
      editor.replaceBlocks(editor.document as any, contentToPersist as any);
    }

    onContentChange(contentToPersist, "saving");

    contentTimeoutRef.current = window.setTimeout(() => {
      onContentChange(contentToPersist, "saved");
    }, 280);
  };

  const handleTitleChange = (value: string) => {
    setTitleDraft(value);

    if (titleTimeoutRef.current) {
      window.clearTimeout(titleTimeoutRef.current);
    }

    titleTimeoutRef.current = window.setTimeout(() => {
      onTitleChange(value.trim());
      titleTimeoutRef.current = null;
    }, 220);
  };

  const flushTitleDraft = () => {
    if (titleTimeoutRef.current) {
      window.clearTimeout(titleTimeoutRef.current);
      titleTimeoutRef.current = null;
    }

    const normalizedTitle = latestTitleDraftRef.current.trim();

    if (normalizedTitle !== latestStoredTitleRef.current.trim()) {
      latestOnTitleChangeRef.current(normalizedTitle);
    }
  };

  const showMarkdownStatus = (status: Exclude<MarkdownStatus, null>) => {
    setMarkdownStatus(status);

    if (markdownStatusTimeoutRef.current) {
      window.clearTimeout(markdownStatusTimeoutRef.current);
    }

    markdownStatusTimeoutRef.current = window.setTimeout(() => {
      setMarkdownStatus(null);
      markdownStatusTimeoutRef.current = null;
    }, 2400);
  };

  const getMarkdown = () => editor.blocksToMarkdownLossy(editor.document as any);

  const getMarkdownFilename = () => {
    const safeTitle = getDisplayNoteTitle(
      {
        title: titleDraft.trim() || note.title,
        plainText: note.plainText,
        excerpt: note.excerpt
      },
      language
    )
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

    return `${safeTitle || "note"}.md`;
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(getMarkdown());
      showMarkdownStatus("copied");
    } catch {
      showMarkdownStatus("error");
    }
  };

  const handleExportMarkdown = async () => {
    try {
      const didSave = await saveTextFileWithDialog({
        defaultPath: getMarkdownFilename(),
        filters: [
          {
            name: "Markdown",
            extensions: ["md", "markdown"]
          }
        ],
        content: getMarkdown(),
        preferredExtension: "md"
      });

      if (!didSave) {
        return;
      }

      showMarkdownStatus("exported");
    } catch {
      showMarkdownStatus("error");
    }
  };

  const applyMarkdownImport = async (markdown: string) => {
    try {
      const blocks = await Promise.resolve(editor.tryParseMarkdownToBlocks(markdown));

      editor.replaceBlocks(editor.document as any, blocks as any);
      onContentChange(blocks as unknown as NoteContent, "saved");
      setPendingMarkdownImport(null);
      showMarkdownStatus("imported");
    } catch {
      showMarkdownStatus("error");
    }
  };

  const handleImportMarkdown = async () => {
    const importedFile = await openTextFileWithDialog({
      filters: [
        {
          name: "Markdown",
          extensions: ["md", "markdown", "txt"]
        }
      ]
    });

    if (!importedFile) {
      return;
    }

    try {
      const { fileName, text } = importedFile;

      if (getMarkdown().trim().length > 0) {
        setPendingMarkdownImport({ fileName, markdown: text });
        return;
      }

      await applyMarkdownImport(text);
    } catch {
      showMarkdownStatus("error");
    }
  };

  useEffect(() => {
    return () => {
      if (titleTimeoutRef.current) {
        window.clearTimeout(titleTimeoutRef.current);
      }

      if (contentTimeoutRef.current) {
        window.clearTimeout(contentTimeoutRef.current);
        if (latestEditorRef.current) {
          latestOnContentChangeRef.current(
            latestEditorRef.current.document as unknown as NoteContent,
            "saved"
          );
        }
      }

      if (markdownStatusTimeoutRef.current) {
        window.clearTimeout(markdownStatusTimeoutRef.current);
      }

      if (latestTitleDraftRef.current !== latestStoredTitleRef.current) {
        latestOnTitleChangeRef.current(latestTitleDraftRef.current.trim());
      }
    };
  }, []);

  const aiPanelBusy = aiPanel?.status === "generating" || aiPanel?.status === "applying";

  return (
    <section
      className={`editor-pane ${immersive ? "is-immersive" : ""} ${
        typographyMode === "reading" ? "is-reading" : ""
      }`}
      style={{ "--note-accent": note.color || DEFAULT_NOTE_COLOR } as CSSProperties}
    >
      <div className="editor-pane-toolbar">
        <div className="editor-pane-toolbar-main">
          <div className="editor-pane-title-stack">
            <input
              value={titleDraft}
              onChange={(event) => handleTitleChange(event.target.value)}
              onFocus={() => {
                isTitleFieldFocusedRef.current = true;
              }}
              onBlur={() => {
                isTitleFieldFocusedRef.current = false;
                flushTitleDraft();
              }}
              className="note-title-input editor-pane-title-field"
              placeholder={t("note.titlePlaceholder")}
            />

            <div className="editor-pane-toolbar-meta">
              <div
                className="editor-pane-typography-switch"
                role="group"
                aria-label={t("note.typographyMode")}
              >
                <button
                  type="button"
                  className={`editor-pane-typography-option ${
                    typographyMode === "focus" ? "is-active" : ""
                  }`}
                  aria-pressed={typographyMode === "focus"}
                  onClick={() => setTypographyMode("focus")}
                >
                  {t("note.typographyFocus")}
                </button>
                <button
                  type="button"
                  className={`editor-pane-typography-option ${
                    typographyMode === "reading" ? "is-active" : ""
                  }`}
                  aria-pressed={typographyMode === "reading"}
                  onClick={() => setTypographyMode("reading")}
                >
                  {t("note.typographyReading")}
                </button>
              </div>
              <span className={`editor-pane-chip editor-pane-save-pill is-${saveState}`}>
                {t(`saveState.${saveState}`)}
              </span>
              <span className="editor-pane-chip">
                {currentFolder?.name ?? t("orbit.uncategorized")}
              </span>
              {note.tagIds.length > 0 ? (
                <span className="editor-pane-chip">
                  {note.tagIds.length} {t("note.tags").toLowerCase()}
                </span>
              ) : null}
              {note.pinned || note.favorite ? (
                <span className="editor-pane-chip is-warm">{t("note.pinnedActive")}</span>
              ) : null}
              <span className="editor-pane-contextmeta">
                {t("note.updated")}: {formatTimestamp(note.updatedAt, language)}
              </span>
              <button
                type="button"
                className="editor-pane-ai-trigger"
                onClick={(event) =>
                  openAiPanel("note", event.currentTarget.getBoundingClientRect())
                }
                aria-label={t("note.aiNote")}
                title={t("note.aiNote")}
              >
                <span className="editor-pane-ai-trigger-glyph" aria-hidden="true">
                  <AiSparkleGlyph />
                </span>
                <span>{t("note.aiShort")}</span>
              </button>
            </div>
          </div>

          <div className="editor-pane-markdown-actions" aria-label={t("note.markdownActions")}>
            <button type="button" className="editor-pane-ghost-action" onClick={handleCopyMarkdown}>
              {t("note.copyMarkdown")}
            </button>
            <button
              type="button"
              className="editor-pane-ghost-action"
              onClick={() => void handleExportMarkdown()}
            >
              {t("note.exportMarkdown")}
            </button>
            <button
              type="button"
              className="editor-pane-ghost-action"
              onClick={() => void handleImportMarkdown()}
            >
              {t("note.importMarkdown")}
            </button>
            {markdownStatus ? (
              <span className={`editor-pane-markdown-status is-${markdownStatus}`}>
                {t(`note.markdownStatus.${markdownStatus}`)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingMarkdownImport)}
        kicker={t("note.importMarkdown")}
        title={t("note.importMarkdownTitle")}
        message={
          pendingMarkdownImport
            ? t("note.importMarkdownMessage", {
                fileName: pendingMarkdownImport.fileName
              })
            : ""
        }
        confirmLabel={t("note.replaceWithMarkdown")}
        cancelLabel={t("dialog.cancel")}
        onCancel={() => setPendingMarkdownImport(null)}
        onConfirm={() => {
          if (!pendingMarkdownImport) {
            return;
          }

          void applyMarkdownImport(pendingMarkdownImport.markdown);
        }}
      />

      {aiPreview ? (
        <div className="editor-ai-preview-layer" role="presentation">
          <button
            type="button"
            className="editor-ai-preview-backdrop"
            aria-label={t("note.aiPreviewCancel")}
            onClick={() => {
              if (aiPreview.status !== "applying") {
                setAiPreview(null);
              }
            }}
          />
          <section
            className="editor-ai-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-ai-preview-title"
          >
            <header className="editor-ai-preview-header">
              <div>
                <p className="editor-ai-preview-kicker">{t("note.aiPreviewKicker")}</p>
                <h3 id="editor-ai-preview-title">{t("note.aiPreviewTitle")}</h3>
                <p>{aiPreview.summary}</p>
              </div>
              <button
                type="button"
                className="editor-ai-preview-close"
                onClick={() => setAiPreview(null)}
                disabled={aiPreview.status === "applying"}
                aria-label={t("note.aiClose")}
              >
                <CloseGlyph />
              </button>
            </header>

            <div className="editor-ai-preview-meta">
              <span>
                {aiPreview.applyMode === "insertBlocks"
                  ? t("note.aiPreviewInsertMode")
                  : aiPreview.applyMode === "replaceInline"
                    ? t("note.aiPreviewInlineMode")
                    : t("note.aiPreviewReplaceMode")}
              </span>
              <span>
                {t("note.aiPreviewStats", {
                  beforeBlocks: aiPreview.beforeStats.blocks,
                  afterBlocks: aiPreview.afterStats.blocks,
                  beforeWords: aiPreview.beforeStats.words,
                  afterWords: aiPreview.afterStats.words
                })}
              </span>
              {aiPreview.fallbackUsed ? <span>{t("note.aiPreviewFallbackBadge")}</span> : null}
            </div>

            {aiPreview.warnings.length > 0 ? (
              <div className="editor-ai-preview-warnings">
                {aiPreview.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
            ) : null}

            <div className="editor-ai-preview-grid">
              <section className="editor-ai-preview-card">
                <div className="editor-ai-preview-card-title">
                  <span>{t("note.aiPreviewBefore")}</span>
                  <span>{t("note.aiPreviewBlocksCount", { count: aiPreview.beforeStats.blocks })}</span>
                </div>
                <div className="editor-ai-preview-scroll">
                  <NoteStaticPreview
                    content={aiPreview.beforeBlocks}
                    emptyLabel={t("note.aiPreviewEmptyBefore")}
                    resolveFileUrl={onResolveFileUrl}
                    compact
                  />
                </div>
              </section>

              <section className="editor-ai-preview-card is-after">
                <div className="editor-ai-preview-card-title">
                  <span>{t("note.aiPreviewAfter")}</span>
                  <span>{t("note.aiPreviewBlocksCount", { count: aiPreview.afterStats.blocks })}</span>
                </div>
                <div className="editor-ai-preview-scroll">
                  <NoteStaticPreview
                    content={aiPreview.afterBlocks}
                    emptyLabel={t("note.aiPreviewEmptyAfter")}
                    resolveFileUrl={onResolveFileUrl}
                    compact
                  />
                </div>
              </section>
            </div>

            {aiPreview.error ? (
              <p className="editor-ai-preview-message is-error">{aiPreview.error}</p>
            ) : null}

            <footer className="editor-ai-preview-footer">
              <button
                type="button"
                className="editor-ai-preview-secondary"
                onClick={() => setAiPreview(null)}
                disabled={aiPreview.status === "applying"}
              >
                {t("note.aiPreviewCancel")}
              </button>
              <button
                type="button"
                className="editor-ai-preview-primary"
                onClick={applyAiPreviewResult}
                disabled={aiPreview.status === "applying"}
              >
                {aiPreview.status === "applying" ? t("note.aiApplying") : t("note.aiPreviewApply")}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {aiPanel ? (
        <div
          ref={aiPanelRef}
          className={`editor-ai-panel ${aiPanel.anchor ? "is-floating" : "is-docked"} is-${
            aiPanel.scope
          } is-${aiPanel.anchor?.placement ?? "bottom"}`}
          style={
            aiPanel.anchor
              ? ({
                  top: aiPanel.anchor.top,
                  left: aiPanel.anchor.left
                } as CSSProperties)
              : undefined
          }
        >
          <div className="editor-ai-prompt-card">
            <span className="editor-ai-prompt-icon" aria-hidden="true">
              <AiSparkleGlyph />
            </span>
            <textarea
              value={aiPanel.customPrompt}
              onChange={(event) =>
                setAiPanel((previous) =>
                  previous
                    ? {
                        ...previous,
                        customPrompt: event.target.value,
                        error: null
                      }
                    : previous
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleRunAiAction("custom");
                }
              }}
              placeholder={t("note.aiPromptPlaceholder")}
              aria-label={t("note.aiCustomPrompt")}
              rows={1}
              disabled={aiPanelBusy}
            />
            <button
              type="button"
              className="editor-ai-prompt-run"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void handleRunAiAction("custom")}
              disabled={aiPanelBusy}
              aria-label={t("note.aiRun")}
              title={t("note.aiRun")}
            >
              <AiArrowGlyph />
            </button>
          </div>

          <div className="editor-ai-command-card">
            <div
              className="editor-ai-mode-switch"
              role="group"
              aria-label={t("note.aiModeLabel")}
            >
              <button
                type="button"
                className={`editor-ai-mode-pill ${
                  aiPanel.customMode === "edit" ? "is-active" : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  setAiPanel((previous) =>
                    previous
                      ? {
                          ...previous,
                          customMode: "edit",
                          error: null
                        }
                      : previous
                  )
                }
                disabled={aiPanelBusy}
              >
                {t("note.aiModeEdit")}
              </button>
              <button
                type="button"
                className={`editor-ai-mode-pill ${
                  aiPanel.customMode === "generate" ? "is-active" : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  setAiPanel((previous) =>
                    previous
                      ? {
                          ...previous,
                          customMode: "generate",
                          error: null
                        }
                      : previous
                  )
                }
                disabled={aiPanelBusy}
              >
                {t("note.aiModeGenerate")}
              </button>
            </div>

            <div className="editor-ai-command-list">
              <button
                type="button"
                className="editor-ai-command-row"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleRunAiAction("beautify")}
                disabled={aiPanelBusy}
              >
                <span className="editor-ai-command-icon" aria-hidden="true">
                  <AiSparkleGlyph />
                </span>
                <span>{t("note.aiBeautify")}</span>
              </button>
              <button
                type="button"
                className="editor-ai-command-row"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleRunAiAction("improve")}
                disabled={aiPanelBusy}
              >
                <span className="editor-ai-command-icon" aria-hidden="true">
                  <AiTextGlyph />
                </span>
                <span>{t("note.aiImprove")}</span>
              </button>
              <button
                type="button"
                className="editor-ai-command-row"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleRunAiAction("fix")}
                disabled={aiPanelBusy}
              >
                <span className="editor-ai-command-icon" aria-hidden="true">
                  <AiCheckGlyph />
                </span>
                <span>{t("note.aiFix")}</span>
              </button>
              <div className="editor-ai-command-row editor-ai-translate-row">
                <button
                  type="button"
                  className="editor-ai-command-main"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void handleRunAiAction("translate")}
                  disabled={aiPanelBusy}
                >
                  <span className="editor-ai-command-icon" aria-hidden="true">
                    <AiGlobeGlyph />
                  </span>
                  <span>{t("note.aiTranslate")}</span>
                </button>
                <input
                  type="text"
                  value={aiPanel.targetLanguage}
                  onChange={(event) =>
                    setAiPanel((previous) =>
                      previous
                        ? {
                            ...previous,
                            targetLanguage: event.target.value,
                            error: null
                          }
                        : previous
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleRunAiAction("translate");
                    }
                  }}
                  placeholder={t("note.aiTargetLanguagePlaceholder")}
                  disabled={aiPanelBusy}
                />
              </div>
            </div>

            {aiPanel.status === "generating" ? (
              <p className="editor-ai-message is-muted">{t("note.aiGenerating")}</p>
            ) : null}
            {aiPanel.status === "applying" ? (
              <p className="editor-ai-message is-muted">{t("note.aiApplying")}</p>
            ) : null}
            {aiPanel.error ? (
              <p className="editor-ai-message is-error">{aiPanel.error}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="editor-pane-shell">
        <div className="editor-stage-column">
          <div className="editor-stage-frame">
            <div className="editor-stage-shell">
              <BlockNoteView
                editor={editor}
                theme="dark"
                onChange={handleEditorChange}
                formattingToolbar={false}
                linkToolbar={false}
                slashMenu
                sideMenu
                filePanel={false}
                tableHandles
                emojiPicker
                comments={false}
              >
                <FormattingToolbarController
                  formattingToolbar={EditorFormattingToolbar}
                  floatingUIOptions={{
                    useFloatingOptions: {
                      strategy: "fixed"
                    },
                    elementProps: {
                      className: "editor-floating-toolbar-popover",
                      style: {
                        zIndex: 60
                      },
                      onPointerEnter: () => {
                        restoreFloatingMediaSelection();
                      },
                      onPointerMove: () => {
                        restoreFloatingMediaSelection();
                      },
                      onPointerDownCapture: (event) => {
                        preserveFloatingMediaSelection(event);
                      },
                      onMouseDown: (event) => {
                        preserveFloatingMediaSelection(event);
                      }
                    }
                  }}
                />
                <LinkToolbarController
                  floatingUIOptions={{
                    useFloatingOptions: {
                      strategy: "fixed"
                    },
                    elementProps: {
                      style: {
                        zIndex: 62
                      },
                      onPointerDown: (event) => {
                        event.stopPropagation();
                      }
                    }
                  }}
                />
                <FilePanelController
                  floatingUIOptions={{
                    useFloatingOptions: {
                      strategy: "fixed"
                    },
                    elementProps: {
                      style: {
                        zIndex: 64
                      },
                      onPointerDown: (event) => {
                        event.stopPropagation();
                      }
                    }
                  }}
                />
              </BlockNoteView>
            </div>
          </div>
        </div>

        <aside className="editor-sidepanel">
          <section className="editor-pane-detail-card">
            <div className="editor-pane-detail-field">
              <span className="editor-pane-detail-label">{t("note.folder")}</span>
              <FolderPicker
                options={folderOptions}
                value={note.folderId}
                emptyLabel={t("orbit.uncategorized")}
                ariaLabel={t("note.folder")}
                onChange={onFolderChange}
              />
            </div>

            <div className="editor-pane-detail-field">
              <span className="editor-pane-detail-label">{t("note.tags")}</span>
              <TagInputField
                tags={tags}
                selectedTagIds={note.tagIds}
                language={language}
                onChangeTagIds={onTagIdsChange}
                onCreateTag={onCreateTag}
              />
            </div>

            <div className="editor-pane-detail-field">
              <span className="editor-pane-detail-label">{t("note.color")}</span>
              <div className="color-swatch-grid compact editor-pane-color-grid">
                {COLOR_PALETTE.map((colorOption) => (
                  <button
                    type="button"
                    key={colorOption.id}
                    className={`color-swatch compact ${note.color === colorOption.hex ? "is-active" : ""}`}
                    onClick={() => onNoteColorChange(colorOption.hex)}
                    style={{ "--swatch-color": colorOption.hex } as CSSProperties}
                    aria-label={`${t("note.color")}: ${t(colorOption.labelKey)}`}
                    title={t(colorOption.labelKey)}
                  >
                    <span className="color-swatch-fill" />
                  </button>
                ))}
              </div>
              <label className="orbital-custom-color-picker editor-pane-custom-color-picker">
                <span className="orbital-color-label">{t("orbit.customColor")}</span>
                <span className="orbital-custom-color-control">
                  <input
                    type="color"
                    className="orbital-custom-color-input"
                    value={note.color || DEFAULT_NOTE_COLOR}
                    onChange={(event) => onNoteColorChange(event.target.value)}
                    aria-label={t("orbit.customColor")}
                  />
                  <span className="orbital-custom-color-value">
                    {(note.color || DEFAULT_NOTE_COLOR).toUpperCase()}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="editor-pane-detail-card editor-pane-detail-card-actions">
            <div className="editor-pane-action-grid">
              <button
                type="button"
                className={`micro-action ${note.pinned || note.favorite ? "is-active" : ""}`}
                onClick={onTogglePin}
              >
                {note.pinned || note.favorite ? t("note.unpin") : t("note.pin")}
              </button>
              {note.trashedAt ? (
                <button type="button" className="micro-action" onClick={onRestore}>
                  {t("note.restore")}
                </button>
              ) : null}
              <button type="button" className="micro-action danger" onClick={onDelete}>
                {note.trashedAt ? t("note.deletePermanently") : t("note.moveToTrash")}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
