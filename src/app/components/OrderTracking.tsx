import React, { useState } from 'react';
import { MapPin, CheckCircle, Clock } from 'lucide-react';
import { Screen } from './types';

interface Props {
  role: 'farmer' | 'consumer';
  onNavigate: (s: Screen) => void;
  profile?: any;
}

const steps = [
  { key: 'placed', label: 'Order placed', desc: 'Your order has been confirmed', date: '3 Jun, 10:22 AM' },
  { key: 'packed', label: 'Packed', desc: 'Farmer has prepared your items', date: '4 Jun, 8:15 AM' },
  { key: 'in_transit', label: 'In transit', desc: 'Driver: Musa Abdullahi · +234 801 234 5678', date: '5 Jun, 9:00 AM' },
  { key: 'delivered', label: 'Delivered', desc: 'Confirm delivery to release payment to farmer', date: '—' },
];

const activeStep = 2; // In transit

const orders = [
  { id: 'ORD-0221', product: 'Roma Tomatoes × 5kg', farmer: 'Aminu Danjuma', amount: 3500, step: 2 },
  { id: 'ORD-0220', product: 'Maize (Dried) × 10kg', farmer: 'Blessing Okafor', amount: 3500, step: 3 },
  { id: 'ORD-0219', product: 'White Onion × 3kg', farmer: 'Musa Ibrahim', amount: 1350, step: 3 },
];

export function OrderTracking({ role, onNavigate, profile }: Props) {
  const isNewUser = profile && !profile.isDemo;
  const displayOrders = isNewUser ? [] : orders;

  if (!displayOrders || displayOrders.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-full bg-[#E6F1FB] text-[#0C447C] flex items-center justify-center mx-auto mb-5 text-2xl">
          📦
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#0C447C', marginBottom: 8 }}>No orders yet</h1>
        <p style={{ fontSize: 13, color: '#5F5E5A', marginBottom: 24, lineHeight: 1.6 }} className="max-w-md mx-auto">
          {role === 'farmer' ? "You don't have any farm orders yet. List your products to start selling!" : "You haven't placed any orders yet. Browse the marketplace to find fresh farm produce!"}
        </p>
        <button
          onClick={() => onNavigate(role === 'farmer' ? 'add-listing' : 'marketplace')}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition hover:scale-[0.99] active:scale-[0.98] cursor-pointer shadow-sm text-xs mx-auto"
          style={{ backgroundColor: role === 'farmer' ? '#27500A' : '#185FA5' }}
        >
          {role === 'farmer' ? 'Add Your First Listing' : 'Browse Marketplace'}
        </button>
      </div>
    );
  }

  const [selected, setSelected] = useState(displayOrders[0]?.id);
  const [confirmed, setConfirmed] = useState(false);
  const order = displayOrders.find(o => o.id === selected) || displayOrders[0];

  return (
    <div className="p-5 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 500, color: role === 'farmer' ? '#27500A' : '#0C447C' }}>Order tracking</h1>
        <p style={{ fontSize: 13, color: '#5F5E5A' }}>Track your orders in real-time</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Order list */}
        <div className="space-y-2">
          <p style={{ fontSize: 12, fontWeight: 500, color: '#5F5E5A', marginBottom: 8 }}>Your orders</p>
          {displayOrders.map(o => {
            const stepData = steps[o.step];
            return (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                className="w-full text-left rounded-xl p-3 transition-all"
                style={{
                  border: `${selected === o.id ? '1px' : '0.5px'} solid ${selected === o.id ? '#185FA5' : 'rgba(0,0,0,0.12)'}`,
                  background: selected === o.id ? '#E6F1FB' : '#fff'
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>{o.id}</p>
                <p style={{ fontSize: 11, color: '#5F5E5A' }}>{o.product}</p>
                <span className="rounded-full px-2 py-0.5 mt-1 inline-block"
                  style={{
                    fontSize: 9,
                    background: o.step === 3 ? '#EAF3DE' : o.step === 2 ? '#E6F1FB' : '#FAEEDA',
                    color: o.step === 3 ? '#27500A' : o.step === 2 ? '#185FA5' : '#854F0B',
                  }}>
                  {stepData.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2">
          <div className="rounded-xl p-5" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>{selected}</p>
                <p style={{ fontSize: 12, color: '#5F5E5A' }}>{order.product} · ₦{order.amount.toLocaleString()}</p>
              </div>
              <div className="rounded-xl px-3 py-1" style={{ background: '#E6F1FB' }}>
                <p style={{ fontSize: 11, color: '#0C447C' }}>Est. delivery: 8 Jun 2026</p>
              </div>
            </div>

            {/* Stepper */}
            <div className="space-y-0">
              {steps.map((step, i) => {
                const isDone = i < order.step;
                const isActive = i === order.step;
                return (
                  <div key={step.key} className="flex gap-4">
                    {/* Icon + line */}
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isDone ? '#27500A' : isActive ? '#EAF3DE' : '#F1EFE8',
                          border: isActive ? '1.5px solid #3B6D11' : 'none',
                        }}>
                        {isDone ? (
                          <CheckCircle size={12} style={{ color: '#fff' }} />
                        ) : isActive ? (
                          <Clock size={10} style={{ color: '#27500A' }} />
                        ) : (
                          <div className="w-2 h-2 rounded-full" style={{ background: '#5F5E5A' }} />
                        )}
                      </div>
                      {i < steps.length - 1 && (
                        <div className="w-0.5 flex-1 my-1" style={{ background: isDone ? '#27500A' : '#EAF3DE', minHeight: 24 }} />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-5 flex-1">
                      <p style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: isDone || isActive ? '#444441' : '#5F5E5A' }}>
                        {step.label}
                      </p>
                      <p style={{ fontSize: 11, color: '#5F5E5A', marginTop: 1 }}>{step.desc}</p>
                      {step.date !== '—' && (
                        <p style={{ fontSize: 10, color: '#5F5E5A', marginTop: 1 }}>{step.date}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Map pin */}
            <div className="rounded-xl p-4 mt-2" style={{ background: '#F7F6F2', border: '0.5px solid rgba(0,0,0,0.1)' }}>
              <div className="flex items-center gap-2">
                <MapPin size={14} style={{ color: '#185FA5' }} aria-hidden="true" />
                <p style={{ fontSize: 12, color: '#444441' }}>Currently near: Toll Gate, Lagos–Ibadan Expressway</p>
              </div>
            </div>

            {/* Confirm delivery (consumer) */}
            {role === 'consumer' && order.step === 2 && !confirmed && (
              <button
                onClick={() => setConfirmed(true)}
                className="w-full mt-4 rounded-lg py-2.5 transition-all active:scale-[0.98]"
                style={{ background: '#27500A', color: '#fff', fontSize: 13, fontWeight: 500 }}
              >
                Confirm delivery received
              </button>
            )}
            {confirmed && (
              <div className="mt-4 rounded-xl p-3 flex items-center gap-2" style={{ background: '#EAF3DE' }}>
                <CheckCircle size={14} style={{ color: '#27500A' }} />
                <p style={{ fontSize: 12, color: '#27500A' }}>Delivery confirmed. Payment released to farmer.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
