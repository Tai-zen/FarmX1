import React, { useState, useEffect } from 'react';
import { Users, ShoppingBag, TrendingUp, Package, RefreshCw, ChevronRight, Search } from 'lucide-react';
import { Screen } from './types';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';

interface Props {
  onNavigate: (s: Screen) => void;
  profile?: any;
}

const statusStyle = (s: string) => {
  if (s === 'dispatched' || s === 'in_transit') return { bg: '#E6F1FB', color: '#185FA5', label: 'In transit' };
  if (s === 'delivered') return { bg: '#EAF3DE', color: '#27500A', label: 'Delivered' };
  if (s === 'new' || s === 'placed') return { bg: '#FAEEDA', color: '#854F0B', label: 'New' };
  if (s === 'packed') return { bg: '#F3E8FF', color: '#6B21A8', label: 'Packed' };
  return { bg: '#F1EFE8', color: '#5F5E5A', label: s };
};

export function AdminDashboard({ onNavigate, profile }: Props) {
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'users'>('overview');

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(docs);
      setLoading(false);
    }, (err) => {
      console.error('Admin orders error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, 'user_profiles'));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(docs);
      } catch (err) {
        console.error('Admin users error:', err);
      }
    }
    fetchUsers();
  }, []);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const newOrders = orders.filter(o => o.status === 'new' || o.status === 'placed').length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const farmers = users.filter(u => u.role === 'farmer').length;
  const consumers = users.filter(u => u.role === 'consumer').length;

  const filteredOrders = orders.filter(o => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      (o.id || '').toLowerCase().includes(t) ||
      (o.buyerName || '').toLowerCase().includes(t) ||
      (o.farmerName || '').toLowerCase().includes(t) ||
      (o.product || '').toLowerCase().includes(t)
    );
  });

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      (u.fullName || '').toLowerCase().includes(t) ||
      (u.email || '').toLowerCase().includes(t) ||
      (u.role || '').toLowerCase().includes(t)
    );
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <RefreshCw size={28} className="animate-spin" style={{ color: '#185FA5' }} />
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#444441' }}>Admin dashboard</h1>
        <p style={{ fontSize: 13, color: '#5F5E5A' }}>
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Platform overview
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total revenue', value: `₦${totalRevenue.toLocaleString()}`, sub: `${orders.length} orders total`, color: '#27500A', bg: '#EAF3DE', icon: TrendingUp },
          { label: 'New orders', value: String(newOrders), sub: `${deliveredOrders} delivered`, color: '#854F0B', bg: '#FAEEDA', icon: Package },
          { label: 'Registered farmers', value: String(farmers), sub: `${consumers} consumers`, color: '#185FA5', bg: '#E6F1FB', icon: Users },
          { label: 'Total users', value: String(users.length), sub: `${users.filter(u => u.role === 'admin').length} admin(s)`, color: '#5F5E5A', bg: '#F1EFE8', icon: ShoppingBag },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: c.bg }}>
              <c.icon size={14} style={{ color: c.color }} />
            </div>
            <p style={{ fontSize: 10, color: '#5F5E5A', marginBottom: 1 }}>{c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 500, color: '#444441' }}>{c.value}</p>
            <p style={{ fontSize: 10, color: c.color, marginTop: 1 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: '#F1EFE8', width: 'fit-content' }}>
        {(['overview', 'orders', 'users'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg capitalize transition-all"
            style={{ background: activeTab === tab ? '#fff' : 'transparent', fontSize: 13, fontWeight: activeTab === tab ? 500 : 400, color: activeTab === tab ? '#444441' : '#5F5E5A', boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      {(activeTab === 'orders' || activeTab === 'users') && (
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5F5E5A' }} />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder={activeTab === 'orders' ? 'Search orders by ID, buyer, or product…' : 'Search users by name or email…'}
            className="w-full pl-9 pr-4 rounded-xl outline-none"
            style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 13, color: '#444441', background: '#fff' }} />
        </div>
      )}

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Recent orders */}
          <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Recent orders</h2>
              <button onClick={() => setActiveTab('orders')} style={{ fontSize: 11, color: '#185FA5' }} className="flex items-center gap-0.5">
                View all <ChevronRight size={12} />
              </button>
            </div>
            <div className="space-y-2.5">
              {orders.slice(0, 6).map(o => {
                const s = statusStyle(o.status);
                return (
                  <div key={o.id} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F7F6F2', fontSize: 16 }}>
                      🌾
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 11, fontWeight: 500, color: '#444441', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.product || 'Product'} · {o.buyerName || 'Buyer'}
                      </p>
                      <p style={{ fontSize: 10, color: '#5F5E5A' }}>
                        ₦{(o.amount || 0).toLocaleString()} ·&nbsp;
                        {o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : 'Recently'}
                      </p>
                    </div>
                    <span className="rounded-full px-1.5 py-0.5 flex-shrink-0" style={{ fontSize: 9, background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                );
              })}
              {orders.length === 0 && (
                <p style={{ fontSize: 12, color: '#5F5E5A', textAlign: 'center', padding: '16px 0' }}>No orders yet</p>
              )}
            </div>
          </div>

          {/* Recent users */}
          <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Registered users</h2>
              <button onClick={() => setActiveTab('users')} style={{ fontSize: 11, color: '#185FA5' }} className="flex items-center gap-0.5">
                View all <ChevronRight size={12} />
              </button>
            </div>
            <div className="space-y-2.5">
              {users.slice(0, 6).map(u => {
                const initials = (u.fullName || 'U').split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                const roleColor = u.role === 'farmer' ? { bg: '#EAF3DE', color: '#27500A' } : u.role === 'admin' ? { bg: '#F3E8FF', color: '#6B21A8' } : { bg: '#E6F1FB', color: '#185FA5' };
                return (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: roleColor.color, fontSize: 11, fontWeight: 500 }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 11, fontWeight: 500, color: '#444441', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.fullName || 'User'}</p>
                      <p style={{ fontSize: 10, color: '#5F5E5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || ''}</p>
                    </div>
                    <span className="rounded-full px-1.5 py-0.5 flex-shrink-0" style={{ fontSize: 9, background: roleColor.bg, color: roleColor.color }}>{u.role}</span>
                  </div>
                );
              })}
              {users.length === 0 && (
                <p style={{ fontSize: 12, color: '#5F5E5A', textAlign: 'center', padding: '16px 0' }}>No users yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders tab */}
      {activeTab === 'orders' && (
        <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>{filteredOrders.length} orders</p>
          </div>
          <div className="divide-y" style={{ divideColor: 'rgba(0,0,0,0.05)' }}>
            {filteredOrders.map(o => {
              const s = statusStyle(o.status);
              return (
                <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F7F6F2', fontSize: 16 }}>🌾</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>{o.product || 'Product'}</p>
                      <span style={{ fontSize: 9, color: '#5F5E5A' }}>#{(o.id || '').slice(-6).toUpperCase()}</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#5F5E5A' }}>
                      Buyer: {o.buyerName || '—'} · Farmer: {o.farmerName || '—'} · ₦{(o.amount || 0).toLocaleString()}
                    </p>
                    <p style={{ fontSize: 10, color: '#5F5E5A' }}>
                      {o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toLocaleString('en-NG') : ''}
                    </p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 flex-shrink-0" style={{ fontSize: 9, background: s.bg, color: s.color }}>{s.label}</span>
                </div>
              );
            })}
            {filteredOrders.length === 0 && (
              <div className="py-12 text-center">
                <p style={{ fontSize: 13, color: '#5F5E5A' }}>No orders found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>{filteredUsers.length} users</p>
          </div>
          <div className="divide-y" style={{ divideColor: 'rgba(0,0,0,0.05)' }}>
            {filteredUsers.map(u => {
              const initials = (u.fullName || 'U').split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              const roleColor = u.role === 'farmer' ? { bg: '#EAF3DE', color: '#27500A' } : u.role === 'admin' ? { bg: '#F3E8FF', color: '#6B21A8' } : { bg: '#E6F1FB', color: '#185FA5' };
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: roleColor.color, fontSize: 12, fontWeight: 600 }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>{u.fullName || 'Unknown User'}</p>
                    <p style={{ fontSize: 11, color: '#5F5E5A' }}>{u.email || '—'}</p>
                    {u.role === 'farmer' && u.farmName && (
                      <p style={{ fontSize: 10, color: '#5F5E5A' }}>{u.farmName} · {u.farmState}</p>
                    )}
                    {u.role === 'consumer' && u.deliveryAddress && (
                      <p style={{ fontSize: 10, color: '#5F5E5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.deliveryAddress}</p>
                    )}
                  </div>
                  <span className="rounded-full px-2 py-0.5 flex-shrink-0 capitalize" style={{ fontSize: 9, background: roleColor.bg, color: roleColor.color }}>{u.role}</span>
                </div>
              );
            })}
            {filteredUsers.length === 0 && (
              <div className="py-12 text-center">
                <p style={{ fontSize: 13, color: '#5F5E5A' }}>No users found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
