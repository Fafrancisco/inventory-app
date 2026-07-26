"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Recipe = {
  id: number;
  title: string;
  summary: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: Array<{
    nome: string;
    quantidade: string;
    unidade: string;
    available: boolean;
    notes: string;
  }>;
  instructions: string[];
  missingIngredients: Array<{
    nome: string;
    quantidade: string;
    unidade: string;
    notes: string;
  }>;
  generationMode: string;
  isFavorite?: boolean;
  createdAt: string;
};

type Preferences = {
  cuisine: string;
  diet: string;
  allergens: string;
  max_time_minutes: number | null;
  notes: string;
  auto_suggest_enabled: boolean;
  auto_suggest_cooldown_minutes: number;
};

const DEFAULT_PREFERENCES: Preferences = {
  cuisine: "",
  diet: "",
  allergens: "",
  max_time_minutes: null,
  notes: "",
  auto_suggest_enabled: true,
  auto_suggest_cooldown_minutes: 180,
};

export default function ReceitasPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingMissingForRecipeId, setAddingMissingForRecipeId] = useState<number | null>(null);
  const [updatingRecipeId, setUpdatingRecipeId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const normalizeComparable = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase()
      .trim();

  const normalizeUnit = (unit: string) => {
    const normalized = unit.trim();
    if (!normalized) return "un";
    const allowed = new Set(["un", "kg", "L", "g", "ml", "cx", "pac"]);
    return allowed.has(normalized) ? normalized : "un";
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/recipes");
      if (!res.ok) throw new Error("Erro ao carregar receitas");
      const data = await res.json();
      setRecipes(Array.isArray(data.recipes) ? data.recipes : []);
      setPreferences(data.preferences ?? DEFAULT_PREFERENCES);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const savePreferences = async () => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/recipes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuisine: preferences.cuisine,
          diet: preferences.diet,
          allergens: preferences.allergens,
          maxTimeMinutes: preferences.max_time_minutes,
          notes: preferences.notes,
          autoSuggestEnabled: preferences.auto_suggest_enabled,
          autoSuggestCooldownMinutes: preferences.auto_suggest_cooldown_minutes,
        }),
      });
      if (!res.ok) throw new Error("Erro ao guardar preferências");
      const saved = await res.json();
      setPreferences(saved);
      setInfo("Preferências atualizadas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  };

  const generateRecipe = async () => {
    setGenerating(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "manual" }),
      });
      const data = await res.json();

      if (res.status === 202 && data?.skipped) {
        setInfo("Sugestão automática ignorada pelas regras de cooldown/duplicação.");
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao gerar receita");
      }

      setRecipes((prev) => [data.recipe, ...prev]);
      const missingCount = Array.isArray(data?.recipe?.missingIngredients)
        ? data.recipe.missingIngredients.length
        : 0;
      setInfo(
        missingCount > 0
          ? `Nova receita gerada. Faltam ${missingCount} ingrediente(s); podes adicioná-los à lista de compras.`
          : "Nova receita gerada com sucesso."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setGenerating(false);
    }
  };

  const addMissingToShopping = async (recipe: Recipe) => {
    const missing = Array.isArray(recipe.missingIngredients)
      ? recipe.missingIngredients
      : [];
    if (missing.length === 0) {
      setInfo("Esta receita não tem ingredientes em falta.");
      return;
    }

    setAddingMissingForRecipeId(recipe.id);
    setError(null);
    setInfo(null);

    try {
      const [stockRes, productsRes] = await Promise.all([
        fetch("/api/stock"),
        fetch("/api/config/products"),
      ]);

      if (!stockRes.ok) {
        throw new Error("Não foi possível ler o inventário atual");
      }

      const stockItems = (await stockRes.json()) as Array<{ nome: string }>;
      const existingStockNames = new Set(
        stockItems.map((item) => normalizeComparable(item.nome)).filter(Boolean)
      );

      const existingProductNames = new Set<string>();
      if (productsRes.ok) {
        const products = (await productsRes.json()) as Array<{ nome: string }>;
        for (const product of products) {
          const key = normalizeComparable(product.nome);
          if (key) existingProductNames.add(key);
        }
      }

      const uniqueMissing = new Map<string, { nome: string; unidade: string }>();
      for (const ingredient of missing) {
        const key = normalizeComparable(ingredient.nome);
        if (!key || uniqueMissing.has(key)) continue;
        uniqueMissing.set(key, {
          nome: ingredient.nome.trim(),
          unidade: normalizeUnit(ingredient.unidade),
        });
      }

      let created = 0;
      let alreadyPresent = 0;

      for (const [key, ingredient] of uniqueMissing.entries()) {
        if (existingStockNames.has(key)) {
          alreadyPresent += 1;
          continue;
        }

        const createRes = await fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: ingredient.nome,
            quantidade: 0,
            stock_minimo: 1,
            unidade: ingredient.unidade,
            localizacao: "",
          }),
        });

        if (!createRes.ok) {
          continue;
        }

        created += 1;
        existingStockNames.add(key);

        if (!existingProductNames.has(key)) {
          await fetch("/api/config/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nome: ingredient.nome,
              unidade: ingredient.unidade,
            }),
          }).catch(() => {
            // Best effort only.
          });
        }
      }

      if (created > 0) {
        setInfo(`Adicionados ${created} ingrediente(s) em falta à lista de compras.`);
      } else if (alreadyPresent > 0) {
        setInfo("Os ingredientes em falta já estavam no inventário/lista de compras.");
      } else {
        setInfo("Não foi possível adicionar ingredientes em falta automaticamente.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setAddingMissingForRecipeId(null);
    }
  };

  const toggleFavoriteRecipe = async (recipe: Recipe) => {
    setUpdatingRecipeId(recipe.id);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !recipe.isFavorite }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao atualizar favorito");
      }

      setRecipes((prev) =>
        prev.map((r) => (r.id === recipe.id ? { ...r, isFavorite: Boolean(data.isFavorite) } : r))
      );
      setInfo(data.isFavorite ? "Receita guardada como favorita." : "Receita removida dos favoritos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUpdatingRecipeId(null);
    }
  };

  const deleteRecipe = async (recipe: Recipe) => {
    if (!confirm(`Apagar a receita \"${recipe.title}\"?`)) {
      return;
    }

    setUpdatingRecipeId(recipe.id);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao apagar receita");
      }

      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
      setInfo("Receita apagada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUpdatingRecipeId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/40">
      <header className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-4 flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors text-lg"
            aria-label="Voltar ao inventário"
          >
            ←
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">🍳 Chef AI</h1>
            <p className="text-amber-100 text-xs mt-0.5">
              Sugestões com base no inventário e no teu histórico.
            </p>
          </div>
          <button
            onClick={() => void generateRecipe()}
            disabled={generating || loading}
            className="ml-auto bg-white text-orange-600 text-sm font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-orange-50 disabled:opacity-50"
          >
            {generating ? "A gerar..." : "Gerar"}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start justify-between gap-2 shadow-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold shrink-0 text-red-400 hover:text-red-600">
              ✕
            </button>
          </div>
        )}

        {info && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 flex items-start justify-between gap-2 shadow-sm">
            <span>{info}</span>
            <button onClick={() => setInfo(null)} className="font-bold shrink-0 text-emerald-500 hover:text-emerald-700">
              ✕
            </button>
          </div>
        )}

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Preferências</h2>
            <p className="text-xs text-slate-400 mt-0.5">Isto é enviado ao Gemini para personalizar as receitas.</p>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Cozinha</label>
              <input
                value={preferences.cuisine}
                onChange={(e) => setPreferences((prev) => ({ ...prev, cuisine: e.target.value }))}
                placeholder="Ex: mediterrânica"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Dieta</label>
              <input
                value={preferences.diet}
                onChange={(e) => setPreferences((prev) => ({ ...prev, diet: e.target.value }))}
                placeholder="Ex: vegetariana"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Alergias / intolerâncias</label>
              <input
                value={preferences.allergens}
                onChange={(e) => setPreferences((prev) => ({ ...prev, allergens: e.target.value }))}
                placeholder="Ex: lactose, amendoim"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Tempo máximo (min)</label>
              <input
                type="number"
                min="0"
                value={preferences.max_time_minutes ?? ""}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    max_time_minutes: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                  }))
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1">Notas livres</label>
              <textarea
                value={preferences.notes}
                onChange={(e) => setPreferences((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Ex: evitar fritos, preferir refeições simples para jantar"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 min-h-20"
              />
            </div>

            <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={preferences.auto_suggest_enabled}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    auto_suggest_enabled: e.target.checked,
                  }))
                }
              />
              Ativar sugestões automáticas quando o inventário muda
            </label>

          </div>

          <div className="px-4 pb-4">
            <button
              onClick={() => void savePreferences()}
              disabled={saving || loading}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "A guardar..." : "Guardar preferências"}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">Histórico de receitas</h2>
              <p className="text-xs text-slate-400 mt-0.5">As receitas guardadas também são usadas como contexto.</p>
            </div>
            <button
              onClick={() => void fetchData()}
              className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5"
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">Ainda não há receitas guardadas.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recipes.map((recipe) => (
                <li key={recipe.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{recipe.title}</h3>
                      {recipe.summary && <p className="text-xs text-slate-500 mt-0.5">{recipe.summary}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          recipe.generationMode === "auto"
                            ? "bg-blue-50 text-blue-600 border-blue-100"
                            : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}
                      >
                        {recipe.generationMode === "auto" ? "auto" : "manual"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void toggleFavoriteRecipe(recipe)}
                        disabled={updatingRecipeId === recipe.id}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                          recipe.isFavorite
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : "bg-white text-slate-500 border-slate-200 hover:border-yellow-200 hover:text-yellow-700"
                        }`}
                      >
                        {recipe.isFavorite ? "★ Favorita" : "☆ Favorita"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRecipe(recipe)}
                        disabled={updatingRecipeId === recipe.id}
                        className="text-[11px] px-2 py-0.5 rounded-full border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                      >
                        Apagar
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {recipe.servings ? <span className="bg-slate-100 px-2 py-0.5 rounded-full">{recipe.servings} porções</span> : null}
                    {recipe.prepMinutes ? <span className="bg-slate-100 px-2 py-0.5 rounded-full">prep {recipe.prepMinutes} min</span> : null}
                    {recipe.cookMinutes ? <span className="bg-slate-100 px-2 py-0.5 rounded-full">cozedura {recipe.cookMinutes} min</span> : null}
                    <span className="bg-slate-100 px-2 py-0.5 rounded-full">{new Date(recipe.createdAt).toLocaleString("pt-PT")}</span>
                  </div>

                  {recipe.ingredients.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">Ingredientes</p>
                      <ul className="text-xs text-slate-600 space-y-0.5">
                        {recipe.ingredients.map((ingredient, index) => (
                          <li key={`${recipe.id}-${index}`}>
                            • {ingredient.nome}
                            {ingredient.quantidade ? ` - ${ingredient.quantidade}` : ""}
                            {ingredient.unidade ? ` ${ingredient.unidade}` : ""}
                            {!ingredient.available ? " (pode faltar)" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {recipe.missingIngredients.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">Faltam ingredientes</p>
                      <ul className="text-xs text-amber-800 space-y-0.5 mb-2">
                        {recipe.missingIngredients.map((ingredient, index) => (
                          <li key={`${recipe.id}-missing-${index}`}>
                            • {ingredient.nome}
                            {ingredient.quantidade ? ` - ${ingredient.quantidade}` : ""}
                            {ingredient.unidade ? ` ${ingredient.unidade}` : ""}
                            {ingredient.notes ? ` (${ingredient.notes})` : ""}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => void addMissingToShopping(recipe)}
                        disabled={addingMissingForRecipeId === recipe.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {addingMissingForRecipeId === recipe.id
                          ? "A adicionar..."
                          : "Adicionar faltas à lista de compras"}
                      </button>
                    </div>
                  )}

                  {recipe.instructions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">Passos</p>
                      <ol className="text-xs text-slate-600 space-y-0.5 list-decimal pl-4">
                        {recipe.instructions.map((step, index) => (
                          <li key={`${recipe.id}-step-${index}`}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
