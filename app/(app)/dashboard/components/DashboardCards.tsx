"use client";

import {
  faBuilding,
  faCalendarCheck,
  faCircleCheck,
  faHandshake,
  faIndianRupeeSign,
  faStore,
  faUserGroup,
  faUserShield,
  faUserTie,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { SummaryCard } from "@/app/components/SummaryCard";
import { MobileSummaryDrawer } from "@/app/components/MobileSummaryDrawer";
import type { DashboardStats } from "@/types/dashboard";

interface DashboardCardsProps {
  stats: DashboardStats | null;
  isFranchiseAdmin: boolean;
}

export function DashboardCards({ stats, isFranchiseAdmin }: Readonly<DashboardCardsProps>) {
  if (!stats) return null;

  const cards = isFranchiseAdmin
    ? [
        { label: "My Stores", value: stats.storeCount ?? 0, color: "teal" as const, icon: faStore },
        { label: "Employee Summary", value: stats.employeeSummary ?? 0, color: "orange" as const, icon: faUserGroup },
        {
          label: "Sales (This Month)",
          value: `₹${(stats.salesSummary ?? 0).toLocaleString("en-IN")}`,
          color: "orange" as const,
          icon: faIndianRupeeSign,
        },
        { label: "Attendance Summary", value: stats.attendanceSummary ?? 0, color: "teal" as const, icon: faCalendarCheck },
      ]
    : [
        { label: "Total Stores", value: stats.totalStores ?? 0, color: "teal" as const, icon: faStore },
        { label: "Active Stores", value: stats.activeStores ?? 0, color: "orange" as const, icon: faCircleCheck },
        { label: "Franchise Stores", value: stats.franchiseStores ?? 0, color: "orange" as const, icon: faHandshake },
        { label: "Company Stores", value: stats.companyStores ?? 0, color: "teal" as const, icon: faBuilding },
        { label: "Total Users", value: stats.totalUsers ?? 0, color: "teal" as const, icon: faUsers },
        { label: "Sub Admins", value: stats.subAdmins ?? 0, color: "orange" as const, icon: faUserShield },
        { label: "Store Admins", value: stats.storeAdmins ?? 0, color: "orange" as const, icon: faUserTie },
        { label: "Employees", value: stats.employees ?? 0, color: "teal" as const, icon: faUserGroup },
      ];

  return (
    <>
      <div className="hidden gap-3 sm:grid sm:grid-cols-4">
        {cards.map((card) => (
          <SummaryCard key={card.label} label={card.label} value={card.value} color={card.color} icon={card.icon} />
        ))}
      </div>
      <MobileSummaryDrawer cards={cards} />
    </>
  );
}
