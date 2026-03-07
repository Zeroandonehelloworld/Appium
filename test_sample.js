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
    console.log('Session created. Launching Play Store with monkey command...');

    // Use monkey to launch Play Store reliably (bypasses activity name issues)
    execSync('adb shell monkey -p com.android.vending -c android.intent.category.LAUNCHER 1');

    await driver.pause(20000); // Longer wait – Play Store is slow on emulator

    console.log('Play Store should be open. Clicking search button...');

    // Correct way to find element by content-desc (accessibility id)
    const searchButton = await driver.$('~Search');  // ~ means accessibility id / content-desc
    await searchButton.waitForExist({ timeout: 30000 });
    await searchButton.click();

    await driver.pause(5000);

    // Search input after clicking search button
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
    console.log('Test finished successfully');
  } catch (err) {
    console.error('Error:', err.message || err);
  } finally {
    await driver.deleteSession();
  }
})();
