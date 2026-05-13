import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { en, ru } from "@blocknote/core/locales";
import {
  FormattingToolbarController,
  LinkToolbarController,
  useCreateBlockNote
} from "@blocknote/react";
import { useTranslation } from "react-i18next";

import "./EditorPane.css";
import ConfirmDialog from "./ConfirmDialog";
import EditorFormattingToolbar from "./EditorFormattingToolbar";
import FolderPicker from "./FolderPicker";
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
  normalizeChecklistOrdering,
  normalizeNoteContent,
  seedChecklistStableOrderMap
} from "../lib/notes";
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
  const titleTimeoutRef = useRef<number | null>(null);
  const contentTimeoutRef = useRef<number | null>(null);
  const markdownStatusTimeoutRef = useRef<number | null>(null);
  const isApplyingChecklistTransformRef = useRef(false);
  const pendingEmptyInlinePasteRestoreRef =
    useRef<EmptyInlinePasteRestoreSnapshot | null>(null);
  const checklistStableOrderRef = useRef(new Map<string, number>());
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
    setTitleDraft(note.title);
  }, [note.id, note.title]);

  useEffect(() => {
    setPendingMarkdownImport(null);
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
    }, 220);
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
                filePanel
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
                      style: {
                        zIndex: 60
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
