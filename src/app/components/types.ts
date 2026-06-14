export type UserRole = 'farmer' | 'consumer' | 'admin';
export type Screen =
  | 'login'
  | 'farmer-dashboard'
  | 'crop-prediction'
  | 'planting-calendar'
  | 'my-listings'
  | 'farmer-orders'
  | 'wallet'
  | 'consumer-dashboard'
  | 'marketplace'
  | 'product-detail'
  | 'cart'
  | 'checkout'
  | 'order-tracking'
  | 'add-listing'
  | 'admin-dashboard'
  | 'profile-settings';

export interface AppState {
  role: UserRole | null;
  screen: Screen;
  cartCount: number;
  selectedProductId?: string;
}
