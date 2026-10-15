interface IconProps {
  className?: string;
}

export function ProfileIcon({
  className = "w-5 h-5 shrink-0",
}: Readonly<IconProps>) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.121 17.804A10.97 10.97 0 0112 15c2.59 0 4.972.893 6.879 2.804M15 11a3 3 0 11-6 0 3 3 0 016 0zM12 2a10 10 0 100 20A10 10 0 0012 2z"
      />
    </svg>
  );
}
