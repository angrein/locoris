import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

function resolveManualChunk(id: string) {
  const normalizedId = id.replaceAll("\\", "/");
  const hasPackage = (packageName: string) =>
    normalizedId.includes(`/node_modules/${packageName}/`);

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  if (
    hasPackage("@blocknote/core") ||
    hasPackage("@blocknote/mantine") ||
    hasPackage("@blocknote/react")
  ) {
    return "vendor-blocknote";
  }

  if (
    hasPackage("@tiptap/core") ||
    hasPackage("@tiptap/extension-bold") ||
    hasPackage("@tiptap/extension-code") ||
    hasPackage("@tiptap/extension-code-block") ||
    hasPackage("@tiptap/extension-collaboration") ||
    hasPackage("@tiptap/extension-collaboration-cursor") ||
    hasPackage("@tiptap/extension-color") ||
    hasPackage("@tiptap/extension-gapcursor") ||
    hasPackage("@tiptap/extension-highlight") ||
    hasPackage("@tiptap/extension-history") ||
    hasPackage("@tiptap/extension-horizontal-rule") ||
    hasPackage("@tiptap/extension-italic") ||
    hasPackage("@tiptap/extension-link") ||
    hasPackage("@tiptap/extension-strike") ||
    hasPackage("@tiptap/extension-table") ||
    hasPackage("@tiptap/extension-table-cell") ||
    hasPackage("@tiptap/extension-table-header") ||
    hasPackage("@tiptap/extension-table-row") ||
    hasPackage("@tiptap/extension-text-align") ||
    hasPackage("@tiptap/extension-text-style") ||
    hasPackage("@tiptap/extension-underline") ||
    hasPackage("@tiptap/pm") ||
    hasPackage("@tiptap/react") ||
    hasPackage("@tiptap/starter-kit") ||
    hasPackage("hast-util-from-dom") ||
    hasPackage("prosemirror-changeset") ||
    hasPackage("prosemirror-commands") ||
    hasPackage("prosemirror-dropcursor") ||
    hasPackage("prosemirror-gapcursor") ||
    hasPackage("prosemirror-history") ||
    hasPackage("prosemirror-keymap") ||
    hasPackage("prosemirror-model") ||
    hasPackage("prosemirror-schema-list") ||
    hasPackage("prosemirror-state") ||
    hasPackage("prosemirror-tables") ||
    hasPackage("prosemirror-transform") ||
    hasPackage("prosemirror-view") ||
    hasPackage("rehype-parse") ||
    hasPackage("rehype-remark") ||
    hasPackage("remark-gfm") ||
    hasPackage("remark-parse") ||
    hasPackage("remark-stringify") ||
    hasPackage("unified") ||
    hasPackage("y-prosemirror") ||
    hasPackage("yjs")
  ) {
    return "vendor-editor";
  }

  if (
    hasPackage("@mantine/core") ||
    hasPackage("@mantine/hooks") ||
    hasPackage("@floating-ui/core") ||
    hasPackage("@floating-ui/dom") ||
    hasPackage("@floating-ui/react") ||
    hasPackage("@floating-ui/react-dom") ||
    hasPackage("@floating-ui/utils") ||
    hasPackage("@emotion/cache") ||
    hasPackage("@emotion/react") ||
    hasPackage("@emotion/serialize") ||
    hasPackage("@emotion/sheet") ||
    hasPackage("@emotion/utils") ||
    hasPackage("@emotion/weak-memoize")
  ) {
    return "vendor-ui";
  }

  if (
    hasPackage("react") ||
    hasPackage("react-dom") ||
    hasPackage("scheduler") ||
    hasPackage("use-sync-external-store")
  ) {
    return "vendor-react";
  }

  if (hasPackage("lucide-react")) {
    return "vendor-icons";
  }

  if (
    hasPackage("dexie") ||
    hasPackage("dexie-react-hooks")
  ) {
    return "vendor-storage";
  }

  if (normalizedId.includes("/node_modules/@tauri-apps/")) {
    return "vendor-native";
  }

  if (
    hasPackage("i18next") ||
    hasPackage("react-i18next")
  ) {
    return "vendor-i18n";
  }

  if (
    hasPackage("jspdf") ||
    hasPackage("fflate")
  ) {
    return "vendor-pdf";
  }

  if (
    hasPackage("html2canvas")
  ) {
    return "vendor-capture";
  }

  if (
    hasPackage("jszip") ||
    hasPackage("dompurify")
  ) {
    return "vendor-archive";
  }

  return undefined;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    resolve: {
      dedupe: ["react", "react-dom"]
    },
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 4173,
      strictPort: true
    },
    build: {
      chunkSizeWarningLimit: 1900,
      rollupOptions: {
        output: {
          manualChunks: resolveManualChunk
        }
      }
    }
  };
});
