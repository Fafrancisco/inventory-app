"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Product {
  id: number;
  nome: string;
  unidade: string;
}

interface Location {
  id: number;
  nome: string;
}

const UNIDADES = ["un", "kg", "g", "L", "ml", "cx", "pac"];

export default function ConfiguracoesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState({ nome: "", unidade: "un" });
  const [newLocation, setNewLocation] = useState("");

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/config/products");
      if (!res.ok) throw new Error("Erro ao carregar produtos");
      setProducts(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/config/locations");
      if (!res.ok) throw new Error("Erro ao carregar localizações");
      setLocations(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchLocations();
  }, [fetchProducts, fetchLocations]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/config/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao adicionar produto");
      }
      const created: Product = await res.json();
      setProducts((prev) =>
        [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setNewProduct({ nome: "", unidade: "un" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Apagar este produto?")) return;
    try {
      const res = await fetch(`/api/config/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao apagar produto");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/config/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: newLocation }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao adicionar localização");
      }
      const created: Location = await res.json();
      setLocations((prev) =>
        [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setNewLocation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!confirm("Apagar esta localização?")) return;
    try {
      const res = await fetch(`/api/config/locations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao apagar localização");
      setLocations((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-4 flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors text-lg"
            aria-label="Voltar ao inventário"
          >
            ←
          </Link>
          <div>
            <h1 className="text-xl font-bold">⚙️ Configurações</h1>
            <p className="text-blue-100 text-xs mt-0.5">Produtos e localizações</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start justify-between gap-2 shadow-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold shrink-0 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Products section */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Produtos</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cada produto tem uma unidade padrão usada ao adicionar ao inventário.
            </p>
          </div>

          {/* Add product form */}
          <form onSubmit={handleAddProduct} className="px-4 py-3 border-b border-slate-100 flex gap-2">
            <input
              required
              placeholder="Nome do produto"
              value={newProduct.nome}
              onChange={(e) => setNewProduct({ ...newProduct, nome: e.target.value })}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
            <select
              value={newProduct.unidade}
              onChange={(e) => setNewProduct({ ...newProduct, unidade: e.target.value })}
              className="border border-slate-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
            >
              +
            </button>
          </form>

          {/* Product list */}
          {loadingProducts ? (
            <div className="space-y-2 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Nenhum produto configurado.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-800 font-medium">{p.nome}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {p.unidade}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="text-xs text-slate-300 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                  >
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Locations section */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Localizações</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Locais onde os itens são armazenados (ex: Cozinha, Casa de banho).
            </p>
          </div>

          {/* Add location form */}
          <form onSubmit={handleAddLocation} className="px-4 py-3 border-b border-slate-100 flex gap-2">
            <input
              required
              placeholder="Nome da localização"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
            >
              +
            </button>
          </form>

          {/* Location list */}
          {loadingLocations ? (
            <div className="space-y-2 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : locations.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Nenhuma localização configurada.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {locations.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  <span className="text-sm text-slate-800 font-medium flex items-center gap-1.5">
                    <span className="text-slate-400">📍</span> {l.nome}
                  </span>
                  <button
                    onClick={() => handleDeleteLocation(l.id)}
                    className="text-xs text-slate-300 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                  >
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
