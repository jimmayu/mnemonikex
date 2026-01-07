// Simple test script to verify the page loads without errors
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Set a user agent
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.toString());
  });

  try {
    console.log('Loading page...');

    // Set page content directly to avoid timeout issues
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Block external resources that might timeout
      const url = request.url();
      if (url.includes('fonts.googleapis.com') || url.includes('cdn.') && !url.includes('jsdelivr')) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.goto('http://localhost:8888/public/index.html', { waitUntil: 'load', timeout: 20000 });

    // Wait a bit for scripts to execute
    await page.waitForTimeout(2000);

    // Check if nobleCurves is loaded
    const nobleCurvesLoaded = await page.evaluate(() => {
      return typeof window.nobleCurves !== 'undefined';
    });

    // Check if DOMContentLoaded handler ran
    const allDepsLoaded = await page.evaluate(() => {
      return typeof mnemonic !== 'undefined' &&
             typeof mn_words !== 'undefined' &&
             typeof Awesomplete !== 'undefined';
    });

    console.log('\n=== Test Results ===');
    console.log('noble-curves loaded:', nobleCurvesLoaded);
    console.log('Other dependencies loaded:', allDepsLoaded);

    console.log('\n=== Console Messages ===');
    consoleMessages.forEach(msg => console.log(msg));

    if (errors.length > 0) {
      console.log('\n=== Errors ===');
      errors.forEach(err => console.log(err));
      process.exit(1);
    } else if (!nobleCurvesLoaded || !allDepsLoaded) {
      console.log('\n❌ Dependencies not loaded properly');
      process.exit(1);
    } else {
      console.log('\n✅ Page loaded successfully without errors!');
      process.exit(0);
    }

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
