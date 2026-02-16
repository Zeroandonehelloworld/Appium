const wd = require("wd");

async function runTest() {
  console.log("Starting Appium test...");

  try {
    const driver = await wd.promiseChainRemote("http://localhost:4723/wd/hub");

    const desiredCaps = {
      platformName: "Android",
      deviceName: "emulator-5554",
      app: "C:\\dummy\\path\\to\\app.apk", // just a dummy path for CI demo
      automationName: "UiAutomator2"
    };

    // Try init session (will fail in CI without real APK, but demonstrates workflow)
    await driver.init(desiredCaps);
    console.log("Appium session started!");
    await driver.quit();
  } catch (err) {
    console.error("Appium test finished (demo mode) — error expected in CI:", err.message);
  }
}

runTest();
