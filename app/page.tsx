"use client";

import { useCallback, useEffect, useState } from "react";
import type { StockItem, CreateStockItemPayload } from "@/lib/types";

const LOCATIONS = [
  "Todos",
  "Despensa",
  "Frigorífico",
  "Congelador",
  "Congelador Arrecadação",
  "Armário",
] as const;

const UNITS = ["un", "kg", "gramas", "doses"] as const;

const emptyForm: CreateStockItemPayload = {
  nome: "",
  quantidade: 0,
  unidade: "un",
  localizacao: "Despensa",
  categoria: "",
  stock_minimo: 0,
};

export default function Home() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [shoppingList, setShoppingList] = useState<StockItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("Todos");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateStockItemPayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch all items (optionally filtered by location) ──────────────────────
  const fetchItems = useCallback(async (filter: string) => {
    setLoading(true);
    setError(null);
    try {
      const url =
        filter === "Todos"
          ? "/api/stock"
          : `/api/stock?localizacao=${encodeURIComponent(filter)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar itens.");
      setItems(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch shopping list ────────────────────────────────────────────────────
  const fetchShoppingList = useCallback(async () => {
    try {
      const res = await fetch("/api/stock?shoppingList=true");
      if (!res.ok) throw new Error();
      setShoppingList(await res.json());
    } catch {
      // Non-critical; fail silently
    }
  }, []);

  useEffect(() => {
    fetchItems(activeFilter);
    fetchShoppingList();
  }, [activeFilter, fetchItems, fetchShoppingList]);

  // ── Quick quantity adjust (+/-) ────────────────────────────────────────────
  const adjust = async (id: string, delta: number) => {
    try {
      const res = await fetch("/api/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, delta }),
      });
      if (!res.ok) throw new Error();
      const updated: StockItem = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      // Refresh shopping list since quantities changed
      fetchShoppingList();
    } catch {
      setError("Erro ao atualizar quantidade.");
    }
  };

  // ── Delete item ────────────────────────────────────────────────────────────
  const deleteItem = async (id: string) => {
    if (!confirm("Eliminar este item?")) return;
    try {
      const res = await fetch(`/api/stock?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((item) => item.id !== id));
      fetchShoppingList();
    } catch {
      setError("Erro ao eliminar item.");
    }
  };

  // ── Add item (POST) ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao criar item.");
      }
      setForm(emptyForm);
      setShowForm(false);
      fetchItems(activeFilter);
      fetchShoppingList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-5 shadow-md sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Stock Doméstico</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-white text-blue-600 font-semibold text-sm px-3 py-1.5 rounded-full shadow hover:bg-blue-50 transition"
          >
            {showForm ? "Fechar" : "+ Novo item"}
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 mt-4 space-y-5">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Add item form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow p-4 space-y-3 border border-slate-100"
          >
            <h2 className="font-semibold text-slate-800">Adicionar item</h2>

            <input
              required
              type="text"
              placeholder="Nome *"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                step="any"
                placeholder="Quantidade"
                value={form.quantidade}
                onChange={(e) =>
                  setForm({ ...form, quantidade: Number(e.target.value) })
                }
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <select
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.localizacao}
                onChange={(e) =>
                  setForm({ ...form, localizacao: e.target.value })
                }
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {LOCATIONS.filter((l) => l !== "Todos").map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Categoria"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <input
              type="number"
              min={0}
              step="any"
              placeholder="Stock mínimo"
              value={form.stock_minimo}
              onChange={(e) =>
                setForm({ ...form, stock_minimo: Number(e.target.value) })
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm transition disabled:opacity-60"
            >
              {submitting ? "A guardar…" : "Guardar"}
            </button>
          </form>
        )}

        {/* Location filter buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setActiveFilter(loc)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition flex-shrink-0 ${
                activeFilter === loc
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
              }`}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Items list */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Inventário
            {activeFilter !== "Todos" && (
              <span className="ml-1 text-blue-600">— {activeFilter}</span>
            )}
          </h2>

          {loading ? (
            <p className="text-slate-400 text-sm text-center py-8">
              A carregar…
            </p>
          ) : items.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">
              Nenhum item encontrado.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onAdjust={adjust}
                  onDelete={deleteItem}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Shopping list */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            🛒 Lista de Compras
          </h2>
          {shoppingList.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4 bg-white rounded-xl border border-slate-100">
              Nenhum item em falta.
            </p>
          ) : (
            <ul className="space-y-2">
              {shoppingList.map((item) => (
                <li
                  key={item.id}
                  className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-800 text-sm">
                      {item.nome}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.localizacao}
                      {item.categoria ? ` · ${item.categoria}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <span className="font-semibold text-amber-700">
                      {item.quantidade} {item.unidade}
                    </span>
                    <p className="text-xs text-slate-400">
                      mín. {item.stock_minimo}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

// ── Item row component ──────────────────────────────────────────────────────
function ItemRow({
  item,
  onAdjust,
  onDelete,
}: {
  item: StockItem;
  onAdjust: (id: string, delta: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const low = item.quantidade <= item.stock_minimo;

  return (
    <li
      className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 shadow-sm ${
        low ? "border-amber-300" : "border-slate-100"
      }`}
    >
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 text-sm truncate">
          {item.nome}
        </p>
        <p className="text-xs text-slate-400 truncate">
          {item.localizacao}
          {item.categoria ? ` · ${item.categoria}` : ""}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          mín.{" "}
          <span className="font-medium">
            {item.stock_minimo} {item.unidade}
          </span>
        </p>
      </div>

      {/* Quantity + controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onAdjust(item.id, -1)}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center transition"
          aria-label="Diminuir"
        >
          −
        </button>
        <span
          className={`w-14 text-center font-semibold text-sm ${
            low ? "text-amber-600" : "text-slate-800"
          }`}
        >
          {item.quantidade}
          <br />
          <span className="font-normal text-xs text-slate-400">
            {item.unidade}
          </span>
        </span>
        <button
          onClick={() => onAdjust(item.id, 1)}
          className="w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-lg flex items-center justify-center transition"
          aria-label="Aumentar"
        >
          +
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 font-bold text-base flex items-center justify-center transition ml-1"
          aria-label="Eliminar"
        >
          ×
        </button>
      </div>
    </li>
  );
}
