import { FolderOpenIcon, PlusIcon, SettingsIcon } from "lucide-solid"
// @ts-expect-error ts(2307)
import { dndzone } from "solid-dnd-directive"
import { For, createSignal, createEffect, onMount, Show } from "solid-js"
import {
  type BookmarkDataType,
  duplicateSpeedDial,
  openFolder,
  moveSpeedDial,
  openModal,
  setSpeedDials,
  speedDials,
  setIsSettingDrawerOpen,
  isSpeedDialsLoaded,
  folderPath,
  gridColumns,
  currentFolder,
  getFolderColumns,
  dialSize,
  dialRadius,
  showSpeedDialTitles,
  dialTextSize,
  showAddNewButton,
  showSettingsButton,
  showHelpButton,
  disableDragAndDrop,
  DEFAULT_VALUES,
} from "~/stores"
import { GridItem, InputModal, SettingsDrawer } from "./"
import { getGridDimensions } from "~/utils"
import { CustomTooltip } from "./CustomTooltip"
import { Button } from "./ui/button"
import { Text } from "./ui/text"
import { FolderBreadcrumb } from "./FolderBreadcrumb"

export const Grid = () => {
  dndzone

  const [currentGridColumns, setCurrentGridColumns] = createSignal<
    number | undefined
  >(DEFAULT_VALUES.gridColumns)
  const [currentDialSize, setCurrentDialSize] = createSignal(
    DEFAULT_VALUES.dialSize
  )
  const [currentDialRadius, setCurrentDialRadius] = createSignal(
    DEFAULT_VALUES.dialRadius
  )
  const [currentDialTextSize, setCurrentDialTextSize] = createSignal(
    DEFAULT_VALUES.dialTextSize
  )
  const [currentShowSpeedDialTitles, setCurrentShowSpeedDialTitles] =
    createSignal(DEFAULT_VALUES.showSpeedDialTitles)
  const [currentShowAddNew, setCurrentShowAddNew] = createSignal(
    DEFAULT_VALUES.showAddNewButton
  )
  const [currentShowSettings, setCurrentShowSettings] = createSignal(
    DEFAULT_VALUES.showSettingsButton
  )
  const [currentShowHelp, setCurrentShowHelp] = createSignal(
    DEFAULT_VALUES.showHelpButton
  )
  const [currentDisableDragDrop, setCurrentDisableDragDrop] = createSignal(
    DEFAULT_VALUES.disableDragAndDrop
  )

  // Load settings on mount
  onMount(async () => {
    setCurrentGridColumns((await gridColumns.getValue()) ?? undefined)
    setCurrentDialSize(await dialSize.getValue())
    setCurrentDialRadius(await dialRadius.getValue())
    setCurrentShowSpeedDialTitles(await showSpeedDialTitles.getValue())
    setCurrentDialTextSize(await dialTextSize.getValue())
    setCurrentShowAddNew(await showAddNewButton.getValue())
    setCurrentShowSettings(await showSettingsButton.getValue())
    setCurrentShowHelp(await showHelpButton.getValue())
    setCurrentDisableDragDrop(await disableDragAndDrop.getValue())

    // Watch for changes
    // WXT emits null when an optional storage item is removed. Normalize it to
    // undefined so the grid falls back to its automatically calculated width.
    gridColumns.watch((value) => setCurrentGridColumns(value ?? undefined))
    dialSize.watch(setCurrentDialSize)
    dialRadius.watch(setCurrentDialRadius)
    showSpeedDialTitles.watch(setCurrentShowSpeedDialTitles)
    dialTextSize.watch(setCurrentDialTextSize)
    showAddNewButton.watch(setCurrentShowAddNew)
    showSettingsButton.watch(setCurrentShowSettings)
    showHelpButton.watch(setCurrentShowHelp)
    disableDragAndDrop.watch(setCurrentDisableDragDrop)
  })

  // Folders use automatic sizing unless they have their own override.
  const gridDimensions = () => {
    const customColumns =
      folderPath().length > 1
        ? getFolderColumns(currentFolder()?.id ?? "")
        : currentGridColumns()
    const { gridHeight: height, gridWidth: width } = getGridDimensions(
      speedDials.length,
      customColumns
    )
    return { height, width }
  }

  // Apply dial size and radius to CSS variables
  createEffect(() => {
    const size = currentDialSize()
    const radius = currentDialRadius()
    const radiusToken = `var(--radius-${radius}, var(--radius-sm))`

    document.documentElement.style.setProperty("--dial-size", `${size}px`)
    document.documentElement.style.setProperty("--dial-radius", radiusToken)
  })

  const onDrag = (e: any, isFinalize = false) => {
    if (isFinalize) {
      const newItems = (e.detail.items as BookmarkDataType[]).filter(
        (item) => item.id !== "ADD" && item.id !== "SETTINGS"
      )
      setSpeedDials(newItems)
      return
    }
    const newItems = e.detail.items as BookmarkDataType[]
    setSpeedDials(newItems)
  }

  const onDragConsider = (e: any) => {
    onDrag(e)
  }

  const onDragFinalize = (e: any) => {
    onDrag(e, true)

    if (e.detail.info.id === "ADD" || e.detail.info.id === "SETTINGS") return

    const itemId = e.detail.info.id
    const item = speedDials.find((item) => item.id === itemId)
    const itemNewIndex = speedDials.findIndex((item) => item.id === itemId)

    if (item && String(itemNewIndex) && item.index !== itemNewIndex)
      moveSpeedDial(
        item,
        itemNewIndex > (item.index ?? itemNewIndex)
          ? itemNewIndex + 1
          : itemNewIndex
      )
  }

  return (
    <>
      <InputModal />
      <SettingsDrawer />

      <div class="flex w-full min-w-0 items-start justify-between gap-3">
        <FolderBreadcrumb />

        <div class="ml-auto flex shrink-0 items-center gap-2">
          <Show when={currentShowAddNew()}>
            <CustomTooltip content="Add an item">
              {(triggerProps) => (
                <Button
                  {...triggerProps()}
                  aria-label="Add a speed dial or folder"
                  size="icon-md"
                  variant="translucent"
                  onClick={() => openModal("ADD")}
                >
                  <PlusIcon aria-hidden="true" />
                </Button>
              )}
            </CustomTooltip>
          </Show>

          <Show when={currentShowSettings()}>
            <CustomTooltip content="Settings">
              {(triggerProps) => (
                <Button
                  {...triggerProps()}
                  aria-label="Open settings"
                  size="icon-md"
                  variant="translucent"
                  onClick={() => setIsSettingDrawerOpen(true)}
                >
                  <SettingsIcon aria-hidden="true" />
                </Button>
              )}
            </CustomTooltip>
          </Show>

          {/* <Show when={currentShowHelp()}>
            <CustomTooltip content="Help">
              <Button
                variant="outline"
                // open help link
              >
                <CircleQuestionMarkIcon size={20} />
                Help
              </Button>
            </CustomTooltip>
          </Show> */}
        </div>
      </div>

      <Show when={isSpeedDialsLoaded()}>
        <Show
          when={speedDials.length > 0}
          fallback={
            <div class="flex min-w-[min(420px,calc(100vw-32px))] flex-col items-center self-center gap-1.5 rounded-2xl  border border-foreground/15 bg-foreground/2 px-8 py-10.5 text-center animate-[fadeInAnimation_0.45s_ease-out] border-dashed">
              <div class="mb-1.5 grid size-13.5 place-items-center rounded-lg border border-foreground/15 bg-foreground/8 text-muted-foreground">
                <FolderOpenIcon size={28} />
              </div>
              <Text size="lg" class="font-semibold">
                This folder is empty
              </Text>
              <Text size="sm" class="text-muted-foreground">
                Add a speed dial or folder to get started.
              </Text>
              <Button class="mt-2" onClick={() => openModal("ADD")}>
                <PlusIcon aria-hidden="true" />
                Add an item
              </Button>
            </div>
          }
        >
          <div
            class="grid grid-cols-[repeat(var(--grid-width,3),var(--dial-size,112px))] grid-rows-[repeat(var(--grid-height,3),var(--dial-size,112px))] gap-2 animate-[fadeInAnimation_0.75s_ease-in-out]"
            style={{
              "--grid-width": gridDimensions().width.toString(),
              "--grid-height": gridDimensions().height.toString(),
            }}
            // @ts-expect-error ts(2322)
            use:dndzone={{
              items: () => speedDials,
              flipDurationMs: 150,
              dragDisabled: currentDisableDragDrop,
              centreDraggedOnCursor: true,
              dropTargetStyle: {
                outline: "2px dashed var(--muted-foreground)",
                borderRadius: "8px",
              },
            }}
            on:consider={onDragConsider}
            on:finalize={onDragFinalize}
          >
            <For each={speedDials}>
              {(item) => (
                <GridItem
                  item={item}
                  openModal={openModal}
                  duplicateSpeedDial={duplicateSpeedDial}
                  openFolder={openFolder}
                  showTitle={currentShowSpeedDialTitles()}
                  textSize={currentDialTextSize()}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </>
  )
}
