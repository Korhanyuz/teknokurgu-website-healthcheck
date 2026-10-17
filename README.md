# Tekno Kurgu Website Health Check

Daily Playwright-based browser crawl of the public Tekno Kurgu website.

## Run locally

```bash
npm install
npx playwright install chromium
npm test
```

## GitHub Actions

Open **Actions → Daily Website Health Check → Run workflow** for an immediate run. The workflow also runs daily at 08:17 Turkey time (UTC+3). Download the `website-health-report` artifact for HTML and JSON results.

## Notes

- Crawls up to 250 internal HTML pages reachable from the homepage.
- Reports HTTP failures, uncaught JavaScript errors, missing titles, and broken images.
- JavaScript errors and images are warnings, not fatal errors.
- This is a first-pass health monitor, not a guarantee that all forms, menus, or business flows work.
- Dynamic links not reachable from the homepage, external URLs, and downloadable files are not covered.
