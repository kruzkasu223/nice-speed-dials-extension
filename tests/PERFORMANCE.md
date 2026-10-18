# Performance audit and reusable optimization guide

This document explains the performance changes made to Nice Speed Dials in
October 2026. It covers what was wrong, how the issues were found, how the
implementation works, what was measured, and how to apply the same reasoning to
another project.

The largest improvements came from reducing repeated work. Every dial was
independently reading and subscribing to the same setting. Every bookmark event
was scheduling a complete reload. Every new tab was loading settings controls
and the entire icon catalog before the user needed them.

## 1. Terms used in this guide

| Term                     | Plain-language meaning                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Bundle                   | JavaScript files produced by the production build.                                                                            |
| Initial JavaScript       | The JavaScript loaded to display the page before optional features are opened.                                                |
| Code splitting           | Producing separate JavaScript files so some features can load later.                                                          |
| Lazy loading             | Waiting until a feature is needed before loading or creating it.                                                              |
| Listener or subscription | A callback that stays registered and receives future changes.                                                                 |
| Cleanup                  | Unregistering callbacks or releasing other resources when their owner is removed.                                             |
| Signal                   | A SolidJS value whose consumers update when it changes.                                                                       |
| DOM                      | The browser's live representation of the page's elements.                                                                     |
| Reconciliation           | Updating existing state by matching items to their stable identities.                                                         |
| Cache                    | A saved result that can be reused instead of fetched or computed again.                                                       |
| Invalidation             | Marking a cached result as outdated.                                                                                          |
| Race condition           | An outcome that depends on which asynchronous operation finishes first.                                                       |
| IPC                      | Communication between processes. Browser extension API calls can require communication outside the page's JavaScript context. |
| Fixture                  | Controlled test data that makes a scenario repeatable.                                                                        |

## 2. How the investigation worked

### Trace the paths users exercise repeatedly

I inspected the entry points, components, stores, utilities, CSS, dependencies,
and build configuration. The review concentrated on the work triggered by
opening a new tab, displaying each dial, navigating folders, receiving bookmark
events, changing settings, and copying folders.

Useful searches included:

```sh
rg --files src
rg -n 'onMount|onCleanup|watch\(|addEventListener|setTimeout|createEffect' src
rg -n 'getValue|getSubTree|getChildren|bookmarks\.get|reconcile' src
```

These searches locate potential problems; they do not prove that every matching
line is expensive. For each suspicious path, I checked how often it ran, what it
allocated or requested, and how its lifetime ended.

For example, a storage watcher in a single long-lived page component can be
appropriate. The same watcher inside every dial becomes hundreds of watchers. If
those watchers also survive when dials disappear, the cost grows with navigation
history.

### Build a baseline before changing the code

I ran a production Chrome build and saved a copy outside the working tree for
comparison. Production output matters because development mode includes
additional machinery and uses different loading behavior.

The baseline new tab loaded two JavaScript files totaling 1,137,167 uncompressed
bytes, approximately 1.14 MB. The build also reported two Solid transform
passes. That prompted inspection of both the application configuration and the
installed WXT Solid module.

### Add counters around the actual sources of repeated work

The browser fixture in [tests/fixtures/browser.js](tests/fixtures/browser.js)
supplies in-memory bookmarks, storage, and browser events. It counts bookmark
API calls, storage reads, and active storage listeners.

The fixture contains 100 bookmarks at Home and one folder containing another 50
bookmarks. Home therefore displays 101 items: 100 links and one folder.

I used the same fixture against the baseline and modified production builds. The
scenarios included three folder round trips and a burst of 100 bookmark-change
events. This allowed direct comparison of work counts without touching real
bookmarks.

### Check correctness as well as reduced work

A cache can be fast while displaying stale data. A lazily loaded dialog can lose
initial focus. A list optimization can disrupt drag-and-drop. The checks
therefore exercised the behavior around each optimization, rather than only
checking smaller numbers.

## 3. Measured results and their limits

| Measurement                                              |   Before |  After |
| -------------------------------------------------------- | -------: | -----: |
| Initial new-tab JavaScript, uncompressed                 | 1,137 KB | 254 KB |
| Initial storage reads                                    |      149 |     34 |
| Initial storage listeners                                |      131 |     16 |
| Storage listeners after three folder round trips         |      584 |     16 |
| Additional full tree reads for those six navigations     |        6 |      0 |
| Full tree reads caused by 100 simultaneous change events |      100 |      1 |
| Listeners after navigation and the event burst           |   10,684 |     16 |

