import type { StockItem } from "@/components/inventory/types";

const CACHE_KEY = "inventory-app:stock-snapshot";
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

interface StockSnapshot {
  savedAt: number;
  items: StockItem[];
}

export function readStockSnapshot(): StockItem[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const snapshot = JSON.parse(raw) as StockSnapshot;
    if (!Array.isArray(snapshot.items) || Date.now() - snapshot.savedAt > CACHE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return snapshot.items;
  } catch {
    return null;
  }
}

export function writeStockSnapshot(items: StockItem[]): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), items } satisfies StockSnapshot)
    );
  } catch {
    // Storage is an optional performance enhancement.
  }
}