import { createEffect } from "solid-js"
import {
  darkMode,
  DEFAULT_VALUES,
  mainBackgroundColor,
  mainBackgroundImage,
} from "~/stores/useSettings"
import { createStoredSignal } from "~/utils/createStoredSignal"

type AppThemeOptions = { useCustomBackground?: boolean }

export const useAppTheme = (options: AppThemeOptions = {}) => {
  const useCustomBackground = options.useCustomBackground ?? true
  const [isDarkMode] = createStoredSignal(darkMode, DEFAULT_VALUES.darkMode)
  const [bgColor] = useCustomBackground
    ? createStoredSignal(
        mainBackgroundColor,
        DEFAULT_VALUES.mainBackgroundColor
      )
    : [() => undefined]
  const [bgImage] = useCustomBackground
    ? createStoredSignal(
        mainBackgroundImage,
        DEFAULT_VALUES.mainBackgroundImage
      )
    : [() => undefined]

  createEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode())
  })

  createEffect(() => {
    const hasBackgroundImage = useCustomBackground && !!bgImage()

    document.documentElement.style.setProperty(
      "--app-background-color",
      hasBackgroundImage
        ? "transparent"
        : useCustomBackground
          ? bgColor() || DEFAULT_VALUES.mainBackgroundColor
          : isDarkMode()
            ? DEFAULT_VALUES.mainBackgroundColor
            : "color-mix(in srgb, var(--primary) 8%, var(--background))"
    )
    document.documentElement.style.setProperty(
      "--app-background-image",
      hasBackgroundImage ? `url(${bgImage()})` : "none"
    )
    document.documentElement.style.setProperty(
      "--app-background-size",
      hasBackgroundImage ? "cover" : "auto"
    )
    document.documentElement.style.setProperty(
      "--app-background-position",
      hasBackgroundImage ? "center" : "auto"
    )
  })
}
