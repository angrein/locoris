export type OpenSourceNotice = {
  name: string;
  version: string;
  license: string;
  usage: string;
  url: string;
};

export const applicationNotices: OpenSourceNotice[] = [
  { name: "@blocknote/core", version: "0.47.3", license: "MPL-2.0", usage: "Rich text editor core", url: "https://www.blocknotejs.org/" },
  { name: "@blocknote/react", version: "0.47.3", license: "MPL-2.0", usage: "React editor integration", url: "https://www.blocknotejs.org/" },
  { name: "@blocknote/mantine", version: "0.47.3", license: "MPL-2.0", usage: "Editor UI integration", url: "https://www.blocknotejs.org/" },
  { name: "@excalidraw/excalidraw", version: "0.18.1", license: "MIT", usage: "Canvas drawing surface", url: "https://github.com/excalidraw/excalidraw" },
  { name: "@excalidraw/mermaid-to-excalidraw", version: "2.2.2", license: "MIT", usage: "Mermaid to canvas conversion", url: "https://github.com/excalidraw/mermaid-to-excalidraw" },
  { name: "@mantine/core", version: "8.3.18", license: "MIT", usage: "Interface primitives", url: "https://mantine.dev/" },
  { name: "@tauri-apps/api", version: "2.11.1", license: "Apache-2.0 OR MIT", usage: "Desktop and Android runtime APIs", url: "https://tauri.app/" },
  { name: "dexie", version: "4.4.4", license: "Apache-2.0", usage: "IndexedDB local vault storage", url: "https://dexie.org/" },
  { name: "docx", version: "9.7.1", license: "MIT", usage: "Document import/export support", url: "https://github.com/dolanmiu/docx" },
  { name: "html2canvas", version: "1.4.1", license: "MIT", usage: "Canvas/export rendering support", url: "https://html2canvas.hertzen.com/" },
  { name: "i18next", version: "26.3.1", license: "MIT", usage: "Localization", url: "https://www.i18next.com/" },
  { name: "jspdf", version: "4.2.1", license: "MIT", usage: "PDF export support", url: "https://github.com/parallax/jsPDF" },
  { name: "jszip", version: "3.10.1", license: "MIT OR GPL-3.0-or-later", usage: "Readable ZIP export and backups", url: "https://stuk.github.io/jszip/" },
  { name: "react", version: "18.3.1", license: "MIT", usage: "Application UI", url: "https://react.dev/" },
  { name: "rrule", version: "2.8.1", license: "BSD-3-Clause", usage: "Recurring planner rules", url: "https://github.com/jakubroztocil/rrule" }
];

export const websiteNotices: OpenSourceNotice[] = [
  { name: "React", version: "18.3.1", license: "MIT", usage: "Marketing site UI", url: "https://react.dev/" },
  { name: "Vite", version: "7.3.5", license: "MIT", usage: "Website build tooling", url: "https://vite.dev/" },
  { name: "TypeScript", version: "6.0.3", license: "Apache-2.0", usage: "Website typechecking", url: "https://www.typescriptlang.org/" }
];

export const fontNotices: OpenSourceNotice[] = [
  { name: "Onest", version: "5.2.11", license: "OFL-1.1", usage: "Primary product and website UI font", url: "https://github.com/simpals/onest" },
  { name: "Golos Text", version: "5.2.8", license: "OFL-1.1", usage: "Readable UI and export font", url: "https://github.com/googlefonts/golos-text" },
  { name: "Unbounded", version: "5.2.8", license: "OFL-1.1", usage: "Brand and display headings", url: "https://github.com/googlefonts/unbounded" },
  { name: "IBM Plex Sans", version: "5.2.8", license: "OFL-1.1", usage: "Export and compatibility font", url: "https://github.com/IBM/plex" },
  { name: "IBM Plex Serif", version: "5.2.7", license: "OFL-1.1", usage: "Export and compatibility font", url: "https://github.com/IBM/plex" },
  { name: "IBM Plex Mono", version: "5.2.7", license: "OFL-1.1", usage: "Code and export monospace font", url: "https://github.com/IBM/plex" }
];
