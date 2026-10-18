import { FolderIcon, type icons, type LucideProps } from "lucide-solid"
import { createSignal, createEffect, splitProps } from "solid-js"
import { Dynamic } from "solid-js/web"
import { DEFAULT_FOLDER_ICON } from "~/stores/useFolderIcons"

export type LucideIconName = keyof typeof icons

const [catalog, setCatalog] = createSignal<typeof icons>()
let catalogPromise: Promise<void> | undefined
const loadCatalog = () =>
  (catalogPromise ??= import("~/utils/folderIconCatalog")
    .then((module) => {
      setCatalog(module.icons)
    })
    .catch((error) => {
      catalogPromise = undefined
      console.error("Unable to load folder icons", error)
    }))

export const isLucideIconName = (name?: string): name is LucideIconName =>
  !!name &&
  (name === DEFAULT_FOLDER_ICON ||
    Object.prototype.hasOwnProperty.call(catalog() ?? {}, name))

type FolderIconGlyphProps = LucideProps & { name?: string }

export const FolderIconGlyph = (props: FolderIconGlyphProps) => {
  const [local, iconProps] = splitProps(props, ["name"])
  createEffect(() => {
    if (local.name && local.name !== DEFAULT_FOLDER_ICON && !catalog())
      void loadCatalog()
  })
  const icon = () => {
    const loaded = catalog()
    return loaded && isLucideIconName(local.name)
      ? loaded[local.name]
      : FolderIcon
  }
  return <Dynamic component={icon()} {...iconProps} />
}
