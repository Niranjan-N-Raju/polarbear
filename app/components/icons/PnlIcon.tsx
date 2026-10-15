interface IconProps {
  className?: string;
}

export function PnlIcon({
  className = "w-5 h-5 shrink-0",
}: Readonly<IconProps>) {
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
        d="M4 19h16M7 16V9m5 7V5m5 11v-5"
      />
    </svg>
  );
}
