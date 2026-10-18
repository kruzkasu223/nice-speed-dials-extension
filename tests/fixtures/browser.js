// Install with Playwright's addInitScript to exercise production builds without
// reading or modifying the user's real browser bookmarks.
;(() => {
  const events = () => {
    const listeners = new Set()
    return {
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
      emit: (...args) => {
        for (const fn of listeners) fn(...args)
      },
      count: () => listeners.size,
    }
  }
  const calls = {}
  const count = (name) => {
    calls[name] = (calls[name] ?? 0) + 1
  }
  const clone = (value) => structuredClone(value)
  const tree = {
    id: "root",
    title: "NICE_SPEED_DIALS_BOOKMARKS_[DO_NOT_DELETE]",
    children: Array.from({ length: 100 }, (_, i) => ({
      id: `b${i}`,
      parentId: "root",
      index: i,
      title: `Bookmark ${i}`,
      url: `https://example.com/${i}`,
    })).concat({
      id: "folder",
      parentId: "root",
      index: 100,
      title: "Work",
      children: Array.from({ length: 50 }, (_, i) => ({
        id: `f${i}`,
        parentId: "folder",
        index: i,
        title: `Work ${i}`,
        url: `https://example.com/work/${i}`,
      })),
    }),
  }
  const find = (id, node = tree) =>
    node.id === id
      ? node
      : node.children?.map((child) => find(id, child)).find(Boolean)
  const node = (id) => {
    const result = find(id)
    if (!result) throw new Error(`Missing bookmark ${id}`)
    return result
  }
  const shallow = ({ children, ...rest }) => clone(rest)
  let nextId = 0
  const bookmarks = Object.fromEntries(
    [
      "onChanged",
      "onCreated",
      "onMoved",
      "onRemoved",
      "onChildrenReordered",
      "onImportBegan",
      "onImportEnded",
    ].map((name) => [name, events()])
  )
  Object.assign(bookmarks, {
    async search() {
      count("search")
      return [shallow(tree)]
    },
    async get(id) {
      count("get")
      return [shallow(node(id))]
    },
    async getSubTree(id) {
      count("getSubTree")
      return [clone(node(id))]
    },
    async getChildren(id) {
      count("getChildren")
      return clone(node(id).children ?? [])
    },
    async create(data) {
      count("create")
      const parent = node(data.parentId ?? "root")
      const result = {
        ...data,
        id: `new${nextId++}`,
        parentId: parent.id,
        index: parent.children.length,
        ...(!data.url ? { children: [] } : {}),
      }
      parent.children.push(result)
      bookmarks.onCreated.emit(result.id, shallow(result))
      return shallow(result)
    },
    async update(id, data) {
      count("update")
      Object.assign(node(id), data)
      bookmarks.onChanged.emit(id, data)
      return shallow(node(id))
    },
    async move(id, data) {
      count("move")
      const item = node(id)
      const oldParent = node(item.parentId)
      oldParent.children = oldParent.children.filter((child) => child.id !== id)
      const parent = node(data.parentId ?? item.parentId)
      parent.children.splice(data.index ?? parent.children.length, 0, item)
      item.parentId = parent.id
      parent.children.forEach((child, index) => {
        child.index = index
      })
      bookmarks.onMoved.emit(id, data)
      return shallow(item)
    },
    async remove(id) {
      count("remove")
      const item = node(id)
      const parent = node(item.parentId)
      parent.children = parent.children.filter((child) => child.id !== id)
      bookmarks.onRemoved.emit(id, { parentId: parent.id, node: shallow(item) })
    },
    async removeTree(id) {
      return bookmarks.remove(id)
    },
  })
  const values = {}
  const changed = events()
  const local = {
    onChanged: changed,
    async get(keys) {
      count("storage.get")
      const list =
        typeof keys === "string" ? [keys] : (keys ?? Object.keys(values))
      for (const key of list) count(`storage.get:${key}`)
      return Object.fromEntries(
        list
          .filter((key) => key in values)
          .map((key) => [key, clone(values[key])])
      )
    },
    async set(data) {
      count("storage.set")
      const changes = {}
      for (const [key, value] of Object.entries(data)) {
        changes[key] = { oldValue: values[key], newValue: value }
        values[key] = clone(value)
      }
      changed.emit(changes, "local")
    },
    async remove(keys) {
      const changes = {}
      for (const key of [keys].flat()) {
        changes[key] = { oldValue: values[key] }
        delete values[key]
      }
      changed.emit(changes, "local")
    },
  }
  const api = {
    bookmarks,
    storage: { local, onChanged: changed },
    runtime: {
      id: "mock",
      getManifest: () => ({ version: "6" }),
      getURL: (path) => path,
    },
    tabs: { create: async () => ({}) },
  }
  // WXT selects browser or chrome depending on the build target.
  window.browser = api
  window.chrome = Object.assign(window.chrome ?? {}, api)
  window.__fixture = {
    tree,
    calls,
    listeners: changed.count,
    bookmarks,
    storage: local,
  }
})()
