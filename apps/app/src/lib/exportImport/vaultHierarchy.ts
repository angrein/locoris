import type { Folder } from "../../types";

export function getFolderPathMap(folders: Folder[]) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const cache = new Map<string, string>();

  const resolvePath = (folderId: string): string => {
    const cached = cache.get(folderId);

    if (cached) {
      return cached;
    }

    const folder = byId.get(folderId);

    if (!folder) {
      return "";
    }

    const parentPath = folder.parentId ? resolvePath(folder.parentId) : "";
    const path = parentPath ? `${parentPath}/${folder.name}` : folder.name;

    cache.set(folderId, path);
    return path;
  };

  folders.forEach((folder) => resolvePath(folder.id));
  return cache;
}

