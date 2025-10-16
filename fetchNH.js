import fetch from "node-fetch";
import fs from "fs";
import dotenv from "dotenv";
import { groupBranches } from "./utils/groupBranches.js";
import { exportCSV } from "./utils/exportCSV.js";

dotenv.config();
const API_KEY = process.env.KAKAO_API_KEY;
const KAKAO_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const REGION = "강원도";
const KEYWORD = "농협";

// --- Kakao Local API에서 농협 데이터 전수 수집 ---
async function fetchAll() {
  let results = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${KAKAO_URL}?query=${REGION} ${KEYWORD}&page=${page}`, {
      headers: { Authorization: `KakaoAK ${API_KEY}` },
    });
    const data = await res.json();
    if (!data.documents.length) break;
    results.push(...data.documents);
    console.log(`📦 Page ${page} 수집 완료 (${data.documents.length}건)`);
    page++;
  }

  return results.map((d) => ({
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    phone: d.phone || "",
  }));
}

// --- 실행 ---
(async () => {
  try {
    console.log("🚀 Kakao API 호출 중...");
    const raw = await fetchAll();
    console.log(`총 ${raw.length}건 수집 완료`);
    const grouped = groupBranches(raw);
    exportCSV(grouped, "./output/branches.csv");
    console.log("✅ branches.csv 생성 완료");
  } catch (err) {
    console.error("❌ 오류 발생:", err);
  }
})();
