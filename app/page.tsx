"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface StockItem {
  id: number;
  nome: string;
  quantidade: number;
  stock_minimo: number;
  localizacao: string;
  unidade: string;
  updated_at: string;
}

interface ConfigProduct {
  id: number;
  nome: string;
  unidade: string;
}

interface ConfigLocation {
  id: number;
  nome: string;
}

type ActiveTab = "inventario" | "compras";

export default function Home() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("inventario");
  const [locationFilter, setLocationFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    nome: "",
    quantidade: 0,
    stock_minimo: 1,
    localizacao: "",
    unidade: "un",
  });
  const [error, setError] = useState<string | null>(null);
  const [configProducts, setConfigProducts] = useState<ConfigProduct[]>([]);
  const [configLocations, setConfigLocations] = useState<ConfigLocation[]>([]);
  const [customNome, setCustomNome] = useState(false);
  const [customLocalizacao, setCustomLocalizacao] = useState(false);

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

  useEffect(() => {
    fetchItems();
    fetchConfig();
  }, [fetchItems, fetchConfig]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) throw new Error("Erro ao adicionar item");
      const created: StockItem = await res.json();
      setItems((prev) => [created, ...prev]);
      setNewItem({ nome: "", quantidade: 0, stock_minimo: 1, localizacao: "", unidade: "un" });
      setCustomNome(false);
      setCustomLocalizacao(false);
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const locations = [...new Set(items.map((i) => i.localizacao).filter(Boolean))];
  const filtered = items.filter(
    (i) => !locationFilter || i.localizacao === locationFilter
  );
  const lowStock = items.filter((i) => i.quantidade <= i.stock_minimo);

  const displayItems = activeTab === "inventario" ? filtered : lowStock;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40">
        <header className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 pt-5 pb-4 shadow-lg">
          <div className="max-w-lg mx-auto">
            <div className="h-7 w-36 bg-white/20 rounded-lg animate-pulse" />
            <div className="h-4 w-24 bg-white/15 rounded mt-2 animate-pulse" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="h-14 bg-white/15 rounded-xl animate-pulse" />
              <div className="h-14 bg-white/15 rounded-xl animate-pulse" />
            </div>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden flex animate-pulse">
              <div className="w-1 bg-slate-200 shrink-0" />
              <div className="flex-1 px-4 py-4">
                <div className="h-4 w-2/3 bg-slate-200 rounded mb-3" />
                <div className="h-3 w-1/3 bg-slate-100 rounded mb-3" />
                <div className="h-1.5 w-full bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-4">
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold tracking-tight">📦 Inventário</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Link
                href="/configuracoes"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors text-lg"
                aria-label="Configurações"
              >
                ⚙️
              </Link>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-white text-blue-600 text-sm font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-blue-50 transition-colors"
              >
                + Novo
              </button>
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-xs text-blue-100">itens no total</p>
            </div>
            <div className={`rounded-xl px-3 py-2 text-center transition-colors ${
              lowStock.length > 0 ? "bg-red-500/30" : "bg-white/15"
            }`}>
              <p className="text-2xl font-bold">{lowStock.length}</p>
              <p className="text-xs text-blue-100">em falta</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-start justify-between gap-2 shadow-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold shrink-0 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <form
            onSubmit={handleAddItem}
            className="bg-white rounded-2xl border border-slate-100 p-5 mb-4 shadow-sm space-y-4 animate-slide-down"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Novo Item</h2>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setCustomNome(false); setCustomLocalizacao(false); }}
                className="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Product name */}
            {configProducts.length > 0 && !customNome ? (
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Produto</label>
                <div className="flex gap-2">
                  <select
                    required
                    value={newItem.nome}
                    onChange={(e) => {
                      const val = e.target.value;
                      const selected = configProducts.find((p) => p.nome === val);
                      setNewItem({ ...newItem, nome: val, unidade: selected ? selected.unidade : "un" });
                    }}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  >
                    <option value="">— Selecionar produto —</option>
                    {configProducts.map((p) => (
                      <option key={p.id} value={p.nome}>{p.nome}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setCustomNome(true); setNewItem({ ...newItem, nome: "", unidade: "un" }); }}
                    className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-3 bg-slate-50 hover:bg-slate-100 whitespace-nowrap transition-colors"
                  >
                    Outro
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Produto</label>
                <div className="flex gap-2">
                  <input
                    required
                    placeholder="Nome do produto"
                    value={newItem.nome}
                    onChange={(e) => setNewItem({ ...newItem, nome: e.target.value })}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                  {configProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setCustomNome(false); setNewItem({ ...newItem, nome: "" }); }}
                      className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-3 bg-slate-50 hover:bg-slate-100 whitespace-nowrap transition-colors"
                    >
                      Lista
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Quantidade</label>
                <input
                  type="number"
                  min="0"
                  value={newItem.quantidade}
                  onChange={(e) => setNewItem({ ...newItem, quantidade: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Stock mínimo</label>
                <input
                  type="number"
                  min="0"
                  value={newItem.stock_minimo}
                  onChange={(e) => setNewItem({ ...newItem, stock_minimo: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Localização</label>
                {configLocations.length > 0 && !customLocalizacao ? (
                  <div className="flex gap-1">
                    <select
                      value={newItem.localizacao}
                      onChange={(e) => setNewItem({ ...newItem, localizacao: e.target.value })}
                      className="flex-1 border border-slate-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                    >
                      <option value="">— Selecionar —</option>
                      {configLocations.map((l) => (
                        <option key={l.id} value={l.nome}>{l.nome}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setCustomLocalizacao(true); setNewItem({ ...newItem, localizacao: "" }); }}
                      className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                      title="Outra localização"
                    >
                      ✎
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <input
                      placeholder="Ex: Cozinha"
                      value={newItem.localizacao}
                      onChange={(e) => setNewItem({ ...newItem, localizacao: e.target.value })}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                    />
                    {configLocations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setCustomLocalizacao(false); setNewItem({ ...newItem, localizacao: "" }); }}
                        className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                        title="Usar lista"
                      >
                        ☰
                      </button>
                    )}
                  </div>
                )}
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

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
            >
              Adicionar ao Inventário
            </button>
          </form>
        )}

        {/* Tabs */}
        <div className="flex bg-white border border-slate-100 rounded-2xl p-1 mb-4 shadow-sm gap-1">
          <button
            onClick={() => setActiveTab("inventario")}
            className={`flex-1 text-sm font-semibold py-2.5 rounded-xl transition-all ${
              activeTab === "inventario"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            Inventário
          </button>
          <button
            onClick={() => setActiveTab("compras")}
            className={`flex-1 text-sm font-semibold py-2.5 rounded-xl transition-all ${
              activeTab === "compras"
                ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            Compras{lowStock.length > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === "compras" ? "bg-white/25" : "bg-red-100 text-red-500"
              }`}>
                {lowStock.length}
              </span>
            )}
          </button>
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
          <ul className="space-y-2.5">
            {displayItems.map((item) => {
              const isLow = item.quantidade <= item.stock_minimo;
              const isWarning = !isLow && item.quantidade <= item.stock_minimo * 2;
              const maxQty = Math.max(item.stock_minimo * 3, item.quantidade, 3);
              const pct = Math.min(100, Math.round((item.quantidade / maxQty) * 100));
              const barColor = isLow
                ? "bg-red-400"
                : isWarning
                ? "bg-amber-400"
                : "bg-emerald-400";
              return (
                <li key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden flex">
                  <div className={`w-1 shrink-0 ${isLow ? "bg-red-400" : "bg-blue-400"}`} />
                  <div className="flex-1 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm">{item.nome}</span>
                          {isLow && (
                            <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full font-medium shrink-0">
                              Baixo
                            </span>
                          )}
                        </div>
                        {item.localizacao && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-1 bg-slate-50 px-2 py-0.5 rounded-full">
                            📍 {item.localizacao}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleQuantityChange(item.id, -1)}
                          disabled={item.quantidade <= 0}
                          className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-bold text-lg flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 transition-colors"
                        >
                          −
                        </button>
                        <div className="flex flex-col items-center w-14">
                          <span className={`text-base font-bold leading-tight ${isLow ? "text-red-500" : "text-slate-800"}`}>
                            {item.quantidade}
                          </span>
                          <span className="text-xs text-slate-400 leading-tight">{item.unidade}</span>
                        </div>
                        <button
                          onClick={() => handleQuantityChange(item.id, 1)}
                          className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 font-bold text-lg flex items-center justify-center hover:bg-blue-100 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {/* Stock progress bar */}
                    <div className="mt-2.5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-400">mín: {item.stock_minimo} {item.unidade}</span>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-xs text-slate-300 hover:text-red-400 transition-colors"
                        >
                          Apagar
                        </button>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
