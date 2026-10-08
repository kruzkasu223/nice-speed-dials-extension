import { InfoIcon, RotateCcwIcon, Undo2Icon, XIcon } from "lucide-solid"
import { Button } from "~/components/ui/button"
import { Drawer } from "~/components/ui/drawer"
import { Text } from "~/components/ui/text"
import {
  isSettingDrawerOpen,
  setIsSettingDrawerOpen,
  gridColumns,
  dialSize,
  dialRadius,
  showSpeedDialTitles,
  showAddNewButton,
  showSettingsButton,
  showHelpButton,
  openLinksInNewTab,
  rememberLastFolder,
  disableDragAndDrop,
  darkMode,
  mainBackgroundColor,
  mainBackgroundImage,
  resetAllSettings,
  resetSetting,
  toggleSettingsDrawer,
  DEFAULT_VALUES,
  speedDials,
} from "~/stores"
import { ColorPicker, Divider, FileUpload } from "."
import {
  NumberInput,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
  NumberInputInput,
  NumberInputScrubber,
} from "~/components/ui/number-input"
import { Switch } from "~/components/ui/switch"
import { Show, createSignal, onMount, createMemo } from "solid-js"
import { Slider } from "~/components/ui/slider"
import { getGridDimensions } from "~/utils"
import { AppreciationActions } from "./AppreciationActions"
import { CustomTooltip } from "./CustomTooltip"

const RADII = [
  "none",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
] as const

