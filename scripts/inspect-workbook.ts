import ExcelJS from "exceljs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/inspect-workbook.ts <file.xlsx>");
  process.exit(1);
}

async function run() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  for (const worksheet of workbook.worksheets) {
    console.log(`\n=== Sheet: "${worksheet.name}" (rows: ${worksheet.rowCount}, cols: ${worksheet.columnCount}) ===`);
    const maxHeaderRows = 2;
    for (let r = 1; r <= maxHeaderRows; r++) {
      const row = worksheet.getRow(r);
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values.push(`[${colNumber}]${JSON.stringify(cell.value)}`);
      });
      console.log(`Row ${r}: ${values.join(" | ")}`);
    }
    console.log("Sample data rows:");
    for (let r = 3; r <= Math.min(6, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values.push(`[${colNumber}]${JSON.stringify(cell.value)}`);
      });
      console.log(`Row ${r}: ${values.join(" | ")}`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
