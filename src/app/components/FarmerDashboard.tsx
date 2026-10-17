import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, ClipboardList, TrendingUp, Sprout, ChevronRight,
  Bell, Sun, CloudRain, Wind, CheckCircle2, Circle, AlertCircle
} from 'lucide-react';
import { Screen } from './types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { subscribeToPlantingSchedules, subscribeToFarmerOrders, auth } from '../firebase';
import { get6MonthsFromCurrent } from './WalletScreen';

interface Props { onNavigate: (s: Screen, param?: string) => void; profile?: any; }

const recentOrders = [
  { id: 'ORD-8821', buyer: 'Fatima Bello', location: 'Abuja FCT', product: 'Roma Tomatoes × 20kg', amount: 14000, status: 'new', time: '2h ago', avatar: 'FB', color: '#185FA5' },
  { id: 'ORD-8820', buyer: 'Emeka Obi', location: 'Lagos', product: 'Sweet Pepper × 10kg', amount: 8500, status: 'dispatched', time: '5h ago', avatar: 'EO', color: '#854F0B' },
  { id: 'ORD-8819', buyer: 'Hauwa Musa', location: 'Kano', product: 'Yam × 50kg', amount: 22000, status: 'delivered', time: 'Yesterday', avatar: 'HM', color: '#27500A' },
  { id: 'ORD-8818', buyer: 'Tunde Akande', location: 'Ibadan', product: 'Maize × 100kg', amount: 35000, status: 'delivered', time: 'Yesterday', avatar: 'TA', color: '#27500A' },
];

import { NIGERIA_CROPS } from '../data/nigeriaCrops';
import { generateCropTasks } from './PlantingCalendar';

// Dynamically generate in-season crop recommendations for the current month
function getInSeasonSuggestions() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const inSeason = NIGERIA_CROPS.filter(c => c.plantingMonths.includes(currentMonth));
  const pool = inSeason.length > 0 ? inSeason : NIGERIA_CROPS;
  return pool.slice(0, 4).map((c, i) => ({
    name: c.name,
    match: 96 - i * 3,
    emoji: c.emoji,
    best: i === 0,
    category: c.category,
    daysToMaturity: c.daysToMaturity
  }));
}

const notifications = [
  { type: 'order', msg: 'New order from Fatima Bello — ₦14,000', time: '2h ago', read: false },
  { type: 'wallet', msg: '₦22,000 escrow released from ORD-8815', time: '4h ago', read: false },
  { type: 'ai', msg: 'AI tip: Rainfall expected next week — ideal planting window', time: '6h ago', read: true },
  { type: 'order', msg: 'New order from Emeka Obi — ₦8,500', time: '5h ago', read: false },
];

const statusStyle = (s: string) => {
  if (s === 'new') return { background: '#FAEEDA', color: '#854F0B', label: 'New' };
  if (s === 'dispatched') return { background: '#E6F1FB', color: '#185FA5', label: 'Dispatched' };
  if (s === 'delivered') return { background: '#EAF3DE', color: '#27500A', label: 'Delivered' };
  return { background: '#F1EFE8', color: '#5F5E5A', label: s };
};

const phaseColor = (p: string) => {
  if (p === 'Pre-planting') return '#27500A';
  if (p === 'Planting') return '#3B6D11';
  return '#639922';
};

const badgeStyle = (s: string) => {
  if (s === 'today') return { bg: '#FCEBEB', color: '#A32D2D' };
  if (s === 'tomorrow') return { bg: '#FAEEDA', color: '#854F0B' };
  return { bg: '#F1EFE8', color: '#5F5E5A' };
};

