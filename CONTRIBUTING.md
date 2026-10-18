# Contributing to Nice Speed Dials

Thank you for helping improve Nice Speed Dials. Contributions of all sizes are
welcome, including bug fixes, accessibility improvements, documentation, and new
features.

## Before you start

- Search the
  [existing issues](https://github.com/kruzkasu223/nice-speed-dials-extension/issues)
  before opening a new one.
- For a large feature or behavior change, open an issue first so the approach
  can be discussed before significant work begins.
- Keep each pull request focused on one problem. Small, focused changes are
  easier to review and test.

## Requirements

- A modern version of Node.js
- [Yarn Classic](https://classic.yarnpkg.com/) 1.x
- Chrome, Firefox, or Edge for testing the extension

## Set up the project

1. Fork the repository and clone your fork.
2. Install the dependencies:

   ```sh
   yarn install
   ```

3. If the generated WXT files are missing, prepare the project:

   ```sh
   yarn prepare
   ```

4. Start a development build:

   ```sh
   # Chrome
   yarn dev

   # Firefox
   yarn dev:firefox
   ```

WXT will create development output in generated directories such as `.wxt` and
`.output`. Do not edit or commit those directories.

Development builds use a separate
`DEV_NICE_SPEED_DIALS_BOOKMARKS_[DO_NOT_DELETE]` bookmark folder so they do not
interfere with data from the published extension.

## Project structure

- `src/components` contains the application and UI components.
- `src/components/ui` contains the owned Ark UI and Tailwind components.
- `src/stores` contains bookmark, folder, modal, and settings state.
- `src/entrypoints` contains the WXT new-tab and background entry points.
- `src/index.css` contains the Tailwind entry point and shared design tokens.
- `src/utils` contains small shared utilities.
- `public` contains extension icons and other static assets.

## Development guidelines

- Write TypeScript and follow the existing SolidJS component and signal
  patterns.
- Reuse existing components, stores, theme values, and path aliases before
  introducing new abstractions.
- Keep user-facing controls keyboard accessible. Use semantic elements, visible
  labels or accessible names, and appropriate ARIA attributes.
- Nice Speed Dials uses browser bookmarks as its source of truth. Changes must
  preserve the user's bookmark data and must not recreate, move, or delete
  unrelated bookmarks.
- Use the browser APIs exposed through WXT where possible, and account for API
  differences between Chrome, Firefox, and Edge.
- Avoid committing generated output, dependency directories, or packaged ZIP
  files unless the change is specifically preparing an official release.
- Do not update version numbers or release names unless requested by a
  maintainer.

## Formatting and validation

Format the files you change:

```sh
yarn prettier --write <changed-files>
```

Before submitting a pull request, run:

```sh
yarn prettier --check <changed-files>
yarn typecheck
yarn test
yarn build
yarn build:firefox
```

The Node test suite requires Node.js 22.18+ (native TypeScript support) and
covers refresh batching, storage subscription cleanup, and grid sizing. See
[tests/README.md](tests/README.md) for the isolated browser regression checks.
Also manually test the behavior your change affects. Depending on the change,
verify that:

- The new-tab page loads without console errors.
- Speed dials and folders can be created, edited, duplicated, moved, and deleted
  safely.
- Drag-and-drop order persists after refreshing the page.
- Folder navigation and breadcrumbs work with nested folders.
- Settings take effect immediately and remain after a refresh.
- Browser context-menu actions still work.
- The affected behavior works in each browser relevant to the change.

## Commit messages

Use a short, descriptive subject. The repository generally follows Conventional
Commits:

```text
feat: add a new user-facing capability
fix: correct broken behavior
docs: update documentation
refactor: restructure code without changing behavior
chore: update tooling or maintenance files
```

Use the body of the commit message when the reason for a change is not obvious
from the subject.

## Pull requests

A pull request should include:

- A clear summary of what changed and why.
- A link to the related issue, when one exists.
- The browsers and scenarios you tested.
- Screenshots or a short recording for visible interface changes.
- User-facing changelog updates when the change introduces a notable feature or
  fixes a significant user-facing problem.

Please keep unrelated formatting, refactoring, dependency, and generated-file
changes out of the pull request.

By contributing, you agree that your contribution will be licensed under the
same GNU General Public License v3.0-only terms as the project.
