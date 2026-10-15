interface IconProps {
  className?: string;
}

export function PencilIcon({ className = "w-5 h-5" }: Readonly<IconProps>) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 3.487a2.121 2.121 0 013 3L7.5 18.849 3 20l1.151-4.5L16.862 3.487z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l3 3" />
    </svg>
  );
}
