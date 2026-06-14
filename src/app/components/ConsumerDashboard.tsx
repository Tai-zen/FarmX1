import React, { useState, useEffect } from 'react';
import { ChevronRight, ShoppingBag, Star, TrendingDown, Package, Heart, MapPin } from 'lucide-react';
import { Screen } from './types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { getRegisteredFarmers, subscribeToConsumerOrders, auth } from '../firebase';

interface Props { onNavigate: (s: Screen) => void; profile?: any; }

// Demo-only static data
const demoRecentOrders = [
  { id: 'ORD-0221', product: 'Roma Tomatoes × 5kg', farmer: 'Aminu Danjuma', location: 'Kaduna', amount: 3500, status: 'in_transit', date: '3 Jun', emoji: '🍅', eta: 'Today' },
  { id: 'ORD-0220', product: 'Maize (Dried) × 10kg', farmer: 'Blessing Okafor', location: 'Plateau', amount: 3500, status: 'delivered', date: '1 Jun', emoji: '🌽', eta: 'Delivered' },
  { id: 'ORD-0219', product: 'White Onion × 3kg', farmer: 'Musa Ibrahim', location: 'Kano', amount: 1350, status: 'delivered', date: '28 May', emoji: '🧅', eta: 'Delivered' },
  { id: 'ORD-0218', product: 'Fresh Ginger × 1kg', farmer: 'Aminu Danjuma', location: 'Kaduna', amount: 1200, status: 'delivered', date: '26 May', emoji: '🫚', eta: 'Delivered' },
];

const savedFarmersFallback = [
  { name: 'Aminu Danjuma', farm: 'Danjuma Farm', location: 'Kaduna', rating: 4.9, orders: 12, initials: 'AD', color: '#27500A' },
  { name: 'Blessing Okafor', farm: 'Blessing Farms', location: 'Plateau', rating: 4.7, orders: 5, initials: 'BO', color: '#3B6D11' },
  { name: 'Musa Ibrahim', farm: 'Ibrahim Fresh', location: 'Kano', rating: 4.8, orders: 3, initials: 'MI', color: '#185FA5' },
];

const demoSpendData = [
  { name: 'Vegetables', value: 12800, color: '#3B6D11' },
  { name: 'Grains', value: 7000, color: '#639922' },
  { name: 'Fruits', value: 3200, color: '#185FA5' },
  { name: 'Spices', value: 2400, color: '#854F0B' },
];

const demoWeeklySpend = [
  { week: 'W1 May', amount: 4200 },
  { week: 'W2 May', amount: 6800 },
  { week: 'W3 May', amount: 3500 },
  { week: 'W4 May', amount: 8400 },
  { week: 'W1 Jun', amount: 5100 },
  { week: 'W2 Jun', amount: 9400 },
];

const recommendations = [
  { name: 'Irish Potato', price: 550, unit: 'kg', farmer: 'Jos Farms', reason: 'In season now', emoji: '🥔' },
  { name: 'Cowpea', price: 600, unit: 'kg', farmer: 'Blessing Okafor', reason: 'Your regular pick', emoji: '🫘' },
  { name: 'Watermelon', price: 2500, unit: 'piece', farmer: 'Fatima Farms', reason: 'Peak summer fruit', emoji: '🍉' },
];

const statusStyle = (s: string) => {
  if (s === 'in_transit' || s === 'dispatched') return { bg: '#E6F1FB', color: '#185FA5', label: 'In transit' };
  if (s === 'delivered') return { bg: '#EAF3DE', color: '#27500A', label: 'Delivered' };
  if (s === 'placed' || s === 'new') return { bg: '#FAEEDA', color: '#854F0B', label: 'Processing' };
  return { bg: '#F1EFE8', color: '#5F5E5A', label: s };
};

