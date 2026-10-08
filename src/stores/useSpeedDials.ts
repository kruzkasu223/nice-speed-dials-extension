import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
// import { notify } from '~/components/Toast'
import { getGridDimensions } from "~/utils"
import { type Browser, browser } from "wxt/browser"
import { lastOpenedFolderId, rememberLastFolder } from "./useSettings"
import {
  getFolderIcon,
  removeFolderIcons,
  setFolderIcon,
} from "./useFolderIcons"

export type BookmarkDataType = Browser.bookmarks.BookmarkTreeNode
export type SpeedDialValues = Partial<BookmarkDataType> & { icon?: string }

const IS_DEV = import.meta.env.MODE === "development"

const DEFAULT_SPEED_DIALS_FOLDER_NAME = IS_DEV
  ? "DEV_NICE_SPEED_DIALS_BOOKMARKS_[DO_NOT_DELETE]"
  : "NICE_SPEED_DIALS_BOOKMARKS_[DO_NOT_DELETE]"
const BOOKMARK_EVENTS = [
  "onChanged",
  "onCreated",
  "onMoved",
  "onRemoved",
  ...(import.meta.env.BROWSER !== "firefox"
    ? (["onChildrenReordered", "onImportBegan", "onImportEnded"] as const)
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

const createDefaultSpeedDialsFolder = async () => {
  const created = await browser.bookmarks.create({
    title: DEFAULT_SPEED_DIALS_FOLDER_NAME,
  })
  setDefaultSpeedDialsFolder(created)
  return created
}

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

  const results = await browser.bookmarks.search({
    title: DEFAULT_SPEED_DIALS_FOLDER_NAME,
  })

  if (results && results.length > 0) {
    const defaultFolder = results.find((bookmark) => !bookmark.url)
    if (defaultFolder) {
      setDefaultSpeedDialsFolder(defaultFolder)
      return defaultFolder
    }
  }

  return await createDefaultSpeedDialsFolder()
}

const getFolderPath = async (folderId: string, root: BookmarkDataType) => {
  const path: BookmarkDataType[] = []
  const visitedIds = new Set<string>()
  let nextId: string | undefined = folderId

  try {
    while (nextId && !visitedIds.has(nextId)) {
      visitedIds.add(nextId)
      const folders: BookmarkDataType[] = await browser.bookmarks.get(nextId)
      const folder: BookmarkDataType | undefined = folders[0]

      if (!folder || folder.url) break

      path.unshift(folder)
      if (folder.id === root.id) return path
      nextId = folder.parentId
    }
  } catch {
    // The folder or one of its ancestors may have been removed externally.
  }

  return [root]
}

const refreshFolderTree = async (root: BookmarkDataType) => {
  try {
    const [tree] = await browser.bookmarks.getSubTree(root.id)
    setFolderTree(tree ?? root)
  } catch {
    setFolderTree(root)
  }
}

const loadSpeedDials = async (folderId?: string, recordNavigation = false) => {
  const previousFolderId = currentFolder()?.id
  const root = await getDefaultSpeedDialsFolder()
  const requestedFolderId = folderId ?? currentFolder()?.id ?? root.id
  const nextPath = await getFolderPath(requestedFolderId, root)
  const nextFolder = nextPath.at(-1) ?? root

  setCurrentFolder(nextFolder)
  setFolderPath(nextPath)
  await refreshFolderTree(root)

  try {
    const children = await browser.bookmarks.getChildren(nextFolder.id)
    setSpeedDials(children)
  } catch {
    setCurrentFolder(root)
    setFolderPath([root])
    setSpeedDials(await browser.bookmarks.getChildren(root.id))
  }

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

const handleBookmarkChange = () => {
  void getSpeedDials()
}

const bookmarkEventListeners = () =>
  BOOKMARK_EVENTS.forEach((event) =>
    browser.bookmarks[event].addListener(handleBookmarkChange)
  )

const removeBookmarkEventListeners = () =>
  BOOKMARK_EVENTS.forEach((event) =>
    browser.bookmarks[event].removeListener(handleBookmarkChange)
  )

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
      await removeFolderIcons(folderIds)
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
    const children = await browser.bookmarks.getChildren(source.id)
    for (const child of children) {
      await copyBookmarkTree(child, copy.id)
    }
  }

  return copy
}

const duplicateSpeedDial = async (values?: Partial<BookmarkDataType>) => {
  if (!values?.id || !values.title) return

  const root = await getDefaultSpeedDialsFolder()
  const destinationId = values.parentId ?? currentFolder()?.id ?? root.id

  try {
    const [source] = await browser.bookmarks.get(values.id)
    if (source) {
      await copyBookmarkTree(source, destinationId, `${source.title} (copy)`)
    }
  } catch (error) {
    // notify().error({ title: 'Error!!', description: error.message })
    console.error("Unable to duplicate speed dial", error)
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
