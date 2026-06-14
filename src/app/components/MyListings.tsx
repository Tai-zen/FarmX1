import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Archive, MoreHorizontal } from 'lucide-react';
import { Screen } from './types';
import { subscribeToFarmerProducts } from '../firebase';

interface Props { onNavigate: (s: Screen) => void; profile?: any; }

const demoListings = [
  { id: 'L001', name: 'Roma Tomatoes', category: 'Vegetables', price: 700, unit: 'kg', qty: 850, sold: 320, status: 'in_stock', img: '🍅' },
  { id: 'L002', name: 'Sweet Pepper', category: 'Vegetables', price: 850, unit: 'kg', qty: 45, sold: 180, status: 'low_stock', img: '🌶️' },
  { id: 'L003', name: 'White Onion', category: 'Vegetables', price: 450, unit: 'kg', qty: 0, sold: 500, status: 'out_of_stock', img: '🧅' },
  { id: 'L004', name: 'Maize (Dried)', category: 'Grains', price: 350, unit: 'kg', qty: 2000, sold: 800, status: 'in_stock', img: '🌽' },
  { id: 'L005', name: 'Fresh Ginger', category: 'Spices', price: 1200, unit: 'kg', qty: 120, sold: 65, status: 'in_stock', img: '🫚' },
  { id: 'L006', name: 'Cowpea', category: 'Grains', price: 600, unit: 'kg', qty: 0, sold: 250, status: 'archived', img: '🫘' },
];

const statusBadge = (s: string) => {
  if (s === 'in_stock') return { label: 'In stock', bg: '#EAF3DE', color: '#27500A' };
  if (s === 'low_stock') return { label: 'Low stock', bg: '#FAEEDA', color: '#854F0B' };
  if (s === 'out_of_stock') return { label: 'Out of stock', bg: '#FCEBEB', color: '#A32D2D' };
  return { label: 'Archived', bg: '#F1EFE8', color: '#5F5E5A' };
};

export function MyListings({ onNavigate, profile }: Props) {
  const [filter, setFilter] = useState('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [userListings, setUserListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // isDemo flag drives demo mode — real authenticated users always get Firestore data
  const isDemo = profile?.isDemo === true;

  useEffect(() => {
    if (isDemo) {
      setUserListings(demoListings);
      setLoading(false);
      return;
    }

    const uid = profile?.uid;
    if (!uid) {
      setUserListings([]);
      setLoading(false);
      return;
    }

    const unsub = subscribeToFarmerProducts(uid, (items) => {
      setUserListings(items);
      setLoading(false);
    });
    return () => unsub();
  }, [profile, isDemo]);

  const filtered = filter === 'all' ? userListings : userListings.filter(l => l.status === filter);

  if (loading) {
    return (
      <div className="p-5 lg:p-6 max-w-5xl mx-auto">
        <div className="rounded-xl p-16 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
          <p style={{ fontSize: 14, color: '#5F5E5A' }}>Loading your listings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#27500A' }}>My listings</h1>
          <p style={{ fontSize: 13, color: '#5F5E5A' }}>{userListings.filter(l => l.status !== 'archived').length} active products</p>
        </div>
        <button onClick={() => onNavigate('add-listing')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all active:scale-[0.98]"
          style={{ background: '#27500A', color: '#fff', fontSize: 13 }}>
          <Plus size={14} /> Add listing
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { key: 'all', label: 'All' },
          { key: 'in_stock', label: 'In stock' },
          { key: 'low_stock', label: 'Low stock' },
          { key: 'out_of_stock', label: 'Out of stock' },
          { key: 'archived', label: 'Archived' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-lg"
            style={{
              fontSize: 12,
              background: filter === f.key ? '#27500A' : '#F1EFE8',
              color: filter === f.key ? '#fff' : '#5F5E5A',
              border: '0.5px solid rgba(0,0,0,0.1)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Empty state for real users with no listings */}
      {!isDemo && userListings.length === 0 && (
        <div className="rounded-xl p-16 text-center" style={{ border: '1px dashed #3B6D11', background: '#F7F6F2' }}>
          <span style={{ fontSize: 40 }}>🌾</span>
          <p style={{ fontSize: 14, color: '#5F5E5A', marginTop: 12, marginBottom: 16 }}>
            You haven't added any listings yet.
          </p>
          <button onClick={() => onNavigate('add-listing')}
            className="px-6 py-2 rounded-lg"
            style={{ background: '#27500A', color: '#fff', fontSize: 13 }}>
            Add your first listing
          </button>
        </div>
      )}

      {/* Grid */}
      {(isDemo || userListings.length > 0) && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(listing => {
            const badge = statusBadge(listing.status);
            return (
              <div key={listing.id} className="rounded-xl overflow-hidden" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
                {/* Image area */}
                <div className="h-36 flex items-center justify-center relative overflow-hidden"
                  style={{ background: '#F7F6F2', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                  {listing.images?.[0] ? (
                    <img src={listing.images[0]} alt={listing.name} className="w-full h-full object-cover" />
                  ) : (
                    <span style={{ fontSize: 52 }}>{listing.img || '🌾'}</span>
                  )}
                  <div className="absolute top-2 right-2 relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === listing.id ? null : listing.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)' }}
                      aria-label="Listing options"
                    >
                      <MoreHorizontal size={14} style={{ color: '#5F5E5A' }} />
                    </button>
                    {openMenu === listing.id && (
                      <div className="absolute right-0 mt-1 rounded-xl overflow-hidden z-10"
                        style={{ width: 140, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-left"
                          style={{ fontSize: 12, color: '#444441' }}
                          onClick={() => setOpenMenu(null)}>
                          <Edit2 size={12} /> Edit listing
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-left"
                          style={{ fontSize: 12, color: '#5F5E5A' }}
                          onClick={() => setOpenMenu(null)}>
                          <Archive size={12} /> Archive
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>{listing.name}</p>
                      <p style={{ fontSize: 11, color: '#5F5E5A' }}>{listing.category}</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 mb-3">
                    <span style={{ fontSize: 16, fontWeight: 500, color: '#27500A' }}>₦{listing.price.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: '#5F5E5A' }}>/ {listing.unit}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2 text-center" style={{ background: '#F7F6F2' }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>{(listing.qty ?? 0).toLocaleString()}{listing.unit}</p>
                      <p style={{ fontSize: 10, color: '#5F5E5A' }}>Available</p>
                    </div>
                    <div className="rounded-lg p-2 text-center" style={{ background: '#F7F6F2' }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>{(listing.sold ?? 0).toLocaleString()}{listing.unit}</p>
                      <p style={{ fontSize: 10, color: '#5F5E5A' }}>Sold</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add listing card */}
          <button
            onClick={() => onNavigate('add-listing')}
            className="rounded-xl flex flex-col items-center justify-center p-8 transition-all"
            style={{ border: '1px dashed #3B6D11', background: '#F7F6F2', minHeight: 200 }}
            aria-label="Add new listing"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: '#EAF3DE' }}>
              <Plus size={20} style={{ color: '#27500A' }} />
            </div>
            <p style={{ fontSize: 13, color: '#27500A', fontWeight: 500 }}>Add new listing</p>
          </button>
        </div>
      )}
    </div>
  );
}