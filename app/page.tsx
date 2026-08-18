"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ChefHat, Package, Settings, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InventoryCard } from "@/components/inventory/inventory-card";
import { readStockSnapshot, writeStockSnapshot } from "@/lib/inventory-cache";

interface StockItem {
  id: number;
  nome: string;
  quantidade: number;
  stock_minimo: number;
  localizacao: string;
  unidade: string;
  updated_at: string;
  categoria?: string | null;
}

interface ConfigProduct {
  id: number;
  nome: string;
  unidade: string;
  localizacao_padrao: string | null;
  categoria?: string | null;
}

interface ConfigLocation {
  id: number;
  nome: string;
}

interface NewItemForm {
  nome: string;
  quantidade: number | string | "";
  stock_minimo: number | string | "";
  localizacao: string;
  unidade: string;
}

type ActiveTab = "inventario" | "compras";

const INTEGER_INPUT_PATTERN = /^\d*$/;
const DECIMAL_INPUT_PATTERN = /^\d*(?:\.\d{0,3})?$/;

function isDecimalUnit(unit: string): boolean {
  const normalized = unit.toLowerCase();
  return normalized === "kg" || normalized === "l" || normalized === "ml";
}

function isValidNumericInput(value: string, unit: string): boolean {
  return isDecimalUnit(unit) ? DECIMAL_INPUT_PATTERN.test(value) : INTEGER_INPUT_PATTERN.test(value);
}

function getNumberStep(unit: string): string {
  return isDecimalUnit(unit) ? "0.100" : "1";
}

function getStockMinStep(unit: string): string {
  return isDecimalUnit(unit) ? "0.100" : "1";
}

