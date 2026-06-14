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
import { AdminDashboard } from './components/AdminDashboard';
import { ProfileSettings } from './components/ProfileSettings';
import { AIChatWidget } from './components/AIChatWidget';
import { UserRole, Screen } from './components/types';
import { LogOut } from 'lucide-react';
import { auth, getUserProfile, subscribeToCart } from './firebase';

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [cartCount, setCartCount] = useState(0);
  const [profile, setProfile] = useState<any | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        try {
          const fetchedProfile = await getUserProfile(currentUser.uid);
          if (fetchedProfile) {
            const r = fetchedProfile.role as UserRole;
            setRole(r);
            setProfile(fetchedProfile);
            if (r === 'admin') setScreen('admin-dashboard');
            else setScreen(r === 'farmer' ? 'farmer-dashboard' : 'consumer-dashboard');
          }
        } catch (error) {
          console.error("Error loading user profile on auth change:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setCartCount(0); return; }
    const unsub = subscribeToCart(uid, (items) => {
      setCartCount(items.length);
    });
    return () => unsub();
  }, [profile]);

  const handleLogin = (r: UserRole, userProfile?: any) => {
    setRole(r);
    setProfile(userProfile || null);
    if (r === 'admin') setScreen('admin-dashboard');
    else setScreen(r === 'farmer' ? 'farmer-dashboard' : 'consumer-dashboard');
  };

  const handleLogout = () => {
    auth.signOut().catch(err => console.warn('Auth signOut error:', err));
    setRole(null);
    setProfile(null);
    setScreen('login');
    setCartCount(0);
    setShowLogoutConfirm(false);
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
      <Sidebar role={role} activeScreen={screen} onNavigate={navigate} cartCount={cartCount} profile={profile} />

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
              style={{ fontSize: 10, background: role === 'farmer' ? '#EAF3DE' : role === 'admin' ? '#F3E8FF' : '#E6F1FB', color: role === 'farmer' ? '#27500A' : role === 'admin' ? '#6B21A8' : '#185FA5' }}>
              {role === 'farmer' ? '🌾 Farmer' : role === 'admin' ? '🛡 Admin' : '🛒 Consumer'}
            </span>
            <button onClick={() => setShowLogoutConfirm(true)} aria-label="Log out">
              <LogOut size={16} style={{ color: '#5F5E5A' }} />
            </button>
          </div>
        </div>

        {/* Desktop header bar */}
        <div className="hidden lg:flex items-center justify-end gap-3 px-6 py-3"
          style={{ borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
          <span className="rounded-full px-2.5 py-1"
            style={{ fontSize: 11, background: role === 'farmer' ? '#EAF3DE' : role === 'admin' ? '#F3E8FF' : '#E6F1FB', color: role === 'farmer' ? '#27500A' : role === 'admin' ? '#6B21A8' : '#185FA5' }}>
            {role === 'farmer' ? '🌾 Farmer mode' : role === 'admin' ? '🛡 Admin mode' : '🛒 Consumer mode'}
          </span>
          <button onClick={() => setShowLogoutConfirm(true)} className="flex items-center gap-1.5"
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
            onAddToCart={() => {}}
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
            onCartChange={() => {}}
          />
        )}
        {screen === 'checkout' && <CheckoutScreen onNavigate={navigate} profile={profile} />}
        {screen === 'order-tracking' && <OrderTracking role={role === 'admin' ? 'farmer' : role} onNavigate={navigate} profile={profile} />}
        {screen === 'admin-dashboard' && <AdminDashboard onNavigate={navigate} profile={profile} />}
        {screen === 'profile-settings' && <ProfileSettings onNavigate={navigate} profile={profile} onProfileUpdate={(p) => setProfile(p)} />}
      </main>

      <MobileNav role={role === 'admin' ? 'farmer' : role} activeScreen={screen} onNavigate={navigate} cartCount={cartCount} />

      <AIChatWidget role={role === 'admin' ? 'farmer' : role} />

      {/* Logout confirmation dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowLogoutConfirm(false)}>
          <div className="rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl"
            style={{ background: '#fff' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#FEF3C7' }}>
              <LogOut size={22} style={{ color: '#92400E' }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: '#444441', textAlign: 'center', marginBottom: 8 }}>
              Log out of FarmX?
            </h2>
            <p style={{ fontSize: 13, color: '#5F5E5A', textAlign: 'center', marginBottom: 24 }}>
              You'll need to sign in again to access your account.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl py-2.5 transition-all"
                style={{ border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 14, color: '#444441', background: '#F7F6F2' }}>
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 rounded-xl py-2.5 transition-all"
                style={{ background: '#A32D2D', color: '#fff', fontSize: 14, fontWeight: 500 }}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
