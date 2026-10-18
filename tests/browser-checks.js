// Run with playwright-cli run-code --filename tests/browser-checks.js after
// serving the Chrome build at http://127.0.0.1:4173.
async function runChecks(page) {
  const check = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript({ path: "tests/fixtures/browser.js" })
  await page.goto("http://127.0.0.1:4173/newtab.html")
  await page
    .getByRole("button", { name: "Open Work folder", exact: true })
    .waitFor()
  const metrics = () =>
    page.evaluate(() => ({
      calls: { ...__fixture.calls },
      listeners: __fixture.listeners(),
      scripts: performance
        .getEntriesByType("resource")
        .filter((e) => e.name.endsWith(".js"))
        .map((e) => ({
          name: e.name.split("/").pop(),
          bytes: e.decodedBodySize,
        })),
    }))
  const initial = await metrics()
  check(
    initial.listeners < 30,
    "Initial listener count must not scale with dial count"
  )
  check(
    !initial.scripts.some((s) =>
      /SettingsDrawer|InputModal|folderIconCatalog/.test(s.name)
    ),
    "Optional UI was loaded on startup"
  )
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Open Work folder", exact: true })
      .click()
    await page.getByRole("button", { name: "Home", exact: true }).click()
  }
  const navigation = await metrics()
  check(
    navigation.listeners === initial.listeners,
    "Folder navigation leaked storage listeners"
  )
  check(
    navigation.calls.getSubTree === initial.calls.getSubTree,
    "Unchanged navigation fetched the tree again"
  )
  await page.evaluate(() => {
    window.__retainedDial = document.querySelector(
      'a[aria-label="Open Bookmark 0"]'
    )
    for (let i = 0; i < 100; i++)
      __fixture.bookmarks.onChanged.emit("b0", { title: "Bookmark 0" })
  })
  await page.waitForTimeout(300)
  const burst = await metrics()
  check(
    burst.calls.getSubTree === navigation.calls.getSubTree + 1,
    "Event burst did not coalesce"
  )
  check(
    burst.listeners === initial.listeners,
    "Bookmark refresh leaked listeners"
  )
  check(
    await page.evaluate(
      () =>
        __retainedDial ===
        document.querySelector('a[aria-label="Open Bookmark 0"]')
    ),
    "Refresh recreated an unchanged dial"
  )

  await page.evaluate(() => {
    __fixture.bookmarks.onImportBegan.emit()
    for (let i = 0; i < 100; i++) __fixture.bookmarks.onChanged.emit("b0", {})
  })
  await page.waitForTimeout(150)
  check(
    (await metrics()).calls.getSubTree === burst.calls.getSubTree,
    "Import refreshed before completion"
  )
  await page.evaluate(() => __fixture.bookmarks.onImportEnded.emit())
  await page.waitForTimeout(150)
  check(
    (await metrics()).calls.getSubTree === burst.calls.getSubTree + 1,
    "Import did not refresh after completion"
  )

  // Ensure the context-menu settings command still works before lazy UI is loaded.
  await page.evaluate(() =>
    __fixture.storage.set({ toggleSettingsDrawer: true })
  )
  await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor()
  await page
    .getByRole("checkbox", { name: "Open links in a new tab", exact: true })
    .press("Space")
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click()
  await page
    .getByRole("dialog", { name: "Settings", exact: true })
    .waitFor({ state: "hidden" })
  check(
    (await page
      .getByRole("link", { name: "Open Bookmark 0", exact: true })
      .getAttribute("target")) === "_blank",
    "Shared link preference failed"
  )
  await page.getByRole("button", { name: "Open settings", exact: true }).click()
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click()
  await page
    .getByRole("dialog", { name: "Settings", exact: true })
    .waitFor({ state: "hidden" })

  await page
    .getByRole("button", { name: "Add a speed dial or folder", exact: true })
    .click()
  await page.getByRole("dialog", { name: "Add an item", exact: true }).waitFor()
  check(
    await page
      .locator('input[name="title"]')
      .evaluate((el) => el === document.activeElement),
    "Lazy dialog lost initial focus"
  )
  await page.getByRole("button", { name: "Folder", exact: true }).click()
  await page
    .getByRole("searchbox", { name: "Folder icon", exact: true })
    .fill("rocket")
  await page.getByRole("button", { name: "Rocket", exact: true }).click()
  await page.locator('input[name="title"]').fill("Launch")
  await page.getByRole("button", { name: "Add folder", exact: true }).click()
  await page
    .getByRole("button", { name: "Open Launch folder", exact: true })
    .waitFor()
  check(
    await page
      .getByRole("button", { name: "Open Launch folder", exact: true })
      .locator("svg")
      .getAttribute("class")
      .then((c) => c.includes("lucide-rocket")),
    "Custom folder icon failed"
  )

  await page
    .getByRole("button", { name: "Actions for Work", exact: true })
    .click()
  const beforeCopy = (await metrics()).calls.getSubTree
  await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click()
  await page
    .getByRole("button", { name: "Open Work (copy) folder", exact: true })
    .waitFor()
  await page.waitForTimeout(150)
  const afterCopy = await metrics()
  check(
    afterCopy.calls.getSubTree - beforeCopy === 2,
    "Copy should read the source once and refresh once"
  )
  await page
    .getByRole("button", { name: "Open Work (copy) folder", exact: true })
    .click()
  check(
    (await page.getByRole("link").count()) === 50,
    "Copied folder lost bookmarks"
  )
  await page.goBack()
  await page
    .getByRole("button", { name: "Open Launch folder", exact: true })
    .click()
  await page.evaluate(() =>
    __fixture.bookmarks.removeTree(
      __fixture.tree.children.find((item) => item.title === "Launch").id
    )
  )
  await page
    .getByRole("button", { name: "Open Work folder", exact: true })
    .waitFor()
  check(
    !(await page.getByRole("navigation", { name: "Folder path" }).count()),
    "Deleting the current folder did not return home"
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/performance-desktop.png",
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "Open settings", exact: true }).click()
  await page.getByRole("dialog", { name: "Settings", exact: true }).waitFor()
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/performance-mobile.png",
  })
  await page.goto("http://127.0.0.1:4173/update.html")
  await page
    .getByRole("heading", { name: "Release notes", exact: true })
    .waitFor()
  check(
    !(await metrics()).calls.getSubTree,
    "Release notes initialized the bookmark store"
  )
  check(errors.length === 0, `Browser errors: ${errors.join("; ")}`)
  return {
    initial,
    navigation,
    burst,
    checks:
      "Navigation, batching, import, settings, focus, icons, duplication, history, deletion passed",
  }
}
