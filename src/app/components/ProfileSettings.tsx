import React, { useState } from 'react';
import { User, Phone, MapPin, Wheat, Save, CheckCircle, ArrowLeft } from 'lucide-react';
import { Screen } from './types';
import { createOrUpdateUserProfile, auth, logUserAction } from '../firebase';

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa',
  'Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger',
  'Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
  'Abuja (FCT)',
];

interface Props {
  onNavigate: (s: Screen) => void;
  profile?: any;
  onProfileUpdate?: (p: any) => void;
}

export function ProfileSettings({ onNavigate, profile, onProfileUpdate }: Props) {
  const role = profile?.role || 'consumer';

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [farmName, setFarmName] = useState(profile?.farmName || '');
  const [farmState, setFarmState] = useState(profile?.farmState || 'Kaduna');
  const [farmSize, setFarmSize] = useState(profile?.farmSize || '');
  const [deliveryAddress, setDeliveryAddress] = useState(profile?.deliveryAddress || '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Full name is required'); return; }
    const uid = auth.currentUser?.uid;
    if (!uid) { setError('Not authenticated — please log in again'); return; }

    setSaving(true);
    setError(null);
    try {
      const updated = {
        fullName: fullName.trim(),
        email: profile?.email || '',
        role,
        phone: phone.trim(),
        ...(role === 'farmer'
          ? { farmName: farmName.trim(), farmState, farmSize: farmSize || '0' }
          : { deliveryAddress: deliveryAddress.trim() }),
      };
      await createOrUpdateUserProfile(uid, updated);
      await logUserAction('PROFILE_UPDATE', 'User updated their profile in settings', { uid, role });
      const merged = { ...profile, ...updated };
      onProfileUpdate?.(merged);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  return (
    <div className="p-5 lg:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => onNavigate(role === 'farmer' ? 'farmer-dashboard' : 'consumer-dashboard')}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={{ background: '#F1EFE8', border: '0.5px solid rgba(0,0,0,0.1)' }}>
          <ArrowLeft size={15} style={{ color: '#5F5E5A' }} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#444441' }}>Profile settings</h1>
          <p style={{ fontSize: 12, color: '#5F5E5A' }}>Edit your personal and account information</p>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6 p-4 rounded-xl" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ background: role === 'farmer' ? '#27500A' : '#185FA5', fontSize: 20, fontWeight: 600 }}>
          {initials}
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 500, color: '#444441' }}>{fullName || 'Your Name'}</p>
          <p style={{ fontSize: 12, color: '#5F5E5A' }}>{profile?.email || ''}</p>
          <span className="inline-block rounded-full px-2 py-0.5 mt-1"
            style={{ fontSize: 10, background: role === 'farmer' ? '#EAF3DE' : '#E6F1FB', color: role === 'farmer' ? '#27500A' : '#185FA5' }}>
            {role === 'farmer' ? '🌾 Farmer' : '🛒 Consumer'}
          </span>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#991B1B', border: '0.5px solid rgba(153,27,27,0.2)' }}>
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 p-3 rounded-lg text-xs flex items-center gap-2" style={{ background: '#EAF3DE', color: '#27500A', border: '0.5px solid #3B6D11' }}>
          <CheckCircle size={14} /> Profile saved successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Full name */}
        <div className="rounded-xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: '#444441', marginBottom: 12 }}>Personal information</h2>
          <div className="space-y-3">
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>Full name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5F5E5A' }} />
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name"
                  className="w-full pl-9 pr-3 rounded-lg outline-none"
                  style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#FAFAF8' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>Phone number</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5F5E5A' }} />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234 800 000 0000"
                  className="w-full pl-9 pr-3 rounded-lg outline-none"
                  style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#FAFAF8' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>Email address</label>
              <input type="email" value={profile?.email || ''} disabled
                className="w-full px-3 rounded-lg"
                style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.1)', fontSize: 13, color: '#5F5E5A', background: '#F1EFE8', cursor: 'not-allowed' }} />
              <p style={{ fontSize: 10, color: '#5F5E5A', marginTop: 3 }}>Email cannot be changed</p>
            </div>
          </div>
        </div>

        {/* Role-specific fields */}
        <div className="rounded-xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: '#444441', marginBottom: 12 }}>
            {role === 'farmer' ? 'Farm information' : 'Delivery information'}
          </h2>
          {role === 'farmer' ? (
            <div className="space-y-3">
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>Farm name</label>
                <div className="relative">
                  <Wheat size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5F5E5A' }} />
                  <input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} placeholder="e.g. Danjuma Farm"
                    className="w-full pl-9 pr-3 rounded-lg outline-none"
                    style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#FAFAF8' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>State</label>
                <select value={farmState} onChange={e => setFarmState(e.target.value)}
                  className="w-full px-3 rounded-lg outline-none"
                  style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#FAFAF8' }}>
                  {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>Farm size (hectares)</label>
                <input type="number" value={farmSize} onChange={e => setFarmSize(e.target.value)} placeholder="e.g. 5"
                  min="0" step="0.1"
                  className="w-full px-3 rounded-lg outline-none"
                  style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#FAFAF8' }} />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#5F5E5A', display: 'block', marginBottom: 4 }}>Delivery address</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-3" style={{ color: '#5F5E5A' }} />
                <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Street address, City, State"
                  rows={3}
                  className="w-full pl-9 pr-3 pt-2 rounded-lg outline-none resize-none"
                  style={{ border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#FAFAF8' }} />
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving}
          className="w-full rounded-xl py-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: saving ? '#639922' : '#27500A', color: '#fff', fontSize: 14, fontWeight: 500 }}>
          {saving ? (
            <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Saving…</>
          ) : (
            <><Save size={16} />Save changes</>
          )}
        </button>
      </form>
    </div>
  );
}
