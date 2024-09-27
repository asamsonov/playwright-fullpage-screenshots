import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import { manualLoginAndSaveCookies } from './login';

// Function to load cookies from file
async function loadCookiesForDomain(context: BrowserContext, domain: string, cookieFile: string) {
  if (fs.existsSync(cookieFile)) {
    const cookieData = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
    if (cookieData[domain]) {
      await context.addCookies(cookieData[domain]);
      console.log(`Loaded cookies for ${domain}`);
    }
  }
}

// Function to take screenshot of a URL
async function takeScreenshot(url: string, browser: any, outputDir: string) {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    const filename = url.replace(/https?:\/\//, '').replace(/\//g, '_') + '.png';
    const filepath = `${outputDir}/${filename}`;
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`Screenshot saved for ${url} at ${filepath}`);
  } catch (error) {
    console.error(`Failed to take screenshot for ${url}: ${error}`);
  } finally {
    await page.close();
  }
}

// Main function to process the list of URLs
async function processUrls(file: string, outputDir: string, cookieFile: string, domainsRequiringLogin: string[]) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const urls = fs.readFileSync(file, 'utf-8').split('\n').map(url => url.trim()).filter(url => url);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  for (const url of urls) {
    const domain = new URL(url).hostname;

    // Check if the domain requires manual login
    if (domainsRequiringLogin.includes(domain)) {
      await loadCookiesForDomain(context, domain, cookieFile);

      const cookiesExist = (await context.cookies()).length > 0;
      if (!cookiesExist) {
        console.log(`Manual login required for ${domain}.`);
        await manualLoginAndSaveCookies(domain, url, cookieFile);  // Manual login and save cookies
        await loadCookiesForDomain(context, domain, cookieFile);  // Reload cookies after login
      }
    }

    await takeScreenshot(url, browser, outputDir);
  }

  await browser.close();
}

// List of domains that require manual login
const domainsRequiringLogin = [
  'example.com',
  'another-domain.com',
];

// Run the process
processUrls('urls.txt', 'screenshots', 'cookies.json', domainsRequiringLogin)
  .then(() => console.log('Screenshots completed!'))
  .catch(err => console.error(`Error during screenshot process: ${err}`));