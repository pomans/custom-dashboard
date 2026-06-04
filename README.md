# BI Dashboard (custom-dashboard)

React + Vite dashboard builder for TCEB — a drag-and-drop widget canvas that visualises MICE statistics, tourism, ICCA rankings, and economic indicators.

## Project ecosystem

This repository is one of three interconnected projects that together form the TCEB platform:

| Repository | Role | Tech |
|---|---|---|
| **tceb-core-api** | Backend REST API — authentication, portal data, MICE statistics, dashboards, insight reports | .NET 8 / ASP.NET Core |
| **custom-dashboard** ← you are here | Embedded BI dashboard builder — drag-and-drop widgets that visualise data by calling the API | React + Vite |
| **tceb-web** | Main web portal — the host application that embeds this dashboard and surfaces all platform features to end users | Vue 3 / Vite |

### How they connect

```
tceb-web
   │
   └── embeds ──► custom-dashboard ──► tceb-core-api ──► Blendata
                   (this repo)          /datasource/        (data
                                        widget/{key}        warehouse)
```

- This app fetches widget data from `tceb-core-api` at `/datasource/widget/{key}`.
- The API host is configured via `VITE_API_BASE_URL` (defaults to `https://localhost:7139`).
- **tceb-web** embeds this app and controls which dashboards are visible based on the authenticated user's permissions.

## Features

- Build dashboards from draggable widgets.
- Save the active dashboard as a `.json` file.
- Import a saved dashboard `.json` file.
- Export the active dashboard as PDF.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production build is written to `dist/`.

## Deploy to GitHub Pages

This project is configured for GitHub Pages:

- Vite uses a relative asset base (`./`) so the app can run under a repository path such as `https://<user>.github.io/<repo>/`.
- `.github/workflows/deploy.yml` builds the app and deploys `dist/` to GitHub Pages on every push to `main`.

In GitHub, enable **Settings > Pages > Build and deployment > Source: GitHub Actions**.
