import { removeFolderLayouts } from "./useFolderLayout"
import { findOrCreateSpeedDialsFolder } from "~/utils/speedDialBookmarks"
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js"
import { createStore, reconcile } from "solid-js/store"
// import { notify } from '~/components/Toast'
import { getGridDimensions } from "~/utils"
import { createRefreshScheduler } from "~/utils/createRefreshScheduler"
import { type Browser, browser } from "wxt/browser"
import { lastOpenedFolderId, rememberLastFolder } from "./useSettings"
import {
  getFolderIcon,
  removeFolderIcons,
  setFolderIcon,
} from "./useFolderIcons"

export type BookmarkDataType = Browser.bookmarks.BookmarkTreeNode
export type SpeedDialValues = Partial<BookmarkDataType> & { icon?: string }

const BOOKMARK_EVENTS = [
  "onChanged",
  "onCreated",
  "onMoved",
  "onRemoved",
  ...(import.meta.env.BROWSER !== "firefox"
    ? (["onChildrenReordered"] as const)
    : ([] as const)),
] as const

export const ADD_NEW_SPEED_DIALS_ITEM: BookmarkDataType = {
  id: "ADD",
  title: "Add New",
  syncing: false,
}

export const SETTINGS_SPEED_DIALS_ITEM: BookmarkDataType = {
  id: "SETTINGS",
  title: "Settings",
  syncing: false,
}

const [defaultSpeedDialsFolder, setDefaultSpeedDialsFolder] =
  createSignal<BookmarkDataType>()
const [currentFolder, setCurrentFolder] = createSignal<BookmarkDataType>()
const [folderPath, setFolderPath] = createSignal<BookmarkDataType[]>([])
const [folderTree, setFolderTree] = createSignal<BookmarkDataType>()
const [isSpeedDialsLoaded, setIsSpeedDialsLoaded] = createSignal(false)

const hasFolders = createMemo(
  () => folderTree()?.children?.some((child) => !child.url) ?? false
)

const [speedDials, setSpeedDials] = createStore<BookmarkDataType[]>([])

const speedDialsGrid = createMemo(() => {
  const { gridHeight: height, gridWidth: width } = getGridDimensions(
    speedDials?.length || 0
  )
  return { height, width }
})

const getDefaultSpeedDialsFolder = async () => {
  const cachedFolder = defaultSpeedDialsFolder()

  if (cachedFolder) {
    try {
      const [folder] = await browser.bookmarks.get(cachedFolder.id)
      if (folder && !folder.url) return folder
    } catch {
      setDefaultSpeedDialsFolder(undefined)
    }
  }

  const folder = await findOrCreateSpeedDialsFolder()
  setDefaultSpeedDialsFolder(folder)
  return folder
}

let treeVersion = 0
let loadedTreeVersion = -1
let folderIndex = new Map<string, BookmarkDataType>()

const getFolderSnapshot = async () => {
  if (folderTree() && loadedTreeVersion === treeVersion) return folderTree()!
  const version = treeVersion
  const root = await getDefaultSpeedDialsFolder()
  const [tree] = await browser.bookmarks.getSubTree(root.id)
  if (!tree) throw new Error("Speed dials folder was not found")
  const index = new Map<string, BookmarkDataType>()
  const pending = [tree]
  while (pending.length) {
    const node = pending.pop()!
    if (node.url) continue
    index.set(node.id, node)
    for (const child of node.children ?? []) {
      if (!child.url) pending.push(child)
    }
  }
  folderIndex = index
  loadedTreeVersion = version
  return tree
}

const getFolderPath = (folderId: string, root: BookmarkDataType) => {
  const path: BookmarkDataType[] = []
  let folder = folderIndex.get(folderId)
  while (folder) {
    path.push(folder)
    if (folder.id === root.id) return path.reverse()
    folder = folder.parentId ? folderIndex.get(folder.parentId) : undefined
  }
  return [root]
}

