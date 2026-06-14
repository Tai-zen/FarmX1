import React from 'react';
import {
  Leaf, LayoutDashboard, Sprout, CalendarDays, ShoppingBag,
  ClipboardList, Wallet, Settings, ShoppingCart, Package, BarChart3
} from 'lucide-react';
import { Screen, UserRole } from './types';

interface Props {
  role: UserRole;
  activeScreen: Screen;
  onNavigate: (s: Screen) => void;
  cartCount?: number;
  profile?: any;
}

const farmerNav = [
  { label: 'Main', items: [
    { screen: 'farmer-dashboard' as Screen, icon: LayoutDashboard, label: 'Overview' },
    { screen: 'crop-prediction' as Screen, icon: Sprout, label: 'Crop AI', badge: 'New' },
    { screen: 'planting-calendar' as Screen, icon: CalendarDays, label: 'Calendar' },
  ]},
  { label: 'Commerce', items: [
    { screen: 'my-listings' as Screen, icon: ShoppingBag, label: 'My Listings' },
    { screen: 'farmer-orders' as Screen, icon: ClipboardList, label: 'Orders' },
    { screen: 'wallet' as Screen, icon: Wallet, label: 'Wallet' },
  ]},
  { label: 'Account', items: [
    { screen: 'farmer-dashboard' as Screen, icon: Settings, label: 'Settings' },
  ]},
];

const consumerNav = [
  { label: 'Main', items: [
    { screen: 'consumer-dashboard' as Screen, icon: LayoutDashboard, label: 'Overview' },
    { screen: 'marketplace' as Screen, icon: ShoppingBag, label: 'Marketplace' },
    { screen: 'cart' as Screen, icon: ShoppingCart, label: 'Cart' },
    { screen: 'order-tracking' as Screen, icon: Package, label: 'My Orders' },
  ]},
  { label: 'Account', items: [
    { screen: 'consumer-dashboard' as Screen, icon: BarChart3, label: 'Spending' },
    { screen: 'consumer-dashboard' as Screen, icon: Settings, label: 'Settings' },
  ]},
];

export function Sidebar({ role, activeScreen, onNavigate, cartCount = 0, profile }: Props) {
  const nav = role === 'farmer' ? farmerNav : consumerNav;

  const displayName = profile ? profile.fullName : (role === 'farmer' ? 'Aminu Danjuma' : 'Chioma Ike');
  const displayLocation = profile 
    ? (role === 'farmer' ? `${profile.farmName || 'My Farm'} · ${profile.farmState || 'Nigeria'}` : `Consumer · ${profile.deliveryAddress?.split(',').slice(-2).join(',') || 'Lagos'}`) 
    : (role === 'farmer' ? 'Danjuma Farm · Kaduna' : 'Consumer · Lagos');
  
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  return (
    <aside className="hidden lg:flex flex-col h-screen sticky top-0 overflow-y-auto"
      style={{ width: 200, background: '#fff', borderRight: '0.5px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.1)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#27500A' }}>
          <Leaf size={14} className="text-white" />
        </div>
        <span style={{ fontSize: 15, fontWeight: 500, color: '#27500A' }}>FarmX</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {nav.map(section => (
          <div key={section.label}>
            <p className="px-2 mb-1" style={{ fontSize: 10, fontWeight: 500, color: '#5F5E5A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = activeScreen === item.screen;
                return (
                  <button
                    key={item.label}
                    onClick={() => onNavigate(item.screen)}
                    aria-label={item.label}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all text-left"
                    style={{
                      background: isActive ? '#EAF3DE' : 'transparent',
                      color: isActive ? '#27500A' : '#5F5E5A',
                    }}
                  >
                    <item.icon size={16} aria-hidden="true" />
                    <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, flex: 1 }}>{item.label}</span>
                    {'badge' in item && item.badge && (
                      <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, background: '#EAF3DE', color: '#27500A', border: '0.5px solid #3B6D11' }}>
                        {item.badge}
                      </span>
                    )}
                    {/* ── FIX: only show cart count badge when count > 0 ── */}
                    {item.screen === 'cart' && cartCount > 0 && (
                      <span className="rounded-full w-4 h-4 flex items-center justify-center" style={{ fontSize: 9, background: '#185FA5', color: '#fff' }}>
                        {cartCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4" style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)' }}>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ background: '#27500A', fontSize: 11, fontWeight: 500 }}>
            {initials}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>{displayName}</p>
            <p style={{ fontSize: 10, color: '#5F5E5A' }}>{displayLocation}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}