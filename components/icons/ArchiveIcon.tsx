interface IconProps {
  className?: string;
}

export function ArchiveIcon({
  className = "w-4 h-4 shrink-0",
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
        d="M4 7h16v13H4V7Zm-1-3h18v3H3V4Zm6 8h6"
      />
    </svg>
  );
}