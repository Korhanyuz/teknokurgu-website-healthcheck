const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  timeout: 90000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { browserName: 'chromium', headless: true, ignoreHTTPSErrors: false },
});
