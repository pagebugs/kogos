import fs from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

const inputPath = "./output/branches.csv";
const outputPath = "./output/branches_clean.csv";

console.log("🧹 데이터 정제 시작...");

// 1. CSV 읽기
const file = fs.readFileSync(inputPath, "utf8");
const records = parse(file, { columns: true, skip_empty_lines: true });

// 2. 기본 정제 + 타입 분류
let cleaned = records.map((r) => ({
  name: (r["name"] || r["메인브랜치"] || "").trim(),
  address: (r["address"] || r["주소"] || "").trim(),
  phone: normalizePhone(r["phone"] || r["전화번호"] || ""),
  type: classifyType(r["name"] || ""), // ✅ 신규 필드 추가
}));

// 3. 중복 주소 제거 (주소 + 메인브랜치 기준)
const uniqueMap = new Map();
for (const row of cleaned) {
  const key = `${row.main.trim()}-${row.address.trim()}`;
  if (!uniqueMap.has(key)) uniqueMap.set(key, row);
  else if (row.sub === "본점") uniqueMap.set(key, row);
}
cleaned = Array.from(uniqueMap.values());

// 4. 지역(region) 컬럼 추가
cleaned = cleaned.map((r) => ({
  ...r,
  region: extractRegion(r.address),
}));

// 4-1. 분류 로직 추가
function classifyType(name) {
  if (!name) return "UNKNOWN";
  if (name.includes("축산농협") || name.includes("원예농협") || name.includes("양돈농협"))
    return "SPECIAL_NH";
  if (name.includes("NH농협은행") && name.includes("출장소"))
    return "NH_BANK_SUB";
  if (name.includes("NH농협은행") && name.includes("지부"))
    return "NH_BANK_MAIN";
  if (name.includes("농협"))
    return "LOCAL_NH";
  return "OTHER";
}

// 5. 데이터 검증 및 통계 요약
const total = cleaned.length;
const emptyAddress = cleaned.filter((r) => !r.address).length;
const emptyPhone = cleaned.filter((r) => !r.phone).length;

// 중복 주소 카운트
const addressCount = {};
cleaned.forEach((r) => {
  addressCount[r.address] = (addressCount[r.address] || 0) + 1;
});
const dupCount = Object.values(addressCount).filter((c) => c > 1).length;

// 시군별 분포
const regionCount = {};
cleaned.forEach((r) => {
  if (!r.region) return;
  regionCount[r.region] = (regionCount[r.region] || 0) + 1;
});

// 통계 리포트 작성
let report = "=== Branches Data Report ===\n";
report += `총 데이터 수: ${total}\n`;
report += `주소 누락: ${emptyAddress}\n`;
report += `전화번호 누락: ${emptyPhone}\n`;
report += `중복 주소 수: ${dupCount}\n`;
report += `\n[시군별 분포]\n`;
for (const [region, count] of Object.entries(regionCount)) {
  report += `- ${region}: ${count}\n`;
}

console.log(report);
fs.writeFileSync("./output/cleanNH_report.txt", report, "utf8");

// 6. CSV로 저장 (Excel 호환 UTF-8 + BOM)
const bom = Buffer.from("\uFEFF", "utf8");
const csv = stringify(cleaned, {
  header: true,
  columns: ["name", "address", "phone", "type", "region"],
});
fs.writeFileSync(outputPath, bom + csv, "utf8");

console.log(`✅ 정제 완료: ${cleaned.length}건 → ${outputPath}`);

// ---- 유틸 함수들 ----
function normalizePhone(phone) {
  if (!phone) return "";
  return phone
    .replace(/[^0-9]/g, "")
    .replace(/(^02|^0\d{2})(\d+)(\d{4})$/, "$1-$2-$3");
}

function extractRegion(address) {
  const match = address.match(/강원\s*(\S+?[시군])/);
  return match ? match[1] : "";
}
