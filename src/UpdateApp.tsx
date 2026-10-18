import { For, onMount, type JSX } from "solid-js"
import changelog from "../CHANGELOG.md?raw"
import { AppreciationActions } from "~/components/AppreciationActions"

type ChangelogSection = { title: string; entries: string[] }

type Release = { version: string; date?: string; sections: ChangelogSection[] }

const parseChangelog = (source: string): Release[] =>
  source
    .split(/^## /m)
    .slice(1)
    .map((release) => {
      const [heading = "", ...body] = release.trim().split("\n")
      const match = heading.match(/^(.*?)\s+\(([^)]+)\)$/)

      return {
        version: match?.[1] ?? heading,
        date: match?.[2],
        sections: body
          .join("\n")
          .split(/^### /m)
          .slice(1)
          .map((section) => {
            const [title = "", ...content] = section.trim().split("\n")
            return {
              title,
              entries: content
                .join("\n")
                .trim()
                .split(/\n(?=- )/)
                .map((entry) =>
                  entry.replace(/^- /, "").replace(/\n\s*/g, " ").trim()
                )
                .filter(Boolean),
            }
          }),
      }
    })

const renderInline = (text: string): JSX.Element[] =>
  text
    .split(/(\*\*[^*]+\*\*)/)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong>{part.slice(2, -2)}</strong>
      ) : (
        part
      )
    )

const releases = parseChangelog(changelog)

export const UpdateApp = () => {
  const latestRelease = releases[0]

  onMount(() => {
    document.title = "Release notes | Nice Speed Dials"
  })

  return (
    <div class="min-h-screen w-full bg-(--app-background-color,var(--background)) bg-no-repeat p-4 text-foreground [background-image:var(--app-background-image,none)] bg-position-(--app-background-position,auto) bg-size-(--app-background-size,auto) sm:p-8">
      <main class="mx-auto w-full max-w-3xl">
        <header class="border-b border-border pb-8 sm:pb-10">
          <p class="mb-3 font-medium text-primary text-sm">NICE SPEED DIALS</p>
          <h1 class="max-w-xl font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
            {latestRelease
              ? `${latestRelease.version} is here`
              : "Release notes"}
          </h1>
          <p class="mt-3 max-w-2xl text-base text-muted-foreground leading-6">
            A fresh round of improvements for the new tab you use every day.
          </p>

          <div class="mt-6">
            <AppreciationActions isUpdatePage />
          </div>
        </header>

        <section
          id="release-notes"
          class="py-8 sm:py-10"
          aria-labelledby="release-notes-title"
        >
          <div class="mb-7">
            <h2
              id="release-notes-title"
              class="font-heading font-semibold text-xl"
            >
              Release notes
            </h2>
          </div>

          <div class="overflow-hidden rounded-2xl border border-border bg-background/88 shadow-sm/5">
            <For each={releases}>
              {(release, releaseIndex) => (
                <article
                  class="p-5 sm:p-7"
                  classList={{ "border-t border-border": releaseIndex() > 0 }}
                >
                  <header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 class="font-heading font-semibold text-xl tracking-tight text-primary">
                      {release.version}
                    </h3>
                    <time class="text-muted-foreground text-sm">
                      {release.date}
                    </time>
                  </header>

                  <div class="mt-6 space-y-6">
                    <For each={release.sections}>
                      {(section) => (
                        <section
                          aria-labelledby={`${release.version}-${section.title}`}
                        >
                          <h4
                            id={`${release.version}-${section.title}`}
                            class="font-medium text-foreground text-sm"
                          >
                            {section.title}
                          </h4>
                          <ul class="mt-3 space-y-2 text-muted-foreground text-sm leading-6">
                            <For each={section.entries}>
                              {(entry) => (
                                <li class="relative ps-4 before:absolute before:inset-s-0 before:top-2.5 before:size-1 before:rounded-full before:bg-primary/72">
                                  {renderInline(entry)}
                                </li>
                              )}
                            </For>
                          </ul>
                        </section>
                      )}
                    </For>
                  </div>
                </article>
              )}
            </For>
          </div>
        </section>
      </main>
    </div>
  )
}