The approximately 78% reduction describes **initial JavaScript bytes with
default folder icons**. It does not establish that the whole application runs
78% faster. Parsing and executing less JavaScript should reduce startup work,
but this audit did not measure real-user loading times, heap memory in
megabytes, or Core Web Vitals.

The modified initial JavaScript measured 253,853 bytes in the final browser
check. Small future source changes can change exact file sizes and filenames.

The complete icon catalog still exists in the extension package. Code splitting
primarily changes when code is loaded. Total installed JavaScript remained
roughly unchanged, with a small increase from splitting and loading machinery.

The listener count of 16 applies before optional settings UI is opened in this
fixture. Opening Settings creates its own bounded set of subscriptions. The
important property is that the count no longer grows with the number of dials or
repeated folder navigation.

Storage read counts include work performed by the storage library, such as item
initialization and metadata checks. A counted read is not necessarily one
physical disk access.

## 4. Fix: stop every dial subscribing to the same setting

Relevant files: [Grid.tsx](src/components/Grid.tsx),
[GridItem.tsx](src/components/GridItem.tsx), and
[createStoredSignal.ts](src/utils/createStoredSignal.ts).

### What happened before

Every `GridItem` read `openLinksInNewTab` when it mounted and registered a
watcher for that setting. The simplified pattern was:

```ts
onMount(async () => {
  const value = await openLinksInNewTab.getValue()
  setTarget(value ? "_blank" : "_self")

  openLinksInNewTab.watch((value) => {
    setTarget(value ? "_blank" : "_self")
  })
})
```

All dials use the same preference. Nevertheless, a page with 101 items performed
that setup 101 times. The watcher returns a function that unregisters it, but
the old code discarded that function.

When the user entered another folder, old dials disappeared and new dials
mounted. The old watchers remained registered. They retained callbacks and
associated state and still participated in future storage change notifications.

### How the issue was confirmed

The fixture counted active listener registrations. The baseline started at 131
storage listeners. After three folder round trips it had 584. After the
additional burst of 100 bookmark events it had 10,684.

Those are counts of active callbacks, not a measurement of memory bytes. They
demonstrate an accumulating resource lifetime problem.

### What changed

`Grid` now reads and watches the preference once for the whole grid:

```ts
const [currentOpenLinksNewTab] = createStoredSignal(
  openLinksInNewTab,
  DEFAULT_VALUES.openLinksInNewTab
)
```

It passes the resulting boolean into each item:

```tsx
<GridItem openInNewTab={currentOpenLinksNewTab()} /* other props */ />
```

Each dial derives its target from that property:

```ts
const target = () => (props.openInNewTab ? "_blank" : "_self")
```

The dial still reacts when the preference changes. It simply receives the shared
result instead of independently talking to storage.

### Apply this elsewhere

When a repeated component accesses the same external source, ask whether its
parent can own the subscription and pass down the value. This applies to
preferences, authentication state, connection status, shared clocks, and other
values that are identical across a list.

A useful scaling question is: **If I render 1,000 rows, do I create 1,000
external subscriptions?** Sometimes that is required; for a single shared
preference, it usually is not.

## 5. Fix: concurrent settings reads with reliable cleanup

Relevant files: [createStoredSignal.ts](src/utils/createStoredSignal.ts),
[Grid.tsx](src/components/Grid.tsx),
[SettingsDrawer.tsx](src/components/SettingsDrawer.tsx), and
[useAppTheme.ts](src/useAppTheme.ts).

### What happened before

Settings were loaded through sequential awaits:

```ts
setSize(await dialSize.getValue())
setRadius(await dialRadius.getValue())
setTextSize(await dialTextSize.getValue())
```

The radius read did not start until the size read finished. These values are
independent, so that waiting chain was unnecessary. Watchers were registered
only after the reads completed, and their unsubscribe functions were discarded.

### How the new helper works

`createStoredSignal(item, fallback)` creates a signal and immediately starts two
things: a watcher for future changes and a read for the initial value. Each call
starts its own read without awaiting previous calls, so independent reads can
overlap.

The helper also tracks two conditions:

- `active`: the component still exists.
- `changed`: a newer storage event has already arrived.

The initial read updates the signal only if the component is still active and no
newer event has arrived.

