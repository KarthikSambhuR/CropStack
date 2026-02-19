// CROPSTACK DATABASE TYPES — used across the app
// Data is stored in Firestore collections: profiles, products, orders, transactions

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'buyer' | 'seller' | 'organizer';
  avatar_url: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  category: string;
  price_per_unit: number;
  unit: string;
  quantity_available: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type Order = {
  id: string;
  buyer_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  reservation_fee?: number;
  fee_paid?: boolean;
  status: 'pending' | 'approved' | 'reserved' | 'confirmed' | 'completed' | 'cancelled' | 'expired';
  reservation_expiry: string | null;
  pickup_code: string | null;
  created_at: string;
};

export type Transaction = {
  id: string;
  order_id: string;
  seller_id: string;
  amount: number;
  status: 'held' | 'released' | 'cleared' | 'refunded';
  available_at: string | null;
  created_at: string;
};
