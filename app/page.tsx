"use client";

import { useEffect, useState, useCallback } from "react";

interface StockItem {
  id: number;
  nome: string;
  quantidade: number;
  stock_minimo: number;
  localizacao: string;
  unidade: string;
  updated_at: string;
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

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm">A carregar...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-5 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📦 Inventário</h1>
            <p className="text-blue-100 text-xs mt-0.5">
              {items.length} {items.length === 1 ? "item" : "itens"} · {lowStock.length} em falta
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-white text-blue-600 text-sm font-semibold px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
          >
            + Novo
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 flex items-start justify-between gap-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold shrink-0">✕</button>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <form
            onSubmit={handleAddItem}
            className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm space-y-3"
          >
            <h2 className="text-sm font-semibold text-slate-700">Novo Item</h2>
            <input
              required
              placeholder="Nome do produto"
              value={newItem.nome}
              onChange={(e) => setNewItem({ ...newItem, nome: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Quantidade</label>
                <input
                  type="number"
                  min="0"
                  value={newItem.quantidade}
                  onChange={(e) => setNewItem({ ...newItem, quantidade: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Stock mínimo</label>
                <input
                  type="number"
                  min="0"
                  value={newItem.stock_minimo}
                  onChange={(e) => setNewItem({ ...newItem, stock_minimo: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Localização</label>
                <input
                  placeholder="Ex: Cozinha"
                  value={newItem.localizacao}
                  onChange={(e) => setNewItem({ ...newItem, localizacao: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Unidade</label>
                <select
                  value={newItem.unidade}
                  onChange={(e) => setNewItem({ ...newItem, unidade: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 bg-slate-100 text-slate-700 text-sm font-semibold py-2 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Tabs */}
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 mb-4 shadow-sm gap-1">
          <button
            onClick={() => setActiveTab("inventario")}
            className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
              activeTab === "inventario"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Inventário
          </button>
          <button
            onClick={() => setActiveTab("compras")}
            className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
              activeTab === "compras"
                ? "bg-red-500 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Lista de Compras {lowStock.length > 0 && `(${lowStock.length})`}
          </button>
        </div>

        {/* Location filter */}
        {activeTab === "inventario" && locations.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
            <button
              onClick={() => setLocationFilter("")}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                !locationFilter
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
              }`}
            >
              Todos
            </button>
            {locations.map((loc) => (
              <button
                key={loc}
                onClick={() => setLocationFilter(loc)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  locationFilter === loc
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        )}

        {/* Items list */}
        {displayItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">
              {activeTab === "compras" ? "✅" : "📦"}
            </p>
            <p className="text-sm">
              {activeTab === "compras"
                ? "Tudo bem em stock!"
                : "Sem itens. Adiciona o primeiro!"}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {displayItems.map((item) => {
              const isLow = item.quantidade <= item.stock_minimo;
              return (
                <li
                  key={item.id}
                  className={`bg-white rounded-xl border shadow-sm px-4 py-3 ${
                    isLow ? "border-red-200" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 text-sm truncate">
                          {item.nome}
                        </span>
                        {isLow && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                            Baixo
                          </span>
                        )}
                      </div>
                      {item.localizacao && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          📍 {item.localizacao}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        mín: {item.stock_minimo} {item.unidade}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleQuantityChange(item.id, -1)}
                        disabled={item.quantidade <= 0}
                        className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold text-lg flex items-center justify-center hover:bg-slate-200 disabled:opacity-40 transition-colors"
                      >
                        −
                      </button>
                      <span className={`w-12 text-center text-sm font-bold ${isLow ? "text-red-500" : "text-slate-800"}`}>
                        {item.quantidade} {item.unidade}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.id, 1)}
                        className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center hover:bg-blue-200 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Apagar
                    </button>
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
