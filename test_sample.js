const { remote } = require('webdriverio');
const { execSync } = require('child_process');

const capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'emulator-5554',
  'appium:noReset': true,
  'appium:fullReset': false,
  'appium:autoGrantPermissions': true
};

(async () => {
  const driver = await remote({
    protocol: 'http',
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities,
  });

  try {
    console.log('Blank session started. Launching Play Store via ADB...');

    // Launch Play Store
    execSync('adb shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n com.android.vending/.AssetBrowserActivity');

    await driver.pause(15000); // Wait for home to load

    console.log('Play Store opened. Clicking Search button in bottom bar...');

    // Click Search button in bottom nav (content-desc is reliable)
    const searchButton = await driver.$('accessibility id=Search');
    await searchButton.waitForExist({ timeout: 20000 });
    await searchButton.click();

    await driver.pause(5000); // Wait for search interface

    // Locate active search input (resource-id in recent Play Store)
    let searchInput;
    try {
      searchInput = await driver.$('id=com.android.vending:id/search_box_text_input');
      await searchInput.waitForExist({ timeout: 15000 });
    } catch (e) {
      console.log('Primary input id not found, trying fallback...');
      searchInput = await driver.$('//android.widget.EditText');
      await searchInput.waitForExist({ timeout: 15000 });
    }

    await searchInput.click();
    await searchInput.setValue('Instagram');

    await driver.pressKeyCode(66); // Enter

    await driver.pause(15000); // Wait for results

    // Install button
    const installBtn = await driver.$('//android.widget.Button[contains(@text, "Install")]');
    if (await installBtn.isExisting({ timeout: 10000 })) {
      await installBtn.click();
      console.log('Clicked Install');
    } else {
      console.log('Install button not found');
    }

    await driver.saveScreenshot('./screenshot.png');
    console.log('Screenshot saved – test complete');
  } catch (err) {
    console.error('Test failed:', err.message || err);
  } finally {
    await driver.deleteSession();
  }
})();
