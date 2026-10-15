interface IconProps {
  className?: string;
}

export function SalaryIcon({
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
        d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 5h10M8 14h3m3 0h2M8 17h2"
      />
    </svg>
  );
}