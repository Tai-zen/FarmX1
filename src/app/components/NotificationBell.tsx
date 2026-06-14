import React, { useState, useEffect, useRef } from 'react';
import { Bell, Package, CheckCircle, TrendingUp, X, ShoppingBag } from 'lucide-react';
import { UserRole, Screen } from './types';
import { auth, subscribeToFarmerOrders, subscribeToConsumerOrders } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

interface Props {
  role: UserRole;
  onNavigate: (s: Screen) => void;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  icon: 'order' | 'delivery' | 'payment' | 'new';
  time: Date;
  read: boolean;
  screen?: Screen;
}

const SEEN_KEY = 'farmx_notif_seen_ids';

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {}
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const iconMap = {
  order: { icon: Package, bg: '#FAEEDA', color: '#854F0B' },
  delivery: { icon: CheckCircle, bg: '#EAF3DE', color: '#27500A' },
  payment: { icon: TrendingUp, bg: '#E6F1FB', color: '#185FA5' },
  new: { icon: ShoppingBag, bg: '#F3E8FF', color: '#6B21A8' },
};

export function NotificationBell({ role, onNavigate }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(getSeenIds());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    if (role === 'farmer') {
      const unsub = subscribeToFarmerOrders(uid, (orders) => {
        const notifs: Notification[] = orders.map((o: any) => {
          const time = o.createdAt?.toDate ? new Date(o.createdAt.toDate()) : new Date();
          if (o.status === 'delivered') {
            return {
              id: `delivered-${o.id}`,
              title: 'Order delivered ✓',
              body: `${o.buyerName || 'A buyer'} confirmed delivery of ${o.product || 'your product'}.`,
              icon: 'delivery' as const,
              time,
              read: seenIds.has(`delivered-${o.id}`),
              screen: 'farmer-orders' as Screen,
            };
          }
          if (o.status === 'new' || o.status === 'placed') {
            return {
              id: `new-${o.id}`,
              title: 'New order received 🛒',
              body: `${o.buyerName || 'A consumer'} ordered ${o.product || 'a product'} for ₦${(o.amount || 0).toLocaleString()}.`,
              icon: 'order' as const,
              time,
              read: seenIds.has(`new-${o.id}`),
              screen: 'farmer-orders' as Screen,
            };
          }
          return {
            id: `update-${o.id}-${o.status}`,
            title: 'Order updated',
            body: `Order for ${o.product || 'a product'} is now ${o.status}.`,
            icon: 'new' as const,
            time,
            read: seenIds.has(`update-${o.id}-${o.status}`),
            screen: 'farmer-orders' as Screen,
          };
        });
        notifs.sort((a, b) => b.time.getTime() - a.time.getTime());
        setNotifications(notifs.slice(0, 20));
      });
      return () => unsub();
    }

    if (role === 'consumer') {
      const unsub = subscribeToConsumerOrders(uid, (orders) => {
        const notifs: Notification[] = orders.flatMap((o: any) => {
          const time = o.createdAt?.toDate ? new Date(o.createdAt.toDate()) : new Date();
          const items: Notification[] = [];
          if (o.status === 'dispatched') {
            items.push({
              id: `dispatched-${o.id}`,
              title: 'Order on its way 🚚',
              body: `Your order of ${o.product || 'a product'} has been dispatched.`,
              icon: 'order' as const,
              time,
              read: seenIds.has(`dispatched-${o.id}`),
              screen: 'order-tracking' as Screen,
            });
          }
          if (o.status === 'delivered') {
            items.push({
              id: `recv-${o.id}`,
              title: 'Order arrived ✓',
              body: `${o.product || 'Your order'} has been delivered successfully.`,
              icon: 'delivery' as const,
              time,
              read: seenIds.has(`recv-${o.id}`),
              screen: 'order-tracking' as Screen,
            });
          }
          if (o.status === 'new' || o.status === 'placed') {
            items.push({
              id: `placed-${o.id}`,
              title: 'Order confirmed ✓',
              body: `Your order of ${o.product || 'a product'} for ₦${(o.amount || 0).toLocaleString()} is confirmed.`,
              icon: 'payment' as const,
              time,
              read: seenIds.has(`placed-${o.id}`),
              screen: 'order-tracking' as Screen,
            });
          }
          return items;
        });
        notifs.sort((a, b) => b.time.getTime() - a.time.getTime());
        setNotifications(notifs.slice(0, 20));
      });
      return () => unsub();
    }

    if (role === 'admin') {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(30));
      const unsub = onSnapshot(q, (snap) => {
        const notifs: Notification[] = snap.docs.map(d => {
          const o = { id: d.id, ...d.data() } as any;
          const time = o.createdAt?.toDate ? new Date(o.createdAt.toDate()) : new Date();
          return {
            id: `admin-${o.id}`,
            title: `New order — ₦${(o.amount || 0).toLocaleString()}`,
            body: `${o.buyerName || 'Consumer'} ordered ${o.product || 'product'} from ${o.farmerName || 'a farmer'}.`,
            icon: 'new' as const,
            time,
            read: seenIds.has(`admin-${o.id}`),
            screen: 'admin-dashboard' as Screen,
          };
        });
        setNotifications(notifs.slice(0, 20));
      }, () => {});
      return () => unsub();
    }
  }, [role]);

  // Close when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = notifications.filter(n => !seenIds.has(n.id)).length;

  function handleOpen() {
    setOpen(o => !o);
  }

  function markAllRead() {
    const newSeen = new Set(seenIds);
    notifications.forEach(n => newSeen.add(n.id));
    setSeenIds(newSeen);
    saveSeenIds(newSeen);
  }

  function handleClick(n: Notification) {
    const newSeen = new Set(seenIds);
    newSeen.add(n.id);
    setSeenIds(newSeen);
    saveSeenIds(newSeen);
    setOpen(false);
    if (n.screen) onNavigate(n.screen);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-all"
        style={{ background: open ? '#EAF3DE' : 'transparent' }}
      >
        <Bell size={16} style={{ color: open ? '#27500A' : '#5F5E5A' }} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ fontSize: 8, fontWeight: 700, background: '#A32D2D', color: '#fff' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-2xl shadow-xl overflow-hidden"
          style={{
            width: 320,
            background: '#fff',
            border: '0.5px solid rgba(0,0,0,0.12)',
            zIndex: 300,
            top: '100%',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Notifications</p>
              {unread > 0 && <p style={{ fontSize: 11, color: '#5F5E5A' }}>{unread} unread</p>}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ fontSize: 11, color: '#185FA5', fontWeight: 500 }}
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#F1EFE8' }}>
                <X size={12} style={{ color: '#5F5E5A' }} />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={28} className="mx-auto mb-3" style={{ color: '#D4E8C2' }} />
                <p style={{ fontSize: 13, color: '#5F5E5A' }}>No notifications yet</p>
                <p style={{ fontSize: 11, color: '#AAAAA5', marginTop: 4 }}>Activity will appear here in real time</p>
              </div>
            ) : (
              notifications.map(n => {
                const isRead = seenIds.has(n.id);
                const meta = iconMap[n.icon];
                const IconComp = meta.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all hover:bg-gray-50"
                    style={{ borderBottom: '0.5px solid rgba(0,0,0,0.05)', background: isRead ? '#fff' : '#FAFDF5' }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: meta.bg }}>
                      <IconComp size={14} style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p style={{ fontSize: 12, fontWeight: isRead ? 400 : 600, color: isRead ? '#5F5E5A' : '#444441', lineHeight: 1.4 }}>
                          {n.title}
                        </p>
                        {!isRead && (
                          <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: '#27500A' }} />
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.4, marginTop: 1 }}>{n.body}</p>
                      <p style={{ fontSize: 10, color: '#AAAAA5', marginTop: 3 }}>{timeAgo(n.time)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2.5" style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)', background: '#FAFAF8' }}>
              <p style={{ fontSize: 10, color: '#AAAAA5', textAlign: 'center' }}>Showing last {notifications.length} activities</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
