export function RoleBadge({ role }: Readonly<{ role: string }>) {
  const map: Record<string, { label: string; cls: string }> = {
    admin: { label: "Super Admin", cls: "bg-brand-orange/10 text-brand-orange" },
    sub_admin: { label: "Sub Admin", cls: "bg-brand-sky/10 text-brand-sky" },
    franchise_admin: { label: "Store Admin", cls: "bg-brand-yellow/20 text-brand-orange" },
    employee: { label: "Employee", cls: "bg-brand-teal/10 text-brand-teal" },
  };
  const { label, cls } = map[role] ?? { label: role, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export function FranchisePill({ name }: Readonly<{ name: string }>) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-sand text-gray-700 border border-brand-beige">{name}</span>;
}
