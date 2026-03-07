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

    // Reliable launcher intent for Play Store (works on Android 14+ emulator)
    execSync('adb shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n com.android.vending/.AssetBrowserActivity');

    await driver.pause(15000); // Wait for Play Store home to load

    console.log('Play Store opened. Searching for Instagram...');

    // Modern search bar locator (2025+ Play Store often uses this resource-id)
    // Fallback to contains text if needed
    let searchBar;
    try {
      searchBar = await driver.$('id=com.android.vending:id/search_box_text_input');
      await searchBar.waitForExist({ timeout: 20000 });
    } catch (e) {
      console.log('Primary search id not found, trying fallback...');
      searchBar = await driver.$('//android.widget.EditText[contains(@text, "Search")]');
      await searchBar.waitForExist({ timeout: 15000 });
    }

    await searchBar.click();
    await searchBar.setValue('Instagram');

    await driver.pressKeyCode(66); // Enter key

    await driver.pause(15000); // Wait for results

    // Install button – use text contains "Install" (more stable than compose path)
    const installBtn = await driver.$('//android.widget.Button[contains(@text, "Install")]');
    if (await installBtn.isExisting({ timeout: 10000 })) {
      await installBtn.click();
      console.log('Clicked Install on Instagram');
    } else {
      console.log('Install button not found – UI changed or app already installed');
    }

    await driver.saveScreenshot('./screenshot.png');
    console.log('Test completed – screenshot saved');
  } catch (err) {
    console.error('Test failed:', err.message || err);
  } finally {
    await driver.deleteSession();
  }
})();
