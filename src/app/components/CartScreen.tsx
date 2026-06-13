import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Info } from 'lucide-react';
import { Screen } from './types';
import { auth, subscribeToCart, updateCartItemQty, removeCartItem, clearCart, CartItemDoc } from '../firebase';

interface Props {
  onNavigate: (s: Screen) => void;
  onCartChange: (delta: number) => void;
}

interface DisplayCartItem {
  id: string;
  productId: string;
  name: string;
  farmer: string;
  price: number;
  unit: string;
  qty: number;
  emoji: string;
  image?: string | null;
}

export function CartScreen({ onNavigate, onCartChange }: Props) {
  const [items, setItems] = useState<DisplayCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const unsub = subscribeToCart(uid, (cartItems: CartItemDoc[]) => {
      const mapped = cartItems.map((c) => ({
        id: c.id,
        productId: c.productId,
        name: c.name || 'Unnamed product',
        farmer: c.farmerName || 'FarmX Farmer',
        price: c.price ?? 0,
        unit: c.unit || 'unit',
        qty: c.qty ?? 1,
        emoji: c.emoji || '🌾',
        image: c.image || null,
      }));

      const prevCount = prevCountRef.current ?? 0;
      const delta = mapped.length - prevCount;
      if (delta !== 0) onCartChange(delta);
      prevCountRef.current = mapped.length;

      setItems(mapped);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const update = async (id: string, delta: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newQty = Math.max(1, item.qty + delta);

    // Optimistic UI update
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: newQty } : i)));

    try {
      await updateCartItemQty(id, newQty);
    } catch (err) {
      console.error('Failed to update cart item quantity:', err);
    }
  };

  const remove = async (id: string) => {
    try {
      await removeCartItem(id);
    } catch (err) {
      console.error('Failed to remove cart item:', err);
    }
  };

  const clearAll = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await clearCart(uid);
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  };

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const delivery = items.length > 0 ? 2500 : 0;
  const total = subtotal + delivery;

  if (loading) {
    return (
      <div className="p-5 lg:p-6 max-w-4xl mx-auto">
        <div className="rounded-xl p-16 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
          <p style={{ fontSize: 14, color: '#5F5E5A' }}>Loading your cart…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#0C447C' }}>Your cart</h1>
          <p style={{ fontSize: 13, color: '#5F5E5A' }}>{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        {items.length > 0 && (
          <button onClick={clearAll} style={{ fontSize: 12, color: '#A32D2D' }}>Clear all</button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl p-16 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
          <span style={{ fontSize: 40 }}>🛒</span>
          <p style={{ fontSize: 14, color: '#5F5E5A', marginTop: 12 }}>Your cart is empty</p>
          <button onClick={() => onNavigate('marketplace')} className="mt-4 px-6 py-2 rounded-lg"
            style={{ background: '#185FA5', color: '#fff', fontSize: 13 }}>
            Browse marketplace
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-4 rounded-xl"
                style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: '#F7F6F2', fontSize: 26 }}>
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    item.emoji
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>{item.name}</p>
                  <p style={{ fontSize: 11, color: '#5F5E5A' }}>{item.farmer} · ₦{item.price}/{item.unit}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => update(item.id, -1)}
                      className="w-6 h-6 rounded-md flex items-center justify-center"
                      style={{ border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 14 }}
                      aria-label="Decrease quantity">−</button>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#444441', minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                    <button onClick={() => update(item.id, 1)}
                      className="w-6 h-6 rounded-md flex items-center justify-center"
                      style={{ border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 14 }}
                      aria-label="Increase quantity">+</button>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>₦{(item.price * item.qty).toLocaleString()}</p>
                  <button onClick={() => remove(item.id)} className="mt-2"
                    aria-label={`Remove ${item.name}`}>
                    <Trash2 size={14} style={{ color: '#A32D2D' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div>
            <div className="rounded-xl p-4 sticky top-6" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441', marginBottom: 12 }}>Order summary</h2>
              <div className="space-y-2.5 mb-4">
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: '#5F5E5A' }}>Subtotal</span>
                  <span style={{ fontSize: 13, color: '#444441' }}>₦{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: 13, color: '#5F5E5A' }}>Delivery estimate</span>
                  <span style={{ fontSize: 13, color: '#444441' }}>₦{delivery.toLocaleString()}</span>
                </div>
                <div className="pt-2" style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)' }}>
                  <div className="flex justify-between">
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Total</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#185FA5' }}>₦{total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Commission note */}
              <div className="flex gap-2 p-2.5 rounded-lg mb-4" style={{ background: '#EAF3DE' }}>
                <Info size={13} style={{ color: '#27500A', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <p style={{ fontSize: 10, color: '#27500A', lineHeight: 1.5 }}>
                  Platform service fee (3%) is deducted from the farmer's settlement — no extra charge to you.
                </p>
              </div>

              <button onClick={() => onNavigate('checkout')}
                className="w-full rounded-lg py-2.5 transition-all active:scale-[0.98]"
                style={{ background: '#185FA5', color: '#fff', fontSize: 13, fontWeight: 500 }}>
                Proceed to checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}