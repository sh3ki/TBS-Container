export interface BillingRecord {
  inv_id: number;
  container_no: string;
  client_id: number;
  client?: {
    c_id: number;
    client_code: string;
    client_name: string;
  };
  container_size: string; // '20', '40', '45'
  date_in: string; // YYYY-MM-DD
  date_out: string | null; // YYYY-MM-DD or null if still IN
  storage_days: number;
  storage_rate: number;
  storage_charges: number;
  handling_count: number;
  handling_rate: number;
  handling_charges: number;
  total_charges: number;
}

export interface BillingGenerateRequest {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface BillingListRequest {
  start: string;
  end: string;
  client_id?: string; // MD5 hashed client ID (optional)
}

export interface BillingExportRequest {
  start: string;
  end: string;
  client_id?: string; // MD5 hashed client ID (optional)
}

export interface ClientOption {
  c_id: number;
  client_code: string;
  client_name: string;
  hashed_id: string;
}

export interface BillingResponse {
  success: boolean;
  data: BillingRecord[];
  total: number;
  message?: string;
}
