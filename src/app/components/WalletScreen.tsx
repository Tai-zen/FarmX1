import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownToLine, Lock, TrendingUp, Download, ChevronDown, ChevronUp,
  Building2, Check, Edit3, X, AlertCircle, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { auth, createOrUpdateUserProfile, logUserAction } from '../firebase';

export const NIGERIAN_BANKS = [
  'Guaranty Trust Bank (GTBank)',
  'Access Bank',
  'Zenith Bank',
  'First Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Kuda Microfinance Bank',
  'OPay Digital Services',
  'Palmpay',
  'Moniepoint Microfinance Bank',
  'Stanbic IBTC Bank',
  'Fidelity Bank',
  'Sterling Bank',
  'Union Bank of Nigeria',
  'First City Monument Bank (FCMB)',
  'Wema Bank (ALAT)',
  'Polaris Bank',
  'Jaiz Bank',
  'Taj Bank'
];

export interface DestinationAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
  accountType?: 'Savings' | 'Current';
}

// Generates 6-month datasets relative to current month
export function get6MonthsFromCurrent(now = new Date(), mode: 'past' | 'projected' = 'past') {
  const months = [];
  const basePastRevenues = [145000, 182000, 210000, 195000, 248000, 287000];
  const basePastOrders = [22, 28, 33, 30, 39, 44];
  const basePastWithdrawals = [80000, 100000, 120000, 110000, 160000, 50000];

  const baseProjRevenues = [287000, 315000, 340000, 365000, 395000, 420000];
  const baseProjOrders = [44, 48, 52, 56, 61, 65];
  const baseProjWithdrawals = [100000, 150000, 160000, 180000, 200000, 220000];

  if (mode === 'past') {
    // 6 months ending in the current month (i.e. May to October if Oct)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const idx = 5 - i;
      months.push({
        month: d.toLocaleString('en-US', { month: 'short' }),
        fullMonth: d.toLocaleString('en-US', { month: 'long' }),
        year: d.getFullYear(),
        revenue: basePastRevenues[idx],
        orders: basePastOrders[idx],
        withdrawals: basePastWithdrawals[idx],
        isCurrentMonth: i === 0,
      });
    }
  } else {
    // 6 months starting from current month
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({
        month: d.toLocaleString('en-US', { month: 'short' }),
        fullMonth: d.toLocaleString('en-US', { month: 'long' }),
        year: d.getFullYear(),
        revenue: baseProjRevenues[i],
        orders: baseProjOrders[i],
        withdrawals: baseProjWithdrawals[i],
        isCurrentMonth: i === 0,
      });
    }
  }

  return months;
}

const statusBadge = (s: string) => {
  if (s === 'escrow') return { bg: '#FAEEDA', color: '#854F0B', label: 'In escrow' };
  if (s === 'settled') return { bg: '#EAF3DE', color: '#27500A', label: 'Settled' };
  return { bg: '#F1EFE8', color: '#5F5E5A', label: 'Completed' };
};

interface Props {
  profile?: any;
  onProfileUpdate?: (p: any) => void;
}

