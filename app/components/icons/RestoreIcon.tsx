interface IconProps {
  className?: string;
}

export function RestoreIcon({ className = "w-4 h-4 shrink-0" }: Readonly<IconProps>) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12a9 9 0 1 0 2.64-6.36L3 8m0-5v5h5"
      />
    </svg>
  );
}