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
    console.log('Session created. Launching Play Store...');

    // This line fixes the launch error
    execSync('adb shell am start -n com.android.vending/.AssetBrowserActivity');

    await driver.pause(20000); // Wait for Play Store to fully open

    console.log('Play Store should be open. Clicking search button...');

    // Correct accessibility id syntax
    const searchButton = await driver.$('~Search');
    await searchButton.waitForExist({ timeout: 30000 });
    await searchButton.click();

    await driver.pause(5000);

    const searchInput = await driver.$('//android.widget.EditText');
    await searchInput.waitForExist({ timeout: 20000 });
    await searchInput.setValue('Instagram');

    await driver.pressKeyCode(66); // Enter

    await driver.pause(15000);

    const installBtn = await driver.$('//android.widget.Button[contains(@text, "Install")]');
    if (await installBtn.isExisting({ timeout: 10000 })) {
      await installBtn.click();
      console.log('Clicked Install');
    } else {
      console.log('No Install button found');
    }

    await driver.saveScreenshot('./screenshot.png');
    console.log('Test finished – screenshot saved');
  } catch (err) {
    console.error('Error:', err.message || err);
  } finally {
    await driver.deleteSession();
  }
})();
