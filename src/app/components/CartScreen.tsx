import React, { useState } from 'react';
import { Trash2, Info } from 'lucide-react';
import { Screen } from './types';

interface Props {
  onNavigate: (s: Screen) => void;
  onCartChange: (delta: number) => void;
}

const initialItems = [
  { id: 'P001', name: 'Roma Tomatoes', farmer: 'Aminu Danjuma', price: 700, unit: 'kg', qty: 5, emoji: '🍅' },
  { id: 'P003', name: 'Maize (Dried)', farmer: 'Blessing Okafor', price: 350, unit: 'kg', qty: 10, emoji: '🌽' },
  { id: 'P004', name: 'White Onion', farmer: 'Musa Ibrahim', price: 450, unit: 'kg', qty: 3, emoji: '🧅' },
];

export function CartScreen({ onNavigate, onCartChange }: Props) {
  const [items, setItems] = useState(initialItems);

  const update = (id: string, delta: number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
    ));
  };

  const remove = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    onCartChange(-1);
  };

  const clearAll = () => {
    setItems([]);
    onCartChange(-items.length);
  };

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const delivery = items.length > 0 ? 2500 : 0;
  const total = subtotal + delivery;

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
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#F7F6F2', fontSize: 26 }}>
                  {item.emoji}
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
