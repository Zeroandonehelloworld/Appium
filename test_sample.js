const { remote } = require('webdriverio');

const capabilities = {
  platformName: 'Android',                          // standard W3C → no prefix

  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'emulator-5554',
  'appium:appPackage': 'com.android.vending',
  'appium:appActivity': 'com.google.android.finsky.activities.MainActivity',

  'appium:noReset': true,
  'appium:fullReset': false,
  'appium:autoGrantPermissions': true,
  'appium:appWaitForLaunch': true,
  'appium:appWaitDuration': 45000
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
    // Give Play Store time to fully load (modern versions are slow on emulator)
    await driver.pause(8000);

    // Search field – added wait for reliability
    const searchField = await driver.$('//android.widget.TextView[@text="Search apps & games"]');
    await searchField.waitForExist({ timeout: 15000 });
    await searchField.click();

    const input = await driver.$('//android.widget.EditText');
    await input.waitForExist({ timeout: 10000 });
    await input.setValue('Instagram');

    // Press Enter
    await driver.pressKeyCode(66);

    await driver.pause(12000); // wait for search results

    // Attempt to click Install button (this locator is fragile – may need update)
    // Using simpler text-based selector instead of long compose path
    const installBtn = await driver.$('//android.widget.Button[@text="Install"]');
    if (await installBtn.isExisting({ timeout: 5000 })) {
      await installBtn.click();
      console.log('Clicked Install button');
    } else {
      console.log('Install button not found with text "Install"');
    }

    await driver.saveScreenshot('./screenshot.png');
    console.log('Screenshot saved as screenshot.png');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await driver.deleteSession();
  }
})();
