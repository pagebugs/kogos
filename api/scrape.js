import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'baseSites.json');

const BRANCH_NAME_PATTERN = /(지점|사무소|출장소|분소|본점|센터)/;
const CONTACT_PATTERN = /(?:Tel|전화|T|☎)\s*[:：]?\s*([0-9\-()]+)/i;
const FAX_PATTERN = /(?:Fax|팩스|F)\s*[:：]?\s*([0-9\-()]+)/i;

async function loadSites() {
  try {
    const json = await readFile(DATA_PATH, 'utf-8');
    const sites = JSON.parse(json);
    if (!Array.isArray(sites)) {
      throw new Error('baseSites.json must contain an array');
    }
    return sites;
  } catch (error) {
    console.error('Failed to load baseSites.json', error);
    throw error;
  }
}

function parseBranchBlocks(blocks) {
  return blocks
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const flat = lines.join(' ');
      const nameLine =
        lines.find((line) => BRANCH_NAME_PATTERN.test(line)) || lines[0];
      const telMatch = flat.match(CONTACT_PATTERN);
      const faxMatch = flat.match(FAX_PATTERN);
      const addressLine = lines.find(
        (line) =>
          /(주소|로\s|길\s|구\s|동\s|읍\s|면\s|리\s|번지|호)/.test(line) &&
          !/(Tel|전화|팩스|Fax|☎|F\s?\.)/i.test(line)
      );

      return {
        name: nameLine || null,
        address: addressLine || null,
        tel: telMatch ? telMatch[1].trim() : null,
        fax: faxMatch ? faxMatch[1].trim() : null,
        raw: lines,
      };
    });
}

async function scrapeBranches(page) {
  const selectors = ['table tr', 'ul li', 'ol li', 'div'];
  const branchBlocks = await page.evaluate(
    (branchSelectors, namePattern) => {
      const pattern = new RegExp(namePattern);
      const seen = new Set();
      const blocks = [];

      const collectText = (element) =>
        element.innerText
          .split('\n')
          .map((text) => text.trim())
          .filter(Boolean)
          .join('\n');

      branchSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          const textBlock = collectText(element);
          if (!textBlock) return;

          if (pattern.test(textBlock) && !seen.has(textBlock)) {
            seen.add(textBlock);
            blocks.push(textBlock);
          }
        });
      });

      return blocks;
    },
    selectors,
    BRANCH_NAME_PATTERN.source
  );

  return parseBranchBlocks(branchBlocks);
}

async function findBranchLink(page) {
  const anchorCandidates = await page.evaluate(() => {
    const targetTextPattern = /(사무소|지점|출장소|분소|본점|센터)/;

    return Array.from(document.querySelectorAll('a'))
      .map((anchor) => ({
        href: anchor.href,
        text: anchor.innerText.trim(),
      }))
      .filter(({ text, href }) => text && href && targetTextPattern.test(text));
  });

  if (!anchorCandidates.length) {
    return null;
  }

  const preferred = anchorCandidates.find(({ href }) =>
    /indexSub\.do/.test(href)
  );

  return (preferred || anchorCandidates[0]).href;
}

async function createBrowser() {
  const executablePath = await chromium.executablePath();

  return puppeteer.launch({
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let browser;
  const summary = [];

  try {
    const sites = await loadSites();
    browser = await createBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    for (const site of sites) {
      const { region, coop, url } = site;
      const record = {
        region,
        coop,
        base: url,
        branchURL: null,
        branches: [],
        errors: [],
      };
      console.log(`▶ Start: ${coop} (${url})`);

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      } catch (error) {
        const message = `Base page load failed: ${error.message}`;
        console.error(`🚫 ${coop} - ${message}`);
        record.errors.push(message);
        summary.push(record);
        continue;
      }

      let branchURL = null;

      try {
        branchURL = await findBranchLink(page);
        if (!branchURL) {
          throw new Error('No branch-related link found');
        }
        record.branchURL = branchURL;
      } catch (error) {
        const message = `Branch link detection failed: ${error.message}`;
        console.error(`🚫 ${coop} - ${message}`);
        record.errors.push(message);
        summary.push(record);
        continue;
      }

      try {
        await page.goto(branchURL, { waitUntil: 'networkidle2', timeout: 60000 });
        const branches = await scrapeBranches(page);
        record.branches = branches;
        console.log(`✅ ${coop}: collected ${branches.length} branches`);
      } catch (error) {
        const message = `Branch page processing failed: ${error.message}`;
        console.error(`🚫 ${coop} - ${message}`);
        record.errors.push(message);
      }

      summary.push(record);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      status: 'ok',
      total: summary.length,
      timestamp: new Date().toISOString(),
      data: summary,
    });
  } catch (error) {
    console.error('Fatal error in scrape handler', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
