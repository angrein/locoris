export function sanitizeExportFileName(value: string, fallback = "export") {
  const normalized = value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);

  return normalized || fallback;
}

export function formatExportTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function withExtension(fileName: string, extension: string) {
  const normalizedExtension = extension.replace(/^\./, "");
  const suffix = `.${normalizedExtension}`;

  return fileName.toLowerCase().endsWith(suffix.toLowerCase())
    ? fileName
    : `${fileName}${suffix}`;
}

