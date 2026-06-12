import React, { useState } from 'react';
import { ChevronLeft, Star, ShoppingCart, MapPin, Award } from 'lucide-react';
import { Screen } from './types';

interface Props {
  onNavigate: (s: Screen) => void;
  onAddToCart: () => void;
}

export function ProductDetail({ onNavigate, onAddToCart }: Props) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  const images = ['🍅', '🍅', '🌿', '📦'];

  const handleAdd = () => {
    setAdded(true);
    onAddToCart();
  };

  return (
    <div className="p-5 lg:p-6 max-w-5xl mx-auto">
      <button onClick={() => onNavigate('marketplace')} className="flex items-center gap-1.5 mb-5"
        style={{ fontSize: 13, color: '#5F5E5A' }}>
        <ChevronLeft size={15} /> Back to marketplace
      </button>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          <div className="rounded-xl flex items-center justify-center mb-3" style={{ height: 280, background: '#F7F6F2', border: '0.5px solid rgba(0,0,0,0.1)' }}>
            <span style={{ fontSize: 80 }}>{images[activeImg]}</span>
          </div>
          <div className="flex gap-2">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className="w-14 h-14 rounded-lg flex items-center justify-center"
                style={{
                  background: '#F7F6F2',
                  border: `${i === activeImg ? '1.5px' : '0.5px'} solid ${i === activeImg ? '#3B6D11' : 'rgba(0,0,0,0.12)'}`,
                  fontSize: 24
                }}
                aria-label={`View image ${i + 1}`}
              >
                {img}
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="rounded-full px-2 py-0.5 mb-2 inline-block" style={{ fontSize: 10, background: '#EAF3DE', color: '#27500A' }}>Vegetables</span>
              <h1 style={{ fontSize: 22, fontWeight: 500, color: '#444441' }}>Roma Tomatoes</h1>
            </div>
            <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, background: '#EAF3DE', color: '#27500A' }}>In stock</span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} style={{ color: '#854F0B', fill: i < 5 ? '#854F0B' : 'transparent' }} aria-hidden="true" />
            ))}
            <span style={{ fontSize: 12, color: '#854F0B', fontWeight: 500 }}>4.9</span>
            <span style={{ fontSize: 12, color: '#5F5E5A' }}>(142 reviews)</span>
          </div>

          <div className="flex items-baseline gap-2 mb-4">
            <span style={{ fontSize: 28, fontWeight: 500, color: '#185FA5' }}>₦700</span>
            <span style={{ fontSize: 14, color: '#5F5E5A' }}>per kg</span>
          </div>

          <p style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.7, marginBottom: 16 }}>
            Freshly harvested Roma tomatoes from Kaduna State. Grown without synthetic pesticides using traditional farming methods. Firm, rich red colour — ideal for cooking, stews, and fresh use. Picked within 24 hours of dispatch.
          </p>

          {/* Farmer profile */}
          <div className="rounded-xl p-3 mb-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#F7F6F2' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: '#27500A', fontSize: 13, fontWeight: 500 }}>
                AD
              </div>
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>Aminu Danjuma</p>
                <div className="flex items-center gap-1">
                  <MapPin size={11} style={{ color: '#5F5E5A' }} />
                  <p style={{ fontSize: 11, color: '#5F5E5A' }}>Danjuma Farm, Kawo · Kaduna State</p>
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
            <label style={{ fontSize: 13, color: '#444441', fontWeight: 500 }}>Quantity (kg)</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 18, color: '#444441' }}
                aria-label="Decrease quantity"
              >−</button>
              <span style={{ fontSize: 15, fontWeight: 500, color: '#444441', minWidth: 24, textAlign: 'center' }}>{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 18, color: '#444441' }}
                aria-label="Increase quantity"
              >+</button>
            </div>
            <span style={{ fontSize: 14, color: '#185FA5', fontWeight: 500 }}>= ₦{(700 * qty).toLocaleString()}</span>
          </div>

          {/* CTA */}
          <div className="space-y-2">
            <button
              onClick={handleAdd}
              className="w-full rounded-lg py-2.5 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: added ? '#EAF3DE' : '#185FA5', color: added ? '#27500A' : '#fff', fontSize: 14, fontWeight: 500 }}
            >
              <ShoppingCart size={16} />
              {added ? 'Added to cart!' : 'Add to cart'}
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
