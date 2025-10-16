/**
 * 농협 사무소/지점 크롤러 (로컬 크롬 버전)
 */

import puppeteer from "puppeteer-core";
import fetch from "node-fetch";
import fs from "fs";

// ✅ 로컬 크롬 경로 (Windows 기준)
const LOCAL_CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// ✅ GAS Web App Endpoint
const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycby0yJeYe8QA5al2uX2Obdk5THmCPqegiAjVYcG8lsqb7aBQ3nEKkGebsYegKQio-8tXLg/exec";

// ✅ 시트에서 사이트 목록 불러오기
async function loadSitesFromSheet() {
  console.log("📡 Google Sheet 데이터 로드 중...");
  const res = await fetch(GAS_ENDPOINT);
  if (!res.ok) throw new Error(`시트 요청 실패 (${res.status})`);
  const data = await res.json();

  return data
    .filter((row) => row["홈페이지"] && row["홈페이지"].includes("http"))
    .map((row) => ({
      name: row["농·축협"] || row["지역"] || "Unknown",
      url: row["홈페이지"],
    }));
}

// ✅ 로컬 크롬으로 브라우저 실행
async function launchBrowser() {
  return puppeteer.launch({
    headless: true, // 백그라운드 모드
    executablePath: LOCAL_CHROME_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

async function scrapeBranches(site) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const results = [];

  try {
    console.log(`🕵️‍♂️ [${site.name}] 접속 중...`);
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const targetLink = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      const target = anchors.find(
        (a) => a.textContent.includes("사무소") || a.textContent.includes("지점")
      );
      return target ? target.href : null;
    });

    if (!targetLink) {
      console.warn(`⚠️ [${site.name}] 사무소/지점 링크를 찾을 수 없음`);
      await browser.close();
      return [];
    }

    await page.goto(targetLink, { waitUntil: "domcontentloaded", timeout: 30000 });

    const branchList = await page.evaluate(() => {
      const text = document.body.innerText;
      const blocks = text.split(/\n{2,}/);
      return blocks.filter((b) => /(지점|사무소)/.test(b)).slice(0, 50);
    });

    branchList.forEach((b) =>
      results.push({ site: site.name, name: b.slice(0, 40), address: "", phone: "" })
    );
  } catch (err) {
    console.error(`❌ [${site.name}] 에러:`, err.message);
  } finally {
    await browser.close();
  }

  return results;
}

// ✅ 메인 실행
(async () => {
  const sites = await loadSitesFromSheet();
  let allResults = [];

  for (const site of sites.slice(0, 3)) {
    const branches = await scrapeBranches(site);
    allResults = allResults.concat(branches);
  }

  // ✅ GAS로 POST 전송
  await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(allResults),
  });

  fs.writeFileSync("result.json", JSON.stringify(allResults, null, 2));
  console.log("✅ 완료: result.json 생성 및 GAS 전송 완료");
})();
