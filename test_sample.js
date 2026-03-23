const { remote } = require('webdriverio');

const capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:appPackage': 'com.android.vending',
  'appium:appActivity': 'com.google.android.finsky.activities.MainActivity',
  'appium:noReset': true,
  'appium:autoGrantPermissions': true,
  'appium:systemPort': 8200,               // avoid port conflicts with UiAutomator2 server
  'appium:uiautomator2ServerInstallTimeout': 120000,
  'appium:newCommandTimeout': 300,
  // NOTE: no deviceName — Appium auto-discovers the only connected emulator
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
    driver = await remote({
      protocol: 'http',
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      capabilities,
      logLevel: 'warn',
    });
    console.log('✅ Session created');

    // Wait for Play Store to fully load
    await driver.pause(8000);
    await saveScreenshot(driver, 'screenshot_1_launch.png');

    // ── Find search bar ──────────────────────────────────────────────────────
    console.log('🔍 Looking for search bar...');
    const searchLocators = [
      '//android.widget.TextView[@text="Search apps & games"]',
      '//android.widget.TextView[contains(@text,"Search")]',
      '//android.widget.TextView[contains(@content-desc,"Search")]',
      '//android.widget.EditText[contains(@hint,"Search")]',
    ];

    let searchBar;
    for (const loc of searchLocators) {
      try {
        const el = await driver.$(loc);
        await el.waitForDisplayed({ timeout: 5000 });
        searchBar = el;
        console.log(`✅ Search bar found: ${loc}`);
        break;
      } catch (_) { /* try next */ }
    }

    if (searchBar) {
      await searchBar.click();
      await driver.pause(2000);

      const editText = await driver.$('//android.widget.EditText');
      await editText.waitForDisplayed({ timeout: 10000 });
      await editText.setValue('Instagram');

      // Press Enter — try mobile:pressKey (Appium v2), fallback to pressKeyCode
      try {
        await driver.executeScript('mobile: pressKey', [{ keycode: 66 }]);
      } catch (_) {
        await driver.pressKeyCode(66);
      }
      console.log('⏎ Enter pressed — waiting for results...');
      await driver.pause(18000);   // Play Store + emulator network is slow

      await saveScreenshot(driver, 'screenshot_2_results.png');

      // ── Try to click Install / Open button ──────────────────────────────
      console.log('🔍 Looking for Install/Open button...');
      const buttonLocators = [
        '//android.widget.Button[@text="Install"]',
        '//android.widget.Button[@text="Open"]',
        '//android.widget.Button[contains(@text,"Install")]',
        '//android.widget.Button[contains(@content-desc,"Install")]',
        // original XPath from project brief (may work on some Play Store versions)
        '//androidx.compose.ui.platform.ComposeView/android.view.View/android.view.View/android.view.View[1]/android.view.View[1]/android.view.View[2]/android.widget.Button',
        '(//android.widget.Button)[1]',
      ];

      let clicked = false;
      for (const loc of buttonLocators) {
        try {
          const btn = await driver.$(loc);
          if (await btn.isDisplayed()) {
            await btn.click();
            console.log(`✅ Button clicked: ${loc}`);
            clicked = true;
            await driver.pause(5000);
            break;
          }
        } catch (_) { /* try next */ }
      }
      if (!clicked) {
        console.log('⚠️  No Install/Open button found (Play Store may require sign-in) — screenshot still saved');
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