export function WalletScreen({ profile, onProfileUpdate }: Props) {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [sixMonthView, setSixMonthView] = useState<'past' | 'projected'>('past');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  // Destination account states
  const [showChangeAccount, setShowChangeAccount] = useState(false);
  const uid = auth.currentUser?.uid || profile?.uid || 'guest-farmer';
  const storageKey = `farmx_destination_account_${uid}`;

  const defaultAccount: DestinationAccount = {
    bankName: profile?.bankName || 'Guaranty Trust Bank (GTBank)',
    accountNumber: profile?.bankAccountNumber || '0023456789',
    accountName: profile?.bankAccountName || profile?.fullName || 'AMINU DANJUMA',
    accountType: profile?.bankAccountType || 'Savings',
  };

  const [destinationAccount, setDestinationAccount] = useState<DestinationAccount>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultAccount;
  });

  // Edit form states
  const [editBank, setEditBank] = useState(destinationAccount.bankName);
  const [editNumber, setEditNumber] = useState(destinationAccount.accountNumber);
  const [editName, setEditName] = useState(destinationAccount.accountName);
  const [editType, setEditType] = useState<'Savings' | 'Current'>(destinationAccount.accountType || 'Savings');
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSuccessMsg, setAccountSuccessMsg] = useState<string | null>(null);
  const [accountErrorMsg, setAccountErrorMsg] = useState<string | null>(null);

  // Synchronize when profile changes
  useEffect(() => {
    if (profile?.bankAccountNumber && profile?.bankAccountNumber !== destinationAccount.accountNumber) {
      setDestinationAccount({
        bankName: profile.bankName || destinationAccount.bankName,
        accountNumber: profile.bankAccountNumber,
        accountName: profile.bankAccountName || destinationAccount.accountName,
        accountType: profile.bankAccountType || destinationAccount.accountType,
      });
    }
  }, [profile]);

  // Compute 6 months from current month
  const monthlyData = useMemo(() => {
    return get6MonthsFromCurrent(new Date(), sixMonthView);
  }, [sixMonthView]);

  const monthRangeText = useMemo(() => {
    if (monthlyData.length === 0) return '';
    const first = monthlyData[0];
    const last = monthlyData[monthlyData.length - 1];
    return `${first.fullMonth} ${first.year} – ${last.fullMonth} ${last.year}`;
  }, [monthlyData]);

  // Transactions list
  const [transactionsList, setTransactionsList] = useState(() => {
    const now = new Date();
    const curMonthName = now.toLocaleString('en-US', { month: 'short' });
    const curYear = now.getFullYear();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthName = prevMonthDate.toLocaleString('en-US', { month: 'short' });

    return [
      { date: `5 ${curMonthName} ${curYear}`, id: 'ORD-8821', buyer: 'Fatima Bello', product: 'Roma Tomatoes × 20kg', gross: 14000, net: 13580, status: 'escrow', type: 'credit' },
      { date: `4 ${curMonthName} ${curYear}`, id: 'ORD-8820', buyer: 'Emeka Obi', product: 'Sweet Pepper × 10kg', gross: 8500, net: 8245, status: 'escrow', type: 'credit' },
      { date: `2 ${curMonthName} ${curYear}`, id: 'ORD-8817', buyer: 'Hauwa Musa', product: 'Yam × 50kg', gross: 22000, net: 21340, status: 'settled', type: 'credit' },
      { date: `1 ${curMonthName} ${curYear}`, id: 'WIT-0042', buyer: 'Withdrawal', product: `${destinationAccount.bankName.split(' ')[0]} — ${destinationAccount.accountNumber}`, gross: -50000, net: -50000, status: 'completed', type: 'debit' },
      { date: `28 ${prevMonthName} ${curYear}`, id: 'ORD-8816', buyer: 'Tunde Akande', product: 'Maize × 100kg', gross: 35000, net: 33950, status: 'settled', type: 'credit' },
      { date: `25 ${prevMonthName} ${curYear}`, id: 'ORD-8815', buyer: 'Ngozi Adeyemi', product: 'Tomatoes × 30kg', gross: 21000, net: 20370, status: 'settled', type: 'credit' },
      { date: `20 ${prevMonthName} ${curYear}`, id: 'WIT-0041', buyer: 'Withdrawal', product: `${destinationAccount.bankName.split(' ')[0]} — ${destinationAccount.accountNumber}`, gross: -100000, net: -100000, status: 'completed', type: 'debit' },
      { date: `18 ${prevMonthName} ${curYear}`, id: 'ORD-8812', buyer: 'Chioma Ike', product: 'Roma Tomatoes × 50kg', gross: 35000, net: 33950, status: 'settled', type: 'credit' },
    ];
  });

  // Save new destination account
  const handleSaveDestinationAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountErrorMsg(null);
    setAccountSuccessMsg(null);

    const cleanNum = editNumber.replace(/\D/g, '');
    if (cleanNum.length !== 10) {
      setAccountErrorMsg('NUBAN bank account number must be exactly 10 digits');
      return;
    }
    if (!editName.trim()) {
      setAccountErrorMsg('Account holder name is required');
      return;
    }

    setSavingAccount(true);
    const updated: DestinationAccount = {
      bankName: editBank,
      accountNumber: cleanNum,
      accountName: editName.trim().toUpperCase(),
      accountType: editType,
    };

    try {
      // 1. Save locally
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setDestinationAccount(updated);

      // 2. Persist to Firestore if authenticated
      if (auth.currentUser) {
        await createOrUpdateUserProfile(auth.currentUser.uid, {
          bankName: updated.bankName,
          bankAccountNumber: updated.accountNumber,
          bankAccountName: updated.accountName,
          bankAccountType: updated.accountType,
        });

        await logUserAction('WALLET_DESTINATION_ACCOUNT_CHANGED', 'Farmer updated payout destination bank account', {
          bankName: updated.bankName,
          accountNumber: updated.accountNumber.slice(-4),
        });
      }

      // 3. Notify parent app state
      if (onProfileUpdate) {
        onProfileUpdate({
          ...profile,
          bankName: updated.bankName,
          bankAccountNumber: updated.accountNumber,
          bankAccountName: updated.accountName,
          bankAccountType: updated.accountType,
        });
      }

      setAccountSuccessMsg('Destination account updated successfully!');
      setTimeout(() => {
        setAccountSuccessMsg(null);
        setShowChangeAccount(false);
      }, 1500);
    } catch (err: any) {
      console.warn('Saving destination account to Firestore notice:', err);
      // Still update local UI
      setAccountSuccessMsg('Destination account updated for this session!');
      setTimeout(() => {
        setAccountSuccessMsg(null);
        setShowChangeAccount(false);
      }, 1500);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleWithdraw = () => {
    setProcessing(true);
    const withdrawAmount = Number(amount);
    setTimeout(() => {
      setProcessing(false);
      setWithdrawDone(true);
      setShowWithdraw(false);

      // Add withdrawal transaction
      const now = new Date();
      const dateStr = `${now.getDate()} ${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`;
      const newTx = {
        date: dateStr,
        id: `WIT-00${Math.floor(45 + Math.random() * 50)}`,
        buyer: 'Withdrawal',
        product: `${destinationAccount.bankName.split(' ')[0]} — ${destinationAccount.accountNumber}`,
        gross: -withdrawAmount,
        net: -withdrawAmount,
        status: 'completed',
        type: 'debit',
      };
      setTransactionsList(prev => [newTx, ...prev]);
    }, 1200);
  };

  const isNewUser = profile && !profile.isDemo && !profile.uid?.startsWith('demo');

  const activeMonthlyData = isNewUser
    ? monthlyData.map(d => ({ ...d, revenue: 0, withdrawals: 0 }))
    : monthlyData;

  const activeTransactions = isNewUser ? [] : transactionsList;

  const totalRevenue = activeMonthlyData.reduce((a, b) => a + b.revenue, 0);
  const totalWithdrawn = activeMonthlyData.reduce((a, b) => a + b.withdrawals, 0);

  const displayBalance = isNewUser ? 0 : 287400;
  const displayEscrow = isNewUser ? 0 : 48500;

  return (
    <div className="p-5 lg:p-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#27500A' }}>Wallet & Earnings</h1>
          <p style={{ fontSize: 13, color: '#5F5E5A' }}>
            {profile?.farmName || 'Danjuma Farm'} · {destinationAccount.bankName} ({destinationAccount.accountNumber})
          </p>
        </div>
        <button
          onClick={() => {
            setEditBank(destinationAccount.bankName);
            setEditNumber(destinationAccount.accountNumber);
            setEditName(destinationAccount.accountName);
            setEditType(destinationAccount.accountType || 'Savings');
            setShowChangeAccount(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium self-start sm:self-auto transition-all"
          style={{ background: '#EAF3DE', color: '#27500A', border: '0.5px solid #3B6D11' }}
        >
          <Building2 size={14} /> Change Destination Account
        </button>
      </div>

      {/* Account Changed Alert */}
      {withdrawDone && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: '#EAF3DE', border: '0.5px solid #3B6D11' }}>
          <TrendingUp size={14} style={{ color: '#27500A' }} />
          <p style={{ fontSize: 12, color: '#27500A' }}>
            Withdrawal of ₦{Number(amount).toLocaleString()} initiated to <strong>{destinationAccount.bankName} ({destinationAccount.accountNumber})</strong> — arrives in 1–2 business days.
          </p>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl p-5 sm:col-span-1 shadow-sm" style={{ background: '#27500A' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Available balance</p>
          <p style={{ fontSize: 28, fontWeight: 500, color: '#fff' }}>₦{displayBalance.toLocaleString()}</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{isNewUser ? 'Deposit details clear' : 'Ready to withdraw'}</p>
          <button
            onClick={() => setShowWithdraw(!showWithdraw)}
            disabled={displayBalance === 0}
            className="mt-4 flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/25"
            style={{ background: 'rgba(255,255,255,0.18)', fontSize: 12, color: '#fff' }}
            aria-label="Withdraw funds"
          >
            <ArrowDownToLine size={13} /> Withdraw funds
          </button>
        </div>

        <div className="rounded-xl p-4 shadow-sm" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Lock size={12} style={{ color: '#854F0B' }} aria-hidden="true" />
            <p style={{ fontSize: 11, color: '#854F0B', fontWeight: 500 }}>Escrowed</p>
          </div>
          <p style={{ fontSize: 24, fontWeight: 500, color: '#444441' }}>₦{displayEscrow.toLocaleString()}</p>
          <p style={{ fontSize: 10, color: '#5F5E5A', marginTop: 4 }}>{isNewUser ? '0 orders pending delivery' : '2 orders pending delivery'}</p>
          <p style={{ fontSize: 10, color: '#5F5E5A' }}>Auto-releases in ≤7 days</p>
        </div>

        <div className="rounded-xl p-4 shadow-sm" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
          <p style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 6 }}>6-Month Revenue</p>
          <p style={{ fontSize: 24, fontWeight: 500, color: '#444441' }}>₦{totalRevenue.toLocaleString()}</p>
          <p style={{ fontSize: 10, color: '#5F5E5A', marginTop: 4 }}>Total withdrawn (6 mo)</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#27500A' }}>₦{totalWithdrawn.toLocaleString()}</p>
        </div>
      </div>

      {/* Destination Account Card with Quick Edit */}
      <div className="rounded-xl p-4 mb-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ border: '0.5px solid rgba(39,80,10,0.2)', background: '#fff' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#EAF3DE', color: '#27500A' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#27500A' }}>{destinationAccount.bankName}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <ShieldCheck size={10} /> Verified Payout
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#444441', marginTop: 1 }}>
              Account Number: <strong className="font-mono text-sm tracking-wide text-neutral-900">{destinationAccount.accountNumber}</strong>
              <span className="mx-1.5 text-neutral-300">·</span>
              <span className="text-neutral-600">{destinationAccount.accountName}</span>
              <span className="mx-1.5 text-neutral-300">·</span>
              <span className="text-neutral-500 text-xs">{destinationAccount.accountType || 'Savings'}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditBank(destinationAccount.bankName);
            setEditNumber(destinationAccount.accountNumber);
            setEditName(destinationAccount.accountName);
            setEditType(destinationAccount.accountType || 'Savings');
            setShowChangeAccount(true);
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 flex items-center gap-1.5 self-start sm:self-auto transition-colors"
        >
          <Edit3 size={13} /> Change Account
        </button>
      </div>

      {/* Change Destination Account Modal */}
      {showChangeAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-neutral-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-800">
                  <Building2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">Change Destination Account</h3>
                  <p className="text-[11px] text-neutral-500">Provide verified Nigerian bank details for automatic payouts</p>
                </div>
              </div>
              <button
                onClick={() => setShowChangeAccount(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
              >
                <X size={15} />
              </button>
            </div>

            {accountSuccessMsg && (
              <div className="p-3 mb-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 size={15} className="flex-shrink-0" />
                <span>{accountSuccessMsg}</span>
              </div>
            )}

            {accountErrorMsg && (
              <div className="p-3 mb-3 rounded-lg bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{accountErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveDestinationAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Bank Name</label>
                <select
                  value={editBank}
                  onChange={(e) => setEditBank(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  10-Digit NUBAN Account Number
                </label>
                <input
                  type="text"
                  maxLength={10}
                  inputMode="numeric"
                  value={editNumber}
                  onChange={(e) => setEditNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="0023456789"
                  className="w-full px-3 py-2 font-mono text-sm tracking-wider rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                />
                <p className="text-[10px] text-neutral-500 mt-1">Must be exactly 10 digits as issued by your bank.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Account Holder Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="AMINU DANJUMA"
                  className="w-full px-3 py-2 text-xs uppercase rounded-xl border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                />
                <p className="text-[10px] text-neutral-500 mt-1">Must match the registered name on your bank BVN record.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Account Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Savings', 'Current'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditType(t)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                        editType === t
                          ? 'bg-emerald-50 border-emerald-700 text-emerald-900 font-semibold'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {t} Account
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-medium text-white shadow-sm transition-all"
                  style={{ background: '#27500A' }}
                >
                  {savingAccount ? 'Saving…' : 'Save Destination Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowChangeAccount(false)}
                  className="py-2 px-4 rounded-xl text-xs font-medium border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Panel */}
      {showWithdraw && (
        <div className="rounded-xl p-4 mb-5 shadow-sm" style={{ border: '1px solid #3B6D11', background: '#EAF3DE' }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#27500A', marginBottom: 12 }}>Withdraw to bank account</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 12, color: '#444441', display: 'block', marginBottom: 5 }}>Amount (₦)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: 14, color: '#5F5E5A' }}>₦</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="50,000"
                  className="w-full pl-8 pr-4 rounded-lg outline-none"
                  style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#fff' }}
                />
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

            <div className="rounded-xl p-3 flex flex-col justify-between" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)' }}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p style={{ fontSize: 11, color: '#5F5E5A' }}>Destination account</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditBank(destinationAccount.bankName);
                      setEditNumber(destinationAccount.accountNumber);
                      setEditName(destinationAccount.accountName);
                      setEditType(destinationAccount.accountType || 'Savings');
                      setShowChangeAccount(true);
                    }}
                    className="text-[11px] text-emerald-800 hover:underline font-medium"
                  >
                    Change
                  </button>
                </div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>{destinationAccount.bankName}</p>
                <p style={{ fontSize: 12, color: '#444441', fontFamily: 'monospace' }}>{destinationAccount.accountNumber}</p>
                <p style={{ fontSize: 11, color: '#5F5E5A' }}>{destinationAccount.accountName}</p>
              </div>
              <p className="text-[10px] text-neutral-400 mt-2">Instant settlement through NIBSS payout</p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleWithdraw}
              disabled={!amount || processing || Number(amount) < 1000 || Number(amount) > displayBalance}
              className="flex-1 rounded-lg py-2 transition-all"
              style={{ background: processing ? '#aaa' : '#27500A', color: '#fff', fontSize: 13, opacity: !amount ? 0.5 : 1 }}
            >
              {processing ? 'Processing…' : `Withdraw ₦${Number(amount || 0).toLocaleString()} to ${destinationAccount.bankName.split(' ')[0]}`}
            </button>
            <button onClick={() => setShowWithdraw(false)} className="px-4 rounded-lg py-2"
              style={{ border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#5F5E5A' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Revenue Chart: 6 Months from Current Month */}
      <div className="rounded-xl p-4 mb-5 shadow-sm" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Revenue overview</h2>
              <span className="rounded-full px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-800 font-medium border border-emerald-200">
                6-Month Timeline
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#5F5E5A', marginTop: 1 }}>{monthRangeText}</p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Selector (Past 6 Months vs Next 6 Months) */}
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-neutral-100 border border-neutral-200">
              <button
                onClick={() => setSixMonthView('past')}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  sixMonthView === 'past' ? 'bg-white text-emerald-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Past 6 Months
              </button>
              <button
                onClick={() => setSixMonthView('projected')}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  sixMonthView === 'projected' ? 'bg-white text-emerald-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                Projected 6 Mos
              </button>
            </div>

            {/* Bar vs Line */}
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
        </div>

        <ResponsiveContainer width="100%" height={170}>
          {chartType === 'bar' ? (
            <BarChart data={activeMonthlyData} barSize={26} barGap={4}>
              <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5F5E5A' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} contentStyle={{ border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="revenue" fill="#3B6D11" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="withdrawals" fill="#EAF3DE" radius={[4, 4, 0, 0]} name="Withdrawn" />
            </BarChart>
          ) : (
            <LineChart data={activeMonthlyData}>
              <CartesianGrid stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5F5E5A' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} contentStyle={{ border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#3B6D11" strokeWidth={2.5} dot={{ fill: '#3B6D11', r: 3.5 }} name="Revenue" />
              <Line type="monotone" dataKey="withdrawals" stroke="#854F0B" strokeWidth={2} strokeDasharray="4 2" dot={{ fill: '#854F0B', r: 3 }} name="Withdrawn" />
            </LineChart>
          ) as React.ReactElement}
        </ResponsiveContainer>

        <div className="flex gap-4 pt-3 mt-1" style={{ borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full" style={{ background: '#3B6D11' }} />
            <span style={{ fontSize: 10, color: '#5F5E5A' }}>Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full" style={{ background: '#EAF3DE', border: '1px solid #3B6D11' }} />
            <span style={{ fontSize: 10, color: '#5F5E5A' }}>Withdrawn</span>
          </div>
          <div className="ml-auto text-[10px] text-neutral-400">
            6 months ending {monthlyData[monthlyData.length - 1]?.fullMonth} {monthlyData[monthlyData.length - 1]?.year}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#F1EFE8', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>Transaction history</h2>
          <button className="flex items-center gap-1 hover:text-neutral-900 transition-colors" style={{ fontSize: 11, color: '#5F5E5A' }}>
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
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50/50 transition-colors"
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
                      <div><p style={{ fontSize: 10, color: '#5F5E5A' }}>Order / Ref ID</p><p style={{ fontSize: 11, color: '#444441' }}>{t.id}</p></div>
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
