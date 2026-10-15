"use client";

import { useCallback, useEffect, useState } from "react";
import { TrashIcon } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { storeConfigRequest } from "../apicall/storeConfig";

export function StorePositionsSection({ activeStoreId }: Readonly<{ activeStoreId: string | null }>) {
  const { error, success } = useToast();
  const [positions, setPositions] = useState<string[]>([]);
  const [positionName, setPositionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPositions = useCallback(async () => {
    if (!activeStoreId) {
      setPositions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await storeConfigRequest(`/api/stores/positions?franchiseId=${encodeURIComponent(activeStoreId)}`);
      const result = await response.json() as { positions?: string[]; message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to load position options.");
      setPositions(result.positions ?? []);
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load position options.");
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, error]);

  useEffect(() => {
    queueMicrotask(() => void loadPositions());
  }, [loadPositions]);

  function addPosition(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = positionName.trim();
    if (!name || name.length > 60) {
      error("Position names must be 1 to 60 characters.");
      return;
    }
    if (positions.some((position) => position.toLowerCase() === name.toLowerCase())) {
      error("That position is already configured for this store.");
      return;
    }
    if (positions.length >= 30) {
      error("A store can have up to 30 position options.");
      return;
    }
    setPositions((current) => [...current, name]);
    setPositionName("");
  }

  async function savePositions() {
    if (!activeStoreId) return;
    setSaving(true);
    try {
      const response = await storeConfigRequest("/api/stores/positions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId: activeStoreId, positions }),
      });
      const result = await response.json() as { positions?: string[]; message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to save position options.");
      setPositions(result.positions ?? positions);
      success(result.message ?? "Position options saved.");
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to save position options.");
      await loadPositions();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="border-b border-gray-100 pb-4">
        <h3 className="font-semibold text-gray-900">Employee Position Options</h3>
        <p className="mt-1 text-sm text-gray-500">Manage the positions available when adding employees to this store.</p>
      </div>
      {loading ? (
        <p className="mt-5 text-sm text-gray-500">Loading positions…</p>
      ) : (
        <>
          <div className="mt-4 divide-y divide-gray-100">
            {positions.length === 0 ? (
              <p className="py-3 text-sm text-gray-500">No position options configured.</p>
            ) : positions.map((position) => (
              <div key={position} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-gray-800">{position}</span>
                <button type="button" onClick={() => setPositions((current) => current.filter((item) => item !== position))} aria-label={`Remove ${position}`} title={`Remove ${position}`} className="flex h-9 w-9 items-center justify-center rounded-md text-orange-600 hover:bg-orange-50">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={addPosition} className="mt-4 flex flex-wrap gap-2">
            <input value={positionName} onChange={(event) => setPositionName(event.target.value)} maxLength={60} placeholder="Add a position" aria-label="New position" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange" />
            <button type="submit" className="rounded-lg border border-brand-orange px-4 py-2 text-sm font-medium text-brand-orange hover:bg-brand-peach/40">Add</button>
          </form>
          <button type="button" onClick={() => void savePositions()} disabled={saving} className="mt-4 rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:opacity-60">
            {saving ? "Saving…" : "Save Positions"}
          </button>
        </>
      )}
    </section>
  );
}