const { remote } = require('webdriverio');

const capabilities = {
  platformName: 'Android',

  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'emulator-5554',
  'appium:appPackage': 'com.android.vending',

  // Removed broken appActivity
  // Added wildcard wait → this is the key fix
  'appium:appWaitActivity': '*',
  'appium:appWaitDuration': 60000,          // 60 seconds – give it plenty of time

  'appium:noReset': true,
  'appium:fullReset': false,
  'appium:autoGrantPermissions': true,
  'appium:appWaitForLaunch': true
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
    console.log('Session created – waiting for Play Store to appear...');

    // Longer initial pause – Play Store can be very slow on fresh emulator
    await driver.pause(10000);

    // Try to locate search field with wait
    const searchField = await driver.$('//android.widget.TextView[@text="Search apps & games"]');
    await searchField.waitForExist({ timeout: 30000, interval: 1000 });
    await searchField.click();

    const input = await driver.$('//android.widget.EditText');
    await input.waitForExist({ timeout: 15000 });
    await input.setValue('Instagram');

    await driver.pressKeyCode(66); // Enter

    await driver.pause(15000); // wait for results

    // More reliable Install button locator (text-based)
    const installBtn = await driver.$('//android.widget.Button[contains(@text, "Install")]');
    if (await installBtn.isExisting({ timeout: 10000 })) {
      await installBtn.click();
      console.log('Clicked Install button');
    } else {
      console.log('No Install button found – Play Store UI may have changed');
    }

    await driver.saveScreenshot('./screenshot.png');
    console.log('Screenshot saved');
  } catch (err) {
    console.error('Test error:', err.message || err);
  } finally {
    await driver.deleteSession();
  }
})();
