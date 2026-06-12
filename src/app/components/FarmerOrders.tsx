import React, { useState, useEffect } from 'react';
import { Truck, Phone, MessageCircle, Search, ChevronDown, ChevronUp } from 'lucide-react';

const demoOrders = [
  { id: 'ORD-8821', buyer: 'Fatima Bello', location: 'Abuja FCT', phone: '+234 802 345 6789', product: 'Roma Tomatoes × 20kg', amount: 14000, status: 'new', time: '2h ago', avatar: 'FB', color: '#185FA5', items: 1 },
  { id: 'ORD-8820', buyer: 'Emeka Obi', location: 'Lagos Island', phone: '+234 803 456 7890', product: 'Sweet Pepper × 10kg', amount: 8500, status: 'new', time: '5h ago', avatar: 'EO', color: '#185FA5', items: 1 },
  { id: 'ORD-8817', buyer: 'Ngozi Adeyemi', location: 'Enugu', phone: '+234 804 567 8901', product: 'Maize × 50kg + Cowpea × 5kg', amount: 19500, status: 'new', time: '1d ago', avatar: 'NA', color: '#185FA5', items: 2 },
  { id: 'ORD-8816', buyer: 'Hauwa Musa', location: 'Kano', phone: '+234 805 678 9012', product: 'Yam × 30kg', amount: 12000, status: 'dispatched', time: '2d ago', avatar: 'HM', color: '#854F0B', items: 1 },
  { id: 'ORD-8815', buyer: 'Tunde Akande', location: 'Ibadan', phone: '+234 806 789 0123', product: 'Maize × 100kg', amount: 35000, status: 'dispatched', time: '3d ago', avatar: 'TA', color: '#854F0B', items: 1 },
  { id: 'ORD-8819', buyer: 'Hauwa Musa', location: 'Kano', phone: '+234 805 678 9012', product: 'Yam × 50kg', amount: 22000, status: 'delivered', time: 'Yesterday', avatar: 'HM', color: '#27500A', items: 1 },
  { id: 'ORD-8814', buyer: 'Chioma Ike', location: 'Lagos', phone: '+234 807 890 1234', product: 'Roma Tomatoes × 50kg', amount: 35000, status: 'delivered', time: '4d ago', avatar: 'CI', color: '#27500A', items: 1 },
  { id: 'ORD-8813', buyer: 'Ibrahim Sule', location: 'Kaduna', phone: '+234 808 901 2345', product: 'Onion × 30kg', amount: 13500, status: 'delivered', time: '5d ago', avatar: 'IS', color: '#27500A', items: 1 },
];

const tabs = ['new', 'dispatched', 'delivered'] as const;
type Tab = typeof tabs[number];
const tabLabel: Record<Tab, string> = { new: 'New', dispatched: 'Dispatched', delivered: 'Delivered' };
const statusStyle: Record<Tab, { bg: string; color: string }> = {
  new: { bg: '#FAEEDA', color: '#854F0B' },
  dispatched: { bg: '#E6F1FB', color: '#185FA5' },
  delivered: { bg: '#EAF3DE', color: '#27500A' },
};

