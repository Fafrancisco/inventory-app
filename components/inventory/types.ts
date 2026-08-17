export interface StockItem {
  id: number;
  nome: string;
  quantidade: number;
  stock_minimo: number;
  localizacao: string;
  unidade: string;
  updated_at: string;
  categoria?: string | null;
}

export function isDecimalUnit(unit: string): boolean {
  const normalized = unit.toLowerCase();
  return normalized === "kg" || normalized === "l" || normalized === "ml";
}

export function formatUnitAmount(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "0";
  if (!isDecimalUnit(unit)) return String(Math.round(value));
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, "");
}

export function getNumberStep(unit: string): string {
  return isDecimalUnit(unit) ? "0.100" : "1";
}

export function getStockMinStep(unit: string): string {
  return isDecimalUnit(unit) ? "0.100" : "1";
}

export function isValidNumericInput(value: string, unit: string): boolean {
  const pattern = isDecimalUnit(unit) ? /^\d*(?:\.\d{0,3})?$/ : /^\d*$/;
  return pattern.test(value);
}