Consider this sequence:

```text
Initial storage read starts
User changes the setting
Watcher receives the new value
Initial read finishes with an older value
```

Without the `changed` guard, the final step could overwrite the newer value.
With the guard, the stale initial result is ignored.

Cleanup sets `active` to false and calls the watcher's unsubscribe function.
This also prevents a pending initial read from updating a disposed component.

### Why cleanup is registered before an await

SolidJS cleanup belongs to a reactive owner, such as a component or root. In
this helper, setup and `onCleanup` registration run synchronously while that
owner is available.

Moving `onCleanup` into an asynchronous callback after an `await` can lose the
original ownership context. Register cleanup during synchronous setup, then let
asynchronous work finish under explicit guards.

This is a lifecycle concern, not merely a preference for shorter syntax.

### Defaults and local updates

Removed or missing values fall back through `value ?? fallback`. This preserves
valid values such as `false` and `0`, which a broad `value || fallback` would
replace.

The helper returns the signal accessor and setter. The background controls use
the setter for an immediate local update while saving the persistent value.

**The setter does not save to storage.** Persistence still requires calling the
storage item's `setValue`. Also, this helper does not automatically deduplicate
subscriptions across the entire application: each call owns one subscription.
The link-target optimization works because the call was moved out of individual
dials and into `Grid`.

### Apply this elsewhere

Start independent asynchronous reads together. With ordinary promises, a common
equivalent is:

```ts
const [size, radius, textSize] = await Promise.all([
  readSize(),
  readRadius(),
  readTextSize(),
])
```

Keep dependent operations sequential. Register cancellation or cleanup while the
component's lifecycle context is available, and decide how old results should
behave when newer data arrives.

## 6. Fix: load optional UI and the icon catalog when needed

Relevant files: [Grid.tsx](src/components/Grid.tsx),
[InputModal.tsx](src/components/InputModal.tsx),
[IconSelector.tsx](src/components/IconSelector.tsx),
[FolderIconGlyph.tsx](src/components/FolderIconGlyph.tsx), and
[folderIconCatalog.ts](src/utils/folderIconCatalog.ts).

### What happened before

The page statically imported the settings drawer, input dialog, icon selector,
and full Lucide icon registry. The registry supports choosing an icon by its
name, so the application needs access to many possible icons.

That dynamic choice prevents the build from treating all unused icons like
ordinary unused named imports. Even someone who only opens a bookmark paid the
initial loading cost of the complete registry and optional editing controls.

### How the issue was found

The production build showed a very large new-tab JavaScript file. Reading the
import paths showed that `FolderIconGlyph` and `IconSelector` imported the full
`icons` object. Settings and modal code were also reachable from startup
imports.

This was a concrete loading problem. It was not a reason to remove custom icons
or rewrite the UI library.

### What changed for dialogs and settings

`Grid` uses dynamic imports through Solid's `lazy`:

```ts
const SettingsDrawer = lazy(() =>
  import("./SettingsDrawer").then((module) => ({
    default: module.SettingsDrawer,
  }))
)
```

The component is rendered only after Settings has been requested. `Suspense`
handles the asynchronous component load.

There are separate flags for whether a feature has ever been mounted and whether
it is currently open. Once loaded, the outer component remains mounted so that
its close animation and focus restoration can complete. The drawer's content
uses `lazyMount` and `unmountOnExit` to avoid keeping its closed controls
mounted.

This distinction matters: immediately removing an entire dialog on close can
interrupt behavior provided by the dialog library.

The icon selector has another lazy boundary inside the input dialog. Opening a
regular bookmark form therefore does not immediately load the icon-selection UI.

### What changed for folder icons

The ordinary folder icon remains a small, direct import. The full registry moved
behind a dynamic import in `folderIconCatalog.ts`.

When a folder requests a non-default icon, `FolderIconGlyph` starts loading that
catalog. Until it arrives, it can display the ordinary folder icon. Once the
registry is available, the reactive component resolves the requested icon.

The module stores one shared promise for the load. If many custom folders render
together, they share the same pending request. A failed load is logged and
clears that promise so a later call can attempt loading again.

The icon-name type uses a type-only import. Type information does not require
loading the registry at runtime.

### Tradeoffs

The first opening of an optional feature now includes loading its JavaScript
chunk. All chunks ship with the installed extension; fetching a local chunk
still has work associated with it.

