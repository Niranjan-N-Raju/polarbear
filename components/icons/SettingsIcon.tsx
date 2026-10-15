interface IconProps {
  className?: string;
}

export function SettingsIcon({
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
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5c0-.5-.1-1-.2-1.5l2-1.6-2-3.4-2.5 1a8 8 0 0 0-2.6-1.5L13.7 2h-3.4L10 5a8 8 0 0 0-2.6 1.5l-2.5-1-2 3.4 2 1.6a8 8 0 0 0 0 3L3 15.1l2 3.4 2.5-1A8 8 0 0 0 10 19l.4 3h3.4l.4-3a8 8 0 0 0 2.6-1.5l2.5 1 2-3.4-2-1.6c.1-.5.2-1 .2-1.5Z"
      />
    </svg>
  );
}