const HORIZONTAL_PADDING = 88;
const VERTICAL_PADDING = 72;
const COLUMN_PITCH = 148;
const ROW_PITCH = 132;

export function mapCanvasDimensions(columns: number, rows: number) {
  const safeColumns = Math.max(1, Math.floor(columns));
  const safeRows = Math.max(1, Math.floor(rows));
  return {
    width: HORIZONTAL_PADDING + COLUMN_PITCH * safeColumns,
    height: VERTICAL_PADDING + ROW_PITCH * safeRows,
  };
}

export function hexColumnClass(column: number) {
  return column % 2 === 1 ? "offset" : "";
}