A tab displaying custom folder icons still loads the entire catalog when those
icons are needed. This change does not create a separate chunk for each icon.
The 78% startup-byte reduction therefore applies to the default-icon scenario.

### Apply this elsewhere

Good candidates include settings, editors, advanced filters, export tools, and
large catalogs. Keep features required for the first useful screen available
immediately.

Verify the output after adding a lazy boundary. A remaining eager import
elsewhere can still pull the same dependency into startup.

## 7. Fix: narrow imports and isolate release-note startup

Relevant files: [App.tsx](src/App.tsx),
[GridItem.tsx](src/components/GridItem.tsx),
[SettingsDrawer.tsx](src/components/SettingsDrawer.tsx), and
[useAppTheme.ts](src/useAppTheme.ts).

The project has barrel modules: files that re-export several other modules, such
as `components/index.ts` and `stores/index.ts`. They make imports convenient,
but can hide how much code is reachable and which imported modules have startup
side effects.

Several imports now point directly to the needed module. For example, `App`
imports `Grid` directly, and `GridItem` imports its context menu and folder
glyph directly. These changes help maintain the intended lazy-loading
boundaries.

This does not mean every barrel import is slow. Bundlers can remove unused
exports when doing so is safe. The concern is modules that perform work during
evaluation, or dependency paths that accidentally reach eagerly loaded features.

`useAppTheme` now imports settings directly from `useSettings`. Previously, its
import through the stores barrel also reached bookmark-store initialization. The
release-notes page uses the theme hook but does not need to load speed dials.

The browser check visits `update.html` and confirms that startup does not call
`getSubTree`. It still performs legitimate theme and storage setup.

The theme hook also now starts with the configured default dark-mode value,
matching the initial dark HTML class, rather than initially forcing a false
value before reading storage. A saved preference still replaces that default
when loaded. No separate visual-flash timing was measured.

**Transferable lesson:** shared modules should have clear startup behavior. A
formatting helper or theme hook should not unexpectedly initialize an unrelated
data store.

## 8. Fix: reuse the bookmark tree during navigation

Relevant file: [useSpeedDials.ts](src/stores/useSpeedDials.ts).

### What happened before

A folder load could validate the root, walk ancestors through repeated
`bookmarks.get` calls, request the current folder's children, and fetch the
complete speed-dial subtree.

The application already received the full tree, including folder relationships
and children. Fetching those relationships again for each navigation repeated
work across the browser API boundary.

### What changed

The store keeps a tree snapshot and builds a `Map` from folder ID to folder
node. The map allows a requested folder to be found without scanning the
complete tree on each navigation.

The current folder's children come from that snapshot. Breadcrumbs are built by
following `parentId` through the folder map. If the requested folder is absent,
the path falls back to Home.

Two counters determine whether the snapshot can be reused:

```ts
let treeVersion = 0
let loadedTreeVersion = -1
```

A bookmark event increments `treeVersion`. A snapshot records the version at
which its load began. When the versions match, navigation can reuse the cached
tree. When they differ, the next load retrieves a fresh tree.

### Why record the version before awaiting the API

Suppose a tree request begins at version 5 and a bookmark changes before the
request finishes. The event increments the version to 6. The completed request
is recorded as version 5, so the cache remains invalid and a subsequent refresh
can retrieve the newer state.

Recording the current version only after the request finished could incorrectly
claim that a potentially older response already included the intervening event.

### Keep the cache separate from mutable display state

Drag-and-drop updates the display store. The loader copies each displayed item's
top-level fields and leaves nested `children` in the cached tree:

```ts
const children = (nextFolder.children ?? []).map(
  ({ children, ...item }) => item
)
```

This prevents display-store mutations from directly modifying the objects used
as the cached tree. The separation is useful when the UI temporarily changes
order before the browser has persisted it.

### Preserve sequencing and publish related state together

The existing promise queue still keeps navigation loads ordered. The scheduler
described next reduces redundant event-driven loads before they enter this
queue.

The loader also retains the existing `batch` that publishes the current folder,
breadcrumb, tree, and dials together. That behavior predates this audit; it
remains important so items do not briefly appear under another folder's
breadcrumb or layout.

### Measured result and tradeoffs

Six navigations during three round trips previously caused six additional
full-tree reads. The modified version caused zero additional full-tree reads
while the tree was unchanged.

