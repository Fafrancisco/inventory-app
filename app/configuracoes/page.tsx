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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-5 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="text-blue-100 hover:text-white transition-colors text-lg leading-none"
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

      <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start justify-between gap-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold shrink-0">✕</button>
          </div>
        )}

        {/* Products section */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 text-sm">Produtos</h2>
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
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newProduct.unidade}
              onChange={(e) => setNewProduct({ ...newProduct, unidade: e.target.value })}
              className="border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              +
            </button>
          </form>

          {/* Product list */}
          {loadingProducts ? (
            <p className="text-slate-400 text-sm text-center py-6">A carregar...</p>
          ) : products.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Nenhum produto configurado.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm text-slate-800 font-medium">{p.nome}</span>
                    <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {p.unidade}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Locations section */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 text-sm">Localizações</h2>
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
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              +
            </button>
          </form>

          {/* Location list */}
          {loadingLocations ? (
            <p className="text-slate-400 text-sm text-center py-6">A carregar...</p>
          ) : locations.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Nenhuma localização configurada.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {locations.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-800 font-medium">📍 {l.nome}</span>
                  <button
                    onClick={() => handleDeleteLocation(l.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
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
