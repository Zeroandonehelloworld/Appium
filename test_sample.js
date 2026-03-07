const { remote } = require('webdriverio');

const capabilities = {
  platformName: 'Android',
  automationName: 'UiAutomator2',
  deviceName: 'emulator-5554',                    // more reliable than 127.0.0.1:5555 in emulator-runner
  appPackage: 'com.android.vending',
  appActivity: 'com.google.android.finsky.activities.MainActivity',   // ← this fixes "No activity found"
  
  // Strongly recommended additions for stability with system apps
  noReset: true,
  fullReset: false,
  autoGrantPermissions: true,
  appWaitForLaunch: true,
  appWaitDuration: 45000,                         // give Play Store more time to appear
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
    // Give Play Store extra time to fully initialize (modern versions are slow)
    await driver.pause(8000);

    // Try to find search field – added some resilience
    const searchField = await driver.$('//android.widget.TextView[@text="Search apps & games"]');
    await searchField.waitForExist({ timeout: 15000 });
    await searchField.click();

    const input = await driver.$('//android.widget.EditText');
    await input.waitForExist({ timeout: 10000 });
    await input.setValue('Instagram');

    await driver.pressKeyCode(66); // Enter

    await driver.pause(12000); // wait for results

    // The compose locator is very fragile – this is likely to fail on different versions
    // Consider replacing with more stable strategy later (accessibility id, resource-id, etc.)
    const installBtn = await driver.$('//android.widget.Button[@text="Install"]');
    if (await installBtn.isExisting()) {
      await installBtn.click();
    } else {
      console.log('Could not find Install button with text "Install"');
    }

    await driver.saveScreenshot('./screenshot.png');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await driver.deleteSession();
  }
})();
