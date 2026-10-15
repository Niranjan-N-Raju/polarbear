"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import { storeConfigRequest } from "../apicall/storeConfig";

export function StoreBrandingSection({ activeStoreId }: Readonly<{ activeStoreId: string | null }>) {
  const { error, success } = useToast();
  const [name, setName] = useState("");
  const [hasLogo, setHasLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [logoCacheBust, setLogoCacheBust] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadBranding = useCallback(async () => {
    if (!activeStoreId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await storeConfigRequest(`/api/stores/branding?franchiseId=${encodeURIComponent(activeStoreId)}`);
      const result = (await response.json()) as { store?: { name: string; hasLogo: boolean }; message?: string };
      if (!response.ok || !result.store) throw new Error(result.message ?? "Failed to load store branding.");
      setName(result.store.name);
      setHasLogo(result.store.hasLogo);
    } catch (loadError) {
      error(loadError instanceof Error ? loadError.message : "Failed to load store branding.");
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, error]);

  useEffect(() => {
    queueMicrotask(() => void loadBranding());
  }, [loadBranding]);

  async function saveName() {
    if (!activeStoreId || !name.trim()) return;
    setSavingName(true);
    try {
      const response = await storeConfigRequest("/api/stores/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId: activeStoreId, name: name.trim() }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to update store name.");
      success(result.message ?? "Store name updated.");
    } catch (saveError) {
      error(saveError instanceof Error ? saveError.message : "Failed to update store name.");
    } finally {
      setSavingName(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!activeStoreId) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("franchiseId", activeStoreId);
      formData.append("file", file);
      const response = await storeConfigRequest("/api/stores/logo", { method: "POST", body: formData });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to upload logo.");
      setHasLogo(true);
      setLogoCacheBust((value) => value + 1);
      success(result.message ?? "Logo uploaded successfully.");
    } catch (uploadError) {
      error(uploadError instanceof Error ? uploadError.message : "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    if (!activeStoreId) return;
    setRemovingLogo(true);
    try {
      const response = await storeConfigRequest(`/api/stores/logo?franchiseId=${encodeURIComponent(activeStoreId)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Failed to remove logo.");
      setHasLogo(false);
      success(result.message ?? "Logo removed.");
    } catch (removeError) {
      error(removeError instanceof Error ? removeError.message : "Failed to remove logo.");
    } finally {
      setRemovingLogo(false);
    }
  }

  if (!activeStoreId || loading) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="border-b border-gray-100 pb-4">
        <h3 className="font-semibold text-gray-900">Branding</h3>
        <p className="mt-1 text-sm text-gray-500">
          This store&apos;s name and logo, shown on documents like the salary slip.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-6">
        <label className="w-64">
          <span className="mb-1 block text-sm font-medium text-gray-700">Store name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
          />
        </label>
        <button
          type="button"
          onClick={() => void saveName()}
          disabled={savingName || !name.trim()}
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-medium text-white hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingName ? "Saving…" : "Save name"}
        </button>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-brand-sand/30">
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/stores/logo?franchiseId=${activeStoreId}&v=${logoCacheBust}`}
              alt="Store logo"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-xs text-gray-400">No logo</span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadLogo(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingLogo}
          className="rounded-lg border border-brand-orange px-4 py-2 text-sm font-medium text-brand-orange hover:bg-brand-peach/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploadingLogo ? "Uploading…" : hasLogo ? "Replace logo" : "Upload logo"}
        </button>
        {hasLogo && (
          <button
            type="button"
            onClick={() => void removeLogo()}
            disabled={removingLogo}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {removingLogo ? "Removing…" : "Remove"}
          </button>
        )}
        <p className="w-full text-xs text-gray-500">PNG, JPEG, or WEBP — up to 2 MB.</p>
      </div>
    </section>
  );
}
