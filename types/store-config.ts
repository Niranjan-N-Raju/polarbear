export interface StoreConfigData {
  store: { name: string };
  shifts: StoreShiftOption[];
  cycle: {
    configured: boolean;
    type: "calendar_month" | "custom";
    startDay: number;
    endDay: number;
  };
}

export interface StoreShiftOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface StoreSelectFranchise {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
}

export interface StoreSelectModalProps {
  isOpen: boolean;
  canDismiss: boolean;
  activeFranchiseId?: string;
  onSelect: (franchiseId: string, franchiseName: string) => void;
  onDismiss: () => void;
}
