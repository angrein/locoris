import type {
  AppState as ExcalidrawAppState,
  BinaryFiles
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import { blobToDataUrl, textBlob } from "./blob";

export type CanvasExportFormat = "json" | "pdf";

type ExcalidrawExportApi = typeof import("@excalidraw/excalidraw");

type CanvasExportInput = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<ExcalidrawAppState>;
  files: BinaryFiles;
  name: string;
};

function getExportableElements(elements: readonly ExcalidrawElement[]) {
  return elements.filter((element) => !element.isDeleted);
}

function getExportAppState(appState: Partial<ExcalidrawAppState>) {
  return {
    ...appState,
    exportBackground: true,
    exportWithDarkMode: false
  };
}

async function loadExcalidrawExportApi(): Promise<ExcalidrawExportApi> {
  return import("@excalidraw/excalidraw");
}

export async function createCanvasJsonBlob(input: CanvasExportInput) {
  const { serializeAsJSON } = await loadExcalidrawExportApi();
  const json = serializeAsJSON(
    getExportableElements(input.elements),
    getExportAppState(input.appState) as ExcalidrawAppState,
    input.files,
    "local"
  );

  return textBlob(json, "application/vnd.excalidraw+json;charset=utf-8");
}

export async function createCanvasSvgBlob(input: CanvasExportInput) {
  const { exportToSvg } = await loadExcalidrawExportApi();
  const svg = await exportToSvg({
    elements: getExportableElements(input.elements),
    appState: getExportAppState(input.appState),
    files: input.files,
    exportPadding: 32
  });

  return textBlob(svg.outerHTML, "image/svg+xml;charset=utf-8");
}

export async function createCanvasPdfBlob(input: CanvasExportInput) {
  const [{ exportToBlob }, { jsPDF }] = await Promise.all([
    loadExcalidrawExportApi(),
    import("jspdf")
  ]);
  const pngBlob = await exportToBlob({
    elements: getExportableElements(input.elements),
    appState: getExportAppState(input.appState),
    files: input.files,
    mimeType: "image/png",
    exportPadding: 40,
    maxWidthOrHeight: 4096
  });
  const dataUrl = await blobToDataUrl(pngBlob);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();

    img.addEventListener("load", () => resolve(img), { once: true });
    img.addEventListener("error", () => reject(new Error("CANVAS_PDF_IMAGE_FAILED")), { once: true });
    img.src = dataUrl;
  });
  const orientation = image.width > image.height ? "landscape" : "portrait";
  const doc = new jsPDF({
    orientation,
    unit: "pt",
    format: "a4"
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (pageWidth - width) / 2;
  const y = (pageHeight - height) / 2;

  doc.addImage(dataUrl, "PNG", x, y, width, height);

  return doc.output("blob");
}