function formatUnitAmount(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "0";
  if (!isDecimalUnit(unit)) {
    return String(Math.round(value));
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function parseQuantityByUnit(value: string, unit: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  if (trimmed.includes(",")) return null;

  if (isDecimalUnit(unit)) {
    if (!/^\d+(?:\.\d{1,3})?$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export default function Home() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("inventario");
  const [locationFilter, setLocationFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<NewItemForm>({
    nome: "",
    quantidade: 0,
    stock_minimo: 1,
    localizacao: "",
    unidade: "un",
  });
  const [error, setError] = useState<string | null>(null);
  const [configProducts, setConfigProducts] = useState<ConfigProduct[]>([]);
  const [configLocations, setConfigLocations] = useState<ConfigLocation[]>([]);
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [editingQuantityId, setEditingQuantityId] = useState<number | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("");
  const [editingStockMinId, setEditingStockMinId] = useState<number | null>(null);
  const [stockMinDraft, setStockMinDraft] = useState("");
  const productInputRef = useRef<HTMLInputElement | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/stock");
      if (!res.ok) throw new Error("Erro ao carregar itens");
      const data: StockItem[] = await res.json();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    const [pRes, lRes] = await Promise.all([
      fetch("/api/config/products"),
      fetch("/api/config/locations"),
    ]);
    if (pRes.ok) setConfigProducts(await pRes.json());
    if (lRes.ok) setConfigLocations(await lRes.json());
  }, []);

  const triggerAutoRecipeSuggestion = useCallback(async () => {
    try {
      await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto" }),
      });
    } catch {
      // Silently ignore; recipe suggestions are best-effort only.
    }
  }, []);

  useEffect(() => {
    const snapshot = readStockSnapshot();
    if (snapshot) {
      setItems(snapshot);
      setLoading(false);
    }

    fetchItems();
    fetchConfig();
  }, [fetchItems, fetchConfig]);

  useEffect(() => {
    if (!loading) writeStockSnapshot(items);
  }, [items, loading]);

  useEffect(() => {
    if (!showAddForm) return;
    const timer = setTimeout(() => {
      productInputRef.current?.focus();
      productInputRef.current?.select();
    }, 50);

    return () => clearTimeout(timer);
  }, [showAddForm]);

  const handleQuantityChange = async (id: number, delta: number) => {
    try {
      const res = await fetch(`/api/stock/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      const updated: StockItem = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      void triggerAutoRecipeSuggestion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleStockMinChange = async (id: number, stockMinimo: number) => {
    try {
      const res = await fetch(`/api/stock/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_minimo: stockMinimo }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar stock mínimo");
      const updated: StockItem = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Apagar este item?")) return;
    try {
      const res = await fetch(`/api/stock/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao apagar");
      setItems((prev) => prev.filter((item) => item.id !== id));
      void triggerAutoRecipeSuggestion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const startQuantityEdit = (item: StockItem) => {
    setEditingQuantityId(item.id);
    setQuantityDraft(formatUnitAmount(item.quantidade, item.unidade));
  };

  const cancelQuantityEdit = () => {
    setEditingQuantityId(null);
    setQuantityDraft("");
  };

  const startStockMinEdit = (item: StockItem) => {
    setEditingStockMinId(item.id);
    setStockMinDraft(formatUnitAmount(item.stock_minimo, item.unidade));
  };

  const cancelStockMinEdit = () => {
    setEditingStockMinId(null);
    setStockMinDraft("");
  };

  const saveQuantityEdit = async (item: StockItem) => {
    const parsed = parseQuantityByUnit(quantityDraft, item.unidade);
    if (parsed === null) {
      setError(
        isDecimalUnit(item.unidade)
          ? "Quantidade para kg/L/ml deve usar ponto decimal (ex.: 1.5)"
          : "Quantidade deve ser um número inteiro maior ou igual a 0"
      );
      return;
    }

    const delta = parsed - item.quantidade;
    if (delta !== 0) {
      await handleQuantityChange(item.id, delta);
    }

    cancelQuantityEdit();
  };

  const saveStockMinEdit = async (item: StockItem) => {
    const parsed = parseQuantityByUnit(stockMinDraft, item.unidade);
    if (parsed === null) {
      setError(
        isDecimalUnit(item.unidade)
          ? "Stock mínimo para kg/L/ml deve usar ponto decimal (ex.: 1.5)"
          : "Stock mínimo deve ser um número inteiro maior ou igual a 0"
      );
      return;
    }

    if (parsed !== item.stock_minimo) {
      await handleStockMinChange(item.id, parsed);
    }

    cancelStockMinEdit();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newItem,
          quantidade: newItem.quantidade === "" ? 0 : newItem.quantidade,
          stock_minimo: newItem.stock_minimo === "" ? 1 : newItem.stock_minimo,
        }),
      });
      if (!res.ok) throw new Error("Erro ao adicionar item");
      const created: StockItem = await res.json();
      setItems((prev) => [created, ...prev]);
      setNewItem({ nome: "", quantidade: 0, stock_minimo: 1, localizacao: "", unidade: "un" });
      setProductCategoryFilter("");
      setShowProductSuggestions(false);
      setShowAddForm(false);
      void triggerAutoRecipeSuggestion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const WARNING_MULTIPLIER = 2;
  const MAX_QTY_MULTIPLIER = 3;

  const normalizeSearch = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase()
      .trim();

  const productCategories = Array.from(
    new Set(
      configProducts
        .map((p) => p.categoria ?? "")
        .filter((c) => c.trim() !== "")
    )
  ).sort((a, b) => a.localeCompare(b));

  const filteredProductSuggestions = configProducts.filter((p) => {
    const byCategory = !productCategoryFilter || p.categoria === productCategoryFilter;
    const query = normalizeSearch(newItem.nome);
    if (!query) return byCategory;
    return byCategory && normalizeSearch(p.nome).includes(query);
  });

  const applySelectedProduct = (selected: ConfigProduct) => {
    setNewItem((prev) => ({
      ...prev,
      nome: selected.nome,
      unidade: selected.unidade,
      localizacao: prev.localizacao || selected.localizacao_padrao || "",
    }));
    setShowProductSuggestions(false);
  };

  const locationOptions = Array.from(
    new Set([
      ...configLocations.map((l) => l.nome),
      ...configProducts
        .map((p) => p.localizacao_padrao ?? "")
        .filter((loc) => loc.trim() !== ""),
      ...items.map((i) => i.localizacao).filter((loc) => loc.trim() !== ""),
      newItem.localizacao.trim(),
    ])
  )
    .filter((loc) => loc !== "")
    .sort((a, b) => a.localeCompare(b));

  const locations = [...new Set(items.map((i) => i.localizacao).filter(Boolean))];
  const filtered = items.filter(
    (i) =>
      (!locationFilter || i.localizacao === locationFilter) &&
      (!categoryFilter || i.categoria === categoryFilter)
  );
  const categories = [...new Set(items.map((i) => i.categoria).filter(Boolean))] as string[];
  const lowStock = items.filter((i) => i.quantidade <= i.stock_minimo);

  const resetAddForm = () => {
    setShowAddForm(false);
    setProductCategoryFilter("");
    setShowProductSuggestions(false);
  };

  const displayItems = activeTab === "inventario" ? filtered : lowStock;

  if (loading) {
    return (
      <div className="min-h-screen">
        <header className="bg-[#12212b] px-4 pb-5 pt-6 text-white shadow-[0_12px_40px_rgb(18_33_43/0.18)]">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 h-3 w-28 rounded bg-[#c7f36b]/40 animate-pulse" />
            <div className="h-7 w-36 rounded-lg bg-white/20 animate-pulse" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="h-16 rounded-2xl bg-white/10 animate-pulse" />
              <div className="h-16 rounded-2xl bg-white/10 animate-pulse" />
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-2xl space-y-3 px-4 pb-32 pt-5 sm:px-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(15_23_42/0.04)] animate-pulse">
              <div className="w-1 shrink-0 bg-slate-200" />
              <div className="flex-1 px-5 py-4">
                <div className="mb-3 h-4 w-2/3 rounded bg-slate-200" />
                <div className="mb-3 h-3 w-1/3 rounded bg-slate-100" />
                <div className="h-2 w-full rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="overflow-hidden bg-[#12212b] text-white shadow-[0_12px_40px_rgb(18_33_43/0.18)]">
        <div className="mx-auto max-w-2xl px-4 pb-5 pt-6 sm:px-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#c7f36b]">Casa em ordem</p>
              <h1 className="flex items-center gap-2 text-2xl font-black tracking-[-0.04em]">
                <Package className="h-6 w-6 text-[#c7f36b]" aria-hidden="true" />
                Inventário
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Link
                href="/configuracoes"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f36b]"
                aria-label="Configurações"
              >
                <Settings className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
          {/* Stats */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-3">
              <p className="text-2xl font-black tracking-[-0.04em]">{items.length}</p>
              <p className="text-xs font-medium text-slate-300">itens no total</p>
            </div>
            <div className={`rounded-2xl border px-3 py-3 transition-colors ${
              lowStock.length > 0 ? "border-[#f5b3a8]/50 bg-[#f5b3a8]/15" : "border-white/10 bg-white/[0.08]"
            }`}>
              <p className="text-2xl font-black tracking-[-0.04em]">{lowStock.length}</p>
              <p className="text-xs font-medium text-slate-300">em falta</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-5 sm:px-6">
        {/* Error banner */}
        {error && (
          <div role="alert" className="mb-4 flex items-start justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold shrink-0 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <form
            onSubmit={handleAddItem}
            className="bg-white rounded-2xl border border-slate-100 p-5 mb-4 shadow-sm space-y-4 animate-slide-down max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain pb-6 md:max-h-none md:overflow-visible md:pb-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Novo Item</h2>
              <button
                type="button"
                onClick={() => resetAddForm()}
                className="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Product name */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Produto</label>
              <div className="space-y-2">
                {productCategories.length > 0 && (
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  >
                    <option value="">Todas as categorias</option>
                    {productCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}

                <div className="relative">
                  <input
                    ref={productInputRef}
                    required
                    placeholder={configProducts.length > 0 ? "Escreve para filtrar produtos" : "Nome do produto"}
                    value={newItem.nome}
                    onFocus={() => setShowProductSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowProductSuggestions(false), 120);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && showProductSuggestions && filteredProductSuggestions.length > 0) {
                        e.preventDefault();
                        applySelectedProduct(filteredProductSuggestions[0]);
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      const selected = configProducts.find(
                        (p) => normalizeSearch(p.nome) === normalizeSearch(val)
                      );

                      setNewItem((prev) => ({
                        ...prev,
                        nome: val,
                        unidade: selected ? selected.unidade : prev.unidade,
                        localizacao: selected
                          ? prev.localizacao || selected.localizacao_padrao || ""
                          : prev.localizacao,
                      }));
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />

                  {showProductSuggestions && filteredProductSuggestions.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {filteredProductSuggestions.slice(0, 30).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySelectedProduct(p)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0 border-slate-100"
                        >
                          <div className="text-sm text-slate-800">{p.nome}</div>
                          <div className="text-xs text-slate-400">
                            {p.categoria || "Sem categoria"} • {p.unidade}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Quantidade</label>
                <input
                  type="number"
                  inputMode={isDecimalUnit(newItem.unidade) ? "decimal" : "numeric"}
                  step={getNumberStep(newItem.unidade)}
                  min="0"
                  value={newItem.quantidade}
                  onFocus={(e) => {
                    if (newItem.quantidade === 0 || newItem.quantidade === "0") {
                      setNewItem({ ...newItem, quantidade: "" });
                    }
                    e.currentTarget.select();
                  }}
                  onBlur={() => {
                    if (newItem.quantidade === "") {
                      setNewItem({ ...newItem, quantidade: 0 });
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes(",")) {
                      return;
                    }
                    if (!isValidNumericInput(val, newItem.unidade)) {
                      return;
                    }
                    if (val === "") {
                      setNewItem({ ...newItem, quantidade: "" });
                      return;
                    }
                    setNewItem({
                      ...newItem,
                      quantidade: val,
                    });
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Stock mínimo</label>
                <input
                  type="number"
                  inputMode={isDecimalUnit(newItem.unidade) ? "decimal" : "numeric"}
                  step={getStockMinStep(newItem.unidade)}
                  min="0"
                  value={newItem.stock_minimo}
                  onFocus={(e) => {
                    if (newItem.stock_minimo === 1 || newItem.stock_minimo === "1") {
                      setNewItem({ ...newItem, stock_minimo: "" });
                    }
                    e.currentTarget.select();
                  }}
                  onBlur={() => {
                    if (newItem.stock_minimo === "") {
                      setNewItem({ ...newItem, stock_minimo: 1 });
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes(",")) {
                      return;
                    }
                    if (!isValidNumericInput(val, newItem.unidade)) {
                      return;
                    }
                    if (val === "") {
                      setNewItem({ ...newItem, stock_minimo: "" });
                      return;
                    }
                    setNewItem({
                      ...newItem,
                      stock_minimo: val,
                    });
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Localização</label>
                <select
                  value={newItem.localizacao}
                  onChange={(e) => setNewItem({ ...newItem, localizacao: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                >
                  <option value="">Sem localização</option>
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Unidade</label>
                <select
                  value={newItem.unidade}
                  onChange={(e) => setNewItem({ ...newItem, unidade: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                >
                  <option value="un">un</option>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="cx">cx</option>
                  <option value="pac">pac</option>
                </select>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full rounded-xl py-3"
            >
              Adicionar ao Inventário
            </Button>
          </form>
        )}

        {/* Tabs */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-medium text-slate-500">
              {activeTab === "inventario" ? "Secção Inventário" : "Secção Compras"}
            </p>
          </div>

          <div className="flex gap-1">
            <Button
              onClick={() => setActiveTab("inventario")}
              variant={activeTab === "inventario" ? "primary" : "ghost"}
              className={`flex-1 rounded-xl py-2.5 ${
                activeTab === "inventario"
                  ? ""
                  : "text-slate-500"
              }`}
            >
              Inventário
            </Button>
            <Button
              onClick={() => setActiveTab("compras")}
              variant={activeTab === "compras" ? "danger" : "ghost"}
              className={`flex-1 rounded-xl py-2.5 ${
                activeTab === "compras"
                  ? ""
                  : "text-slate-500"
              }`}
            >
              Compras{lowStock.length > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === "compras" ? "bg-white/25" : "bg-red-100 text-red-500"
                }`}>
                  {lowStock.length}
                </span>
              )}
            </Button>
            <Link
              href="/receitas"
              className="flex-1 text-center text-sm font-semibold py-2.5 rounded-xl transition-all text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-100"
            >
              Chef AI
            </Link>
          </div>
        </div>

        {/* Location filter */}
        {activeTab === "inventario" && locations.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            <button
              onClick={() => setLocationFilter("")}
              className={`shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-all ${
                !locationFilter
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              Todos
            </button>
            {locations.map((loc) => (
              <button
                key={loc}
                onClick={() => setLocationFilter(loc)}
                className={`shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-all ${
                  locationFilter === loc
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600"
                }`}
              >
                📍 {loc}
              </button>
            ))}
          </div>
        )}

        {/* Category filter */}
        {activeTab === "inventario" && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            <button
              onClick={() => setCategoryFilter("")}
              className={`shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-all ${
                !categoryFilter
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              Todas as categorias
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition-all ${
                  categoryFilter === cat
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Items list */}
        {displayItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">
              {activeTab === "compras" ? "✅" : "📦"}
            </div>
            <p className="font-semibold text-slate-600 mb-1">
              {activeTab === "compras" ? "Tudo em stock!" : "Inventário vazio"}
            </p>
            <p className="text-sm text-slate-400">
              {activeTab === "compras"
                ? "Nenhum item com stock baixo."
                : "Adiciona o primeiro item ao teu inventário."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {displayItems.map((item) => (
              <InventoryCard
                key={item.id}
                item={item}
                warningMultiplier={WARNING_MULTIPLIER}
                maxQuantityMultiplier={MAX_QTY_MULTIPLIER}
                editingQuantity={editingQuantityId === item.id}
                quantityDraft={quantityDraft}
                editingStockMinimum={editingStockMinId === item.id}
                stockMinimumDraft={stockMinDraft}
                onQuantityChange={handleQuantityChange}
                onQuantityDraftChange={setQuantityDraft}
                onStockMinimumDraftChange={setStockMinDraft}
                onStartQuantityEdit={startQuantityEdit}
                onSaveQuantityEdit={(selectedItem) => void saveQuantityEdit(selectedItem)}
                onCancelQuantityEdit={cancelQuantityEdit}
                onStartStockMinimumEdit={startStockMinEdit}
                onSaveStockMinimumEdit={(selectedItem) => void saveStockMinEdit(selectedItem)}
                onCancelStockMinimumEdit={cancelStockMinEdit}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </ul>
        )}

        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-2xl px-5 py-3 shadow-lg"
        >
          {showAddForm ? "Fechar" : "+ Novo"}
        </Button>
      </main>
    </div>
  );
}