export function FarmerDashboard({ onNavigate, profile }: Props) {
  const [doneTasks, setDoneTasks] = useState<Set<number>>(new Set());
  const [showNotifs, setShowNotifs] = useState(false);
  const [chartMode, setChartMode] = useState<'revenue' | 'orders'>('revenue');
  const [sixMonthView, setSixMonthView] = useState<'past' | 'projected'>('past');

  const isNewUser = !profile || !profile.isDemo;

  const displayName = profile ? profile.fullName.split(' ')[0] : 'Aminu';
  const displayLocation = profile
    ? `${profile.farmName || 'My Farm'} · ${profile.farmState || 'Nigeria'}`
    : 'Kawo, Kaduna State';

  // ── Live orders — must be declared BEFORE the stat strings below ──────────
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isNewUser) return;
    const unsub = subscribeToFarmerOrders(uid, setLiveOrders);
    return () => unsub();
  }, [profile, isNewUser]);

  const deliveredOrders = liveOrders.filter(o => o.status === 'delivered');
  const liveRevenue = deliveredOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const livePendingRevenue = liveOrders
    .filter(o => o.status !== 'delivered')
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const liveActiveOrders = liveOrders.filter(o => o.status !== 'delivered').length;
  const liveAwaitingDispatch = liveOrders.filter(o => o.status === 'new').length;
  // ─────────────────────────────────────────────────────────────────────────

  // ── Planting calendar ─────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<any[]>([]);
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeToPlantingSchedules(profile.uid, setSchedules);
    return () => unsub();
  }, [profile]);

  const activeSchedule = schedules[0];
  const cropPlanValue = activeSchedule
    ? activeSchedule.cropName
    : (isNewUser ? 'None' : 'Tomatoes');
  const cropPlanSub = activeSchedule
    ? `Harvest: ${activeSchedule.harvestMonth}`
    : (isNewUser ? 'No active crop plan yet' : 'Week 6 of 14 · On track');
  // ─────────────────────────────────────────────────────────────────────────

  // ── Stat strings (all live vars are available above) ─────────────────────
  const walletValue = isNewUser ? `₦${liveRevenue.toLocaleString()}` : '₦287,400';
  const walletSub = isNewUser
    ? `₦${livePendingRevenue.toLocaleString()} pending release`
    : '+ ₦48,500 pending release';
  const activeOrdersValue = isNewUser ? String(liveActiveOrders) : '7';
  const activeOrdersSub = isNewUser ? `${liveAwaitingDispatch} awaiting dispatch` : '3 awaiting dispatch';
  const salesValue = isNewUser ? `₦${liveRevenue.toLocaleString()}` : '₦287,000';
  const salesSub = isNewUser
    ? (liveRevenue > 0 ? `${deliveredOrders.length} orders completed` : 'No sales yet')
    : '↑ +24% vs last month';
  const dynamicSalesData = useMemo(() => {
    return get6MonthsFromCurrent(new Date(), sixMonthView);
  }, [sixMonthView]);

  const monthRangeText = useMemo(() => {
    if (dynamicSalesData.length === 0) return '';
    const first = dynamicSalesData[0];
    const last = dynamicSalesData[dynamicSalesData.length - 1];
    return `${first.fullMonth} ${first.year} – ${last.fullMonth} ${last.year}`;
  }, [dynamicSalesData]);

  const activeSalesData = isNewUser
    ? dynamicSalesData.map(d => ({ ...d, revenue: 0, orders: 0 }))
    : dynamicSalesData;

  const totalCalculatedRevenue = activeSalesData.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalCalculatedOrders = activeSalesData.reduce((acc, curr) => acc + curr.orders, 0);

  const totalRevenueText = isNewUser ? `₦${liveRevenue.toLocaleString()}` : `₦${totalCalculatedRevenue.toLocaleString()}`;
  const totalOrdersText = isNewUser ? String(liveOrders.length) : String(totalCalculatedOrders);
  const avgOrderValueText = isNewUser
    ? (deliveredOrders.length > 0
        ? `₦${Math.round(liveRevenue / deliveredOrders.length).toLocaleString()}`
        : '₦0')
    : `₦${Math.round(totalCalculatedRevenue / (totalCalculatedOrders || 1)).toLocaleString()}`;

  const cropSuggestions = getInSeasonSuggestions();

  // Tasks derived from active schedule or default in-season crop, strictly starting from Day 1
  const scheduleStartDate = activeSchedule?.startDate ? new Date(activeSchedule.startDate) : new Date();
  const scheduleTasksRaw = generateCropTasks(
    activeSchedule?.cropName || cropSuggestions[0]?.name || 'Roma Tomatoes',
    activeSchedule?.daysToMaturity || cropSuggestions[0]?.daysToMaturity || 90
  );

  const listTasks = scheduleTasksRaw.slice(0, 5).map(t => {
    const taskDate = new Date(scheduleStartDate);
    taskDate.setDate(taskDate.getDate() + (t.day - 1));
    const isToday = taskDate.toDateString() === new Date().toDateString();
    const isTomorrow = new Date(Date.now() + 86400000).toDateString() === taskDate.toDateString();
    return {
      task: t.task,
      phase: t.phase === 'pre' ? 'Pre-planting' : t.phase === 'planting' ? 'Planting' : 'Post-planting',
      date: isToday ? 'Today' : isTomorrow ? 'Tomorrow' : taskDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      status: isToday ? 'today' : isTomorrow ? 'tomorrow' : 'upcoming',
      done: false
    };
  });

  const listOrders = isNewUser ? liveOrders.slice(0, 4) : recentOrders;
  const listNotifications = isNewUser ? [] : notifications;
  const unreadCount = listNotifications.filter(n => !n.read).length;
  // ─────────────────────────────────────────────────────────────────────────

  const toggleTask = (i: number) => {
    setDoneTasks(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const currentDateDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="p-5 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#27500A' }}>Good day, {displayName} 👋</h1>
          <p style={{ fontSize: 13, color: '#5F5E5A' }}>{currentDateDisplay} · {displayLocation}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Weather pill */}
          <button
            onClick={() => onNavigate('crop-prediction')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer hover:bg-blue-100"
            style={{ background: '#E6F1FB', border: '0.5px solid rgba(24,95,165,0.2)' }}
            title="Inspect live farm weather and soil predictions"
          >
            <CloudRain size={13} style={{ color: '#185FA5' }} aria-hidden="true" />
            <span style={{ fontSize: 11, color: '#185FA5' }}>Rain expected · 28°C</span>
          </button>
          {/* Notification bell */}
          <div className="relative">
            <button onClick={() => setShowNotifs(!showNotifs)}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-neutral-50"
              style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}
              aria-label="Notifications">
              <Bell size={15} style={{ color: '#444441' }} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ fontSize: 8, background: '#A32D2D', color: '#fff' }}>{unreadCount}</span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-2 rounded-xl overflow-hidden z-50"
                style={{ width: 280, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>Notifications</p>
                  <span style={{ fontSize: 10, color: '#5F5E5A' }}>Real-time updates</span>
                </div>
                {listNotifications.length === 0 ? (
                  <div className="px-4 py-3 text-center text-xs text-gray-400">No new notifications</div>
                ) : (
                  listNotifications.map((n, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setShowNotifs(false);
                        if (n.type === 'order') onNavigate('farmer-orders');
                        else if (n.type === 'wallet') onNavigate('wallet');
                        else onNavigate('crop-prediction');
                      }}
                      className="flex gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors"
                      style={{ background: n.read ? '#fff' : '#FAFAF8', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: n.type === 'order' ? '#FAEEDA' : n.type === 'wallet' ? '#EAF3DE' : '#E6F1FB', fontSize: 12 }}>
                        {n.type === 'order' ? '📦' : n.type === 'wallet' ? '💰' : '🤖'}
                      </div>
                      <div className="flex-1">
                        <p style={{ fontSize: 11, color: '#444441', lineHeight: 1.4 }}>{n.msg}</p>
                        <p style={{ fontSize: 10, color: '#5F5E5A', marginTop: 2 }}>{n.time}</p>
                      </div>
                      {!n.read && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: '#3B6D11' }} />}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button onClick={() => onNavigate('add-listing')}
            className="px-4 py-2 rounded-lg transition-all active:scale-[0.98]"
            style={{ background: '#27500A', color: '#fff', fontSize: 13 }}>
            + Add listing
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { icon: Wallet, label: 'Wallet balance', value: walletValue, sub: walletSub, subColor: '#27500A', bg: '#EAF3DE', screen: 'wallet' as Screen },
          { icon: ClipboardList, label: 'Active orders', value: activeOrdersValue, sub: activeOrdersSub, subColor: '#854F0B', bg: '#FAEEDA', screen: 'farmer-orders' as Screen },
          { icon: TrendingUp, label: 'Sales this month', value: salesValue, sub: salesSub, subColor: '#27500A', bg: '#EAF3DE', screen: 'wallet' as Screen },
          { icon: Sprout, label: 'Active crop plan', value: cropPlanValue, sub: cropPlanSub, subColor: '#5F5E5A', bg: '#F1EFE8', screen: 'planting-calendar' as Screen },
        ].map(card => (
          <button key={card.label} onClick={() => onNavigate(card.screen)}
            className="rounded-xl p-4 text-left transition-all hover:opacity-90"
            style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: card.bg }}>
              <card.icon size={16} style={{ color: '#27500A' }} aria-hidden="true" />
            </div>
            <p style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2 }}>{card.label}</p>
            <p style={{ fontSize: 20, fontWeight: 500, color: '#444441' }}>{card.value}</p>
            <p style={{ fontSize: 11, color: card.subColor, marginTop: 2 }}>{card.sub}</p>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Revenue chart */}
        <div className="lg:col-span-2 rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Performance overview</h2>
                <span className="rounded-full px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-800 font-medium border border-emerald-200">
                  6-Month Timeline
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#5F5E5A', marginTop: 1 }}>{monthRangeText}</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-neutral-100 border border-neutral-200">
                <button
                  onClick={() => setSixMonthView('past')}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    sixMonthView === 'past' ? 'bg-white text-emerald-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Past 6 Mos
                </button>
                <button
                  onClick={() => setSixMonthView('projected')}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    sixMonthView === 'projected' ? 'bg-white text-emerald-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Projected
                </button>
              </div>
              <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F1EFE8' }}>
                {(['revenue', 'orders'] as const).map(m => (
                  <button key={m} onClick={() => setChartMode(m)}
                    className="px-2.5 py-1 rounded-md"
                    style={{ fontSize: 11, background: chartMode === m ? '#fff' : 'transparent', color: chartMode === m ? '#27500A' : '#5F5E5A', fontWeight: chartMode === m ? 500 : 400 }}>
                    {m === 'revenue' ? 'Revenue' : 'Orders'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={activeSalesData} barSize={28}>
              <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5F5E5A' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => [chartMode === 'revenue' ? `₦${(v / 1000).toFixed(0)}k` : v, chartMode === 'revenue' ? 'Revenue' : 'Orders']}
                contentStyle={{ border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'rgba(59,109,17,0.06)' }}
              />
              <Bar dataKey={chartMode} fill="#3B6D11" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
            <div>
              <p style={{ fontSize: 10, color: '#5F5E5A' }}>Total revenue</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#27500A' }}>{totalRevenueText}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#5F5E5A' }}>Total orders</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>{totalOrdersText}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#5F5E5A' }}>Avg. order value</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>{avgOrderValueText}</p>
            </div>
          </div>
        </div>

        {/* AI crop suggestions */}
        <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>AI crop suggestions</h2>
            <span className="rounded-full px-2 py-0.5" style={{ fontSize: 9, background: '#EAF3DE', color: '#27500A', border: '0.5px solid #3B6D11' }}>AI</span>
          </div>
          <p style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 12 }}>Based on location, weather & soil data</p>
          <div className="space-y-2">
            {cropSuggestions.map((c) => (
              <div key={c.name}
                className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all hover:border-emerald-400 hover:shadow-xs"
                style={{ border: `0.5px solid ${c.best ? '#3B6D11' : 'rgba(0,0,0,0.08)'}`, background: c.best ? '#EAF3DE' : '#F7F6F2' }}
                onClick={() => onNavigate('crop-prediction', c.name)}
                title={`Analyze suitability for ${c.name}`}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>{c.name}</span>
                    {c.best && <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 8, background: '#27500A', color: '#fff' }}>Best fit</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex-1 h-1 rounded-full" style={{ background: '#D4E8C2' }}>
                      <div className="h-full rounded-full" style={{ width: `${c.match}%`, background: '#3B6D11' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#27500A', flexShrink: 0 }}>{c.match}%</span>
                  </div>
                </div>
                <ChevronRight size={13} className="text-gray-300" />
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate('crop-prediction')} className="w-full mt-3 rounded-lg py-2 transition-all active:scale-[0.98] cursor-pointer"
            style={{ background: '#27500A', color: '#fff', fontSize: 12 }}>
            Generate planting calendar →
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        {/* Weekly tasks */}
        <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>This week's tasks</h2>
              <p style={{ fontSize: 11, color: '#5F5E5A' }}>{doneTasks.size}/{listTasks.length} completed</p>
            </div>
            <button onClick={() => onNavigate('planting-calendar')} style={{ fontSize: 11, color: '#27500A' }} className="flex items-center gap-0.5 cursor-pointer">
              Full calendar <ChevronRight size={12} />
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full mb-4" style={{ background: '#EAF3DE' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${listTasks.length === 0 ? 0 : (doneTasks.size / listTasks.length) * 100}%`, background: '#27500A' }} />
          </div>
          <div className="space-y-2">
            {listTasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">No active tasks. Generate a planting calendar using Crop Suggestions!</div>
            ) : (
              listTasks.map((t, i) => {
                const done = doneTasks.has(i);
                const bs = badgeStyle(t.status);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <button onClick={() => toggleTask(i)} aria-label={done ? 'Mark incomplete' : 'Mark complete'} className="cursor-pointer">
                      {done
                        ? <CheckCircle2 size={16} style={{ color: '#27500A' }} />
                        : <Circle size={16} style={{ color: '#D4E8C2' }} />}
                    </button>
                    <div className="flex-1">
                      <p style={{ fontSize: 12, color: done ? '#5F5E5A' : '#444441', textDecoration: done ? 'line-through' : 'none' }}>{t.task}</p>
                      <p style={{ fontSize: 10, color: phaseColor(t.phase) }}>{t.phase}</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 9, background: bs.bg, color: bs.color }}>
                      {t.date}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Recent orders</h2>
              <p style={{ fontSize: 11, color: '#5F5E5A' }}>
                {isNewUser ? `${liveOrders.length} order${liveOrders.length !== 1 ? 's' : ''}` : '3 new · 2 dispatched'}
              </p>
            </div>
            <button onClick={() => onNavigate('farmer-orders')} style={{ fontSize: 11, color: '#27500A' }} className="flex items-center gap-0.5 cursor-pointer">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2.5">
            {listOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No orders received yet. Active product listings on the marketplace will appear here.</div>
            ) : (
              listOrders.map((o: any) => {
                const s = statusStyle(o.status);
                return (
                  <div
                    key={o.id}
                    onClick={() => onNavigate('farmer-orders')}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-emerald-50/70 transition-colors group"
                    style={{ background: '#F7F6F2' }}
                    title="Click to manage order in Orders screen"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 group-hover:scale-105 transition-transform"
                      style={{ background: o.color || '#27500A', fontSize: 10, fontWeight: 500 }}>
                      {o.avatar || (o.buyerName ? o.buyerName.slice(0, 2).toUpperCase() : '??')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }} className="group-hover:text-emerald-800">{o.buyer || o.buyerName}</p>
                      <p style={{ fontSize: 10, color: '#5F5E5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.product}</p>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>₦{Number(o.amount).toLocaleString()}</p>
                        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 9, background: s.background, color: s.color }}>{s.label}</span>
                      </div>
                      <ChevronRight size={13} className="text-gray-300 group-hover:text-emerald-700 transition-colors" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <button onClick={() => onNavigate('farmer-orders')}
            className="w-full mt-3 rounded-lg py-2 text-center cursor-pointer hover:bg-neutral-50 transition-colors"
            style={{ border: '0.5px solid rgba(0,0,0,0.12)', fontSize: 12, color: '#5F5E5A' }}>
            View all {isNewUser ? liveOrders.length : 7} orders
          </button>
        </div>
      </div>

      {/* Farm health summary */}
      <div className="rounded-xl p-4 mt-5" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Farm health summary</h2>
          <button onClick={() => onNavigate('crop-prediction')} style={{ fontSize: 11, color: '#27500A' }} className="flex items-center gap-0.5 cursor-pointer">
            Detailed sensor telemetry <ChevronRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Soil moisture', value: isNewUser ? '—' : '68%', status: isNewUser ? 'info' : 'good', icon: '💧', statusText: isNewUser ? 'No data' : 'Good condition' },
            { label: 'Crop health score', value: isNewUser ? '—' : '87/100', status: isNewUser ? 'info' : 'good', icon: '🌿', statusText: isNewUser ? 'No plants' : 'Good condition' },
            { label: 'Pest risk level', value: isNewUser ? '—' : 'Low', status: isNewUser ? 'info' : 'good', icon: '🐛', statusText: isNewUser ? 'No data' : 'Good condition' },
            { label: 'Harvest readiness', value: isNewUser ? '—' : '14 weeks', status: 'info', icon: '🌾', statusText: isNewUser ? 'No crop' : 'Info' },
          ].map(h => (
            <div
              key={h.label}
              onClick={() => onNavigate('crop-prediction')}
              className="rounded-xl p-3 cursor-pointer hover:border-emerald-300 hover:shadow-xs transition-all group"
              style={{ background: '#F7F6F2', border: '0.5px solid rgba(0,0,0,0.08)' }}
              title={`Analyze ${h.label} in AI Crop Prediction`}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 20 }}>{h.icon}</span>
                <ChevronRight size={12} className="text-gray-300 group-hover:text-emerald-700 transition-colors" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 500, color: '#444441', marginTop: 4 }}>{h.value}</p>
              <p style={{ fontSize: 10, color: '#5F5E5A' }}>{h.label}</p>
              <div className="mt-1.5 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: h.status === 'good' ? '#27500A' : '#185FA5' }} />
                <span style={{ fontSize: 9, color: h.status === 'good' ? '#27500A' : '#185FA5' }}>
                  {h.statusText}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}