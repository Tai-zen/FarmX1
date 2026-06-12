import React from 'react';
import { LayoutDashboard, Sprout, ShoppingBag, Wallet, ShoppingCart, Package } from 'lucide-react';
import { Screen, UserRole } from './types';

interface Props {
  role: UserRole;
  activeScreen: Screen;
  onNavigate: (s: Screen) => void;
  cartCount?: number;
}

export function MobileNav({ role, activeScreen, onNavigate, cartCount = 0 }: Props) {
  const farmerItems = [
    { screen: 'farmer-dashboard' as Screen, icon: LayoutDashboard, label: 'Home' },
    { screen: 'crop-prediction' as Screen, icon: Sprout, label: 'Crop AI' },
    { screen: 'my-listings' as Screen, icon: ShoppingBag, label: 'Listings' },
    { screen: 'wallet' as Screen, icon: Wallet, label: 'Wallet' },
  ];
  const consumerItems = [
    { screen: 'consumer-dashboard' as Screen, icon: LayoutDashboard, label: 'Home' },
    { screen: 'marketplace' as Screen, icon: ShoppingBag, label: 'Market' },
    { screen: 'cart' as Screen, icon: ShoppingCart, label: 'Cart', badge: cartCount },
    { screen: 'order-tracking' as Screen, icon: Package, label: 'Orders' },
  ];

  const items = role === 'farmer' ? farmerItems : consumerItems;

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 flex items-center justify-around px-2 py-2 z-50"
      style={{ background: '#fff', borderTop: '0.5px solid rgba(0,0,0,0.1)', height: 58 }}>
      {items.map(item => {
        const isActive = activeScreen === item.screen;
        return (
          <button
            key={item.label}
            onClick={() => onNavigate(item.screen)}
            aria-label={item.label}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl relative"
            style={{ color: isActive ? '#27500A' : '#5F5E5A' }}
          >
            <item.icon size={20} aria-hidden="true" />
            <span style={{ fontSize: 9 }}>{item.label}</span>
            {'badge' in item && item.badge && item.badge > 0 && (
              <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ fontSize: 8, background: '#185FA5', color: '#fff' }}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
