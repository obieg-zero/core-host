// ── OPFS Plugin Cache ───────────────────────────────────────────────
// Cache tylko dla immutable specs: @vX.Y.Z (git tag) i store:// (worker).
// Branche (@main, @dev) i lokalne (./) się zmieniają — nie cache'ujemy.

export const shouldCache = (spec: string) =>
  spec.startsWith('store://') || /^.+@v\d+\.\d+\.\d+/.test(spec)

const toKey = (spec: string) => spec.replace(/[^a-zA-Z0-9_@.-]/g, '_')

let _dir: FileSystemDirectoryHandle | null = null
const getDir = async () =>
  _dir ??= await (await navigator.storage.getDirectory())
    .getDirectoryHandle('plugin-cache', { create: true })

export const opfsRead = async (spec: string): Promise<string | null> => {
  try {
    const fh = await (await getDir()).getFileHandle(toKey(spec))
    return await (await fh.getFile()).text()
  } catch { return null }
}

export const opfsWrite = async (spec: string, data: string): Promise<void> => {
  const fh = await (await getDir()).getFileHandle(toKey(spec), { create: true })
  const w = await fh.createWritable()
  await w.write(data)
  await w.close()
}

export const opfsClear = async (): Promise<void> => {
  try {
    await (await navigator.storage.getDirectory())
      .removeEntry('plugin-cache', { recursive: true })
  } catch { /* nie istnieje — ok */ }
  _dir = null
}
