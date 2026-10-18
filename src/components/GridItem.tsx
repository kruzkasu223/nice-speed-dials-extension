import { Show } from "solid-js"
import { Text } from "~/components/ui/text"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import {
  type BookmarkDataType,
  getFolderIcon,
  DEFAULT_VALUES,
  type ModalTypes,
} from "~/stores"
import { getFaviconUrl } from "~/utils"
import { ContextMenu } from "./ContextMenu"
import { FolderIconGlyph } from "./FolderIconGlyph"

interface P {
  item: BookmarkDataType
  openModal: (type: ModalTypes, item?: BookmarkDataType) => void
  duplicateSpeedDial: (item: Partial<BookmarkDataType>) => void
  openFolder: (folder: BookmarkDataType) => void
  showTitle: boolean
  textSize: number
  openInNewTab: boolean
}

const gridItemActionClass =
  "block h-full w-full cursor-pointer border-0 bg-transparent p-2 font-[inherit] text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring"

const gridItemImageClass =
  "pointer-events-none h-full w-full select-none object-contain"

export const GridItem = (props: P) => {
  const target = () => (props.openInNewTab ? "_blank" : "_self")

  const itemContent = () => (
    <div class="flex h-full w-full flex-col items-center justify-evenly">
      <div class="h-1/2 w-1/2 rounded-(--dial-radius,4px) p-2">
        <Show
          when={props.item.url}
          fallback={
            <FolderIconGlyph
              name={getFolderIcon(props.item.id)}
              class={gridItemImageClass}
            />
          }
        >
          {(url) => (
            <img class={gridItemImageClass} src={getFaviconUrl(url())} alt="" />
          )}
        </Show>
      </div>

      <Show when={props.showTitle}>
        <Tooltip
          positioning={{ placement: "bottom" }}
          closeOnPointerDown={false}
          openDelay={150}
          closeDelay={0}
        >
          <TooltipTrigger
            asChild={(triggerProps) => (
              <span
                {...triggerProps()}
                class="w-full truncate text-center"
                style={{
                  "font-size":
                    props.textSize === DEFAULT_VALUES.dialTextSize
                      ? undefined
                      : `${props.textSize}px`,
                }}
              >
                {props.item.title}
              </span>
            )}
          />

          <TooltipContent class="w-max max-w-[min(48rem,calc(100vw-2rem))] text-center wrap-anywhere">
            <Text size="sm" class="font-semibold">
              {props.item.title}
            </Text>
            <Show when={props.item.url}>
              <Text size="sm">{props.item.url}</Text>
            </Show>
          </TooltipContent>
        </Tooltip>
      </Show>
    </div>
  )

  return (
    <div class="group/gridItem relative h-full w-full cursor-pointer overflow-hidden rounded-(--dial-radius,4px) border border-foreground/15 bg-foreground/4 transition-[background-color,border-color] duration-200 ease-out hover:border-foreground/20 hover:bg-foreground/10 hover:text-foreground focus-within:border-ring focus-within:bg-foreground/10 focus-within:text-foreground">
      <ContextMenu
        item={props.item}
        openModal={props.openModal}
        duplicateSpeedDial={props.duplicateSpeedDial}
      />

      <Show
        when={props.item.url}
        fallback={
          <button
            type="button"
            class={gridItemActionClass}
            onClick={() => props.openFolder(props.item)}
            aria-label={`Open ${props.item.title} folder`}
            title={props.showTitle ? undefined : props.item.title}
          >
            {itemContent()}
          </button>
        }
      >
        {(url) => (
          <a
            class={gridItemActionClass}
            href={url()}
            draggable={false}
            target={target()}
            rel={target() === "_blank" ? "noreferrer" : undefined}
            aria-label={`Open ${props.item.title}`}
            title={props.showTitle ? undefined : props.item.title}
          >
            {itemContent()}
          </a>
        )}
      </Show>
    </div>
  )
}
