import { browser } from "wxt/browser"

export const prepareReleaseVideos = async () => {
  // Extension pages omit HTTP Referer even with an iframe referrer policy.
  // YouTube requires an HTTPS app identity to avoid player error 153.
  const extensionHost = window.location.hostname
  const appId = browser.runtime.id.replace(/[^a-z0-9.-]/gi, "-").toLowerCase()
  const referrer = `https://nice-speed-dials.${appId}/`

  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "Referer", operation: "set", value: referrer },
          ],
        },
        condition: {
          initiatorDomains: [extensionHost],
          regexFilter:
            "^https://www\\.youtube-nocookie\\.com/embed/(_elcX0A3V9I|-EoPEjAIyec)([?].*)?$",
          resourceTypes: ["sub_frame"],
        },
      },
    ],
  })
}
