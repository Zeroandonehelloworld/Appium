const { remote } = require('webdriverio');

const capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:appPackage': 'com.android.vending',      // Play Store
  'appium:appActivity': 'com.google.android.finsky.activities.MainActivity', // more reliable launcher
  'appium:noReset': true,
  'appium:uiautomator2ServerInstallTimeout': 120000,
  'appium:systemPort': 8200,                        // helps avoid port conflicts
  'appium:newCommandTimeout': 300
};

(async () => {
  let driver;

  try {
    driver = await remote({
      protocol: 'http',
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      capabilities
    });

    console.log('Session started');

    // Wait for Play Store to be ready
    await driver.pause(8000);

    // Search bar - more robust locator + wait
    const searchBar = await driver.$('//android.widget.TextView[@text="Search apps & games"]');
    await searchBar.waitForDisplayed({ timeout: 20000, timeoutMsg: 'Search bar not found' });
    await searchBar.click();

    const editText = await driver.$('//android.widget.EditText');
    await editText.waitForDisplayed({ timeout: 10000 });
    await editText.setValue('Instagram');

    // Enter key
    await driver.pressKeyCode(66);
    console.log('Enter pressed');

    // Wait longer for results (emulator + network is slow)
    await driver.pause(18000);

    // Try to find and click first Install button
    // This XPath is fragile — may need update if UI changes
    const installBtnXPath = '//androidx.compose.ui.platform.ComposeView' +
                           '/android.view.View/android.view.View/android.view.View[1]' +
                           '/android.view.View[1]/android.view.View[2]/android.widget.Button';

    const installBtn = await driver.$(installBtnXPath);
    if (await installBtn.isDisplayed({ timeout: 10000 })) {
      console.log('Found Install button → clicking');
      await installBtn.click();
      await driver.pause(6000); // wait a bit after click
    } else {
      console.log('Install button not found with given XPath — UI probably changed');
    }

    // Take screenshot
    await driver.saveScreenshot('./screenshot.png');
    console.log('Screenshot saved to ./screenshot.png');

  } catch (err) {
    console.error('Test failed:', err);
    if (driver) {
      try { await driver.saveScreenshot('./error-screenshot.png'); } catch {}
    }
    throw err; // make workflow fail if critical error
  } finally {
    if (driver) {
      await driver.deleteSession();
    }
  }
})();
