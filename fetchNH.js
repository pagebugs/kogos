import fs from "fs";
import dotenv from "dotenv";
import { groupBranches } from "./utils/groupBranches.js";
import { exportCSV } from "./utils/exportCSV.js";

dotenv.config();
const API_KEY = process.env.KAKAO_API_KEY;
const KAKAO_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const REGION = "강원도";
const KEYWORDS = ["농협", "농협은행", "축산농협", "원예농협", "양돈농협"];

// --- Kakao Local API에서 농협 데이터 전수 수집 ---
async function fetchAll() {
  let results = [];
    for (const kw of KEYWORDS) {
    console.log(`🔍 '${kw}' 검색 중...`);
  let page = 1;

  while (true) {
    const res = await fetch(`${KAKAO_URL}?query=${REGION} ${kw}&page=${page}`, {
      headers: { Authorization: `KakaoAK ${API_KEY}` },
    });

    const data = await res.json();

    // ✅ 안전한 종료 조건 (빈 페이지일 경우 break)
    // ✅ 첫 페이지에서만 전체 결과 수 표시
    if (page === 1 && data.meta) {
      console.log(`🔹 전체 검색결과 수: ${data.meta.total_count}`);
    }

    if (!data.documents || data.documents.length === 0) {
      console.log(`📭 데이터 없음 → 수집 종료 (page=${page})`);
      break;
    }

    results.push(...data.documents);
    console.log(`📦 Page ${page} 수집 완료 (${data.documents.length}건)`);
    page++;
  }
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
    //const grouped = groupBranches(raw);
    //exportCSV(grouped, "./output/branches.csv");
    exportCSV(raw, "./output/branches.csv");
    console.log("✅ branches.csv 생성 완료");
  } catch (err) {
    console.error("❌ 오류 발생:", err);
  }
})();
