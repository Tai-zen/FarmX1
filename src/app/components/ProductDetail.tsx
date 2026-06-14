import React, { useState, useEffect } from 'react';
import { ChevronLeft, Star, ShoppingCart, MapPin, Award, Loader } from 'lucide-react';
import { Screen } from './types';
import { auth, addToCart, getProductById } from '../firebase';

interface Props {
  onNavigate: (s: Screen) => void;
  onAddToCart: () => void;
  productId?: string;
}

export function ProductDetail({ onNavigate, onAddToCart, productId }: Props) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    if (!productId) {
      console.warn('[ProductDetail] No productId prop received — check that App passes selectedProductId correctly.');
      setLoading(false);
      return;
    }

    console.log('[ProductDetail] Loading product id:', productId);
    setLoading(true);
    setAdded(false);
    setActiveImg(0);
    setQty(1);
    setProduct(null);

    getProductById(productId)
      .then((data) => {
        if (!data) {
          console.warn('[ProductDetail] getProductById returned null for id:', productId);
        } else {
          console.log('[ProductDetail] Product loaded:', data);
        }
        setProduct(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[ProductDetail] Failed to load product:', err);
        setLoading(false);
      });
  }, [productId]);

  const handleAdd = async () => {
    if (!product || addingToCart) return;
    setAddingToCart(true);

    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        // addToCart signature: (uid, { id, name, farmerUid?, farmerName?, price, unit, emoji?, image? }, qty?)
        await addToCart(
          uid,
          {
            id: product.id,
            name: product.name,
            farmerUid: product.farmerUid,
            farmerName: product.farmerName || 'FarmX Farmer',
            price: product.price,
            unit: product.unit,
            emoji: '🌾',
            image: product.images?.[0] || null,
          },
          qty
        );
      } catch (err) {
        console.error('Failed to add to cart:', err);
      }
    }

    setAdded(true);
    setAddingToCart(false);
    onAddToCart();
  };

  if (loading) {
    return (
      <div className="p-5 lg:p-6 max-w-5xl mx-auto">
        <button onClick={() => onNavigate('marketplace')} className="flex items-center gap-1.5 mb-5"
          style={{ fontSize: 13, color: '#5F5E5A' }}>
          <ChevronLeft size={15} /> Back to marketplace
        </button>
        <div className="rounded-xl p-20 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
          <Loader size={24} className="animate-spin mx-auto mb-3" style={{ color: '#185FA5' }} />
          <p style={{ fontSize: 13, color: '#5F5E5A' }}>Loading product…</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-5 lg:p-6 max-w-5xl mx-auto">
        <button onClick={() => onNavigate('marketplace')} className="flex items-center gap-1.5 mb-5"
          style={{ fontSize: 13, color: '#5F5E5A' }}>
          <ChevronLeft size={15} /> Back to marketplace
        </button>
        <div className="rounded-xl p-20 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
          <span style={{ fontSize: 40 }}>🌾</span>
          <p style={{ fontSize: 14, color: '#5F5E5A', marginTop: 12 }}>Product not found.</p>
          <button onClick={() => onNavigate('marketplace')} className="mt-4 px-6 py-2 rounded-lg"
            style={{ background: '#185FA5', color: '#fff', fontSize: 13 }}>
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  const images: string[] = product.images?.length > 0 ? product.images : [];
  const inStock = (product.qty ?? 0) > 0;
  const stockStatus = inStock ? 'In stock' : 'Out of stock';
  const stockStyle = inStock
    ? { bg: '#EAF3DE', color: '#27500A' }
    : { bg: '#FCEBEB', color: '#A32D2D' };

  const farmerInitials = (product.farmerName || 'FX')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="p-5 lg:p-6 max-w-5xl mx-auto">
      <button onClick={() => onNavigate('marketplace')} className="flex items-center gap-1.5 mb-5"
        style={{ fontSize: 13, color: '#5F5E5A' }}>
        <ChevronLeft size={15} /> Back to marketplace
      </button>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          <div className="rounded-xl flex items-center justify-center mb-3 overflow-hidden"
            style={{ height: 280, background: '#F7F6F2', border: '0.5px solid rgba(0,0,0,0.1)' }}>
            {images.length > 0 ? (
              <img src={images[activeImg]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: 80 }}>🌾</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className="w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center"
                  style={{
                    background: '#F7F6F2',
                    border: `${i === activeImg ? '1.5px' : '0.5px'} solid ${i === activeImg ? '#3B6D11' : 'rgba(0,0,0,0.12)'}`,
                  }}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="rounded-full px-2 py-0.5 mb-2 inline-block"
                style={{ fontSize: 10, background: '#EAF3DE', color: '#27500A' }}>
                {product.category || 'General'}
              </span>
              <h1 style={{ fontSize: 22, fontWeight: 500, color: '#444441' }}>{product.name}</h1>
            </div>
            <span className="rounded-full px-2 py-0.5"
              style={{ fontSize: 10, background: stockStyle.bg, color: stockStyle.color }}>
              {stockStatus}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} style={{ color: '#854F0B', fill: '#854F0B' }} aria-hidden="true" />
            ))}
            <span style={{ fontSize: 12, color: '#854F0B', fontWeight: 500 }}>New</span>
            <span style={{ fontSize: 12, color: '#5F5E5A' }}>listing</span>
          </div>

          <div className="flex items-baseline gap-2 mb-4">
            <span style={{ fontSize: 28, fontWeight: 500, color: '#185FA5' }}>
              ₦{(product.price ?? 0).toLocaleString()}
            </span>
            <span style={{ fontSize: 14, color: '#5F5E5A' }}>per {product.unit || 'unit'}</span>
          </div>

          {product.description && (
            <p style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.7, marginBottom: 16 }}>
              {product.description}
            </p>
          )}

          {/* Stock info */}
          <div className="rounded-lg px-3 py-2 mb-4 inline-flex items-center gap-2"
            style={{ background: '#F7F6F2', border: '0.5px solid rgba(0,0,0,0.1)' }}>
            <span style={{ fontSize: 12, color: '#5F5E5A' }}>Available stock:</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>
              {(product.qty ?? 0).toLocaleString()} {product.unit}
            </span>
          </div>

          {/* Farmer profile */}
          <div className="rounded-xl p-3 mb-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#F7F6F2' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                style={{ background: '#27500A', fontSize: 13, fontWeight: 500 }}>
                {farmerInitials}
              </div>
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>{product.farmerName || 'FarmX Farmer'}</p>
                <div className="flex items-center gap-1">
                  <MapPin size={11} style={{ color: '#5F5E5A' }} />
                  <p style={{ fontSize: 11, color: '#5F5E5A' }}>{product.farmState || 'Nigeria'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Award size={13} style={{ color: '#3B6D11' }} />
                <span style={{ fontSize: 11, color: '#3B6D11' }}>Verified</span>
              </div>
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-3 mb-4">
            <label style={{ fontSize: 13, color: '#444441', fontWeight: 500 }}>
              Quantity ({product.unit || 'unit'})
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 18, color: '#444441' }}
                aria-label="Decrease quantity"
              >−</button>
              <span style={{ fontSize: 15, fontWeight: 500, color: '#444441', minWidth: 24, textAlign: 'center' }}>{qty}</span>
              <button
                onClick={() => setQty(Math.min(qty + 1, product.qty ?? 999))}
                disabled={!inStock}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 18, color: '#444441', opacity: !inStock ? 0.4 : 1 }}
                aria-label="Increase quantity"
              >+</button>
            </div>
            <span style={{ fontSize: 14, color: '#185FA5', fontWeight: 500 }}>
              = ₦{((product.price ?? 0) * qty).toLocaleString()}
            </span>
          </div>

          {/* CTA */}
          <div className="space-y-2">
            <button
              onClick={handleAdd}
              disabled={!inStock || addingToCart}
              className="w-full rounded-lg py-2.5 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: added ? '#EAF3DE' : '#185FA5',
                color: added ? '#27500A' : '#fff',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {addingToCart ? (
                <><Loader size={16} className="animate-spin" /> Adding…</>
              ) : (
                <><ShoppingCart size={16} />{added ? 'Added to cart!' : 'Add to cart'}</>
              )}
            </button>
            {added && (
              <button onClick={() => onNavigate('cart')} className="w-full rounded-lg py-2.5"
                style={{ border: '0.5px solid #185FA5', color: '#185FA5', fontSize: 13 }}>
                View cart & checkout
              </button>
            )}
          </div>

          <p className="mt-3" style={{ fontSize: 11, color: '#5F5E5A' }}>
            Platform service fee (3%) is deducted from the farmer's settlement — no extra charge to you.
          </p>
        </div>
      </div>
    </div>
  );
}