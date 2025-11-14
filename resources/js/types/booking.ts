export interface Booking {
  b_id: number;
  book_no: string;
  client_id: number;
  shipper: string;
  twenty: number;
  fourty: number;
  fourty_five: number;
  twenty_rem: number;
  fourty_rem: number;
  fourty_five_rem: number;
  cont_list: string;
  cont_list_rem: string;
  expiration_date: string;
  date_added: string;
  user_id: number;
  status_text: string;
  hashed_id: string;
  is_active: boolean;
  client?: {
    c_id: number;
    client_code: string;
    client_name: string;
  };
  user?: {
    user_id: number;
    username: string;
  };
}

export interface BookingFormData {
  bnum: string;
  cid: string; // MD5 hashed client ID
  shipper: string;
  two?: number;
  four?: number;
  fourf?: number;
  cnums?: string; // Container numbers (comma-separated)
  exp: string; // YYYY-MM-DD
}

export interface BookingEditData {
  id: string; // hashed ID
  bnum: string;
  ship: string;
  exp: string;
  two?: number;
  four?: number;
  fourf?: number;
  clientid: string; // hashed client ID
  isc: 0 | 1; // 0 = has container list, 1 = no container list
}

export interface ClientOption {
  c_id: number;
  client_code: string;
  client_name: string;
  hashed_id: string;
}
