interface IconProps {
  className?: string;
}

export function CheckIcon({
  className = "w-4 h-4 text-brand-orange shrink-0",
}: Readonly<IconProps>) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  );
}
