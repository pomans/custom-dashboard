# BI Dashboard (custom-dashboard)

React + Vite dashboard builder for TCEB — a drag-and-drop widget canvas that visualises MICE statistics, tourism, ICCA rankings, and economic indicators.

## Project ecosystem

This repository is one of three interconnected projects that together form the TCEB platform. They communicate through a shared backend API and an Ocelot API Gateway that proxies queries to the Blendata data warehouse.

| Component | Role | Tech |
|---|---|---|
| **tceb-core-api** | Backend REST API — authentication, portal data, MICE statistics, dashboards, insight reports | .NET 8 / ASP.NET Core |
| **custom-dashboard** ← you are here | Embedded BI dashboard builder — drag-and-drop widgets that visualise data | React + Vite |
| **tceb-web** | Main web portal — authenticates users, hosts all platform features, and embeds this dashboard | Vue 3 / Vite |
| **Ocelot Gateway** | API Gateway — routes widget SQL queries from `tceb-core-api` to the Blendata data warehouse | Ocelot (.NET) |
| **Blendata** | Data warehouse — executes SQL over MICE/tourism fact tables and returns JSON result sets | Blendata / Spark |

### How they connect

```
custom-dashboard (this repo)
        │
        │  REST /datasource/widget/{key}
        ▼
  tceb-core-api ──── POST /blendata/query ────► Ocelot Gateway ──► Blendata
                                                                    (data warehouse)
        ▲
        │  REST (auth, portal, reports)
  tceb-web ── embeds ──► custom-dashboard
```

- This app calls `tceb-core-api` at `/datasource/widget/{key}?...` to load chart/table data.
- `tceb-core-api` builds a SQL query and POSTs it to **Ocelot**, which forwards it to **Blendata** for execution.
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
