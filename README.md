# BI Dashboard

React + Vite dashboard builder prototype.

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
