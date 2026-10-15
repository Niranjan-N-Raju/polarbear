export const INVALID_FIELD_CLASS =
  "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/40";

export function fieldClass(
  hasError: boolean,
  validClass = "border-gray-300 focus:border-brand-orange focus:ring-brand-orange/50",
): string {
  return hasError ? INVALID_FIELD_CLASS : validClass;
}

export function FieldError({
  id,
  message,
}: Readonly<{ id?: string; message?: string }>) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-600" role="alert">
      {message}
    </p>
  );
}

export function focusFirstInvalidField(formId: string) {
  requestAnimationFrame(() => {
    const field = document
      .getElementById(formId)
      ?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus();
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}