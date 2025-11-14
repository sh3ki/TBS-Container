export interface InventoryRecord {
  inv_id: number;
  hashed_id: string;
  container_no: string;
  client_id: number;
  client?: {
    c_id: number;
    client_code: string;
    client_name: string;
  };
  container_size: string; // '20', '40', '45'
  container_type: string; // 'GP', 'HC', 'RF', 'OT', 'FR', 'TK'
  load_type: string; // 'E' (Empty) or 'F' (Full)
  booking: string;
  shipper: string;
  vessel: string;
  voyage: string;
  date_in: string; // YYYY-MM-DD
  time_in: string; // HH:MM:SS
  date_out: string | null; // YYYY-MM-DD or null
  time_out: string | null; // HH:MM:SS or null
  slot: string;
  status: 'IN' | 'OUT' | 'COMPLETE';
  hold: boolean;
  damage: boolean;
  remarks: string;
  created_at: string;
  created_by?: {
    user_id: number;
    username: string;
  };
  updated_at: string;
  updated_by?: {
    user_id: number;
    username: string;
  };
  days_in_yard?: number;
}

export interface InventoryFilters {
  container_no?: string;
  client_id?: string; // hashed
  booking?: string;
  status?: 'IN' | 'OUT' | 'COMPLETE' | 'all';
  size?: '20' | '40' | '45' | 'all';
  type?: string; // 'GP', 'HC', etc.
  load_type?: 'E' | 'F' | 'all';
  shipper?: string;
  vessel?: string;
  date_in_from?: string;
  date_in_to?: string;
  date_out_from?: string;
  date_out_to?: string;
  hold?: boolean;
  damage?: boolean;
}

export interface DamageRecord {
  damage_id: number;
  inv_id: number;
  description: string;
  repair_status: 'Pending' | 'In Progress' | 'Completed';
  repair_cost: number;
  reported_date: string;
  completed_date: string | null;
  remarks: string;
}

export interface ActivityLog {
  log_id: number;
  module: string;
  action: string;
  record_id: number;
  user_id: number;
  username: string;
  timestamp: string;
  details: string;
  old_value?: string;
  new_value?: string;
}

export interface ClientOption {
  c_id: number;
  client_code: string;
  client_name: string;
  hashed_id: string;
}

export interface SizeOption {
  value: string;
  label: string;
}

export interface TypeOption {
  value: string;
  label: string;
}

export interface SizeTypeOption {
  size: string;
  type: string;
  label: string;
}

export interface InventoryResponse {
  success: boolean;
  data: InventoryRecord[];
  total: number;
  message?: string;
}

export interface InventoryDetailsResponse {
  success: boolean;
  data: {
    inventory: InventoryRecord;
    damages: DamageRecord[];
    activities: ActivityLog[];
  };
}
