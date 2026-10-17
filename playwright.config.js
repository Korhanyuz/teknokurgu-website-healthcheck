const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  timeout: 12 * 60 * 1000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { browserName: 'chromium', headless: true, ignoreHTTPSErrors: false },
});
