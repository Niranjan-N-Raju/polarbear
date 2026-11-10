"use client";

import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/app/hooks/useToast";
import { storeConfigRequest } from "../apicall/storeConfig";

export function StoreTablesSection({ activeStoreId }: { activeStoreId: string }) {
  const { success } = useToast();
  const [tables, setTables] = useState<string[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const endpoint = `/api/billing-tables?${new URLSearchParams({ storeId: activeStoreId })}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    storeConfigRequest(endpoint)
      .then(async (response) => {
        const result = await response.json() as { tables?: string[]; message?: string };
        if (!response.ok) throw new Error(result.message ?? "Unable to load tables.");
        if (active) setTables(result.tables ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setLoadError(reason instanceof Error ? reason.message : "Unable to load tables.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, reloadKey]);

  async function addTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = tableNumber.trim().toUpperCase();
    if (!/^T[1-9]\d{0,3}$/.test(number)) {
      setFormError("Enter a table number from T1 to T9999.");
      return;
    }
    if (tables.includes(number)) {
      setFormError("That table already exists.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await storeConfigRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: number }),
      });
      const result = await response.json() as { tableNumber?: string; message?: string };
      if (!response.ok || !result.tableNumber) throw new Error(result.message ?? "Unable to add table.");
      const added = result.tableNumber;
      setTables((current) => [...new Set([...current, added])].sort((left, right) => Number(left.slice(1)) - Number(right.slice(1))));
      setTableNumber("");
      success("Table added.");
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Unable to add table.");
    } finally { setSaving(false); }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6" aria-labelledby="table-config-title">
      <div className="border-b border-gray-100 pb-4">
        <h3 id="table-config-title" className="font-semibold text-gray-900">Table Configuration</h3>
      </div>
      {loading ? <p role="status" className="mt-5 text-sm text-gray-500">Loading tables...</p> : loadError ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-red-700" role="alert">
          <span>{loadError}</span>
          <button type="button" className="underline" onClick={() => setReloadKey((current) => current + 1)}>Retry</button>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10" aria-label="Configured tables">
            {tables.map((table) => <li key={table} className="flex min-h-11 items-center justify-center rounded-md border border-gray-200 px-2 py-2 text-sm font-medium text-gray-800">{table}</li>)}
          </ul>
          <form onSubmit={(event) => void addTable(event)} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="w-44">
              <span className="mb-1 block text-sm font-medium text-gray-700">Table number</span>
              <input required pattern="[Tt][1-9][0-9]{0,3}" maxLength={5} placeholder="T11" value={tableNumber} disabled={saving} onChange={(event) => { setTableNumber(event.target.value); setFormError(""); }} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange" />
            </label>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-orange px-4 py-2 text-sm font-medium text-brand-orange hover:bg-brand-peach/40 disabled:opacity-60">
              <FontAwesomeIcon icon={faPlus} aria-hidden="true" />{saving ? "Adding..." : "Add table"}
            </button>
            {formError && <p role="alert" className="w-full text-sm text-red-700">{formError}</p>}
          </form>
        </>
      )}
    </section>
  );
}