export interface AppShellProps {
  children: React.ReactNode;
  franchiseId: string;
  initialFranchiseName: string;
  userRole: string;
  userName: string;
  /** Restricted session: only the profile page (password change) is usable. */
  mustChangePassword?: boolean;
}

export interface SidebarProps {
  franchiseName?: string;
  userRole: string;
  userName?: string;
  storeCount?: number;
}

export interface StoreModalContextType {
  openStoreModal: () => void;
  activeStoreId: string | null;
}

export interface StoreSelectModalProps {
  isOpen: boolean;
  canDismiss: boolean;
  activeFranchiseId?: string;
  onSelect: (franchiseId: string, franchiseName: string) => void;
  onDismiss: () => void;
}
