export interface ExcelValidateError {
  row: number;
  errors: string[];
}

export interface ExcelValidatePreview {
  row: number;
  customer_name: string;
  address: string;
}

export interface ExcelValidateResult {
  valid: boolean;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  errors: ExcelValidateError[];
  preview: ExcelValidatePreview[];
}

export interface ExcelImportResult {
  mode: "insert" | "upsert";
  created: number;
  updated: number;
  imported: number;
  activity_ids: number[];
}
