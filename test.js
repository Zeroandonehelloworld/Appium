import { remote } from 'webdriverio';
import fs from 'fs';
import XLSX from 'xlsx';

const capabilities = {
  "appium:platformName": "Android",
  "appium:deviceName": "4HTWTG9PPFIJROH6",
  "appium:automationName": "UiAutomator2",
  "appium:appPackage": "com.talabat",
};

(async () => {
  const driver = await remote({
    protocol: 'http',
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: capabilities,
  });

  await driver.pause(30000);

  // Read all emails from data.txt and remove empty lines
  let emails = fs.readFileSync('data.txt', 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '');

  // Prepare Excel data with header
  const excelData = [['Email', 'Password', 'Voucher']];

  while (emails.length > 0) {
    const emailPrefix = emails[0]; // first row
    const email = emailPrefix + '@gmail.com';
    const password = 'Nadak5589@';

    try {
      // Select Egypt if switch exists
      const els1 = await driver.$$('//android.widget.Switch[@content-desc="Egypt"]');
      if (els1.length > 0) await els1[0].click();

      await driver.pause(10000);
      await driver.$('//android.widget.Button[@content-desc="View more"]').click();
      await driver.pause(10000);
      await driver.$('//android.widget.Button[@content-desc="Continue with email"]').click();
      await driver.pause(10000);

      // Fill login form

      await driver.$('//android.view.View[@resource-id="LoginFieldsView.emailTextField"]').click();
      const emailField = await driver.$('//android.view.View[@resource-id="LoginFieldsView.emailTextField"]/android.widget.EditText');
      await emailField.clearValue();
      await emailField.setValue(email);

      await driver.$('//android.view.View[@resource-id="LoginFieldsView.passwordTextField"]').click();
      const passField = await driver.$('//android.view.View[@resource-id="LoginFieldsView.passwordTextField"]/android.widget.EditText');
      await passField.clearValue();
      await passField.setValue(password);

      await driver.$('//android.widget.Button[@content-desc="Log in"]').click();
      await driver.pause(30000);

      // Close popup if exists
      const els2 = await driver.$$('//android.widget.Button[@content-desc="Close"]');
      if (els2.length > 0) await els2[0].click();

      // Go to Vouchers
      await driver.$('//android.widget.Button[@content-desc="Account, tab"]').click();
      await driver.pause(10000);
      await driver.$('android=new UiSelector().className("android.widget.ImageView").descriptionContains("Vouchers")').click();


      await driver.pause(10000);

      // Get all OFF vouchers
      const elements = await driver.$$("//android.view.View[contains(translate(@content-desc,'off','OFF'),'OFF')]");
      const contentList = [];
      for (const el of elements) {
        const desc = await el.getAttribute('content-desc');
        contentList.push(desc);
      }

      // Add to Excel array
      if (contentList.length > 0) {
        for (const voucher of contentList) {
          excelData.push([email, password, voucher]);
        }
      } else {
        excelData.push([email, password, 'No vouchers']);
      }

      // Logout sequence
      await driver.$('//android.widget.Button[@content-desc="Back"]').click();
      await driver.$('android=new UiSelector().className("android.widget.ImageView").instance(1)').click();
      await driver.$('//android.view.View[@content-desc="Log out"]').click();
      await driver.$('//android.widget.Button[@content-desc="Log out"]').click();
      await driver.pause(10000);

      // Close popup if exists
      const els3 = await driver.$$('//android.widget.Button[@content-desc="Close"]');
      if (els3.length > 0) await els3[0].click();

      // Return to login for next email
      await driver.$('//android.widget.Button[@content-desc="Account, tab"]').click();
      await driver.$('//android.widget.Button[@content-desc="Log in"]').click();
      await driver.pause(5000);

      // Remove processed email from list and update file
      emails.shift();
      fs.writeFileSync('data.txt', emails.join('\n'));

    } catch (error) {
      console.error('Error processing', email, error);

      // Save Excel with whatever is finished
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Vouchers');
      XLSX.writeFile(wb, 'vouchers_partial.xlsx');

      console.log('Partial Excel saved as vouchers_partial.xlsx');
      break; // stop loop on error
    }
  }

  // Save final Excel file
  if (excelData.length > 1) {
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vouchers');
    XLSX.writeFile(wb, 'vouchers.xlsx');
    console.log('Excel file saved as vouchers.xlsx');
  }

  await driver.deleteSession();
})();