The tree is still fetched initially and after invalidation. It is kept in memory
for the page's lifetime. The current listener invalidates it for bookmark events
generally; this audit did not add filtering that ignores every unrelated browser
bookmark change.

**Transferable lesson:** use information already returned by an API, and define
the event that makes a cached result outdated. Caching without an invalidation
rule risks stale data.

## 9. Fix: coalesce bookmark events and pause bulk refreshes

Relevant files: [createRefreshScheduler.ts](src/utils/createRefreshScheduler.ts)
and [useSpeedDials.ts](src/stores/useSpeedDials.ts).

### What happened before

Every bookmark event called the loader. A queue prevented loads from
overlapping, but preserved every request:

```text
100 events -> 100 queued complete loads
```

Sequential execution protected ordering while still performing redundant work. A
folder copy creates a bookmark event for every item, making this especially
wasteful.

### What the scheduler does

An event now marks the data dirty and requests a scheduled refresh. The default
delay is 50 milliseconds. Events arriving before the scheduled refresh share
that refresh:

```text
100 events -> dirty flag -> one scheduled load
```

This is a fixed-window coalescing scheduler. It does not continually reset the
timer with each event like a trailing debounce. That avoids postponing all work
indefinitely during a steady stream of events.

Its state has specific jobs:

| State      | Purpose                                            |
| ---------- | -------------------------------------------------- |
| `dirty`    | Something changed and the view needs refreshing.   |
| `timer`    | A refresh is already scheduled.                    |
| `running`  | A refresh is currently in progress.                |
| `pauses`   | One or more bulk operations are holding refreshes. |
| `disposed` | The scheduler has been shut down.                  |

Before starting a refresh, the scheduler clears `dirty`. If more events arrive
during that refresh, they set it again. On completion, the scheduler requests
one follow-up if needed.

This prevents both an unbounded queue of identical loads and the loss of changes
that arrive while an earlier refresh is running. A sustained event stream can
still cause multiple refreshes; the promise is coalescing redundant work, not
one refresh for every possible stream duration.

### Bulk operations and nested pauses

Bookmark imports on supported Chromium builds pause refreshes between the
import-begin and import-end events. Folder duplication also pauses refresh
scheduling while the copy is being created.

The pause state is a counter rather than a boolean. If two operations overlap,
ending one should not resume refreshes while the other is still active.

Folder duplication resumes in a `finally` block, ensuring that even a copy error
releases its pause. Pausing cancels a pending timer but does not abort a refresh
that has already started.

The existing browser-specific event gating remains: unsupported import events
are not registered for the Firefox build.

### Error handling and cleanup

A failed refresh reports the error and resets the running state so later
requests can succeed. Disposal clears the pending timer and prevents future
scheduling. It does not cancel an API request already in flight.

The unit tests exercise bursts, changes during a running refresh, nested pauses,
recovery after errors, and cancellation of pending work.

### Measured result

The browser fixture's 100 simultaneous change events caused 100 full tree reads
before the change and one after it.

**Transferable lesson:** distinguish events that must each be processed from
notifications that the current view is stale. Every bookmark mutation must still
happen. Many notifications can often share one final view refresh.

## 10. Fix: read a folder-copy source once

Relevant file: [useSpeedDials.ts](src/stores/useSpeedDials.ts).

Previously, copying a folder fetched its children and then repeated that request
for each nested folder. The copy also triggered many ordinary refreshes through
the bookmark listeners.

Duplication now reads the source with `getSubTree` once, then recursively copies
the returned snapshot. Each copied item is still created through the browser
API, and creation remains sequential to preserve sibling ordering. Custom folder
icons are still copied.

The refresh scheduler is paused around the operation, so the view can update
after the batch rather than during every intermediate creation.

The fixture duplicates a folder containing 50 bookmarks and verifies that the
new folder has all 50. It also checks two subtree reads for the operation: one
source read and one final view refresh.

A snapshot represents the source at the time it was retrieved. It does not
continuously incorporate edits made to the source while the copy is running.
That is a normal tradeoff of copying from one consistent snapshot.

**Transferable lesson:** when an API can return a complete hierarchy, use that
result for recursive work instead of making another read at every node. Keep
writes ordered if their order affects the result.

## 11. Fix: retain unchanged dial identities

Relevant file: [useSpeedDials.ts](src/stores/useSpeedDials.ts).

