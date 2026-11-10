"use client";

import { faCheck, faChevronDown, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useId, useRef, useState } from "react";

export function TokenSelect({ tokens, value, disabled = false, required = false, formId, emptyLabel = "Select token", className = "w-36", onChange }: {
  tokens: string[];
  value: string;
  disabled?: boolean;
  required?: boolean;
  formId?: string;
  emptyLabel?: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const popupId = `${listId}-popup`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const options = tokens.filter((token) => token.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (open && !disabled) searchRef.current?.focus();
  }, [open, disabled]);

  useEffect(() => {
    const list = listRef.current;
    const option = list?.children[activeIndex] as HTMLElement | undefined;
    if (!list || !option || !open) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [activeIndex, open]);

  function choose(token: string) {
    onChange(token);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }

  return (
    <div className={`relative min-w-0 ${className}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setOpen(false);
        setQuery("");
        setActiveIndex(-1);
      }
    }}>
      <select aria-label="Serving token" aria-hidden="true" tabIndex={-1} required={required} disabled={disabled} form={formId} name="tableNumber" value={value} onChange={(event) => choose(event.target.value)} onInvalid={(event) => { event.preventDefault(); setOpen(true); }} className="sr-only">
        <option value="">{emptyLabel}</option>
        {tokens.map((token) => <option key={token} value={token}>{token}</option>)}
      </select>
      <button ref={triggerRef} type="button" disabled={disabled} aria-label={`Serving token: ${value || emptyLabel}`} aria-haspopup="dialog" aria-expanded={open && !disabled} aria-controls={popupId}
        onClick={() => { setQuery(""); setActiveIndex(-1); setOpen((current) => !current); }}
        onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex(-1); } }}
        className="relative flex h-10 w-full items-center rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-left text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange disabled:opacity-60">
        <span className="truncate">{value || emptyLabel}</span>
        <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" className={`pointer-events-none absolute right-3 h-3 w-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled && (
        <div id={popupId} role="dialog" aria-label="Choose serving token" className="absolute left-0 top-full z-30 mt-1 w-full min-w-44 rounded-lg border border-gray-200 bg-white shadow-lg"
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); } }}>
          <div className="relative border-b border-gray-100 p-2">
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            <input ref={searchRef} type="search" role="combobox" aria-label="Search tokens" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
              value={query} autoComplete="off" placeholder="Search tokens..." onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (options.length) setActiveIndex((current) => event.key === "ArrowDown" ? Math.min(current + 1, options.length - 1) : current < 0 ? options.length - 1 : Math.max(current - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const token = options[activeIndex] ?? (options.length === 1 ? options[0] : undefined);
                  if (token) choose(token);
                }
              }}
              className="h-9 w-full rounded-md border border-gray-300 py-2 pl-7 pr-2 text-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange" />
          </div>
          {!required && <button type="button" onClick={() => choose("")} className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-brand-peach/40">{emptyLabel}</button>}
          <div ref={listRef} id={listId} role="listbox" aria-label="Serving tokens" className="relative max-h-[min(12rem,40vh)] overflow-y-auto overscroll-contain py-1">
            {options.length ? options.map((token, index) => (
              <div key={token} id={`${listId}-${index}`} role="option" aria-selected={token === value}
                onMouseDown={(event) => event.preventDefault()} onClick={() => choose(token)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-brand-peach/40 ${activeIndex === index ? "bg-brand-peach/40" : ""}`}>
                {token}{value === token && <FontAwesomeIcon icon={faCheck} aria-hidden="true" className="text-xs text-brand-orange" />}
              </div>
            )) : <div className="px-3 py-2 text-sm text-gray-500">No matching tokens.</div>}
            </div>
        </div>
      )}
    </div>
  );
}