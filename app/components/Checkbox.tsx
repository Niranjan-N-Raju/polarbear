"use client";

import type { InputHTMLAttributes } from "react";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked"> & {
  checked: boolean;
  type?: "checkbox" | "radio";
};

export function Checkbox({ checked, type = "checkbox", className = "", ...props }: Readonly<Props>) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 align-middle">
      <input
        {...props}
        type={type}
        checked={checked}
        className={`peer m-0 h-4 w-4 cursor-pointer appearance-none border border-brand-beige bg-white checked:border-brand-orange checked:bg-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${type === "radio" ? "rounded-full" : "rounded"} ${className}`}
      />
      {checked ? type === "radio" ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-[5px] rounded-full bg-white peer-disabled:opacity-50" />
      ) : (
        <FontAwesomeIcon aria-hidden="true" icon={faCheck} className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white peer-disabled:opacity-50" />
      ) : null}
    </span>
  );
}