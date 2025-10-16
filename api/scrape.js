/**
 * 농협 사무소/지점 크롤러 (GAS 연동)
 * 입력: GAS doGet() → Sheet1
 * 출력: GAS doPost() → BranchList
 */

import fs from "fs";
import path from "path";
import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import fetch from "node-fetch";

// ✅ 환경 변수로 Apps Script 엔드포인트 관리
const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwTrVIDuiM30oIrO_KNrsd82u4weR_ssQMKTCeN2LJnqPAE1q60-VDkGPmaxAjivGHgbg/exec";

// ✅ 시트 데이터 불러오기
async function loadSitesFromSheet() {
  console.log("📡 Google Sheet 데이터 로드 중...");
  const res = await fetch(GAS_ENDPOINT);
  if (!res.ok) throw new Error(`시트 요청 실패 (${res.status})`);
  const data = await res.json();

  const sites = data
    .filter(row => row["홈페이지"] && row["홈페이지"].includes("http"))
    .map(row => ({
      name: row["농·축협"] || row["지역"] || "Unknown",
      url: row["홈페이지"],
    }));

  console.log(`✅ ${sites.length}개 농협 로드 완료`);
  return sites;
}

// ✅ Puppeteer 브라우저 실행
async function launchBrowser() {
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

// ✅ 각 사이트별 사무소/지점 데이터 수집
async function scrapeBranches(site) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const results = [];

  try {
    console.log(`🕵️‍♂️ [${site.name}] 접속 중...`);
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const targetLink = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      const target = anchors.find(a =>
        a.textContent.includes("사무소") || a.textContent.includes("지점")
      );
      return target ? target.href : null;
    });

    if (!targetLink) {
      console.warn(`⚠️ [${site.name}] 사무소/지점 링크를 찾을 수 없음`);
      await browser.close();
      return [];
    }

    await page.goto(targetLink, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log(`📍 [${site.name}] 페이지 이동 완료`);

    const branches = await page.evaluate(() => {
      const rows = [];
      const trs = document.querySelectorAll("table tr");
      trs.forEach(tr => {
        const tds = tr.querySelectorAll("td");
        if (tds.length >= 2) {
          const name = tds[0]?.innerText?.trim();
          const address = tds[1]?.innerText?.trim();
          const phone = tds[2]?.innerText?.trim() || "";
          if (name && address) rows.push({ name, address, phone });
        }
      });
      return rows;
    });

    results.push(...branches);
    console.log(`✅ [${site.name}] ${results.length}건 수집`);
  } catch (e) {
    console.error(`❌ [${site.name}] 오류: ${e.message}`);
  } finally {
    await browser.close();
  }

  return results.map(r => ({ site: site.name, ...r }));
}

// ✅ GAS로 결과 전송
async function postResultsToSheet(results) {
  console.log(`📤 BranchList 시트에 ${results.length}건 업로드 중...`);
  const res = await fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(results),
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json.ok) {
      console.log(`✅ 업로드 완료 (${json.count}건)`);
    } else {
      console.warn("⚠️ 업로드 실패:", json.error || text);
    }
  } catch {
    console.warn("⚠️ GAS 응답 파싱 실패:", text);
  }
}

// ✅ 전체 실행
(async () => {
  console.log("🚀 농협 BranchList 자동화 시작");

  const sites = await loadSitesFromSheet();
  const allResults = [];

  for (const site of sites) {
    const branches = await scrapeBranches(site);
    allResults.push(...branches);
  }

  // 로컬 백업
  const outPath = path.resolve(process.cwd(), "result.json");
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2), "utf-8");
  console.log(`💾 로컬 백업 저장 완료: ${outPath}`);

  await postResultsToSheet(allResults);
  console.log("🏁 모든 데이터 처리 완료");
})();
