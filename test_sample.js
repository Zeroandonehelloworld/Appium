const { remote } = require('webdriverio');

const capabilities = {
  // platformName is a W3C standard cap — NO "appium:" prefix
  platformName: 'Android',
  'appium:deviceName': 'emulator-5554',        // GitHub Actions emulator name
  'appium:automationName': 'UiAutomator2',
  'appium:appPackage': 'com.android.vending',
  'appium:appActivity': 'com.google.android.finsky.activities.MainActivity',
  'appium:noReset': true,
  'appium:autoGrantPermissions': true,
  'appium:newCommandTimeout': 120,
};

const wdOpts = {
  protocol: 'http',
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',
  capabilities,
  logLevel: 'info',
};

async function saveScreenshot(driver, filename) {
  try {
    await driver.saveScreenshot(`./${filename}`);
    console.log(`✅ Screenshot saved: ${filename}`);
  } catch (e) {
    console.error(`❌ Could not save screenshot ${filename}:`, e.message);
  }
}

(async () => {
  let driver;
  try {
    console.log('🚀 Connecting to Appium...');
    driver = await remote(wdOpts);
    console.log('✅ Session created');

    // Wait for Play Store to fully load
    await driver.pause(7000);
    await saveScreenshot(driver, 'screenshot_1_launch.png');

    // ── Find search bar ──────────────────────────────────────────────────────
    console.log('🔍 Looking for search bar...');
    let searchBar;

    // Try multiple locator strategies (Play Store UI varies by version / sign-in state)
    const searchLocators = [
      '//android.widget.TextView[contains(@text,"Search")]',
      '//android.widget.TextView[contains(@content-desc,"Search")]',
      '//android.widget.EditText[contains(@hint,"Search")]',
      '//android.widget.SearchBar',
    ];

    for (const loc of searchLocators) {
      try {
        const el = await driver.$(loc);
        if (await el.isDisplayed()) {
          searchBar = el;
          console.log(`✅ Search bar found with: ${loc}`);
          break;
        }
      } catch (_) { /* try next */ }
    }

    if (searchBar) {
      await searchBar.click();
      await driver.pause(2000);

      // Type in search box
      const searchInput = await driver.$('//android.widget.EditText');
      await searchInput.clearValue();
      await searchInput.setValue('Instagram');
      await driver.pause(1000);

      // Press Enter — use mobile:pressKey (Appium v2 compatible)
      try {
        await driver.executeScript('mobile: pressKey', [{ keycode: 66 }]);
      } catch (_) {
        // Fallback for older Appium versions
        await driver.pressKeyCode(66);
      }
      console.log('⏎ Enter pressed, waiting for results...');
      await driver.pause(7000);

      await saveScreenshot(driver, 'screenshot_2_results.png');

      // ── Try clicking the first Install / Open button ───────────────────────
      console.log('🔍 Looking for Install/Open button...');
      const buttonLocators = [
        // Flexible: any Button whose text is Install or Open
        '//android.widget.Button[@text="Install"]',
        '//android.widget.Button[@text="Open"]',
        '//android.widget.Button[contains(@text,"Install")]',
        // ContentDesc fallback
        '//android.widget.Button[contains(@content-desc,"Install")]',
        // First button in the first result card
        '(//android.widget.Button)[1]',
      ];

      let clicked = false;
      for (const loc of buttonLocators) {
        try {
          const btn = await driver.$(loc);
          if (await btn.isDisplayed()) {
            await btn.click();
            console.log(`✅ Button clicked with: ${loc}`);
            clicked = true;
            await driver.pause(3000);
            break;
          }
        } catch (_) { /* try next */ }
      }
      if (!clicked) {
        console.log('⚠️  No Install/Open button found (sign-in may be required — screenshot still saved)');
      }
    } else {
      console.log('⚠️  Search bar not found — Play Store may require sign-in. Saving current state.');
    }

    // ── Final screenshot ─────────────────────────────────────────────────────
    await saveScreenshot(driver, 'screenshot.png');
    console.log('✅ Test complete!');

  } catch (err) {
    console.error('❌ Test error:', err.message || err);
    if (driver) await saveScreenshot(driver, 'screenshot.png');
    process.exit(1);
  } finally {
    if (driver) {
      try { await driver.deleteSession(); } catch (_) {}
    }
  }
})();