export const SettingsDrawer = () => {
  // Reactive signals for settings
  const [currentGridColumns, setCurrentGridColumns] = createSignal<
    number | undefined
  >(DEFAULT_VALUES.gridColumns)
  const [currentDialSize, setCurrentDialSize] = createSignal(
    DEFAULT_VALUES.dialSize
  )
  const [currentDialRadius, setCurrentDialRadius] = createSignal(
    DEFAULT_VALUES.dialRadius
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
  const [currentOpenLinksNewTab, setCurrentOpenLinksNewTab] = createSignal(
    DEFAULT_VALUES.openLinksInNewTab
  )
  const [currentRememberLastFolder, setCurrentRememberLastFolder] =
    createSignal(DEFAULT_VALUES.rememberLastFolder)
  const [currentDisableDragDrop, setCurrentDisableDragDrop] = createSignal(
    DEFAULT_VALUES.disableDragAndDrop
  )
  const [currentDarkMode, setCurrentDarkMode] = createSignal(
    DEFAULT_VALUES.darkMode
  )
  const [currentBgColor, setCurrentBgColor] = createSignal(
    DEFAULT_VALUES.mainBackgroundColor
  )
  const [currentBgImage, setCurrentBgImage] = createSignal<string | undefined>(
    DEFAULT_VALUES.mainBackgroundImage
  )

  // Load settings on mount
  onMount(async () => {
    setCurrentGridColumns((await gridColumns.getValue()) ?? undefined)
    setCurrentDialSize(await dialSize.getValue())
    setCurrentDialRadius(await dialRadius.getValue())
    setCurrentShowSpeedDialTitles(await showSpeedDialTitles.getValue())
    setCurrentShowAddNew(await showAddNewButton.getValue())
    setCurrentShowSettings(await showSettingsButton.getValue())
    setCurrentShowHelp(await showHelpButton.getValue())
    setCurrentOpenLinksNewTab(await openLinksInNewTab.getValue())
    setCurrentRememberLastFolder(await rememberLastFolder.getValue())
    setCurrentDisableDragDrop(await disableDragAndDrop.getValue())
    setCurrentDarkMode(await darkMode.getValue())
    setCurrentBgColor(await mainBackgroundColor.getValue())
    setCurrentBgImage(await mainBackgroundImage.getValue())

    // Watch for changes
    gridColumns.watch((value) => setCurrentGridColumns(value ?? undefined))
    dialSize.watch(setCurrentDialSize)
    dialRadius.watch(setCurrentDialRadius)
    showSpeedDialTitles.watch(setCurrentShowSpeedDialTitles)
    showAddNewButton.watch(setCurrentShowAddNew)
    showSettingsButton.watch(setCurrentShowSettings)
    showHelpButton.watch(setCurrentShowHelp)
    openLinksInNewTab.watch(setCurrentOpenLinksNewTab)
    rememberLastFolder.watch(setCurrentRememberLastFolder)
    disableDragAndDrop.watch(setCurrentDisableDragDrop)
    darkMode.watch(setCurrentDarkMode)
    mainBackgroundColor.watch(setCurrentBgColor)
    mainBackgroundImage.watch(setCurrentBgImage)

    // Watch for toggle settings drawer
    toggleSettingsDrawer.watch(async (value) => {
      if (value) {
        setIsSettingDrawerOpen(!isSettingDrawerOpen())
        await toggleSettingsDrawer.setValue(false)
      }
    })
  })

  // Calculate default columns when no custom value is set
  const defaultColumns = createMemo(() => {
    return getGridDimensions(speedDials.length).gridWidth
  })

  const handleResetAll = async () => {
    await resetAllSettings()
    setCurrentBgColor(DEFAULT_VALUES.mainBackgroundColor)
    setCurrentBgImage(undefined)
  }

  const handleBackgroundReset = async () => {
    // Update the visible state first so reset feels immediate.
    setCurrentBgColor(DEFAULT_VALUES.mainBackgroundColor)
    setCurrentBgImage(undefined)
    await Promise.all([
      resetSetting("mainBackgroundColor"),
      resetSetting("mainBackgroundImage"),
    ])
  }

  return (
    <Drawer.Root
      open={isSettingDrawerOpen()}
      onOpenChange={(e) => setIsSettingDrawerOpen(e.open)}
      swipeDirection="end"
    >
      <Drawer.Content placement="right" variant="inset" draggable={false}>
        <Drawer.Header
          class="pr-16"
          title="Settings"
          description="Choose how your new tab looks and works."
        />
        <Drawer.Close
          asChild={(closeProps) => (
            <Button
              {...closeProps()}
              aria-label="Close settings"
              variant="ghost"
              size="icon-lg"
              class="absolute top-4 right-4"
            >
              <XIcon aria-hidden="true" />
            </Button>
          )}
        />

        <Drawer.Body>
          <section aria-labelledby="about-heading" class="space-y-3">
            <div>
              <Text id="about-heading" size="lg" class="font-bold">
                About
              </Text>
              <Text size="sm">
                See what changed, share feedback, or support future updates.
              </Text>
            </div>

            <AppreciationActions showChangelog />
          </section>

          <Divider />

          <div>
            <SettingItemTitle
              title="Main background"
              subTitle="An uploaded image takes priority over the selected color."
              showReset
              onReset={handleBackgroundReset}
            />
            <ColorPicker
              class="mt-4"
              value={currentBgColor()}
              onValueChange={(e) => {
                mainBackgroundColor.setValue(
                  e.value.toString("hex") || DEFAULT_VALUES.mainBackgroundColor
                )
              }}
            />

            <div class="flex items-center gap-2">
              <Divider />
              <Text class="my-2 font-bold">or</Text>
              <Divider />
            </div>

            <FileUpload
              currentImage={currentBgImage()}
              accept="image/*"
              onFilesChange={async (files) => {
                const file = files[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onloadend = async () => {
                    const base64String = reader.result as string
                    setCurrentBgImage(base64String || undefined)
                    await mainBackgroundImage.setValue(
                      base64String || undefined
                    )
                  }
                  reader.readAsDataURL(file)
                } else {
                  setCurrentBgImage(undefined)
                  await mainBackgroundImage.setValue(undefined)
                }
              }}
              onRemove={async () => {
                setCurrentBgImage(undefined)
                await mainBackgroundImage.setValue(undefined)
              }}
            />
            {/* TODO: input field for gradients, or add a tabs for all the options [color, image, gradient, etc] */}
          </div>

          <Divider />

          <div>
            <div class="flex items-center justify-between gap-2">
              <SettingItemTitle title="Dark mode" />
              <Switch
                aria-label="Dark mode"
                checked={currentDarkMode()}
                onCheckedChange={(e) => darkMode.setValue(e.checked)}
              />
            </div>
          </div>

          <Divider />

          <div>
            <SettingItemTitle
              title="Grid"
              subTitle="Set the number of columns. Rows adjust automatically."
              showReset
              onReset={() => resetSetting("gridColumns")}
            />
            <NumberInput
              class="mt-4 max-w-40"
              value={
                currentGridColumns()?.toString() || defaultColumns()?.toString()
              }
              onValueChange={(e) => {
                const value = Number.parseInt(e.value || "0")
                if (value >= 1 && value <= 40) gridColumns.setValue(value)
              }}
              min={1}
              max={40}
              step={1}
            >
              <NumberInputScrubber>Columns</NumberInputScrubber>
              <NumberInputGroup>
                <NumberInputDecrement />
                <NumberInputInput class="text-center" />
                <NumberInputIncrement />
              </NumberInputGroup>
            </NumberInput>
          </div>

          <Divider />

          <div>
            <SettingItemTitle
              title="Dial size"
              subTitle="Set how much space each speed dial uses."
              showReset
              onReset={() => resetSetting("dialSize")}
            />
            <Slider
              aria-label={["Dial size"]}
              class="mt-4 mb-6"
              min={40}
              max={200}
              value={[currentDialSize()]}
              onValueChange={(e) => {
                const val = e.value[0]
                if (val !== undefined) {
                  dialSize.setValue(val)
                }
              }}
              marks={[
                { value: 40, label: "xs" },
                { value: 60, label: "sm" },
                { value: 80, label: "md" },
                { value: 100, label: "lg" },
                // { value: 112, label: "lg" },
                { value: 120, label: "xl" },
                { value: 140, label: "2xl" },
                { value: 160, label: "3xl" },
                { value: 180, label: "3xl" },
                { value: 200, label: "4xl" },
              ]}
            />
          </div>

          <Divider />

          <div>
            <SettingItemTitle
              title="Dial corner radius"
              showReset
              onReset={() => resetSetting("dialRadius")}
            />
            <Slider
              aria-label={["Dial corner radius"]}
              class="mt-4 mb-6"
              min={0}
              max={RADII.length - 1}
              value={[
                Math.max(
                  0,
                  Math.min(
                    RADII.length - 1,
                    RADII.indexOf(
                      currentDialRadius() as (typeof RADII)[number]
                    ) || 0
                  )
                ),
              ]}
              onValueChange={(e) => {
                const val = e.value[0]
                if (val !== undefined && RADII[val]) {
                  dialRadius.setValue(RADII[val])
                }
              }}
              marks={RADII.map((borderRadius, index) => ({
                value: index,
                label: borderRadius,
              }))}
            />
          </div>

          <Divider />

          <div>
            <div class="flex items-center justify-between gap-2">
              <SettingItemTitle title="Show speed dial titles" />
              <Switch
                aria-label="Show speed dial titles"
                checked={currentShowSpeedDialTitles()}
                onCheckedChange={(e) => showSpeedDialTitles.setValue(e.checked)}
              />
            </div>
          </div>

          <Divider />

          <div>
            <div class="flex items-center justify-between gap-2">
              <SettingItemTitle title="Show Add button" />
              <Switch
                aria-label="Show Add button"
                checked={currentShowAddNew()}
                onCheckedChange={(e) => showAddNewButton.setValue(e.checked)}
              />
            </div>
          </div>

          <Divider />

          <div>
            <div class="flex items-center justify-between gap-2">
              <SettingItemTitle
                title="Show Settings button"
                info="You can still open Settings from the right-click menu on this page."
              />
              <Switch
                aria-label="Show Settings button"
                checked={currentShowSettings()}
                onCheckedChange={(e) => showSettingsButton.setValue(e.checked)}
              />
            </div>
          </div>

          <Divider />

          {/* <div>
              <Flex justify="space-between" align="center">
                <SettingItemTitle title="Show 'Help' button" />
                <Switch
                  checked={currentShowHelp()}
                  onCheckedChange={(e) => showHelpButton.setValue(e.checked)}
                />
              </Flex>
            </div>

            <Divider /> */}

          <div>
            <div class="flex items-center justify-between gap-2">
              <SettingItemTitle
                title="Remember last opened folder"
                info="Start new tabs in your last opened folder."
              />
              <Switch
                aria-label="Remember last opened folder"
                checked={currentRememberLastFolder()}
                onCheckedChange={(e) => rememberLastFolder.setValue(e.checked)}
              />
            </div>
          </div>

          <Divider />

          <div>
            <div class="flex items-center justify-between gap-2">
              <SettingItemTitle title="Open links in a new tab" />
              <Switch
                aria-label="Open links in a new tab"
                checked={currentOpenLinksNewTab()}
                onCheckedChange={(e) => openLinksInNewTab.setValue(e.checked)}
              />
            </div>
          </div>

          <Divider />

          <div>
            <div class="flex items-center justify-between gap-2">
              <SettingItemTitle title="Turn off drag and drop" />
              <Switch
                aria-label="Turn off drag and drop"
                checked={currentDisableDragDrop()}
                onCheckedChange={(e) => disableDragAndDrop.setValue(e.checked)}
              />
            </div>
          </div>
        </Drawer.Body>

        <Drawer.Footer class="gap-3">
          <Drawer.Close
            asChild={(closeProps) => (
              <Button {...closeProps()} variant="outline">
                Close
              </Button>
            )}
          />

          <Button variant="outline" onClick={handleResetAll}>
            <Undo2Icon aria-hidden="true" /> Reset all settings
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer.Root>
  )
}

const SettingItemTitle = (props: {
  title: string
  subTitle?: string
  showReset?: boolean
  info?: string
  onReset?: () => void
}) => {
  return (
    <>
      <div class="flex items-center gap-2">
        <Text size="lg" class="font-bold">
          {props.title}
        </Text>

        <Show when={props.info}>
          <CustomTooltip
            content={props.info ?? ""}
            openDelay={0}
            positioning={{ placement: "top" }}
            class="max-w-xs text-center"
          >
            {(triggerProps) => (
              <Button
                {...triggerProps()}
                aria-label={`About ${props.title}`}
                variant="ghost"
                size="icon-xs"
              >
                <InfoIcon aria-hidden="true" />
              </Button>
            )}
          </CustomTooltip>
        </Show>

        <Show when={props.showReset}>
          <CustomTooltip
            content="Reset to default"
            openDelay={0}
            positioning={{ placement: "top" }}
          >
            {(triggerProps) => (
              <Button
                {...triggerProps()}
                aria-label={`Reset ${props.title} to default`}
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.preventDefault()
                  props.onReset?.()
                }}
              >
                <RotateCcwIcon aria-hidden="true" />
              </Button>
            )}
          </CustomTooltip>
        </Show>
      </div>

      <Show when={props.subTitle}>
        <Text size="sm">{props.subTitle}</Text>
      </Show>
    </>
  )
}
