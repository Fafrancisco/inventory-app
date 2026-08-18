"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Database, PackagePlus, Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Product {
  id: number;
  nome: string;
  unidade: string;
  localizacao_padrao: string | null;
}

interface Location {
  id: number;
  nome: string;
}

type ConfigSection = "products" | "locations";

const UNIDADES = ["un", "kg", "g", "L", "ml", "cx", "pac"];

export default function ConfiguracoesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeSection, setActiveSection] = useState<ConfigSection>("products");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databaseBusy, setDatabaseBusy] = useState<"reset" | "seed" | null>(null);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [databaseMessage, setDatabaseMessage] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState({ nome: "", unidade: "un", localizacao_padrao: "" });
  const [newLocation, setNewLocation] = useState("");
  const [editProduct, setEditProduct] = useState({ nome: "", unidade: "un", localizacao_padrao: "" });
  const [editLocation, setEditLocation] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  const normalizedProductQuery = productQuery.trim().toLowerCase();
  const normalizedLocationQuery = locationQuery.trim().toLowerCase();

  const filteredProducts = products.filter((p) => {
    if (!normalizedProductQuery) return true;
    return (
      p.nome.toLowerCase().includes(normalizedProductQuery) ||
      p.unidade.toLowerCase().includes(normalizedProductQuery) ||
      (p.localizacao_padrao ?? "").toLowerCase().includes(normalizedProductQuery)
    );
  });

  const filteredLocations = locations.filter((l) => {
    if (!normalizedLocationQuery) return true;
    return l.nome.toLowerCase().includes(normalizedLocationQuery);
  });

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
      setNewProduct({ nome: "", unidade: "un", localizacao_padrao: "" });
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

  const startEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setEditProduct({
      nome: product.nome,
      unidade: product.unidade,
      localizacao_padrao: product.localizacao_padrao ?? "",
    });
  };

  const cancelEditProduct = () => {
    setEditingProductId(null);
    setEditProduct({ nome: "", unidade: "un", localizacao_padrao: "" });
  };

  const handleSaveProduct = async (id: number) => {
    try {
      const res = await fetch(`/api/config/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editProduct),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao atualizar produto");
      }

      const updated: Product = await res.json();
      setProducts((prev) =>
        prev
          .map((p) => (p.id === id ? updated : p))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
      cancelEditProduct();
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

  const startEditLocation = (location: Location) => {
    setEditingLocationId(location.id);
    setEditLocation(location.nome);
  };

  const cancelEditLocation = () => {
    setEditingLocationId(null);
    setEditLocation("");
  };

  const handleSaveLocation = async (id: number) => {
    try {
      const res = await fetch(`/api/config/locations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: editLocation }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao atualizar localização");
      }

      const updated: Location = await res.json();
      setLocations((prev) =>
        prev
          .map((l) => (l.id === id ? updated : l))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
      cancelEditLocation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  };

  const handleDatabaseAction = async (action: "reset" | "seed-inventory") => {
    if (action === "reset" && resetConfirmation !== "APAGAR") return;

    setDatabaseBusy(action === "reset" ? "reset" : "seed");
    setError(null);
    setDatabaseMessage(null);

    try {
      const res = await fetch("/api/config/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          confirmation: action === "reset" ? resetConfirmation : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível atualizar a base de dados.");

      setDatabaseMessage(
        action === "reset"
          ? "Base de dados limpa. O esquema foi preservado."
          : data.alreadySeeded
            ? "O inventário de demonstração já tinha sido preenchido."
            : `Foram adicionados ${data.inserted} itens de demonstração ao inventário.`
      );
      setResetConfirmation("");
      await Promise.all([fetchProducts(), fetchLocations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setDatabaseBusy(null);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#12212b] text-white shadow-[0_12px_40px_rgb(18_33_43/0.18)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pb-5 pt-6 sm:px-6">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f36b]"
            aria-label="Voltar ao inventário"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black tracking-[-0.04em]"><Settings className="h-5 w-5 text-[#c7f36b]" aria-hidden="true" /> Configurações</h1>
            <p className="mt-0.5 text-xs text-slate-300">Produtos e localizações</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start justify-between gap-2 shadow-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold shrink-0 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div className="md:hidden bg-white border border-slate-100 rounded-2xl p-1 mb-5 shadow-sm flex gap-1">
          <button
            type="button"
            onClick={() => setActiveSection("products")}
            className={`flex-1 text-sm font-semibold py-2.5 rounded-xl transition-all ${
              activeSection === "products"
                ? "bg-[#12212b] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            Produtos
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("locations")}
            className={`flex-1 text-sm font-semibold py-2.5 rounded-xl transition-all ${
              activeSection === "locations"
                ? "bg-[#12212b] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            Localizações
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">

        {/* Products section */}
        <section
          className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${
            activeSection === "products" ? "" : "hidden"
          } md:block md:col-span-7`}
        >
          <div className="px-4 py-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-800">Produtos</h2>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {products.length}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cada produto tem uma unidade padrão usada ao adicionar ao inventário.
            </p>
            <input
              placeholder="Pesquisar produto"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
          </div>

          {/* Add product form */}
          <form onSubmit={handleAddProduct} className="px-4 py-3 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              required
              placeholder="Nome do produto"
              value={newProduct.nome}
              onChange={(e) => setNewProduct({ ...newProduct, nome: e.target.value })}
              className="sm:col-span-5 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
            <select
              value={newProduct.unidade}
              onChange={(e) => setNewProduct({ ...newProduct, unidade: e.target.value })}
              className="sm:col-span-2 border border-slate-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <select
              value={newProduct.localizacao_padrao}
              onChange={(e) => setNewProduct({ ...newProduct, localizacao_padrao: e.target.value })}
              className="sm:col-span-4 border border-slate-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            >
              <option value="">Sem localização padrão</option>
              {locations.map((l) => (
                <option key={l.id} value={l.nome}>{l.nome}</option>
              ))}
            </select>
            <Button
              type="submit"
              className="sm:col-span-1 px-3 py-2.5"
              aria-label="Adicionar produto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>

          {/* Product list */}
          {loadingProducts ? (
            <div className="space-y-2 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Nenhum produto configurado.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filteredProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  {editingProductId === p.id ? (
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                      <input
                        value={editProduct.nome}
                        onChange={(e) => setEditProduct({ ...editProduct, nome: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={editProduct.unidade}
                          onChange={(e) => setEditProduct({ ...editProduct, unidade: e.target.value })}
                          className="border border-slate-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {UNIDADES.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                        <select
                          value={editProduct.localizacao_padrao}
                          onChange={(e) => setEditProduct({ ...editProduct, localizacao_padrao: e.target.value })}
                          className="border border-slate-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Sem padrão</option>
                          {locations.map((l) => (
                            <option key={l.id} value={l.nome}>{l.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveProduct(p.id)}
                          className="min-w-[92px] text-xs text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditProduct}
                          className="min-w-[92px] text-xs text-slate-500 hover:text-slate-700 border border-slate-200 bg-white px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-800 font-medium truncate">{p.nome}</span>
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                            {p.unidade}
                          </span>
                        </div>
                        {p.localizacao_padrao && (
                          <p className="text-xs text-slate-500 mt-1 truncate" title={p.localizacao_padrao}>
                            📍 {p.localizacao_padrao}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditProduct(p)}
                          className="text-xs text-slate-400 hover:text-blue-500 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="text-xs text-slate-300 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                        >
                          Apagar
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Locations section */}
        <section
          className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${
            activeSection === "locations" ? "" : "hidden"
          } md:block md:col-span-4 md:col-start-9`}
        >
          <div className="px-4 py-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-800">Localizações</h2>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {locations.length}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Locais onde os itens são armazenados (ex: Cozinha, Casa de banho).
            </p>
            <input
              placeholder="Pesquisar localização"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
          </div>

          {/* Add location form */}
          <form onSubmit={handleAddLocation} className="px-4 py-3 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              required
              placeholder="Nome da localização"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="sm:col-span-9 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
            <Button
              type="submit"
              className="sm:col-span-3 px-3 py-2.5"
              aria-label="Adicionar localização"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>

          {/* Location list */}
          {loadingLocations ? (
            <div className="space-y-2 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredLocations.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Nenhuma localização configurada.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filteredLocations.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  {editingLocationId === l.id ? (
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                      <input
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveLocation(l.id)}
                          className="min-w-[92px] text-xs text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditLocation}
                          className="min-w-[92px] text-xs text-slate-500 hover:text-slate-700 border border-slate-200 bg-white px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-slate-800 font-medium flex items-center gap-1.5">
                        <span className="text-slate-400">📍</span> {l.nome}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditLocation(l)}
                          className="text-xs text-slate-400 hover:text-blue-500 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(l.id)}
                          className="text-xs text-slate-300 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                        >
                          Apagar
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="border-b border-amber-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-amber-700" aria-hidden="true" />
              <h2 className="font-semibold text-amber-950">Ferramentas de desenvolvimento</h2>
            </div>
            <p className="mt-1 text-xs text-amber-800">Ações diretas sobre os dados locais da aplicação.</p>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="rounded-xl border border-amber-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <PackagePlus className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Preencher inventário</h3>
                  <p className="mt-1 text-xs text-slate-500">Adiciona os itens de demonstração uma única vez.</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => void handleDatabaseAction("seed-inventory")}
                disabled={databaseBusy !== null}
                className="mt-3 w-full bg-amber-700 text-white hover:bg-amber-800"
              >
                <PackagePlus className="h-4 w-4" aria-hidden="true" />
                {databaseBusy === "seed" ? "A preencher..." : "Preencher inventário"}
              </Button>
            </div>

            <div className="rounded-xl border border-red-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-red-900">Apagar todos os dados</h3>
                  <p className="mt-1 text-xs text-slate-500">Remove inventário, produtos, receitas e preferências. As localizações e o esquema ficam intactos.</p>
                </div>
              </div>
              <label className="mt-3 block text-xs font-semibold text-red-800" htmlFor="reset-confirmation">
                Escreve APAGAR para confirmar
              </label>
              <input
                id="reset-confirmation"
                value={resetConfirmation}
                onChange={(event) => setResetConfirmation(event.target.value.toUpperCase())}
                placeholder="APAGAR"
                className="mt-1 w-full rounded-xl border border-red-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <Button
                type="button"
                onClick={() => void handleDatabaseAction("reset")}
                disabled={databaseBusy !== null || resetConfirmation !== "APAGAR"}
                className="mt-3 w-full bg-red-700 text-white hover:bg-red-800 disabled:bg-red-300"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {databaseBusy === "reset" ? "A apagar..." : "Apagar todos os dados"}
              </Button>
            </div>
          </div>
          {databaseMessage && <p className="border-t border-amber-200 px-4 py-3 text-sm font-medium text-emerald-700">{databaseMessage}</p>}
        </section>
      </div>
    </div>
  );
}
