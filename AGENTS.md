# Repository Guidelines

## Project Structure & Module Organization

This repository is a native WeChat Mini Program. Global application setup is in
`app.js`, `app.json`, and `app.wxss`. Feature pages live under `pages/<feature>/`
and use the standard four-file set: `<feature>.js`, `.json`, `.wxml`, and `.wxss`.
Reusable UI belongs in `components/`; `components/navigation-bar/` is the current
example. Put shipped images and icons in `assets/`. Product briefs and visual
references are in `docs/` and should not be imported at runtime. Add local
fixtures under `data/` and shared helpers under `utils/` when needed.

## Build, Test, and Development Commands

There is no Node package manifest or command-line build/test script. Open this
folder in WeChat DevTools, then use **Compile** to run the Mini Program and
**Preview** to test it on a device. DevTools uses `project.config.json` for
project settings. Enable its ESLint extension with `.eslintrc.js`. Do not add
npm dependencies or a build system unless explicitly required.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes in JavaScript, and trailing commas in
multiline objects where existing code uses them. Name page and component folders
in lowercase kebab-case (`pages/user-profile/`); each folder's four source files
must share its basename. Use camelCase for JavaScript variables, methods, data
keys, and component properties. Keep WXML class names descriptive and
kebab-case. Prefer small page methods and extract storage, navigation, and
formatting helpers to `utils/` instead of duplicating them.

## Testing Guidelines

No automated test framework or coverage target is configured. For every change,
compile in WeChat DevTools and exercise the affected flow in its simulator and,
when UI or safe-area behavior changes, a device preview. Record manual checks in
the pull request, for example: “iOS and Android: city selection persists after
relaunch.” Add automated tests only alongside the tooling needed to run them.

## Commit & Pull Request Guidelines

This checkout contains no Git history, so no repository-specific convention can
be inferred. Use imperative commits explaining intent, such as `Persist the
selected city between launches`. Pull requests should state user impact, list
tested flows, link the relevant requirement or issue, and include screenshots or
recordings for visual changes. Keep unrelated formatting and generated
configuration changes out of feature PRs.

## Configuration & Content Safety

Do not commit secrets, production credentials, or personal device settings from
`project.private.config.json`. Preserve the configured app ID and renderer
settings unless the task explicitly changes platform configuration.
