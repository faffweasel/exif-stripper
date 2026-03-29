const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.avif',
  '.gif',
  '.mp4',
  '.mov',
  '.m4v',
  '.m4a',
]);

function isSupportedFile(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return SUPPORTED_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  let batch: FileSystemEntry[];
  do {
    batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    all.push(...batch);
  } while (batch.length > 0);
  return all;
}

function entryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(
  entry: FileSystemEntry,
  files: File[],
  skipped: { count: number }
): Promise<void> {
  if (entry.isFile) {
    if (isSupportedFile(entry.name)) {
      try {
        // safe: guarded by isFile check above
        files.push(await entryToFile(entry as FileSystemFileEntry));
      } catch {
        skipped.count++;
      }
    } else {
      skipped.count++;
    }
    return;
  }

  if (entry.isDirectory) {
    // safe: guarded by isDirectory check above
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children = await readAllEntries(reader);
    for (const child of children) {
      await walkEntry(child, files, skipped);
    }
  }
}

export async function getFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<{ files: File[]; skipped: number }> {
  // Try the Entry API for folder support
  const entries: FileSystemEntry[] = [];
  if (dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const entry = dataTransfer.items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
  }

  if (entries.length === 0) {
    // Fallback: no Entry API support, use flat file list with extension filter
    const allFiles = Array.from(dataTransfer.files);
    const supported = allFiles.filter((f) => isSupportedFile(f.name));
    return { files: supported, skipped: allFiles.length - supported.length };
  }

  const files: File[] = [];
  const skipped = { count: 0 };
  for (const entry of entries) {
    await walkEntry(entry, files, skipped);
  }
  return { files, skipped: skipped.count };
}