export function ConsumerDashboard({ onNavigate, profile }: Props) {
  const [likedRec, setLikedRec] = useState<Set<string>>(new Set());
  const [dynamicFarmers, setDynamicFarmers] = useState<any[]>([]);

  // ── FIX: subscribe to real consumer orders ──────────────────────────────────
  const [realOrders, setRealOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const isDemo = profile?.isDemo === true;

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || isDemo) {
      setOrdersLoading(false);
      return;
    }
    const unsub = subscribeToConsumerOrders(uid, (orders) => {
      setRealOrders(orders);
      setOrdersLoading(false);
    });
    return () => unsub();
  }, [isDemo]);
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadFarmers() {
      const dbFarmers = await getRegisteredFarmers();
      if (dbFarmers && dbFarmers.length > 0) {
        const mapped = dbFarmers.map((df: any, idx: number) => ({
          name: df.fullName || 'Anonymous Farmer',
          farm: df.farmName || 'Premier Fields',
          location: df.farmState || 'Nigeria',
          rating: 4.8 + (idx % 3) * 0.1,
          orders: 2 + (idx % 5),
          initials: (df.fullName || 'F')
            .split(' ')
            .filter(Boolean)
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'F',
          color: ['#27500A', '#3B6D11', '#185FA5', '#854F0B'][idx % 4]
        }));
        setDynamicFarmers(mapped);
      }
    }
    loadFarmers();
  }, []);

  const displayName = profile ? profile.fullName.split(' ')[0] : 'Chioma';
  const displayLocation = profile ? (profile.deliveryAddress?.split(',').slice(-2).join(',') || 'Lagos') : 'Lagos Island';

  // ── FIX: derive all metrics from real orders for non-demo users ─────────────
  const listOrders: any[] = isDemo
    ? demoRecentOrders
    : realOrders.slice(0, 4).map(o => ({
        id: o.id,
        product: o.product || 'Product',
        farmer: o.buyerName || 'Farmer',
        location: o.buyerLocation?.split(',').slice(-1)[0]?.trim() || 'Nigeria',
        amount: o.amount || 0,
        status: o.status || 'new',
        date: o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : 'Recently',
        emoji: '🌾',
        eta: o.status === 'delivered' ? 'Delivered' : 'Pending',
      }));

  const totalSpent = isDemo
    ? demoSpendData.reduce((a, b) => a + b.value, 0)
    : realOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

  const monthOrders = isDemo ? 8 : realOrders.length;
  const inTransitCount = isDemo ? 1 : realOrders.filter(o => o.status === 'dispatched' || o.status === 'new').length;
  const deliveredCount = isDemo ? 7 : realOrders.filter(o => o.status === 'delivered').length;

  const spentValue = isDemo ? `₦${demoSpendData.reduce((a,b)=>a+b.value,0).toLocaleString()}` : `₦${totalSpent.toLocaleString()}`;
  const spentSub = isDemo ? '↑ +12% vs May' : (realOrders.length > 0 ? `${realOrders.length} total orders` : 'No spend recorded');

  const monthOrdersValue = String(monthOrders);
  const monthOrdersSub = `${inTransitCount} in transit · ${deliveredCount} delivered`;

  const totalOrdersValue = isDemo ? '34' : String(realOrders.length);
  const totalOrdersSub = isDemo ? '98% delivery success' : (realOrders.length > 0 ? 'Order history' : 'Ready for your first order');

  // Spend breakdown: for real users, show flat breakdown based on total
  const activeSpendData = isDemo
    ? demoSpendData
    : demoSpendData.map(d => ({ ...d, value: 0 }));

  const activeWeeklyData = isDemo ? demoWeeklySpend : demoWeeklySpend.map(d => ({ ...d, amount: 0 }));
  const displayTotalSpend = isDemo ? demoSpendData.reduce((a,b)=>a+b.value,0) : totalSpent;

  const showTransitBanner = !isDemo && inTransitCount > 0;
  const listFarmers = [...dynamicFarmers, ...(isDemo ? savedFarmersFallback : [])];
  const savedFarmersValue = String(listFarmers.length);
  const savedFarmersSub = listFarmers.length > 0 ? 'Direct farm connections' : 'Build farm connections';
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#0C447C' }}>Good morning, {displayName} 👋</h1>
          <p style={{ fontSize: 13, color: '#5F5E5A' }}>{new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {displayLocation}</p>
        </div>
        <button onClick={() => onNavigate('marketplace')}
          className="px-4 py-2 rounded-lg transition-all active:scale-[0.98]"
          style={{ background: '#185FA5', color: '#fff', fontSize: 13 }}>
          Browse market
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Spent this month', value: spentValue, sub: spentSub, color: '#0C447C', bg: '#E6F1FB' },
          { label: 'Orders this month', value: monthOrdersValue, sub: monthOrdersSub, color: '#27500A', bg: '#EAF3DE' },
          { label: 'Total orders (all)', value: totalOrdersValue, sub: totalOrdersSub, color: '#5F5E5A', bg: '#F1EFE8' },
          { label: 'Saved farmers', value: savedFarmersValue, sub: savedFarmersSub, color: '#854F0B', bg: '#FAEEDA' },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: c.bg }}>
              <ShoppingBag size={14} style={{ color: c.color }} aria-hidden="true" />
            </div>
            <p style={{ fontSize: 10, color: '#5F5E5A', marginBottom: 1 }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 500, color: '#444441' }}>{c.value}</p>
            <p style={{ fontSize: 10, color: c.color, marginTop: 1 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* In-transit banner (real users with active orders) */}
      {showTransitBanner && (
        <div className="rounded-xl p-4 mb-5 flex items-center justify-between"
          style={{ background: '#E6F1FB', border: '0.5px solid rgba(24,95,165,0.25)' }}>
          <div className="flex items-center gap-3">
            <Package size={20} style={{ color: '#185FA5' }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#0C447C' }}>{inTransitCount} order{inTransitCount !== 1 ? 's' : ''} on the way</p>
              <p style={{ fontSize: 11, color: '#185FA5' }}>Track real-time status of your deliveries</p>
            </div>
          </div>
          <button onClick={() => onNavigate('order-tracking')}
            style={{ fontSize: 12, color: '#185FA5', fontWeight: 500 }}
            className="flex items-center gap-0.5">
            Track <ChevronRight size={13} />
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Spend donut */}
        <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441', marginBottom: 2 }}>Spend by category</h2>
          <p style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 4 }}>All time · ₦{displayTotalSpend.toLocaleString()} total</p>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={activeSpendData} cx="50%" cy="50%" innerRadius={38} outerRadius={55} dataKey="value" strokeWidth={0}>
                {activeSpendData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, '']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.12)' }} />
            </PieChart>
          </ResponsiveContainer>
          {displayTotalSpend === 0 ? (
            <p style={{ fontSize: 11, color: '#5F5E5A', textAlign: 'center', marginTop: 8 }}>No spending data yet</p>
          ) : (
            <div className="space-y-2">
              {activeSpendData.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} aria-hidden="true" />
                    <span style={{ fontSize: 11, color: '#5F5E5A' }}>{d.name}</span>
                  </div>
                  <div className="text-right">
                    <span style={{ fontSize: 11, color: '#444441', fontWeight: 500 }}>₦{d.value.toLocaleString()}</span>
                    <span style={{ fontSize: 10, color: '#5F5E5A' }}> · {displayTotalSpend > 0 ? Math.round(d.value / displayTotalSpend * 100) : 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly spend trend */}
        <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441', marginBottom: 2 }}>Weekly spend trend</h2>
          <p style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 8 }}>May – June 2026</p>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={activeWeeklyData}>
              <CartesianGrid stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="week" tick={{ fontSize: 8, fill: '#5F5E5A' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.12)' }} />
              <Line type="monotone" dataKey="amount" stroke="#185FA5" strokeWidth={2} dot={{ fill: '#185FA5', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 rounded-lg p-2.5" style={{ background: '#EAF3DE' }}>
            <p style={{ fontSize: 11, color: '#27500A' }}>💡 Tip: Buying in bulk reduces unit cost by ~15%</p>
          </div>
        </div>

        {/* Recent orders */}
        <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Recent orders</h2>
            <button onClick={() => onNavigate('order-tracking')} style={{ fontSize: 11, color: '#185FA5' }} className="flex items-center gap-0.5">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2.5">
            {ordersLoading ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading orders…</div>
            ) : listOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No purchase history yet. Orders completed at checkout will show up here!
              </div>
            ) : (
              listOrders.map(o => {
                const s = statusStyle(o.status);
                return (
                  <div key={o.id} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F7F6F2', fontSize: 18 }}>
                      {o.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 11, fontWeight: 500, color: '#444441', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.product}</p>
                      <p style={{ fontSize: 10, color: '#5F5E5A' }}>{o.farmer} · {o.date}</p>
                    </div>
                    <span className="rounded-full px-1.5 py-0.5 flex-shrink-0" style={{ fontSize: 9, background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recommended */}
      <div className="rounded-xl p-4 mt-5" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Recommended for you</h2>
          <button onClick={() => onNavigate('marketplace')} style={{ fontSize: 11, color: '#185FA5' }}>See all →</button>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {recommendations.map(r => (
            <div key={r.name} onClick={() => onNavigate('marketplace')}
              className="rounded-xl p-3 cursor-pointer transition-all" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 28 }}>{r.emoji}</span>
                <button onClick={e => { e.stopPropagation(); setLikedRec(p => { const n = new Set(p); n.has(r.name) ? n.delete(r.name) : n.add(r.name); return n; }); }}
                  aria-label={`Save ${r.name}`}>
                  <Heart size={14} style={{ color: likedRec.has(r.name) ? '#A32D2D' : '#5F5E5A', fill: likedRec.has(r.name) ? '#A32D2D' : 'none' }} />
                </button>
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>{r.name}</p>
              <p style={{ fontSize: 10, color: '#5F5E5A' }}>{r.farmer}</p>
              <div className="flex items-center justify-between mt-2">
                <span style={{ fontSize: 13, fontWeight: 500, color: '#185FA5' }}>₦{r.price.toLocaleString()}<span style={{ fontSize: 10, fontWeight: 400, color: '#5F5E5A' }}>/{r.unit}</span></span>
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: 9, background: '#EAF3DE', color: '#27500A' }}>{r.reason}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Saved farmers */}
      <div className="rounded-xl p-4 mt-5" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Saved farmers</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {listFarmers.length === 0 ? (
            <div className="sm:col-span-3 py-6 text-center text-xs text-gray-400">You haven't saved any farmers yet. Browse the marketplace to connect directly!</div>
          ) : (
            listFarmers.map(f => (
              <div key={f.name} onClick={() => onNavigate('marketplace')}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: f.color, fontSize: 12, fontWeight: 500 }}>{f.initials}</div>
                <div className="min-w-0">
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>{f.name}</p>
                  <div className="flex items-center gap-1">
                    <MapPin size={9} style={{ color: '#5F5E5A' }} />
                    <p style={{ fontSize: 10, color: '#5F5E5A' }}>{f.farm} · {f.location}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Star size={10} style={{ color: '#854F0B', fill: '#854F0B' }} />
                    <span style={{ fontSize: 10, color: '#854F0B' }}>{f.rating}</span>
                    <span style={{ fontSize: 10, color: '#5F5E5A' }}>· {f.orders} orders</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}