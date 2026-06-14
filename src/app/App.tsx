import React, { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { FarmerDashboard } from './components/FarmerDashboard';
import { CropPrediction } from './components/CropPrediction';
import { PlantingCalendar } from './components/PlantingCalendar';
import { MyListings } from './components/MyListings';
import { FarmerOrders } from './components/FarmerOrders';
import { WalletScreen } from './components/WalletScreen';
import { ConsumerDashboard } from './components/ConsumerDashboard';
import { Marketplace } from './components/Marketplace';
import { ProductDetail } from './components/ProductDetail';
import { CartScreen } from './components/CartScreen';
import { CheckoutScreen } from './components/CheckoutScreen';
import { OrderTracking } from './components/OrderTracking';
import { AddListing } from './components/AddListing';
import { AIChatWidget } from './components/AIChatWidget';
import { UserRole, Screen } from './components/types';
import { LogOut } from 'lucide-react';
import { auth, getUserProfile, subscribeToCart } from './firebase';

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [cartCount, setCartCount] = useState(0);
  const [profile, setProfile] = useState<any | null>(null);

  // Sync auth state on mount
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        try {
          const fetchedProfile = await getUserProfile(currentUser.uid);
          if (fetchedProfile) {
            setRole(fetchedProfile.role);
            setProfile(fetchedProfile);
            setScreen(fetchedProfile.role === 'farmer' ? 'farmer-dashboard' : 'consumer-dashboard');
          }
        } catch (error) {
          console.error("Error loading user profile on auth change:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync cart count from Firestore whenever a user is logged in
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setCartCount(0);
      return;
    }
    const unsub = subscribeToCart(uid, (items) => {
      setCartCount(items.length);
    });
    return () => unsub();
  }, [profile]);

  const handleLogin = (r: UserRole, userProfile?: any) => {
    setRole(r);
    setProfile(userProfile || null);
    setScreen(r === 'farmer' ? 'farmer-dashboard' : 'consumer-dashboard');
  };

  const handleLogout = () => {
    auth.signOut().catch(err => console.warn('Auth signOut error:', err));
    setRole(null);
    setProfile(null);
    setScreen('login');
    setCartCount(0);
  };

  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);

  const navigate = (s: Screen, productId?: string) => {
    if (productId !== undefined) setSelectedProductId(productId);
    setScreen(s);
  };

  if (!role || screen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#FAFAF8', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar (desktop) */}
      <Sidebar role={role} activeScreen={screen} onNavigate={navigate} cartCount={cartCount} profile={profile} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0" style={{ minWidth: 0 }}>
        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 lg:hidden"
          style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.1)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#27500A' }}>
              <span style={{ fontSize: 13 }}>🌿</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, color: '#27500A' }}>FarmX</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5"
              style={{ fontSize: 10, background: role === 'farmer' ? '#EAF3DE' : '#E6F1FB', color: role === 'farmer' ? '#27500A' : '#185FA5' }}>
              {role === 'farmer' ? '🌾 Farmer' : '🛒 Consumer'}
            </span>
            <button onClick={handleLogout} aria-label="Log out">
              <LogOut size={16} style={{ color: '#5F5E5A' }} />
            </button>
          </div>
        </div>

        {/* Desktop header bar */}
        <div className="hidden lg:flex items-center justify-end gap-3 px-6 py-3"
          style={{ borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
          <span className="rounded-full px-2.5 py-1"
            style={{ fontSize: 11, background: role === 'farmer' ? '#EAF3DE' : '#E6F1FB', color: role === 'farmer' ? '#27500A' : '#185FA5' }}>
            {role === 'farmer' ? '🌾 Farmer mode' : '🛒 Consumer mode'}
          </span>
          <button onClick={handleLogout} className="flex items-center gap-1.5"
            style={{ fontSize: 12, color: '#5F5E5A' }} aria-label="Log out">
            <LogOut size={13} /> Log out
          </button>
        </div>

        {/* Screens */}
        {screen === 'farmer-dashboard' && <FarmerDashboard onNavigate={navigate} profile={profile} />}
        {screen === 'crop-prediction' && <CropPrediction onNavigate={navigate} profile={profile} />}
        {screen === 'planting-calendar' && <PlantingCalendar onNavigate={navigate} profile={profile} />}
        {screen === 'my-listings' && <MyListings onNavigate={navigate} profile={profile} />}
        {screen === 'farmer-orders' && <FarmerOrders profile={profile} />}
        {screen === 'wallet' && <WalletScreen profile={profile} />}
        {screen === 'add-listing' && <AddListing onNavigate={navigate} profile={profile} />}

        {screen === 'consumer-dashboard' && <ConsumerDashboard onNavigate={navigate} profile={profile} />}
        {screen === 'marketplace' && (
          <Marketplace
            onNavigate={(s, id) => navigate(s, id)}
            onAddToCart={() => {}} // cart count now driven by Firestore subscription
          />
        )}
        {screen === 'product-detail' && (
          <ProductDetail
            onNavigate={navigate}
            onAddToCart={() => {}}
            productId={selectedProductId}
          />
        )}
        {screen === 'cart' && (
          <CartScreen
            onNavigate={navigate}
            onCartChange={() => {}} // cart count now driven by Firestore subscription
          />
        )}
        {screen === 'checkout' && <CheckoutScreen onNavigate={navigate} profile={profile} />}
        {screen === 'order-tracking' && <OrderTracking role={role} onNavigate={navigate} profile={profile} />}
      </main>

      {/* Bottom nav (mobile) */}
      <MobileNav role={role} activeScreen={screen} onNavigate={navigate} cartCount={cartCount} />

      {/* AI Chat Widget */}
      <AIChatWidget role={role} />
    </div>
  );
}