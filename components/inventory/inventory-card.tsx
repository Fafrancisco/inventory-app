"use client";

import { MapPin, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatUnitAmount,
  getNumberStep,
  getStockMinStep,
  isDecimalUnit,
  isValidNumericInput,
  type StockItem,
} from "@/components/inventory/types";

interface InventoryCardProps {
  item: StockItem;
  warningMultiplier: number;
  maxQuantityMultiplier: number;
  editingQuantity: boolean;
  quantityDraft: string;
  editingStockMinimum: boolean;
  stockMinimumDraft: string;
  onQuantityChange: (id: number, delta: number) => void;
  onQuantityDraftChange: (value: string) => void;
  onStockMinimumDraftChange: (value: string) => void;
  onStartQuantityEdit: (item: StockItem) => void;
  onSaveQuantityEdit: (item: StockItem) => void;
  onCancelQuantityEdit: () => void;
  onStartStockMinimumEdit: (item: StockItem) => void;
  onSaveStockMinimumEdit: (item: StockItem) => void;
  onCancelStockMinimumEdit: () => void;
  onDelete: (id: number) => void;
}

export function InventoryCard({
  item,
  warningMultiplier,
  maxQuantityMultiplier,
  editingQuantity,
  quantityDraft,
  editingStockMinimum,
  stockMinimumDraft,
  onQuantityChange,
  onQuantityDraftChange,
  onStockMinimumDraftChange,
  onStartQuantityEdit,
  onSaveQuantityEdit,
  onCancelQuantityEdit,
  onStartStockMinimumEdit,
  onSaveStockMinimumEdit,
  onCancelStockMinimumEdit,
  onDelete,
}: InventoryCardProps) {
  const isLow = item.quantidade <= item.stock_minimo;
  const isWarning = !isLow && item.quantidade <= item.stock_minimo * warningMultiplier;
  const maxQuantity = Math.max(item.stock_minimo * maxQuantityMultiplier, item.quantidade, 3);
  const percentage = Math.min(100, Math.round((item.quantidade / maxQuantity) * 100));
  const status = isLow ? "low" : isWarning ? "warning" : "healthy";
  const statusStyles = {
    low: { rail: "bg-rose-500", bar: "bg-rose-500", badge: "border-rose-200 bg-rose-50 text-rose-700" },
    warning: { rail: "bg-amber-500", bar: "bg-amber-500", badge: "border-amber-200 bg-amber-50 text-amber-700" },
    healthy: { rail: "bg-emerald-500", bar: "bg-emerald-500", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  }[status];

  const handleDraftChange = (value: string, callback: (draft: string) => void) => {
    if (!value.includes(",") && isValidNumericInput(value, item.unidade)) callback(value);
  };

  return (
    <li className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(15_23_42/0.04)] transition-shadow hover:shadow-[0_12px_36px_rgb(15_23_42/0.08)]">
      <div className={`absolute inset-y-0 left-0 w-1 ${statusStyles.rail}`} />
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[15px] font-bold tracking-[-0.01em] text-slate-900">{item.nome}</span>
              {isLow && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusStyles.badge}`}>Baixo</span>}
            </div>
            {item.localizacao ? (
              <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                {item.localizacao}
              </span>
            ) : (
              <span className="mt-1.5 text-xs text-slate-400">Sem localização</span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="secondary"
              aria-label={`Diminuir quantidade de ${item.nome}`}
              onClick={() => onQuantityChange(item.id, -1)}
              disabled={item.quantidade <= 0}
              className="h-10 min-h-10 w-10 rounded-xl p-0 text-slate-500"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="flex w-14 flex-col items-center">
              {editingQuantity ? (
                <input
                  type="number"
                  inputMode={isDecimalUnit(item.unidade) ? "decimal" : "numeric"}
                  step={getNumberStep(item.unidade)}
                  min="0"
                  autoFocus
                  value={quantityDraft}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => handleDraftChange(event.target.value, onQuantityDraftChange)}
                  onBlur={() => onSaveQuantityEdit(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); onSaveQuantityEdit(item); }
                    if (event.key === "Escape") { event.preventDefault(); onCancelQuantityEdit(); }
                  }}
                  className="h-9 w-14 rounded-lg border border-blue-300 text-center text-base font-bold text-slate-900 outline-none ring-2 ring-blue-100"
                  aria-label={`Quantidade de ${item.nome}`}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onStartQuantityEdit(item)}
                  className={`rounded-lg px-1 text-base font-bold leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isLow ? "text-rose-600" : "text-slate-900"}`}
                  title="Editar quantidade"
                  aria-label={`Editar quantidade de ${item.nome}`}
                >
                  {formatUnitAmount(item.quantidade, item.unidade)}
                  <Pencil className="ml-1 inline h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" aria-hidden="true" />
                </button>
              )}
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.unidade}</span>
            </div>
            <Button
              aria-label={`Aumentar quantidade de ${item.nome}`}
              onClick={() => onQuantityChange(item.id, 1)}
              className="h-10 min-h-10 w-10 rounded-xl p-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            {editingStockMinimum ? (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>mín.</span>
                <input
                  type="number"
                  inputMode={isDecimalUnit(item.unidade) ? "decimal" : "numeric"}
                  step={getStockMinStep(item.unidade)}
                  min="0"
                  autoFocus
                  value={stockMinimumDraft}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => handleDraftChange(event.target.value, onStockMinimumDraftChange)}
                  onBlur={() => onSaveStockMinimumEdit(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); onSaveStockMinimumEdit(item); }
                    if (event.key === "Escape") { event.preventDefault(); onCancelStockMinimumEdit(); }
                  }}
                  className="h-7 w-16 rounded-md border border-blue-300 text-center text-xs font-bold outline-none ring-2 ring-blue-100"
                  aria-label={`Stock mínimo de ${item.nome}`}
                />
                <span>{item.unidade}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onStartStockMinimumEdit(item)}
                className="rounded-md px-1 text-xs font-medium text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Editar stock mínimo"
                aria-label={`Editar stock mínimo de ${item.nome}`}
              >
                mín. {formatUnitAmount(item.stock_minimo, item.unidade)} {item.unidade}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Apagar
            </button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${percentage}% do nível máximo`} role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full transition-[width] duration-300 ${statusStyles.bar}`} style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </div>
    </li>
  );
}