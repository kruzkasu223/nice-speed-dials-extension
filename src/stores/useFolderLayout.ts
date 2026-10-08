import { createSignal } from "solid-js"
import { storage } from "wxt/utils/storage"

type FolderLayouts = Record<string, { columns: number }>

const folderLayoutsStorage = storage.defineItem<FolderLayouts>(
  "local:folderLayouts",
  { fallback: {} }
)
const [folderLayouts, setFolderLayouts] = createSignal<FolderLayouts>({})

void folderLayoutsStorage.getValue().then(setFolderLayouts).catch(console.error)
folderLayoutsStorage.watch(setFolderLayouts)

export const getFolderColumns = (folderId: string) => {
  const columns = folderLayouts()[folderId]?.columns
  return typeof columns === "number" &&
    Number.isInteger(columns) &&
    columns >= 1 &&
    columns <= 40
    ? columns
    : undefined
}

// Serialize updates so rapid edits to different folders cannot overwrite each other.
let pending: Promise<void> = Promise.resolve()
const updateLayouts = (update: (layouts: FolderLayouts) => void) => {
  const operation = pending.then(async () => {
    const layouts = { ...(await folderLayoutsStorage.getValue()) }
    update(layouts)
    await folderLayoutsStorage.setValue(layouts)
    setFolderLayouts(layouts)
  })
  pending = operation.catch(() => {})
  return operation
}

export const setFolderColumns = (folderId: string, columns?: number) => {
  if (
    columns !== undefined &&
    (!Number.isInteger(columns) || columns < 1 || columns > 40)
  ) {
    return Promise.reject(new Error("Columns must be between 1 and 40."))
  }
  return updateLayouts((layouts) => {
    if (columns === undefined) delete layouts[folderId]
    else layouts[folderId] = { columns }
  })
}

export const removeFolderLayouts = (folderIds: string[]) =>
  updateLayouts((layouts) => {
    folderIds.forEach((id) => delete layouts[id])
  })

export const resetFolderLayouts = () =>
  updateLayouts((layouts) => {
    Object.keys(layouts).forEach((id) => delete layouts[id])
  })
