# Repository Guidelines

## Project Structure & Module Organization

This repository is a native WeChat Mini Program. Global startup, routing, and styles live in `app.js`, `app.json`, and `app.wxss`. Feature screens are grouped under `pages/`; each page normally has matching `.js`, `.json`, `.wxml`, and `.wxss` files. Shared UI belongs in `components/`, such as `components/navigation-bar/`. Backend operations are isolated by responsibility in `cloudfunctions/<function-name>/`; reusable backend logic belongs in `cloudfunctions/_shared/`. Keep page-specific code beside its page rather than creating unrelated top-level folders.

## Build, Test, and Development Commands

There is no root package script or command-line build. Open the repository root in WeChat DevTools using `project.config.json`, then use **Compile** for local preview and the simulator/device debugger for validation.

Install a cloud function's dependencies before local debugging or deployment:

```powershell
cd cloudfunctions/login
npm install
```

In DevTools, right-click a changed cloud function and choose **Upload and deploy: cloud install dependencies**. Use the DevTools code-quality panel or an ESLint editor extension with `.eslintrc.js` for static checks.

## Coding Style & Naming Conventions

Use JavaScript compatible with ECMAScript 2018 and two-space indentation. Follow the existing style: single quotes, no semicolons, and trailing commas in multiline objects where practical. Use `camelCase` for variables and handlers, `UPPER_SNAKE_CASE` for constants, and kebab-case for page/component directories (for example, `order-detail`). Keep WXML classes descriptive and style them in the adjacent WXSS file. Declare new pages and global components in the appropriate JSON configuration.

## Testing Guidelines

No automated test framework or coverage threshold is configured. Manually verify changed customer, merchant, and administrator flows in WeChat DevTools. For cloud changes, test success, permission failure, empty input, and retry/idempotency behavior against a non-production cloud environment. Confirm console and cloud-function logs contain no unexpected errors.

## Commit & Pull Request Guidelines

The history currently contains only `Initial Commit`, so no established convention can be inferred. Use short imperative subjects such as `Fix expired order cancellation`; keep each commit focused. Pull requests should explain the user-visible behavior, list affected pages/cloud functions, include verification steps, and attach screenshots or recordings for UI changes. Link relevant issues and call out schema, payment, permission, or deployment changes explicitly.

## Security & Configuration

Do not commit secrets, payment credentials, private keys, production data, or machine-specific settings from `project.private.config.json`. Keep privileged checks in cloud functions; never rely only on client-side role or price validation.
