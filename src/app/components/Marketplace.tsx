import React, { useState, useEffect } from 'react';
import { Search, Star, ShoppingCart, Heart, Filter, SlidersHorizontal, MapPin, Award } from 'lucide-react';
import { Screen } from './types';
import { subscribeToMarketplaceProducts, addToCart, auth } from '../firebase';

interface Props {
  onNavigate: (s: Screen, productId?: string) => void;
  onAddToCart: () => void;
}

const categories = ['All', 'Vegetables', 'Grains', 'Fruits', 'Spices', 'Tubers', 'Legumes'];
const states = ['All States', 'Kaduna', 'Kano', 'Lagos', 'Plateau', 'Enugu', 'Niger', 'Oyo'];



export function Marketplace({ onNavigate, onAddToCart }: Props) {
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const unsub = subscribeToMarketplaceProducts((items) => {
      // normalize shape to match what the rest of the component expects
      const mapped = items.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        unit: p.unit,
        farmerUid: p.farmerUid || '',
        farmer: p.farmerName || 'FarmX Farmer',
        location: p.farmState || 'Nigeria',
        rating: 4.5,
        reviews: 0,
        qty: p.qty ?? 0,
        emoji: '🌾',
        image: p.images?.[0] || null,
        verified: false,
        organic: false,
        discount: 0,
      }));
      setProducts(mapped);
      setLoadingProducts(false);
    });
    return () => unsub();
  }, []);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [stateFilter, setStateFilter] = useState('All States');
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [organicOnly, setOrganicOnly] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filtered = products
    .filter(p => category === 'All' || p.category === category)
    .filter(p => stateFilter === 'All States' || p.location === stateFilter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.farmer.toLowerCase().includes(search.toLowerCase()))
    .filter(p => !verifiedOnly || p.verified)
    .filter(p => !organicOnly || p.organic)
    .filter(p => !priceMin || p.price >= Number(priceMin))
    .filter(p => !priceMax || p.price <= Number(priceMax))
    .sort((a, b) => {
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'rating') return b.rating - a.rating;
      if (sort === 'popular') return b.reviews - a.reviews;
      return 0;
    });

  const handleAdd = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (addedIds.has(id)) return;
    setAddedIds(prev => new Set(prev).add(id));
    onAddToCart();

    const uid = auth.currentUser?.uid;
    const product = products.find(p => p.id === id);
    if (uid && product) {
      addToCart(uid, {
        id: product.id,
        name: product.name,
        farmerUid: product.farmerUid,
        farmerName: product.farmer,
        price: product.price,
        unit: product.unit,
        emoji: product.emoji,
        image: product.image,
      }).catch(err => console.error('Failed to add item to cart:', err));
    }
  };

  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const effectivePrice = (p: typeof products[0]) => p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;

  return (
    <div className="p-5 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#0C447C' }}>Marketplace</h1>
        <p style={{ fontSize: 13, color: '#5F5E5A' }}>Fresh produce direct from {[...new Set(products.map(p => p.farmer))].length} farms across Nigeria</p>
      </div>

      {/* Search + controls */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5F5E5A' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products or farmers…"
            className="w-full pl-9 pr-4 rounded-lg outline-none"
            style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="px-3 rounded-lg outline-none"
          style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 12, color: '#444441', background: '#F7F6F2' }}
          aria-label="Sort products">
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="rating">Top rated</option>
          <option value="popular">Most popular</option>
        </select>
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 rounded-lg"
          style={{ height: 36, border: `0.5px solid ${showFilters ? '#185FA5' : 'rgba(0,0,0,0.2)'}`, background: showFilters ? '#E6F1FB' : '#F7F6F2', fontSize: 12, color: showFilters ? '#185FA5' : '#5F5E5A' }}
          aria-label="Toggle filters">
          <SlidersHorizontal size={13} /> Filters
        </button>
      </div>

      {/* Filters drawer */}
      {showFilters && (
        <div className="rounded-xl p-4 mb-4" style={{ border: '0.5px solid rgba(24,95,165,0.2)', background: '#E6F1FB' }}>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 5 }}>State</label>
              <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
                className="w-full px-3 rounded-lg outline-none"
                style={{ height: 34, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 12, color: '#444441', background: '#fff' }}>
                {states.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 5 }}>Price range (₦/unit)</label>
              <div className="flex gap-2">
                <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="Min"
                  className="flex-1 px-2 rounded-lg outline-none"
                  style={{ height: 34, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 12, color: '#444441', background: '#fff' }} />
                <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="Max"
                  className="flex-1 px-2 rounded-lg outline-none"
                  style={{ height: 34, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 12, color: '#444441', background: '#fff' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 8 }}>Options</label>
              <div className="space-y-2">
                {[
                  { label: 'Verified farmers only', value: verifiedOnly, set: setVerifiedOnly },
                  { label: 'Organic produce only', value: organicOnly, set: setOrganicOnly },
                ].map(opt => (
                  <label key={opt.label} className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => opt.set(!opt.value)}
                      className="w-4 h-4 rounded flex items-center justify-center"
                      style={{ background: opt.value ? '#185FA5' : '#fff', border: `1px solid ${opt.value ? '#185FA5' : 'rgba(0,0,0,0.2)'}` }}>
                      {opt.value && <span className="text-white" style={{ fontSize: 10 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 11, color: '#444441' }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className="px-3 py-1.5 rounded-full transition-all"
            style={{ fontSize: 12, background: category === c ? '#185FA5' : '#F1EFE8', color: category === c ? '#fff' : '#5F5E5A', border: '0.5px solid rgba(0,0,0,0.08)' }}>
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 12, color: '#5F5E5A' }}>{filtered.length} products found</p>
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ border: '0.5px solid rgba(0,0,0,0.1)' }}>
          {(['grid', 'list'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className="px-2 py-1 rounded"
              style={{ fontSize: 11, background: viewMode === m ? '#F1EFE8' : 'transparent', color: viewMode === m ? '#27500A' : '#5F5E5A' }}>
              {m === 'grid' ? '⊞' : '≡'} {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid / list */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => {
            const ep = effectivePrice(p);
            const added = addedIds.has(p.id);
            const liked = likedIds.has(p.id);
            return (
              <div key={p.id} onClick={() => onNavigate('product-detail', p.id)}
                className="rounded-xl overflow-hidden cursor-pointer transition-all group"
                style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
                <div className="h-28 flex items-center justify-center relative" style={{ background: '#F7F6F2' }}>
                  {p.image ? (<img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                              <span style={{ fontSize: 42 }}>{p.emoji}</span>
                        )}
                  {!loadingProducts && products.length === 0 && (
                    <div className="rounded-xl p-16 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
                        <span style={{ fontSize: 36 }}>🌾</span>
                        <p style={{ fontSize: 14, color: '#5F5E5A', marginTop: 8 }}>No products listed yet. Check back soon!</p>
                    </div>
                  )}
                  {p.discount > 0 && (
                    <div className="absolute top-2 left-2 rounded-full px-1.5 py-0.5" style={{ background: '#A32D2D', fontSize: 9, color: '#fff' }}>
                      -{p.discount}%
                    </div>
                  )}
                  {p.organic && (
                    <div className="absolute top-2 left-2 rounded-full px-1.5 py-0.5" style={{ background: '#27500A', fontSize: 9, color: '#fff', marginLeft: p.discount ? 32 : 0 }}>
                      🌿 Organic
                    </div>
                  )}
                  <button onClick={e => toggleLike(p.id, e)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: liked ? '#FCEBEB' : 'rgba(255,255,255,0.8)' }}
                    aria-label={liked ? 'Remove from favourites' : 'Add to favourites'}>
                    <Heart size={12} style={{ color: liked ? '#A32D2D' : '#5F5E5A', fill: liked ? '#A32D2D' : 'none' }} />
                  </button>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>{p.name}</p>
                    {p.verified && <Award size={11} style={{ color: '#3B6D11', flexShrink: 0 }} aria-label="Verified farmer" />}
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <MapPin size={9} style={{ color: '#5F5E5A' }} aria-hidden="true" />
                    <p style={{ fontSize: 10, color: '#5F5E5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.farmer} · {p.location}</p>
                  </div>
                  <div className="flex items-center gap-1 mb-3">
                    <Star size={10} style={{ color: '#854F0B', fill: '#854F0B' }} aria-hidden="true" />
                    <span style={{ fontSize: 10, color: '#854F0B' }}>{p.rating}</span>
                    <span style={{ fontSize: 10, color: '#5F5E5A' }}>({p.reviews})</span>
                    <span className="ml-auto rounded-full px-1.5 py-0.5" style={{ fontSize: 8, background: p.qty < 100 ? '#FAEEDA' : '#EAF3DE', color: p.qty < 100 ? '#854F0B' : '#27500A' }}>
                      {p.qty < 100 ? 'Low stock' : 'In stock'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      {p.discount > 0 && <span style={{ fontSize: 10, color: '#5F5E5A', textDecoration: 'line-through' }}>₦{p.price.toLocaleString()} </span>}
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#185FA5' }}>₦{ep.toLocaleString()}</span>
                      <span style={{ fontSize: 10, color: '#5F5E5A' }}>/{p.unit}</span>
                    </div>
                    <button onClick={e => handleAdd(p.id, e)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-[0.95]"
                      style={{ background: added ? '#EAF3DE' : '#185FA5' }}
                      aria-label={`Add ${p.name} to cart`}>
                      <ShoppingCart size={13} style={{ color: added ? '#27500A' : '#fff' }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const ep = effectivePrice(p);
            const added = addedIds.has(p.id);
            return (
              <div key={p.id} onClick={() => onNavigate('product-detail', p.id)}
                className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all"
                style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F7F6F2', fontSize: 28 }}>
                  {p.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>{p.name}</p>
                    {p.verified && <Award size={11} style={{ color: '#3B6D11' }} />}
                    {p.organic && <span style={{ fontSize: 9, color: '#27500A', background: '#EAF3DE', padding: '1px 4px', borderRadius: 4 }}>Organic</span>}
                  </div>
                  <p style={{ fontSize: 11, color: '#5F5E5A' }}>{p.farmer} · {p.location}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Star size={10} style={{ color: '#854F0B', fill: '#854F0B' }} aria-hidden="true" />
                    <span style={{ fontSize: 10, color: '#854F0B' }}>{p.rating} ({p.reviews})</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#185FA5' }}>₦{ep.toLocaleString()}<span style={{ fontSize: 10, fontWeight: 400, color: '#5F5E5A' }}>/{p.unit}</span></p>
                  <button onClick={e => handleAdd(p.id, e)} className="mt-1 px-3 py-1 rounded-lg"
                    style={{ fontSize: 11, background: added ? '#EAF3DE' : '#185FA5', color: added ? '#27500A' : '#fff' }}>
                    {added ? '✓ Added' : '+ Cart'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="rounded-xl p-16 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
          <span style={{ fontSize: 36 }}>🔍</span>
          <p style={{ fontSize: 14, color: '#5F5E5A', marginTop: 8 }}>No products match your filters</p>
          <button onClick={() => { setSearch(''); setCategory('All'); setStateFilter('All States'); setVerifiedOnly(false); setOrganicOnly(false); }}
            style={{ fontSize: 12, color: '#185FA5', marginTop: 8, display: 'block', margin: '8px auto 0' }}>
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}