import { browser } from "wxt/browser"

const DEFAULT_SPEED_DIALS_FOLDER_NAME =
  import.meta.env.MODE === "development"
    ? "DEV_NICE_SPEED_DIALS_BOOKMARKS_[DO_NOT_DELETE]"
    : "NICE_SPEED_DIALS_BOOKMARKS_[DO_NOT_DELETE]"

// Shared by the new-tab page and background worker; keep this free of UI state.
export const findOrCreateSpeedDialsFolder = async () => {
  const results = await browser.bookmarks.search({
    title: DEFAULT_SPEED_DIALS_FOLDER_NAME,
  })
  const folder = results.find((bookmark) => !bookmark.url)
  return (
    folder ??
    browser.bookmarks.create({ title: DEFAULT_SPEED_DIALS_FOLDER_NAME })
  )
}
