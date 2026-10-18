# Performance regression checks

For the detailed audit, explanations of each fix, and a workflow to reuse in
other projects, read [the performance guide](./PERFORMANCE.md).

Run the focused unit tests with Node.js 22.18+:

```sh
npm test
npm run typecheck
```

The browser checks use the production build and an in-memory browser API
fixture. They never access your actual bookmarks or extension settings. They
verify lazy loading, constant storage listener counts, cached navigation,
retained dial DOM, event batching, imports, settings, dialog focus, custom
icons, folder duplication, history, deletion recovery, and isolation of the
release-notes page.

```sh
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 --directory .output/chrome-mv3
```

In another terminal, from the project root:

```sh
mkdir -p output/playwright
npx --yes --package @playwright/cli playwright-cli -s=nsdeperf open about:blank
npx --yes --package @playwright/cli playwright-cli -s=nsdeperf run-code --filename tests/browser-checks.js
npx --yes --package @playwright/cli playwright-cli -s=nsdeperf close
```

Screenshots are saved under `output/playwright/`. The HTTP fixture cannot serve
Chrome's internal favicon endpoint, so blocked favicon resource errors are
expected; JavaScript exceptions fail the checks. A real installed-extension
smoke test is still needed to validate native browser API behavior and favicons.

Measured on the same fixture (100 root bookmarks, one folder with 50 bookmarks):

| Measurement                                        |   Before |  After |
| -------------------------------------------------- | -------: | -----: |
| Initial new-tab JavaScript, uncompressed           | 1,137 KB | 254 KB |
| Initial storage reads                              |      149 |     34 |
| Initial storage listeners                          |      131 |     16 |
| Listeners after three folder round trips           |      584 |     16 |
| Full tree reads for those six navigations          |        6 |      0 |
| Full tree reads for 100 simultaneous change events |      100 |      1 |
| Listeners after navigation plus the event burst    |   10,684 |     16 |

The initial JavaScript measurement is for default folder icons. Custom icons
load the separate catalog when first needed. Code splitting reduces startup
work; total installed JavaScript remains roughly unchanged. Resource timing may
report zero bytes for cached local resources; use production file sizes when
comparing bundle bytes.
