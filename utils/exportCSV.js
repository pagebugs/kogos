import fs from "fs";
import { stringify } from "csv-stringify/sync";

export function exportCSV(data, path) {
  if (!data || data.length === 0) {
    console.warn("⚠️ exportCSV: 저장할 데이터가 없습니다.");
    return;
  }

  // ✅ data[0]의 키를 동적으로 읽어 헤더 생성
  const columns = Object.keys(data[0]);
  const csv = stringify(data, {
    header: true,
    columns,
  });

  // ✅ UTF-8 with BOM (엑셀 호환)
  const bom = Buffer.from("\uFEFF", "utf8");
  fs.writeFileSync(path, bom + csv, "utf8");

  console.log(`✅ CSV 저장 완료 (UTF-8 + BOM, ${data.length}건): ${path}`);
}