const loadSpeedDials = async (folderId?: string, recordNavigation = false) => {
  const previousFolderId = currentFolder()?.id
  const nextTree = await getFolderSnapshot()
  const requestedFolderId = folderId ?? currentFolder()?.id ?? nextTree.id
  const nextPath = getFolderPath(requestedFolderId, nextTree)
  const nextFolder = nextPath.at(-1) ?? nextTree
  // The drag-and-drop store mutates its objects; keep the cached tree immutable.
  const children = (nextFolder.children ?? []).map(
    ({ children, ...item }) => item
  )

  // Publish a complete view at once: old items must never use the new
  // folder's columns or appear underneath its breadcrumb while loading.
  batch(() => {
    setCurrentFolder(nextFolder)
    setFolderPath(nextPath)
    setFolderTree(nextTree)
    setSpeedDials(reconcile(children, { key: "id" }))
  })

  const resolvedFolderId = currentFolder()?.id
  if (
    resolvedFolderId &&
    previousFolderId !== resolvedFolderId &&
    (await rememberLastFolder.getValue())
  ) {
    await lastOpenedFolderId.setValue(resolvedFolderId)
  }
  const state = {
    ...window.history.state,
    speedDialsFolderId: resolvedFolderId,
  }
  if (recordNavigation && previousFolderId !== resolvedFolderId) {
    window.history.pushState(state, "")
  } else if (
    !window.history.state?.speedDialsFolderId ||
    window.history.state.speedDialsFolderId === (folderId ?? previousFolderId)
  ) {
    // Seed the initial entry and repair entries whose folder was deleted.
    window.history.replaceState(state, "")
  }
}

// Keep rapid navigation and bookmark refreshes in order.
let folderLoadQueue: Promise<void> = Promise.resolve()
const getSpeedDials = (folderId?: string, recordNavigation = false) => {
  const load = folderLoadQueue.then(() =>
    loadSpeedDials(folderId, recordNavigation)
  )
  folderLoadQueue = load.catch(() => {})
  return load
}

const openFolder = async (folder: BookmarkDataType) => {
  if (folder.url) return
  await navigateToFolder(folder.id)
}

const navigateToFolder = async (folderId: string) => {
  await getSpeedDials(folderId, true)
}

const navigateToParentFolder = async () => {
  const path = folderPath()
  const parent = path.at(-2)
  if (parent) await navigateToFolder(parent.id)
}

const bookmarkRefresh = createRefreshScheduler(
  () => getSpeedDials(),
  (error) => console.error("Unable to refresh speed dials", error)
)
const handleBookmarkChange = () => {
  treeVersion++
  bookmarkRefresh.request()
}
const handleImportBegan = () => bookmarkRefresh.pause()
const handleImportEnded = () => {
  handleBookmarkChange()
  bookmarkRefresh.resume()
}

const bookmarkEventListeners = () => {
  BOOKMARK_EVENTS.forEach((event) =>
    browser.bookmarks[event].addListener(handleBookmarkChange)
  )
  if (import.meta.env.BROWSER !== "firefox") {
    browser.bookmarks.onImportBegan.addListener(handleImportBegan)
    browser.bookmarks.onImportEnded.addListener(handleImportEnded)
  }
}

const removeBookmarkEventListeners = () => {
  BOOKMARK_EVENTS.forEach((event) =>
    browser.bookmarks[event].removeListener(handleBookmarkChange)
  )
  if (import.meta.env.BROWSER !== "firefox") {
    browser.bookmarks.onImportBegan.removeListener(handleImportBegan)
    browser.bookmarks.onImportEnded.removeListener(handleImportEnded)
  }
  bookmarkRefresh.dispose()
}

const addNewSpeedDial = async (values?: SpeedDialValues, parentId?: string) => {
  const title = values?.title?.trim()
  const url = values?.url
  const icon = values?.icon
  if (!title) return

  const root = await getDefaultSpeedDialsFolder()
  const destinationId =
    values?.parentId ?? parentId ?? currentFolder()?.id ?? root.id

  try {
    const created = await browser.bookmarks.create({
      parentId: destinationId,
      title,
      ...(url ? { url } : {}),
    })

    if (!url) await setFolderIcon(created.id, icon)
  } catch (error) {
    // notify().error({ title: 'Error!!', description: error.message })
    console.error("Unable to create speed dial", error)
  }
}

const editSpeedDial = async (values?: SpeedDialValues) => {
  const title = values?.title?.trim()
  const id = values?.id
  const url = values?.url
  const icon = values?.icon
  if (!id || !title) return

  try {
    const [current] = await browser.bookmarks.get(id)
    await browser.bookmarks.update(id, { title, ...(url ? { url } : {}) })

    if (values?.parentId && current?.parentId !== values.parentId) {
      await browser.bookmarks.move(id, { parentId: values.parentId })
    }

    if (!url) await setFolderIcon(id, icon)
  } catch (error) {
    // notify().error({ title: 'Error!!', description: error.message })
    console.error("Unable to edit speed dial", error)
  }
}