Browser API reads return fresh JavaScript objects, even when the bookmark IDs
and values have not changed. Publishing those objects directly could cause the
keyed list to recreate dial components, repeating their setup and associated
work.

The store now reconciles by bookmark ID:

```ts
setSpeedDials(reconcile(children, { key: "id" }))
```

An existing ID means an existing logical item. Reconciliation can update its
fields and position while preserving its identity. Added IDs create new entries,
and removed IDs disappear.

The browser test saves a reference to an existing bookmark link, fires a
change-event burst, then checks that the same DOM element remains afterward.
This verifies retention of an unchanged dial in the tested scenario.

This complements cleanup rather than replacing it. An item genuinely removed by
navigation or deletion still needs to release resources correctly.

I also exercised a real pointer drag, checked that the fixture received a move,
and navigated away and back to confirm the saved order survived cached
navigation. That was a separate manual browser check; it is not currently part
of `tests/browser-checks.js`.

The first automated drag was too fast for the drag library's interaction cycle.
Repeating it with paced mouse movement produced a persisted move. This was an
automation-timing issue, not evidence that the new store broke drag-and-drop.

**Transferable lesson:** use stable data IDs to identify list items. Prefer
updating existing items over replacing the entire collection with unrelated
identities after every fetch.

## 12. Fix: calculate dimensions without constructing unused cells

Relevant files: [getGridDimensions.ts](src/utils/getGridDimensions.ts) and
[Grid.tsx](src/components/Grid.tsx).

### What happened before

The sizing utility calculated width and height, then built a two-dimensional
array containing a `null` for each grid cell. Callers used only the dimensions;
the generated cell matrix was unused.

For a grid with 10,000 positions, the utility therefore allocated approximately
10,000 placeholder entries to return two useful numbers.

### What changed

The function now returns just `gridWidth` and `gridHeight`. The calculation uses
the item count and optional column override:

```ts
const width = Math.max(1, Math.ceil(Math.sqrt(count)))
const height = Math.max(1, Math.ceil(count / width))
```

The previous matrix construction required work proportional to the number of
cells. The new calculation requires a constant number of arithmetic operations
and no cell-sized allocation.

The test passes a count of one trillion and verifies the dimensions. That test
demonstrates that the helper does not need to allocate one trillion entries. It
does not suggest the UI could render one trillion bookmarks.

`Grid` also wraps its dimensions calculation in `createMemo`, allowing the width
and height consumers to share a computed result until its reactive inputs
change.

**Transferable lesson:** inspect whether callers consume everything a utility
constructs. Removing unused output often produces a clearer API and avoids
unnecessary work. Memoization is most useful when multiple consumers otherwise
repeat a computation.

## 13. Fix: remove a duplicate Solid compiler plugin

Relevant file: [wxt.config.ts](wxt.config.ts).

The configuration enabled `@wxt-dev/module-solid` and also manually installed
`solid()` in Vite's plugin list. Inspection of the installed WXT module showed
that it already adds the Solid Vite plugin.

The baseline build timing output reported two Solid transform passes, supporting
the configuration finding. I removed the extra manual plugin and its import
while retaining the WXT module. Tailwind remains in the application's Vite
plugin configuration.

Subsequent production output reported one Solid transform pass. Chrome and
Firefox builds passed after the change.

This is a build-time improvement. It does not directly establish a
browser-runtime speedup. Observed local build times were shorter, but no
repeated controlled build-time benchmark was performed, so this document does
not claim a guaranteed percentage reduction.

**Transferable lesson:** framework integrations often register plugins for you.
Inspect resolved behavior and the integration's implementation before adding the
same plugin manually.

## 14. Supporting changes and verification

| File                         | Purpose of the change                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `package.json`               | Added `test` and `typecheck` commands.                                                                 |
| `tests/performance.test.mjs` | Added seven focused regression tests for scheduler behavior, storage lifecycle/races, and grid sizing. |
| `tests/fixtures/browser.js`  | Added isolated browser APIs with controlled data and counters.                                         |
| `tests/browser-checks.js`    | Added production-build browser behavior and performance checks.                                        |
| `tests/README.md`            | Added measured results and commands for reproducing the checks.                                        |
| `CONTRIBUTING.md`            | Documented the automated checks and Node requirement.                                                  |
| `.gitignore`                 | Excluded local browser-runner files and screenshot output.                                             |

The UI no longer reads or subscribes to the hidden Help control's setting where
it has no rendered consumer. The setting definition itself remains. Unused local
setters and imports were also removed while converting settings setup.

