import fs from "fs";

export function exportCSV(data, path) {
  const header = "메인브랜치,서브브랜치,주소,전화번호\n";
  const rows = data.map(
    (d) => `${d.main},${d.sub},${d.address || ""},${d.phone || ""}`
  ).join("\n");

  fs.mkdirSync("./output", { recursive: true });
  fs.writeFileSync(path, header + rows, "utf8");
}
