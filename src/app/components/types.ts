export type UserRole = 'farmer' | 'consumer';
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
  | 'add-listing';

export interface AppState {
  role: UserRole | null;
  screen: Screen;
  cartCount: number;
  selectedProductId?: string;
}
