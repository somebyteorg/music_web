async function entryFiles(entry: FileSystemEntry, prefix = ''): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    )
    try {
      Object.defineProperty(file, 'webkitRelativePath', { value: prefix + file.name })
    } catch {
      // 个别浏览器禁止改写该属性；拿不到相对路径也不影响上传
    }
    return [file]
  }
  if (!entry.isDirectory) return []
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  const files: File[] = []
  while (true) {
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    )
    if (!entries.length) break
    for (const child of entries) files.push(...(await entryFiles(child, prefix + entry.name + '/')))
  }
  return files
}
export async function droppedFiles(event: DragEvent) {
  const entries = Array.from(event.dataTransfer?.items || [])
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => !!entry)
  if (!entries.length) return Array.from(event.dataTransfer?.files || [])
  const files: File[] = []
  for (const entry of entries) files.push(...(await entryFiles(entry)))
  return files
}
