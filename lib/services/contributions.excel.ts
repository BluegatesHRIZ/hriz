import ExcelJS from "exceljs";
import type {
  HdmfContributionRow,
  PhicContributionRow,
  SssContributionRow,
} from "@/lib/services/contributions.service";

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF0F0F0" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11 };

function autoSize(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    if (!column.eachCell) return;
    let max = 8;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      if (value === null || value === undefined) return;
      const text = String(value);
      if (text.length > max) max = text.length;
    });
    column.width = Math.min(max + 2, 50);
  });
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
  });
}

function num(v: number | null | undefined): number | string {
  return v ?? "";
}

export async function buildSssContributionXlsx(
  rows: SssContributionRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("SSS Contributions");
  sheet.addRow([
    "Month",
    "Name",
    "SSS ID",
    "Salary",
    "EC",
    "WISP",
    "MSCT",
    "RSSER",
    "RSSEE",
    "RSST",
    "ECER",
    "ECEE",
    "ECT",
    "WISPER",
    "WIPEE",
    "WISPT",
    "TER",
    "TEE",
    "TT",
  ]);
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow([
      row.pyh_desc,
      row.emp_name,
      row.emp_sss,
      num(row.salary),
      num(row.ec),
      num(row.wisp),
      num(row.msct),
      num(row.rsser),
      num(row.rssee),
      num(row.rsst),
      num(row.ecer),
      num(row.ecee),
      num(row.ect),
      num(row.wisper),
      num(row.wipee),
      num(row.wispt),
      num(row.ter),
      num(row.tee),
      num(row.tt),
    ]);
  }
  autoSize(sheet);
  return wb.xlsx.writeBuffer();
}

export async function buildHdmfContributionXlsx(
  rows: HdmfContributionRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("HDMF Contributions");
  sheet.addRow(["Month", "Name", "Pagibig ID", "Salary", "HDMF", "HDMFER"]);
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow([
      row.pyh_desc,
      row.emp_name,
      row.emp_pagibig,
      num(row.salary),
      num(row.pyd_hdmf),
      num(row.pyd_hdmfer),
    ]);
  }
  autoSize(sheet);
  return wb.xlsx.writeBuffer();
}

export async function buildPhicContributionXlsx(
  rows: PhicContributionRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("PHIC Contributions");
  sheet.addRow(["Month", "Name", "PhilHealth ID", "Salary", "PHIC", "PHICER"]);
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow([
      row.pyh_desc,
      row.emp_name,
      row.emp_philhealth,
      num(row.salary),
      num(row.pyd_phic),
      num(row.pyd_phicer),
    ]);
  }
  autoSize(sheet);
  return wb.xlsx.writeBuffer();
}
