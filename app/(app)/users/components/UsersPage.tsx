"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrashIcon,
  PlusIcon,
  FilterIcon,
  EmployeesIcon,
} from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import type {
  CurrentUserRole,
  FranchiseMini,
  UserRow,
} from "@/types/users";
import { usersRequest } from "../apicall/users";
import { getUserCountLabel } from "../utils";
import { FranchisePill, RoleBadge } from "./UserBadges";
import UserFormDrawer from "./UserFormDrawer";

// ── Delete confirmation ────────────────────────────────────────────────────────

function DeleteConfirm({
  user,
  onClose,
  onDeleted,
}: Readonly<{ user: UserRow; onClose: () => void; onDeleted: () => void }>) {
  const [deleting, setDeleting] = useState(false);
  const { error, success } = useToast();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await usersRequest(`/api/users/${user._id}`, { method: "DELETE" });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        error(data.message ?? "Delete failed.");
        return;
      }
      success("User deleted successfully.");
      onDeleted();
    } catch {
      error("Network error.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <TrashIcon className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Delete User</h3>
            <p className="text-sm text-gray-500">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{user.name}</span>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-brand-beige text-sm font-medium text-gray-600 hover:bg-brand-sand transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function UsersPage() {
  useEffect(() => { document.title = "User Management · Polar Bear"; }, []);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [franchises, setFranchises] = useState<FranchiseMini[]>([]);
  const [currentUserRole, setCurrentUserRole] =
    useState<CurrentUserRole>("employee");
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [filterFranchise, setFilterFranchise] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const { error, success } = useToast();

  const load = useCallback(
    async (franchiseId?: string) => {
      setLoading(true);
      setHasError(false);
      try {
        const url = franchiseId
          ? `/api/users?franchiseId=${encodeURIComponent(franchiseId)}&excludeEmployees=true&limit=500`
          : "/api/users?excludeEmployees=true&limit=500";
        const [usersRes, franchisesRes, meRes] = await Promise.all([
          usersRequest(url),
          usersRequest("/api/stores"),
          usersRequest("/api/me"),
        ]);
        const usersData = (await usersRes.json()) as {
          users?: UserRow[];
          message?: string;
        };
        const franchisesData = (await franchisesRes.json()) as {
          franchises?: FranchiseMini[];
        };
        const meData = (await meRes.json()) as { role?: string };

        if (!usersRes.ok) {
          setHasError(true);
          error(usersData.message ?? "Failed to load users.");
          return;
        }
        setUsers(usersData.users ?? []);
        setFranchises(franchisesData.franchises ?? []);
        if (meData.role) {
          setCurrentUserRole(meData.role as CurrentUserRole);
        }
      } catch {
        setHasError(true);
        error("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [error],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load(filterFranchise || undefined);
    });
  }, [filterFranchise, load]);

  function handleSaved() {
    setAddOpen(false);
    setEditUser(null);
    success("User saved successfully.");
    void load(filterFranchise || undefined);
  }

  function handleDeleted() {
    setDeleteUser(null);
    void load(filterFranchise || undefined);
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-beige bg-white/80 p-6 shadow-[0_10px_30px_rgba(36,50,58,0.05)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-brand-teal sm:block">Access management</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Users</h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage staff accounts and store access
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition shadow-sm shadow-brand-orange/30"
        >
          <PlusIcon />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-brand-beige shadow-sm px-4 py-3 mb-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
          <FilterIcon />
          Filter:
        </div>
        <select
          value={filterFranchise}
          onChange={(e) => setFilterFranchise(e.target.value)}
          className="border border-brand-beige rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:border-brand-orange transition min-w-[200px]"
        >
          <option value="">All Stores</option>
          {franchises.map((f) => (
            <option key={f._id} value={f._id}>
              {f.name}
            </option>
          ))}
        </select>
        {filterFranchise && (
          <button
            onClick={() => setFilterFranchise("")}
            className="text-sm text-brand-orange hover:underline"
          >
            Clear filter
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {getUserCountLabel(loading, users.length)}
        </span>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!loading && !hasError && users.length === 0 && (
        <div className="bg-white rounded-2xl border border-brand-beige shadow-sm flex flex-col items-center justify-center py-16 gap-3">
          <EmployeesIcon className="w-12 h-12 text-brand-beige" />
          <p className="text-gray-500 text-sm">No users found</p>
          <button
            onClick={() => setAddOpen(true)}
            className="text-brand-orange text-sm font-medium hover:underline"
          >
            Add your first user
          </button>
        </div>
      )}
      {!loading && !hasError && users.length > 0 && (
        /* Desktop table + mobile cards */
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-brand-beige shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-sand/50 border-b border-brand-beige">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">
                    Role
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">
                    Stores
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-beige/60">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-brand-sand/20 transition">
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange font-bold text-xs shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        {u.name}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {u.franchises.length === 0 ? (
                          <span className="text-gray-400 text-xs">
                            No store
                          </span>
                        ) : (
                          u.franchises.map((f) => (
                            <FranchisePill key={f._id} name={f.name} />
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {!(
                          currentUserRole === "sub_admin" && u.role === "admin"
                        ) && (
                          <>
                            <button
                              onClick={() => setEditUser(u)}
                              className="px-3 py-1.5 rounded-lg border border-brand-beige text-xs font-medium text-gray-600 hover:border-brand-orange hover:text-brand-orange transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteUser(u)}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {users.map((u) => (
              <div
                key={u._id}
                className="bg-white rounded-2xl border border-brand-beige shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange font-bold shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {u.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {u.email}
                      </p>
                    </div>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                {u.franchises.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {u.franchises.map((f) => (
                      <FranchisePill key={f._id} name={f.name} />
                    ))}
                  </div>
                )}
                {!(currentUserRole === "sub_admin" && u.role === "admin") && (
                  <div className="mt-3 flex gap-2 pt-3 border-t border-brand-beige/60">
                    <button
                      onClick={() => setEditUser(u)}
                      className="flex-1 py-1.5 rounded-lg border border-brand-beige text-xs font-medium text-gray-600 hover:border-brand-orange hover:text-brand-orange transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteUser(u)}
                      className="flex-1 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {addOpen && (
        <UserFormDrawer
          mode="add"
          franchises={franchises}
          currentUserRole={currentUserRole}
          onClose={() => setAddOpen(false)}
          onSaved={handleSaved}
        />
      )}
      {editUser && (
        <UserFormDrawer
          mode="edit"
          user={editUser}
          franchises={franchises}
          currentUserRole={currentUserRole}
          onClose={() => setEditUser(null)}
          onSaved={handleSaved}
        />
      )}
      {deleteUser && (
        <DeleteConfirm
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
