import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';

// Function to log in manually and save cookies
export async function manualLoginAndSaveCookies(domain: string, loginUrl: string, cookieFile: string) {
  const browser = await chromium.launch({ headless: false });  // headless=false to allow manual interaction
  const context: BrowserContext = await browser.newContext();
  const page: Page = await context.newPage();

  // Navigate to login page
  await page.goto(loginUrl);
  console.log(`Please complete the login manually for ${domain}...`);

  // Wait for the user to manually log in and capture cookies after navigation
  await page.waitForTimeout(15000);

  // Save cookies after successful login
  const cookies = await context.cookies();
  const cookieData = fs.existsSync(cookieFile) ? JSON.parse(fs.readFileSync(cookieFile, 'utf-8')) : {};
  cookieData[domain] = cookies;
  fs.writeFileSync(cookieFile, JSON.stringify(cookieData, null, 2));
  console.log(`Cookies saved for ${domain} at ${cookieFile}`);

  await browser.close();
}
