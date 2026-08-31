import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"
import solid from "vite-plugin-solid"

export default defineConfig({
  imports: false,
  modules: ["@wxt-dev/module-solid"],
  srcDir: "./src",
  zip: {
    artifactTemplate: "extension-{{browser}}.zip",
    includeSources: [
      "src",
      "public",
      "package.json",
      "yarn.lock",
      "README.md",
      "tsconfig.json",
      "wxt.config.ts",
    ],
  },
  vite: () => ({
    plugins: [tailwindcss(), solid()],
    build: { chunkSizeWarningLimit: 1000 },
  }),
  manifest: (env) => ({
    name: "Nice Speed Dials",
    description:
      "A fast, calm, and customizable new-tab page powered by your browser bookmarks.",
    version: "6",
    version_name: "carbon (v6)",
    permissions: [
      "bookmarks",
      "contextMenus",
      "storage",
      "tabs",
      ...(env.browser !== "firefox" ? ["favicon"] : []),
    ],
    icons: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  }),
})
