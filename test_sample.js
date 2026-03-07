const { remote } = require('webdriverio');

const capabilities = {
  "appium:platformName": "Android",
  "appium:deviceName": "127.0.0.1:5555",
  "appium:automationName": "UiAutomator2",
  // No app / APK → we launch the built-in Play Store
  "appium:appPackage": "com.android.vending",
  // Optional: uncomment if Play Store launch is unstable
  // "appium:appActivity": "com.google.android.finsky.activities.MainActivity",
  // "appium:noReset": true,
  // "appium:fullReset": false
};

(async () => {
  const driver = await remote({
    protocol: 'http',
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: capabilities,
  });

  try {
    await driver.pause(3000); // wait for app to load

    // Search field
    await driver.$('//android.widget.TextView[@text="Search apps & games"]').click();
    await driver.$('//android.widget.EditText').setValue("Instagram");

    // Press Enter
    await driver.pressKeyCode(66);

    await driver.pause(10000); // wait for results

    // Click first Install button (this locator may need update if UI changes)
    await driver.$('//androidx.compose.ui.platform.ComposeView/android.view.View/android.view.View/android.view.View[1]/android.view.View[1]/android.view.View[2]/android.widget.Button').click();

    await driver.saveScreenshot('./screenshot.png');
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await driver.deleteSession();
  }
})();
