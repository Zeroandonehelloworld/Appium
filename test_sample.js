const { remote } = require('webdriverio');

const capabilities = {
  "appium:platformName": "Android",
  "appium:deviceName": "127.0.0.1:5555",
  "appium:automationName": "UiAutomator2",
  // Uncomment and set app path if testing with APK
  // "appium:app": "path/to/app.apk"

  // Example: Play Store
  "appium:appPackage": "com.android.vending",
  // "appium:appActivity": "com.google.android.finsky.activities.MainActivity"
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
    await driver.$('//android.widget.TextView[@text="Search apps & games"]').click();
    await driver.$('//android.widget.EditText').setValue("Instagram");
    await driver.pressKeyCode(66); // press Enter
    await driver.pause(10000); // wait for results
    await driver.$('//androidx.compose.ui.platform.ComposeView/android.view.View/android.view.View/android.view.View[1]/android.view.View[1]/android.view.View[2]/android.widget.Button').click();
    await driver.saveScreenshot('./screenshot.png');
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await driver.deleteSession();
  }
})();