const getFolderIds = (node?: BookmarkDataType): string[] => {
  if (!node || node.url) return []
  return [
    node.id,
    ...(node.children?.flatMap((child) => getFolderIds(child)) ?? []),
  ]
}

const deleteSpeedDial = async (values?: SpeedDialValues) => {
  const id = values?.id
  const url = values?.url
  if (!id) return

  try {
    const folderIds = url
      ? []
      : getFolderIds((await browser.bookmarks.getSubTree(id))[0])

    if (url) {
      await browser.bookmarks.remove(id)
    } else {
      await browser.bookmarks.removeTree(id)
      await Promise.all([
        removeFolderIcons(folderIds),
        removeFolderLayouts(folderIds),
      ])
    }
  } catch (error) {
    // notify().error({ title: 'Error!!', description: error.message })
    console.error("Unable to delete speed dial", error)
  }
}

const copyBookmarkTree = async (
  source: BookmarkDataType,
  parentId: string,
  title = source.title
) => {
  const copy = await browser.bookmarks.create({
    parentId,
    title,
    ...(source.url ? { url: source.url } : {}),
  })

  if (!source.url) {
    await setFolderIcon(copy.id, getFolderIcon(source.id))
    for (const child of source.children ?? []) {
      await copyBookmarkTree(child, copy.id)
    }
  }

  return copy
}

const duplicateSpeedDial = async (values?: Partial<BookmarkDataType>) => {
  if (!values?.id || !values.title) return

  const root = await getDefaultSpeedDialsFolder()
  const destinationId = values.parentId ?? currentFolder()?.id ?? root.id

  bookmarkRefresh.pause()
  try {
    const [source] = await browser.bookmarks.getSubTree(values.id)
    if (source) {
      await copyBookmarkTree(source, destinationId, `${source.title} (copy)`)
    }
  } catch (error) {
    console.error("Unable to duplicate speed dial", error)
  } finally {
    bookmarkRefresh.resume()
  }
}

const moveSpeedDial = async (
  values: Partial<BookmarkDataType>,
  newIndex: number
) => {
  if (!values?.id) return
  if (values?.index === newIndex) return getSpeedDials()
  await browser.bookmarks
    .move(values.id, { index: newIndex })
    .catch((error) => {
      // notify().error({ title: 'Error!!', description: error.message })
      console.error("Unable to move speed dial", error)
    })
}

createEffect(() => {
  const savedFolderId = window.history.state?.speedDialsFolderId
  const loadInitialFolder = async () => {
    const persistedFolderId = (await rememberLastFolder.getValue())
      ? await lastOpenedFolderId.getValue()
      : undefined
    await getSpeedDials(
      typeof savedFolderId === "string"
        ? savedFolderId
        : (persistedFolderId ?? undefined)
    )
  }
  void loadInitialFolder()
    .catch((error) => {
      console.error("Unable to load speed dials", error)
    })
    .finally(() => {
      setIsSpeedDialsLoaded(true)
    })
  bookmarkEventListeners()
  onCleanup(removeBookmarkEventListeners)
  onCleanup(
    rememberLastFolder.watch((enabled) => {
      const folderId = currentFolder()?.id
      const update =
        enabled && folderId
          ? lastOpenedFolderId.setValue(folderId)
          : lastOpenedFolderId.removeValue()
      void update.catch((error) =>
        console.error("Unable to save last opened folder", error)
      )
    })
  )

  const handleHistoryNavigation = (event: PopStateEvent) => {
    const folderId = event.state?.speedDialsFolderId
    void getSpeedDials(
      typeof folderId === "string" ? folderId : undefined
    ).catch((error) =>
      console.error("Unable to navigate folder history", error)
    )
  }
  window.addEventListener("popstate", handleHistoryNavigation)
  onCleanup(() =>
    window.removeEventListener("popstate", handleHistoryNavigation)
  )
})

export {
  speedDials,
  setSpeedDials,
  currentFolder,
  folderPath,
  folderTree,
  hasFolders,
  isSpeedDialsLoaded,
  openFolder,
  navigateToFolder,
  navigateToParentFolder,
  editSpeedDial,
  moveSpeedDial,
  speedDialsGrid,
  addNewSpeedDial,
  deleteSpeedDial,
  duplicateSpeedDial,
}
