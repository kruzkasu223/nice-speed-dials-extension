import {
  ExternalLinkIcon,
  HandHeartIcon,
  RotateCcwClockIcon,
  StarIcon,
} from "lucide-solid"
import { createSignal, Show } from "solid-js"
import { browser } from "wxt/browser"
import { Button } from "~/components/ui/button"
import { Dialog } from "~/components/ui/dialog"
import { Text } from "~/components/ui/text"

const REVIEW_URLS = {
  chrome:
    "https://chromewebstore.google.com/detail/nice-speed-dials/igdancpfkcmgelecddchfeijbofdcnaa/reviews",
  edge: "https://microsoftedge.microsoft.com/addons/detail/nice-speed-dials/bficopaolgfhkccfcnmfphkmnacekbil",
  firefox:
    "https://addons.mozilla.org/en-US/firefox/addon/nice-speed-dials/reviews/",
} as const

const SUPPORT_URL = "https://buymeacoffee.com/nsde"

export const AppreciationActions = (props: {
  isUpdatePage?: boolean
  showChangelog?: boolean
}) => {
  const [isSupportDialogOpen, setIsSupportDialogOpen] = createSignal(false)

  const openExternalPage = async (url: string) => {
    await browser.tabs.create({ url, active: true })
  }

  const openReviewPage = async () => {
    const browserName = import.meta.env.BROWSER as keyof typeof REVIEW_URLS
    await openExternalPage(REVIEW_URLS[browserName] ?? REVIEW_URLS.chrome)
  }

  const openSupportPage = async () => {
    setIsSupportDialogOpen(false)
    await openExternalPage(SUPPORT_URL)
  }

  const openChangelog = async () => {
    await browser.tabs.create({
      // @ts-expect-error - getURL is defined per-project, but not inside the package
      url: browser.runtime.getURL("/update.html"),
      active: true,
    })
  }

  return (
    <>
      <div class="space-y-1">
        <div class="flex flex-wrap gap-2">
          <Button
            variant={props.isUpdatePage ? "translucent" : "outline"}
            size={props.isUpdatePage ? "lg" : "lg"}
            onClick={openReviewPage}
          >
            <StarIcon aria-hidden="true" /> Leave a review
          </Button>
          <Button
            onClick={() => setIsSupportDialogOpen(true)}
            size={props.isUpdatePage ? "lg" : "lg"}
          >
            <HandHeartIcon aria-hidden="true" /> Support development
          </Button>
        </div>
        <Show when={props.showChangelog}>
          <Button
            class="px-0 mt-2"
            size="sm"
            variant="link"
            onClick={openChangelog}
          >
            <RotateCcwClockIcon aria-hidden="true" /> What's new
          </Button>
        </Show>
      </div>

      <Dialog.Root
        open={isSupportDialogOpen()}
        onOpenChange={(e) => setIsSupportDialogOpen(e.open)}
      >
        <Dialog.Content size="sm">
          <Dialog.Header
            title="Keep Nice Speed Dials moving"
            description="A small contribution gives this independent project more room to improve."
          />
          <Dialog.Body>
            <Text>
              If Nice Speed Dials makes your new tab a little calmer or faster,
              supporting its development is a lovely way to help. Every
              contribution goes toward future updates and polish.
            </Text>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close
              asChild={(closeProps) => (
                <Button {...closeProps()} variant="outline">
                  Maybe later
                </Button>
              )}
            />
            <Button onClick={openSupportPage}>
              <HandHeartIcon aria-hidden="true" /> Support the project
              <ExternalLinkIcon aria-hidden="true" />
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