export function FarmerOrders({ profile }: { profile?: any }) {
  const [tab, setTab] = useState<Tab>('new');
  const [dispatched, setDispatched] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [allOrders, setAllOrders] = useState<typeof demoOrders>([]);

  const isNewUser = profile && !profile.isDemo;

  useEffect(() => {
    if (isNewUser) {
      // Load real orders from localStorage
      const userOrdersKey = `farmer_orders_${profile.uid}`;
      const stored = localStorage.getItem(userOrdersKey);
      if (stored) {
        setAllOrders(JSON.parse(stored));
      } else {
        setAllOrders([]);
      }
    } else {
      // Show demo orders
      setAllOrders(demoOrders);
    }
  }, [profile, isNewUser]);

  // Show empty state for real users with no orders
  if (isNewUser && allOrders.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-full bg-[#EAF3DE] text-[#27500A] flex items-center justify-center mx-auto mb-5 text-2xl">
          📦
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#27500A', marginBottom: 8 }}>No orders yet</h1>
        <p style={{ fontSize: 13, color: '#5F5E5A', marginBottom: 24, lineHeight: 1.6 }} className="max-w-md mx-auto">
          When consumers purchase your products, their orders will appear here. Start by adding listings to your catalog.
        </p>
      </div>
    );
  }

  const counts: Record<Tab, number> = {
    new: allOrders.filter(o => o.status === 'new').length,
    dispatched: allOrders.filter(o => o.status === 'dispatched').length,
    delivered: allOrders.filter(o => o.status === 'delivered').length,
  };

  const filtered = allOrders
    .filter(o => (dispatched.has(o.id) ? 'dispatched' : o.status) === tab)
    .filter(o => !search || o.buyer.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase()) || o.product.toLowerCase().includes(search.toLowerCase()));

  const totalValue = filtered.reduce((a, b) => a + b.amount, 0);

  const handleDispatch = (id: string) => {
    setDispatched(prev => new Set(prev).add(id));
  };

  return (
    <div className="p-5 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#27500A' }}>Orders</h1>
          <p style={{ fontSize: 13, color: '#5F5E5A' }}>{counts.new} new orders — total value ₦{allOrders.filter(o => o.status === 'new').reduce((a, b) => a + b.amount, 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5F5E5A' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by buyer, order ID or product…"
          className="w-full pl-9 pr-4 rounded-lg outline-none"
          style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: '#F1EFE8', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg transition-all"
            style={{ fontSize: 12, fontWeight: tab === t ? 500 : 400, background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#27500A' : '#5F5E5A', border: tab === t ? '0.5px solid rgba(0,0,0,0.1)' : 'none' }}>
            {tabLabel[t]}
            {counts[t] > 0 && (
              <span className="ml-2 rounded-full px-1.5 py-0.5"
                style={{ fontSize: 9, background: t === 'new' ? '#FAEEDA' : t === 'dispatched' ? '#E6F1FB' : '#EAF3DE', color: statusStyle[t].color }}>
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div className="rounded-xl p-3 mb-4 flex items-center justify-between"
          style={{ background: '#F7F6F2', border: '0.5px solid rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: 12, color: '#5F5E5A' }}>{filtered.length} orders</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#27500A' }}>Total: ₦{totalValue.toLocaleString()}</span>
        </div>
      )}

      {/* Orders */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-xl p-12 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
            <p style={{ fontSize: 14, color: '#5F5E5A' }}>No {tab} orders{search ? ` matching "${search}"` : ''}</p>
          </div>
        )}
        {filtered.map(order => {
          const effectiveStatus = dispatched.has(order.id) ? 'dispatched' : order.status as Tab;
          const s = statusStyle[effectiveStatus];
          const isExpanded = expanded === order.id;
          return (
            <div key={order.id} className="rounded-xl overflow-hidden"
              style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: order.color, fontSize: 12, fontWeight: 500 }}>{order.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>{order.buyer}</p>
                        <p style={{ fontSize: 11, color: '#5F5E5A' }}>{order.location} · {order.time}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, background: s.bg, color: s.color }}>
                          {dispatched.has(order.id) ? 'Dispatched' : effectiveStatus}
                        </span>
                        <button onClick={() => setExpanded(isExpanded ? null : order.id)}
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                          {isExpanded ? <ChevronUp size={14} style={{ color: '#5F5E5A' }} /> : <ChevronDown size={14} style={{ color: '#5F5E5A' }} />}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 rounded-xl px-3 py-2.5" style={{ background: '#F7F6F2' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p style={{ fontSize: 12, color: '#444441' }}>{order.product}</p>
                          <p style={{ fontSize: 10, color: '#5F5E5A' }}>{order.id} · {order.items} item{order.items > 1 ? 's' : ''}</p>
                        </div>
                        <p style={{ fontSize: 16, fontWeight: 500, color: '#27500A' }}>₦{order.amount.toLocaleString()}</p>
                      </div>
                    </div>
                    {order.status === 'new' && !dispatched.has(order.id) && (
                      <button onClick={() => handleDispatch(order.id)}
                        className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg transition-all active:scale-[0.98]"
                        style={{ background: '#27500A', color: '#fff', fontSize: 12 }}>
                        <Truck size={13} /> Mark as dispatched
                      </button>
                    )}
                    {dispatched.has(order.id) && (
                      <p className="mt-2" style={{ fontSize: 11, color: '#27500A' }}>✓ Marked as dispatched — buyer will be notified</p>
                    )}
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="px-4 pb-4 pt-2" style={{ background: '#FAFAF8', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 500, color: '#444441', marginBottom: 8 }}>Buyer contact</h4>
                  <div className="flex gap-2">
                    <a href={`tel:${order.phone}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
                      style={{ background: '#EAF3DE', border: '0.5px solid #3B6D11', fontSize: 12, color: '#27500A', textDecoration: 'none' }}>
                      <Phone size={12} /> {order.phone}
                    </a>
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
                      style={{ background: '#E6F1FB', border: '0.5px solid #185FA5', fontSize: 12, color: '#185FA5' }}>
                      <MessageCircle size={12} /> Message
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      ['Gross amount', `₦${order.amount.toLocaleString()}`],
                      ['Platform fee (3%)', `−₦${(order.amount * 0.03).toFixed(0)}`],
                      ['Net payout', `₦${(order.amount * 0.97).toFixed(0)}`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg p-2" style={{ background: '#F7F6F2' }}>
                        <p style={{ fontSize: 9, color: '#5F5E5A' }}>{k}</p>
                        <p style={{ fontSize: 12, fontWeight: 500, color: k === 'Platform fee (3%)' ? '#A32D2D' : '#27500A' }}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
