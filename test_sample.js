const { remote } = require('webdriverio');
const { execSync } = require('child_process'); // for adb commands

const capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'emulator-5554',
  
  // NO appPackage / appActivity / appWait* → start blank session
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
    console.log('Blank session created. Manually launching Play Store...');

    // Launch Play Store using ADB intent (most reliable way for system apps)
    // This uses the standard launcher category – works on Android 14 emulator
    execSync('adb shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n com.android.vending/.AssetBrowserActivity');

    // Wait for Play Store to appear (adjust time if needed)
    await driver.pause(15000);

    console.log('Play Store should be open now. Starting interactions...');

    // Your test steps with waits
    const searchField = await driver.$('//android.widget.TextView[@text="Search apps & games"]');
    await searchField.waitForExist({ timeout: 30000 });
    await searchField.click();

    const input = await driver.$('//android.widget.EditText');
    await input.waitForExist({ timeout: 15000 });
    await input.setValue('Instagram');

    await driver.pressKeyCode(66); // Enter

    await driver.pause(15000);

    const installBtn = await driver.$('//android.widget.Button[contains(@text, "Install")]');
    if (await installBtn.isExisting({ timeout: 10000 })) {
      await installBtn.click();
      console.log('Clicked Install');
    } else {
      console.log('Install button not found');
    }

    await driver.saveScreenshot('./screenshot.png');
    console.log('Screenshot saved');
  } catch (err) {
    console.error('Test error:', err.message || err);
  } finally {
    await driver.deleteSession();
  }
})();
