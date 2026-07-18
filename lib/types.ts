export interface StockItem {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  localizacao: string;
  categoria: string;
  stock_minimo: number;
  updated_at: string;
}

export type CreateStockItemPayload = Omit<StockItem, "id" | "updated_at">;

export interface PatchStockItemPayload {
  id: string;
  /** Quick-adjust mode: apply a numeric delta to `quantidade` */
  delta?: number;
  /** Partial-update mode: update one or more fields */
  nome?: string;
  quantidade?: number;
  unidade?: string;
  localizacao?: string;
  categoria?: string;
  stock_minimo?: number;
}
