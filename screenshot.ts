import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
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
async function takeScreenshot(page: Page, url: string, outputDir: string) {
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

// Function to handle downloading files (like PDFs)
async function downloadFile(page: Page, url: string, downloadDir: string) {
  // Ensure the download directory exists
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  // Listen for download event
  const [download] = await Promise.all([
    page.waitForEvent('download'),  // Wait for the download to start
    page.goto(url)                  // Trigger the download by navigating to the URL
  ]);

  const suggestedFilename = download.suggestedFilename();
  const filePath = path.join(downloadDir, suggestedFilename);
  await download.saveAs(filePath);  // Save the file
  console.log(`Downloaded: ${suggestedFilename} to ${filePath}`);
}

// Function to detect if the URL points to a PDF by inspecting headers
async function isPdfUrl(url: string, page: Page): Promise<boolean> {
  try {
    const response = await page.request.head(url);  // Send a HEAD request
    const contentType = response.headers()['content-type'];

    // Check if content-type indicates a PDF file
    if (contentType && contentType.includes('application/pdf')) {
      console.log(`Detected PDF file at: ${url}`);
      return true;
    }
  } catch (error) {
    console.error(`Failed to check content type for ${url}: ${error}`);
  }

  return false;
}

async function handleUrl(url: string, context: BrowserContext, outputDir: string) {
  const page = await context.newPage();

  // Use HEAD request to check if the URL points to a PDF
  const isPdf = await isPdfUrl(url, page);

  if (isPdf) {
    // Handle PDF download and save it to the output directory (same as for screenshots)
    await downloadFile(page, url, outputDir);
  } else {
    // If it's not a PDF, take a screenshot and save it to the same output directory
    await takeScreenshot(page, url, outputDir)
  }

  await page.close();
}

// Main function to process the list of URLs
async function processUrls(file: string, outputDir: string, cookieFile: string, domainsRequiringLogin: string[]) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
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

    // Handle URL (either screenshot or PDF download) in the same output directory
    await handleUrl(url, context, outputDir);
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
  .then(() => console.log('Process completed!'))
  .catch(err => console.error(`Error during process: ${err}`));