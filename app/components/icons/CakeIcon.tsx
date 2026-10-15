interface IconProps {
  className?: string;
}

export function CakeIcon({
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
        d="M4 14h16v7H4v-7Zm0 3.5c1.3 0 1.3 1.5 2.7 1.5s1.3-1.5 2.6-1.5 1.4 1.5 2.7 1.5 1.3-1.5 2.7-1.5 1.3 1.5 2.6 1.5 1.4-1.5 2.7-1.5M6 14v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3M9 9V6m6 3V6M9 6c0-1 .7-1.6 1.5-2.5M15 6c0-1-.7-1.6-1.5-2.5"
      />
    </svg>
  );
}