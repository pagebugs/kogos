export function groupBranches(data) {
  const map = {};
  for (const item of data) {
    const name = item.name;
    const mainName = name.split("농협")[0].trim() + "농협";
    const branchName = name.includes("본점")
      ? "본점"
      : name.replace(mainName, "").replace(/[지점]/g, "").trim() || "본점";

    if (!map[mainName]) map[mainName] = [];
    map[mainName].push({
      main: mainName,
      sub: branchName,
      address: item.address,
      phone: item.phone,
    });
  }

  return Object.values(map).flat();
}
