import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Screen } from './types';
import { auth, subscribeToConsumerOrders, subscribeToFarmerOrders, updateOrderStatus } from '../firebase';

interface Props {
  role: 'farmer' | 'consumer';
  onNavigate: (s: Screen) => void;
  profile?: any;
}

const steps = [
  { key: 'placed',     label: 'Order placed',  desc: 'Your order has been confirmed' },
  { key: 'packed',     label: 'Packed',         desc: 'Farmer has prepared your items' },
  { key: 'in_transit', label: 'In transit',     desc: 'Your order is on its way' },
  { key: 'delivered',  label: 'Delivered',      desc: 'Confirm delivery to release payment to farmer' },
];

function statusToStep(status: string): number {
  switch (status) {
    case 'new':        return 0;
    case 'packed':     return 1;
    case 'dispatched': return 2;
    case 'delivered':  return 3;
    default:           return 0;
  }
}

export function OrderTracking({ role, onNavigate, profile }: Props) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    const subscribe = role === 'farmer' ? subscribeToFarmerOrders : subscribeToConsumerOrders;
    const unsub = subscribe(uid, (liveOrders) => {
      setOrders(liveOrders);
      setSelected(prev => {
        // Keep existing selection if it's still valid, otherwise pick the first order
        if (prev && liveOrders.some(o => o.id === prev)) return prev;
        return liveOrders[0]?.id || null;
      });
      setLoading(false);
    });

    return () => unsub();
  }, [role]);

  const handleConfirmDelivery = async () => {
    if (!selected) return;
    setConfirming(true);
    await updateOrderStatus(selected, 'delivered');
    setConfirming(false);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <RefreshCw size={28} className="animate-spin mx-auto mb-4" style={{ color: '#185FA5' }} />
        <p style={{ fontSize: 13, color: '#5F5E5A' }}>Loading orders…</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-full bg-[#E6F1FB] text-[#0C447C] flex items-center justify-center mx-auto mb-5 text-2xl">
          📦
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#0C447C', marginBottom: 8 }}>No orders yet</h1>
        <p style={{ fontSize: 13, color: '#5F5E5A', marginBottom: 24, lineHeight: 1.6 }} className="max-w-md mx-auto">
          {role === 'farmer'
            ? "You don't have any farm orders yet. List your products to start selling!"
            : "You haven't placed any orders yet. Browse the marketplace to find fresh farm produce!"}
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

  const order = orders.find(o => o.id === selected) || orders[0];
  const orderStep = statusToStep(order?.status || 'new');

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
          {orders.map(o => {
            const step = statusToStep(o.status || 'new');
            const stepData = steps[step];
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
                <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>#{o.id.slice(0, 8).toUpperCase()}</p>
                <p style={{ fontSize: 11, color: '#5F5E5A' }} className="truncate">{o.product}</p>
                <span className="rounded-full px-2 py-0.5 mt-1 inline-block"
                  style={{
                    fontSize: 9,
                    background: step === 3 ? '#EAF3DE' : step === 2 ? '#E6F1FB' : '#FAEEDA',
                    color: step === 3 ? '#27500A' : step === 2 ? '#185FA5' : '#854F0B',
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
            <div className="flex items-start justify-between mb-5 gap-3">
              <div className="min-w-0">
                <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>#{order.id.slice(0, 8).toUpperCase()}</p>
                <p style={{ fontSize: 12, color: '#5F5E5A' }} className="truncate">{order.product} · ₦{Number(order.amount).toLocaleString()}</p>
                {order.buyerName && (
                  <p style={{ fontSize: 11, color: '#5F5E5A' }}>Buyer: {order.buyerName}</p>
                )}
              </div>
              <div className="rounded-xl px-3 py-1 flex-shrink-0" style={{ background: '#E6F1FB' }}>
                <p style={{ fontSize: 11, color: '#0C447C' }}>
                  {order.status === 'delivered' ? 'Delivered' : 'In progress'}
                </p>
              </div>
            </div>

            {/* Stepper */}
            <div className="space-y-0">
              {steps.map((step, i) => {
                const isDone = i < orderStep;
                const isActive = i === orderStep;
                return (
                  <div key={step.key} className="flex gap-4">
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
                    <div className="pb-5 flex-1">
                      <p style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: isDone || isActive ? '#444441' : '#5F5E5A' }}>
                        {step.label}
                      </p>
                      <p style={{ fontSize: 11, color: '#5F5E5A', marginTop: 1 }}>{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Delivery address */}
            {order.buyerLocation && (
              <div className="rounded-xl p-4 mt-2" style={{ background: '#F7F6F2', border: '0.5px solid rgba(0,0,0,0.1)' }}>
                <div className="flex items-center gap-2">
                  <MapPin size={14} style={{ color: '#185FA5' }} aria-hidden="true" />
                  <p style={{ fontSize: 12, color: '#444441' }}>Delivery to: {order.buyerLocation}</p>
                </div>
              </div>
            )}

            {/* Farmer: mark dispatched */}
            {role === 'farmer' && order.status === 'new' && (
              <button
                onClick={() => updateOrderStatus(order.id, 'dispatched')}
                className="w-full mt-4 rounded-lg py-2.5 transition-all active:scale-[0.98]"
                style={{ background: '#185FA5', color: '#fff', fontSize: 13, fontWeight: 500 }}
              >
                Mark as dispatched
              </button>
            )}

            {/* Consumer: confirm delivery */}
            {role === 'consumer' && order.status === 'dispatched' && (
              <button
                onClick={handleConfirmDelivery}
                disabled={confirming}
                className="w-full mt-4 rounded-lg py-2.5 transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: '#27500A', color: '#fff', fontSize: 13, fontWeight: 500 }}
              >
                {confirming ? 'Confirming…' : 'Confirm delivery received'}
              </button>
            )}

            {order.status === 'delivered' && (
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