The checks completed during the audit included TypeScript, formatting, Chrome
and Firefox production builds, the seven unit tests, production-build browser
checks, and a mechanical UI scan. Desktop and mobile settings screenshots were
inspected after animations had settled or were disabled for capture.

### Reproduce the checks

Use Node.js 22.18 or newer for the tests' native TypeScript imports:

```sh
npm run typecheck
npm test
npm run build
npm run build:firefox
```

The test process uses `--conditions=browser` so Solid resolves its browser
reactive implementation for lifecycle tests.

To run the browser checks, first serve the Chrome production output:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory .output/chrome-mv3
```

In another terminal, from the project root:

```sh
mkdir -p output/playwright
npx --yes --package @playwright/cli playwright-cli -s=nsdeperf open about:blank
npx --yes --package @playwright/cli playwright-cli -s=nsdeperf run-code --filename tests/browser-checks.js
npx --yes --package @playwright/cli playwright-cli -s=nsdeperf close
```

The browser script checks initial optional-module loading, listener stability,
cached navigation, retained DOM, event batching, import pauses, settings
toggling, link preferences, dialog focus, custom icons, folder duplication,
history, deletion recovery, and release-note isolation.

### Testing limits

The fixture implements only the browser behavior needed by these scenarios. It
cannot prove that all native Chrome, Firefox, or Edge API details behave
identically. Passing the Firefox build verifies compilation, not a full Firefox
runtime test.

The HTTP-served fixture cannot provide Chrome's internal favicon endpoint.
Blocked favicon resource errors are expected in this setup. JavaScript
exceptions fail the browser checks. A real installed-extension smoke test
remains useful for native APIs and favicon behavior.

Resource timing can report zero transferred or decoded bytes for cached local
resources. For bundle-size comparisons, inspect the production files as well as
the request list. The baseline measurements recorded here are historical; the
current regression script validates the modified build and does not
automatically rebuild the old version.

## 15. A workflow to apply in another project

1. **Pick repeatable user actions.** Include initial loading, repeated
   navigation, changes to shared preferences, and one bulk operation.
2. **Map what each action triggers.** Follow components into stores, API calls,
   subscriptions, and imports. Ask how the work scales with list size and event
   count.
3. **Measure a baseline.** Count requests, subscriptions, created components, or
   bundle bytes as appropriate. Use time measurements when investigating
   latency, and repeat noisy timing experiments.
4. **Find ownership mistakes.** A shared value may belong in a parent. A
   listener may need cleanup. An import may initialize an unrelated subsystem.
5. **Remove unnecessary work first.** Reuse data already available, stop
   constructing unused results, and defer features outside the initial task.
6. **Define correctness rules.** Decide when a cache becomes stale, how an old
   asynchronous response is handled, and what happens when a component
   disappears.
7. **Control bursts explicitly.** Coalesce stale-view notifications and pause
   refreshes around batches. Preserve each operation when every event has
   independent meaning.
8. **Keep item identity stable.** Match fetched records by their real IDs and
   verify unchanged UI elements survive refreshes.
9. **Test boundaries.** Exercise changes during a load, failure followed by
   recovery, deletion of the current item, overlapping bulk work, and first-use
   focus for lazy UI.
10. **Compare the same scenarios again.** Confirm the reduced work and check
    user behavior. Record which improvements were measured and which remain
    expectations.

Use a small measurement table for your own audit:

| Scenario             | Measurement                     | Baseline | Modified | Correctness check               |
| -------------------- | ------------------------------- | -------- | -------- | ------------------------------- |
| Open page            | Initial JS bytes and requests   | Record   | Record   | First useful content appears    |
| Navigate repeatedly  | Active listener count           | Record   | Record   | Navigation and history work     |
| Receive 100 changes  | Refresh/API-call count          | Record   | Record   | Final displayed data is current |
| Open optional editor | Newly loaded modules            | Record   | Record   | Focus, close, and reopen work   |
| Copy a collection    | Source reads and view refreshes | Record   | Record   | All records copied in order     |

The remaining costs in this project include rendering every visible folder item,
loading the full icon catalog for custom icons, and fetching a complete subtree
after invalidation. Those may warrant future investigation for larger real-world
libraries, but this audit did not measure a need for virtualization, per-icon
chunks, or incremental tree patching.
