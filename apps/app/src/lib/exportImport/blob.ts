export function textBlob(content: string, type = "text/plain;charset=utf-8") {
  return new Blob([content], { type });
}

export async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("BLOB_DATA_URL_FAILED"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("BLOB_DATA_URL_FAILED")));
    reader.readAsDataURL(blob);
  });
}

export async function blobToText(blob: Blob) {
  return blob.text();
}

