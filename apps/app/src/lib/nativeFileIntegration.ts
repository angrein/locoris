import { isTauri } from "@tauri-apps/api/core";

export type NativeDialogFilter = {
  name: string;
  extensions: string[];
};

type OpenFileResult = {
  fileName: string;
  blob: Blob;
  path: string | null;
};

type OpenTextFileResult = OpenFileResult & {
  text: string;
};

function isDesktopRuntime() {
  return isTauri();
}

function getFileNameFromPath(path: string) {
  const normalizedPath = path.replace(/\\/g, "/");
  const fileName = normalizedPath.split("/").pop()?.trim();
  return fileName || "file";
}

function buildAcceptAttribute(filters: NativeDialogFilter[]) {
  return filters
    .flatMap((filter) => filter.extensions.map((extension) => `.${extension.replace(/^\./, "")}`))
    .join(",");
}

function ensureFileExtension(path: string, extension: string) {
  const normalizedExtension = extension.replace(/^\./, "").trim();

  if (!normalizedExtension) {
    return path;
  }

  const lowerCasePath = path.toLowerCase();
  const extensionSuffix = `.${normalizedExtension.toLowerCase()}`;

  if (lowerCasePath.endsWith(extensionSuffix)) {
    return path;
  }

  return `${path}${extensionSuffix}`;
}

function downloadBlobInBrowser(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function openBrowserFilePicker(accept: string) {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener(
      "change",
      () => {
        resolve(input.files?.[0] ?? null);
        input.remove();
      },
      { once: true }
    );
    document.body.appendChild(input);
    input.click();
  });
}

export function supportsNativeFileIntegration() {
  return isDesktopRuntime();
}

export async function openTextFileWithDialog(options: {
  filters: NativeDialogFilter[];
}): Promise<OpenTextFileResult | null> {
  if (isDesktopRuntime()) {
    const [{ open }, { readTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs")
    ]);
    const selectedPath = await open({
      multiple: false,
      directory: false,
      filters: options.filters
    });

    if (!selectedPath || Array.isArray(selectedPath)) {
      return null;
    }

    const text = await readTextFile(selectedPath);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });

    return {
      fileName: getFileNameFromPath(selectedPath),
      blob,
      path: selectedPath,
      text
    };
  }

  const file = await openBrowserFilePicker(buildAcceptAttribute(options.filters));

  if (!file) {
    return null;
  }

  return {
    fileName: file.name,
    blob: file,
    path: null,
    text: await file.text()
  };
}

export async function openBlobFileWithDialog(options: {
  filters: NativeDialogFilter[];
}): Promise<OpenFileResult | null> {
  if (isDesktopRuntime()) {
    const [{ open }, { readFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs")
    ]);
    const selectedPath = await open({
      multiple: false,
      directory: false,
      filters: options.filters
    });

    if (!selectedPath || Array.isArray(selectedPath)) {
      return null;
    }

    const bytes = await readFile(selectedPath);
    const blob = new Blob([bytes]);

    return {
      fileName: getFileNameFromPath(selectedPath),
      blob,
      path: selectedPath
    };
  }

  const file = await openBrowserFilePicker(buildAcceptAttribute(options.filters));

  if (!file) {
    return null;
  }

  return {
    fileName: file.name,
    blob: file,
    path: null
  };
}

export async function saveTextFileWithDialog(options: {
  defaultPath: string;
  filters: NativeDialogFilter[];
  content: string;
  preferredExtension: string;
}) {
  if (isDesktopRuntime()) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs")
    ]);
    const selectedPath = await save({
      defaultPath: options.defaultPath,
      filters: options.filters
    });

    if (!selectedPath) {
      return false;
    }

    await writeTextFile(
      ensureFileExtension(selectedPath, options.preferredExtension),
      options.content
    );
    return true;
  }

  downloadBlobInBrowser(
    new Blob([options.content], { type: "text/plain;charset=utf-8" }),
    options.defaultPath
  );
  return true;
}

export async function saveBlobFileWithDialog(options: {
  defaultPath: string;
  filters: NativeDialogFilter[];
  blob: Blob;
  preferredExtension: string;
}) {
  if (isDesktopRuntime()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs")
    ]);
    const selectedPath = await save({
      defaultPath: options.defaultPath,
      filters: options.filters
    });

    if (!selectedPath) {
      return false;
    }

    const bytes = new Uint8Array(await options.blob.arrayBuffer());
    await writeFile(
      ensureFileExtension(selectedPath, options.preferredExtension),
      bytes
    );
    return true;
  }

  downloadBlobInBrowser(options.blob, options.defaultPath);
  return true;
}
