import React, { useState } from 'react';
import { ArrowDownToLine, Lock, TrendingUp, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

const monthlyData = [
  { month: 'Jan', revenue: 92000, withdrawals: 50000 },
  { month: 'Feb', revenue: 142000, withdrawals: 80000 },
  { month: 'Mar', revenue: 198000, withdrawals: 120000 },
  { month: 'Apr', revenue: 165000, withdrawals: 100000 },
  { month: 'May', revenue: 231000, withdrawals: 150000 },
  { month: 'Jun', revenue: 287000, withdrawals: 0 },
];

const transactions = [
  { date: '5 Jun 2026', id: 'ORD-8821', buyer: 'Fatima Bello', product: 'Roma Tomatoes × 20kg', gross: 14000, net: 13580, status: 'escrow', type: 'credit' },
  { date: '5 Jun 2026', id: 'ORD-8820', buyer: 'Emeka Obi', product: 'Sweet Pepper × 10kg', gross: 8500, net: 8245, status: 'escrow', type: 'credit' },
  { date: '3 Jun 2026', id: 'ORD-8817', buyer: 'Hauwa Musa', product: 'Yam × 50kg', gross: 22000, net: 21340, status: 'settled', type: 'credit' },
  { date: '2 Jun 2026', id: 'WIT-0042', buyer: 'Withdrawal', product: 'GTBank — 0023456789', gross: -50000, net: -50000, status: 'completed', type: 'debit' },
  { date: '1 Jun 2026', id: 'ORD-8816', buyer: 'Tunde Akande', product: 'Maize × 100kg', gross: 35000, net: 33950, status: 'settled', type: 'credit' },
  { date: '29 May 2026', id: 'ORD-8815', buyer: 'Ngozi Adeyemi', product: 'Tomatoes × 30kg', gross: 21000, net: 20370, status: 'settled', type: 'credit' },
  { date: '27 May 2026', id: 'WIT-0041', buyer: 'Withdrawal', product: 'GTBank — 0023456789', gross: -100000, net: -100000, status: 'completed', type: 'debit' },
  { date: '25 May 2026', id: 'ORD-8812', buyer: 'Chioma Ike', product: 'Roma Tomatoes × 50kg', gross: 35000, net: 33950, status: 'settled', type: 'credit' },
];

const statusBadge = (s: string) => {
  if (s === 'escrow') return { bg: '#FAEEDA', color: '#854F0B', label: 'In escrow' };
  if (s === 'settled') return { bg: '#EAF3DE', color: '#27500A', label: 'Settled' };
  return { bg: '#F1EFE8', color: '#5F5E5A', label: 'Completed' };
};

interface Props {
  profile?: any;
}

export function WalletScreen({ profile }: Props) {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const handleWithdraw = () => {
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setWithdrawDone(true); setShowWithdraw(false); }, 1500);
  };

  const isNewUser = profile && !profile.isDemo;

  const activeMonthlyData = isNewUser
    ? monthlyData.map(d => ({ ...d, revenue: 0, withdrawals: 0 }))
    : monthlyData;

  const activeTransactions = isNewUser ? [] : transactions;

  const totalRevenue = activeMonthlyData.reduce((a, b) => a + b.revenue, 0);
  const totalWithdrawn = activeMonthlyData.reduce((a, b) => a + b.withdrawals, 0);

  const displayBalance = isNewUser ? 0 : 287400;
  const displayEscrow = isNewUser ? 0 : 48500;

  return (
    <div className="p-5 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#27500A' }}>Wallet</h1>
        <p style={{ fontSize: 13, color: '#5F5E5A' }}>
          {profile?.farmName || 'Danjuma Farm'} · {profile?.bankName || 'Guaranteed Trust Bank'} {profile?.bankAccountNumber || '0023456789'}
        </p>
      </div>

      {withdrawDone && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: '#EAF3DE', border: '0.5px solid #3B6D11' }}>
          <TrendingUp size={14} style={{ color: '#27500A' }} />
          <p style={{ fontSize: 12, color: '#27500A' }}>Withdrawal of ₦{Number(amount).toLocaleString()} initiated — arrives in 1–2 business days.</p>
        </div>
      )}

      {/* Balance cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl p-5 sm:col-span-1" style={{ background: '#27500A' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Available balance</p>
          <p style={{ fontSize: 28, fontWeight: 500, color: '#fff' }}>₦{displayBalance.toLocaleString()}</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{isNewUser ? 'Deposit details clear' : 'Ready to withdraw'}</p>
          <button onClick={() => setShowWithdraw(!showWithdraw)}
            disabled={displayBalance === 0}
            className="mt-4 flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.15)', fontSize: 12, color: '#fff' }}
            aria-label="Withdraw funds">
            <ArrowDownToLine size={13} /> Withdraw funds
          </button>
        </div>
        <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Lock size={12} style={{ color: '#854F0B' }} aria-hidden="true" />
            <p style={{ fontSize: 11, color: '#854F0B', fontWeight: 500 }}>Escrowed</p>
          </div>
          <p style={{ fontSize: 24, fontWeight: 500, color: '#444441' }}>₦{displayEscrow.toLocaleString()}</p>
          <p style={{ fontSize: 10, color: '#5F5E5A', marginTop: 4 }}>{isNewUser ? '0 orders pending delivery' : '2 orders pending delivery'}</p>
          <p style={{ fontSize: 10, color: '#5F5E5A' }}>Auto-releases in ≤7 days</p>
        </div>
        <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <p style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 6 }}>Lifetime earnings</p>
          <p style={{ fontSize: 24, fontWeight: 500, color: '#444441' }}>₦{totalRevenue.toLocaleString()}</p>
          <p style={{ fontSize: 10, color: '#5F5E5A', marginTop: 4 }}>Total withdrawn</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#27500A' }}>₦{totalWithdrawn.toLocaleString()}</p>
        </div>
      </div>

      {/* Withdraw panel */}
      {showWithdraw && (
        <div className="rounded-xl p-4 mb-5" style={{ border: '1px solid #3B6D11', background: '#EAF3DE' }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#27500A', marginBottom: 12 }}>Withdraw to bank account</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 12, color: '#444441', display: 'block', marginBottom: 5 }}>Amount (₦)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: 14, color: '#5F5E5A' }}>₦</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="50,000" className="w-full pl-8 pr-4 rounded-lg outline-none"
                  style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#fff' }} />
              </div>
              <p style={{ fontSize: 10, color: '#5F5E5A', marginTop: 3 }}>Min ₦1,000 · Max ₦{displayBalance.toLocaleString()}</p>
              <div className="flex gap-2 mt-2">
                {[50000, 100000, 200000].map(q => (
                  <button key={q} onClick={() => setAmount(String(q))} className="px-2 py-1 rounded-md"
                    style={{ fontSize: 10, background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)', color: '#27500A' }}>
                    ₦{(q / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 4 }}>Destination account</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>Guaranteed Trust Bank</p>
              <p style={{ fontSize: 12, color: '#444441' }}>0023456789</p>
              <p style={{ fontSize: 11, color: '#5F5E5A' }}>AMINU DANJUMA</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleWithdraw} disabled={!amount || processing || Number(amount) < 1000 || Number(amount) > displayBalance}
              className="flex-1 rounded-lg py-2 transition-all"
              style={{ background: processing ? '#aaa' : '#27500A', color: '#fff', fontSize: 13, opacity: !amount ? 0.5 : 1 }}>
              {processing ? 'Processing…' : `Withdraw ₦${Number(amount || 0).toLocaleString()}`}
            </button>
            <button onClick={() => setShowWithdraw(false)} className="px-4 rounded-lg py-2"
              style={{ border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#5F5E5A' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Revenue chart */}
      <div className="rounded-xl p-4 mb-5" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Revenue overview</h2>
            <p style={{ fontSize: 11, color: '#5F5E5A' }}>January – June 2026</p>
          </div>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ border: '0.5px solid rgba(0,0,0,0.1)' }}>
            {(['bar', 'line'] as const).map(m => (
              <button key={m} onClick={() => setChartType(m)}
                className="px-2 py-1 rounded text-center"
                style={{ fontSize: 10, background: chartType === m ? '#EAF3DE' : 'transparent', color: chartType === m ? '#27500A' : '#5F5E5A' }}>
                {m === 'bar' ? '▊ Bar' : '↗ Line'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          {chartType === 'bar' ? (
            <BarChart data={activeMonthlyData} barSize={24} barGap={4}>
              <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5F5E5A' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} contentStyle={{ border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="revenue" fill="#3B6D11" radius={[3, 3, 0, 0]} name="Revenue" />
              <Bar dataKey="withdrawals" fill="#EAF3DE" radius={[3, 3, 0, 0]} name="Withdrawn" />
            </BarChart>
          ) : (
            <LineChart data={activeMonthlyData}>
              <CartesianGrid stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5F5E5A' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} contentStyle={{ border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#3B6D11" strokeWidth={2} dot={{ fill: '#3B6D11', r: 3 }} name="Revenue" />
              <Line type="monotone" dataKey="withdrawals" stroke="#EAF3DE" strokeWidth={2} strokeDasharray="4 2" dot={{ fill: '#639922', r: 3 }} name="Withdrawn" />
            </LineChart>
          ) as React.ReactElement}
        </ResponsiveContainer>
        <div className="flex gap-4 pt-3" style={{ borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full" style={{ background: '#3B6D11' }} />
            <span style={{ fontSize: 10, color: '#5F5E5A' }}>Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full" style={{ background: '#EAF3DE', border: '1px solid #639922' }} />
            <span style={{ fontSize: 10, color: '#5F5E5A' }}>Withdrawn</span>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#F1EFE8', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>Transaction history</h2>
          <button className="flex items-center gap-1" style={{ fontSize: 11, color: '#5F5E5A' }}>
            <Download size={12} /> Export CSV
          </button>
        </div>
        {activeTransactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400 bg-white" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
            No recent transactions. Your marketplace sales activity will be cataloged here.
          </div>
        ) : (
          activeTransactions.map((t, i) => {
            const badge = statusBadge(t.status);
            const expanded = expandedTx === t.id;
            return (
              <div key={i}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}
                  onClick={() => setExpandedTx(expanded ? null : t.id)}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: t.type === 'credit' ? '#EAF3DE' : '#FCEBEB', fontSize: 14 }}>
                    {t.type === 'credit' ? '↑' : '↓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>{t.buyer}</p>
                    <p style={{ fontSize: 11, color: '#5F5E5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.product}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p style={{ fontSize: 13, fontWeight: 500, color: t.type === 'credit' ? '#27500A' : '#A32D2D' }}>
                      {t.type === 'credit' ? '+' : ''}₦{Math.abs(t.net).toLocaleString()}
                    </p>
                    <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 9, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  </div>
                  {expanded ? <ChevronUp size={13} style={{ color: '#5F5E5A', flexShrink: 0 }} /> : <ChevronDown size={13} style={{ color: '#5F5E5A', flexShrink: 0 }} />}
                </div>
                {expanded && (
                  <div className="px-4 pb-3 pt-1" style={{ background: '#FAFAF8', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                    <div className="grid grid-cols-3 gap-3">
                      <div><p style={{ fontSize: 10, color: '#5F5E5A' }}>Order ID</p><p style={{ fontSize: 11, color: '#444441' }}>{t.id}</p></div>
                      <div><p style={{ fontSize: 10, color: '#5F5E5A' }}>Date</p><p style={{ fontSize: 11, color: '#444441' }}>{t.date}</p></div>
                      <div><p style={{ fontSize: 10, color: '#5F5E5A' }}>Gross amount</p><p style={{ fontSize: 11, color: '#444441' }}>₦{Math.abs(t.gross).toLocaleString()}</p></div>
                      {t.type === 'credit' && <div><p style={{ fontSize: 10, color: '#5F5E5A' }}>Platform fee (3%)</p><p style={{ fontSize: 11, color: '#A32D2D' }}>−₦{(t.gross * 0.03).toFixed(0)}</p></div>}
                      <div><p style={{ fontSize: 10, color: '#5F5E5A' }}>Net settled</p><p style={{ fontSize: 11, fontWeight: 500, color: '#27500A' }}>₦{Math.abs(t.net).toLocaleString()}</p></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
