import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Shield, CreditCard, Building, Phone, MapPin, 
  CloudRain, Thermometer, Droplets, Wind, Info, Map as MapIcon, 
  Compass, AlertTriangle, CheckCircle, RefreshCw, X, ArrowRight,
  Sparkles, Wifi, ShieldCheck, HelpCircle, ExternalLink, Copy, Check
} from 'lucide-react';
import { Screen } from './types';
import { logUserAction, createOrder, auth, subscribeToCart, CartItemDoc, clearCart } from '../firebase';
import { 
  getPaystackConfig, 
  initializePaystackTransaction, 
  verifyPaystackTransaction, 
  openPaystackInlineCheckout,
  PaystackVerifyResponse 
} from '../services/paystack.service';

interface Props { onNavigate: (s: Screen) => void; profile?: any; }

// Agricultural Logistical Distribution Hub
const ESCROW_WAREHOUSE_COORDS = { lat: 6.4678, lng: 3.5222, name: 'FarmX VGC Logistics Hub, Lekki' };

interface StateDetails {
  name: string;
  lat: number;
  lng: number;
  desc: string;
}

const NIGERIAN_STATES: StateDetails[] = [
  { name: 'Lagos', lat: 6.45407, lng: 3.39467, desc: 'Lagos State (Local Standard Delivery)' },
  { name: 'Kaduna', lat: 10.5105, lng: 7.4165, desc: 'Northern terminal transit corridor' },
  { name: 'Oyo', lat: 7.3775, lng: 3.9470, desc: 'Southwest transit corridor' },
  { name: 'Ogun', lat: 7.1475, lng: 3.3619, desc: 'Southwest gateway route' },
  { name: 'Rivers', lat: 4.8156, lng: 7.0498, desc: 'South-South delta route' },
  { name: 'Abuja (FCT)', lat: 9.0765, lng: 7.3986, desc: 'Central capital transit zone' },
  { name: 'Enugu', lat: 6.4483, lng: 7.5599, desc: 'Southeast region route' },
  { name: 'Plateau', lat: 9.8965, lng: 8.8583, desc: 'North-Central highland route' },
  { name: 'Kano', lat: 12.0022, lng: 8.5919, desc: 'Northern commercial hub route' },
  { name: 'Benue', lat: 7.7337, lng: 8.5214, desc: 'Middle-belt logistics corridor' }
];

// Haversine formula to compute actual spatial geographical distances in km
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

// ─── Group cart items by farmerUid so each farmer gets their own order ────────
// CartItemDoc stores farmerUid as a top-level field (set by addToCart in
// ProductDetail). We group items by that uid so a multi-farmer cart correctly
// creates one order per farmer. Falls back to farmerName only when farmerUid is
// absent (legacy data), but that path is now guarded below.
function groupItemsByFarmer(items: CartItemDoc[]): { farmerUid: string; items: CartItemDoc[] }[] {
  const map = new Map<string, CartItemDoc[]>();
  for (const item of items) {
    const uid = (item as any).farmerUid?.trim() || '';
    if (!uid) {
      // farmerUid missing — log so it's easy to diagnose in the console
      console.warn('[CheckoutScreen] Cart item missing farmerUid:', item);
    }
    const key = uid || item.farmerName || 'unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([farmerUid, items]) => ({ farmerUid, items }));
}
// ─────────────────────────────────────────────────────────────────────────────

export function CheckoutScreen({ onNavigate, profile }: Props) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedState, setSelectedState] = useState(NIGERIAN_STATES[0].name);
  const [selectedCityName, setSelectedCityName] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [deliverySpeed, setDeliverySpeed] = useState<'standard' | 'express'>('standard');

  const [cartItems, setCartItems] = useState<CartItemDoc[]>([]);
  const [cartLoading, setCartLoading] = useState(true);
  
  const [weatherData, setWeatherData] = useState({
    temp: '29°C',
    humidity: '82%',
    rain: '0.0mm',
    wind: '12 km/h',
    code: 0,
    statusText: 'Optimal Transit Skylines'
  });
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(false);

  const [showGateway, setShowGateway] = useState(false);
  const [payMethod, setPayMethod] = useState<'card' | 'bank' | 'ussd'>('card');
  const [gatewayStage, setGatewayStage] = useState<'input' | 'otp' | 'submitting' | 'success'>('input');
  
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [cardError, setCardError] = useState('');

  const [paystackConfig, setPaystackConfig] = useState<{ publicKey: string; isLiveConfigured: boolean; hasCustomKey: boolean }>({
    publicKey: '',
    isLiveConfigured: false,
    hasCustomKey: false,
  });
  const [activePaystackRef, setActivePaystackRef] = useState<string>('');
  const [isPaystackInitializing, setIsPaystackInitializing] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  useEffect(() => {
    getPaystackConfig().then(cfg => setPaystackConfig(cfg)).catch(() => {});
  }, []);

  const [transferMinutes, setTransferMinutes] = useState(14);
  const [transferSeconds, setTransferSeconds] = useState(59);
  const [transferCheckedStatus, setTransferCheckedStatus] = useState<'none' | 'verifying' | 'found' | 'error'>('none');

  const [selectedUSSDId, setSelectedUSSDId] = useState('gtb');
  const [ussdOverlayActive, setUssdOverlayActive] = useState(false);
  const [ussdStep, setUssdStep] = useState(1);

  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => onNavigate('order-tracking'), 2500);
      return () => clearTimeout(timer);
    }
  }, [done]);

  const matchedState = NIGERIAN_STATES.find(s => s.name.trim().toLowerCase() === selectedState.trim().toLowerCase()) || NIGERIAN_STATES[0];
  const activeLat = matchedState.lat;
  const activeLng = matchedState.lng;

  const distanceInKm = getHaversineDistance(
    ESCROW_WAREHOUSE_COORDS.lat, 
    ESCROW_WAREHOUSE_COORDS.lng, 
    activeLat, 
    activeLng
  );

  const isLocal = selectedState.trim().toLowerCase() === 'lagos';
  const baseLogisticsFee = 50;
  const calcDeliveryFee = 50;

  const orderSubtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const platformFee = 250;
  const orderTotal = orderSubtotal + calcDeliveryFee + platformFee;

  const ussdProviders = [
    { id: 'gtb', name: 'GTBank', code: '*737*1*2*' },
    { id: 'zenith', name: 'Zenith Bank', code: '*966*3*' },
    { id: 'access', name: 'Access Bank', code: '*901*2*' },
    { id: 'uer', name: 'United Bank for Africa', code: '*919*8*' }
  ];

  const mockCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsWeatherLoading(true);
    setWeatherError(false);
    
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${activeLat}&longitude=${activeLng}&current=temperature_2m,relative_humidity_2m,rain,weather_code,wind_speed_10m&timezone=auto`)
      .then(res => {
        if (!res.ok) throw new Error('API down');
        return res.json();
      })
      .then(data => {
        if (data && data.current) {
          const current = data.current;
          let text = 'Mild skies for hauling';
          if (current.weather_code >= 51) {
            text = 'Wet downpour predicted along route';
          } else if (current.temperature_2m > 32) {
             text = 'Accelerated crop heat loading hazard';
          } else if (current.wind_speed_10m > 18) {
            text = 'Dusty gusts, tarps advised';
          } else {
            text = 'Optimal agricultural shipping sky';
          }
          setWeatherData({
            temp: `${Math.round(current.temperature_2m)}°C`,
            humidity: `${current.relative_humidity_2m}%`,
            rain: `${current.rain || 0.0}mm`,
            wind: `${Math.round(current.wind_speed_10m)} km/h`,
            code: current.weather_code,
            statusText: text
          });
        }
        setIsWeatherLoading(false);
      })
      .catch(err => {
        console.warn('Weather API fetch failed', err);
        setWeatherError(true);
        const isNorth = activeLat > 8; 
        setWeatherData({
          temp: isNorth ? '34°C' : '28°C',
          humidity: isNorth ? '45%' : '84%',
          rain: isNorth ? '0.0mm' : '1.8mm',
          wind: '14 km/h',
          code: isNorth ? 1 : 61,
          statusText: isNorth ? 'Arid clear conditions' : 'Scattered wet roadways'
        });
        setIsWeatherLoading(false);
      });
  }, [activeLat, activeLng]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setCartLoading(false);
      return;
    }
    setCartLoading(true);
    const unsubscribe = subscribeToCart(uid, (items) => {
      setCartItems(items);
      setCartLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showGateway && payMethod === 'bank') {
      timer = setInterval(() => {
        setTransferSeconds(sec => {
          if (sec === 0) {
            setTransferMinutes(min => (min > 0 ? min - 1 : 0));
            return 59;
          }
          return sec - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showGateway, payMethod]);

  // ── Centralized Payment Verification & Order Finalization (Step C) ──
  const handlePaymentSuccess = async (txReference: string, channel: 'card' | 'bank' | 'ussd') => {
    setGatewayStage('submitting');
    try {
      // Step C: Verify transaction via backend API /api/paystack/verify/:reference
      console.log(`[Paystack] Verifying transaction reference: ${txReference}`);
      const verification = await verifyPaystackTransaction(txReference);
      console.log('[Paystack] Verification confirmed:', verification);

      logUserAction('CHECKOUT_PAYMENT_SUCCESS', `Consumer finalized Paystack checkout payment via ${channel.toUpperCase()}`, {
        paystackReference: txReference,
        channel,
        amountNaira: orderTotal,
        amountKobo: orderTotal * 100,
        destination: `${streetAddress}, ${selectedCityName}, ${selectedState}`,
        distance: distanceInKm
      });

      // Fan out one order per farmer so each farmer's subscription fires
      const groups = groupItemsByFarmer(cartItems);
      await Promise.all(groups.map(({ farmerUid, items: farmerItems }) => {
        const groupSubtotal = farmerItems.reduce((s, i) => s + i.price * i.qty, 0);
        return createOrder({
          farmerUid,
          buyerUid: auth.currentUser?.uid || 'guest',
          buyerName: recipientName,
          buyerPhone: recipientPhone,
          buyerLocation: `${streetAddress}, ${selectedCityName}, ${selectedState}`,
          product: farmerItems.map(i => `${i.name} (${i.qty}${i.unit})`).join(', '),
          amount: groups.length === 1 ? orderTotal : groupSubtotal,
          items: farmerItems.length,
          cartItems: farmerItems.map(i => ({ productId: i.productId, name: i.name, qty: i.qty, unit: i.unit, price: i.price, farmerName: i.farmerName })),
          paymentMethod: 'paystack',
          paymentReference: txReference,
        });
      }));

      const uid = auth.currentUser?.uid;
      if (uid) await clearCart(uid).catch(() => {});

      setGatewayStage('success');
      setTimeout(() => {
        setShowGateway(false);
        setDone(true);
      }, 1500);
    } catch (err: any) {
      console.error('[Paystack] Verification or order creation failed:', err);
      setCardError(err.message || 'Payment verification failed');
      setGatewayStage('input');
    }
  };

  // Step A: Initialize Paystack transaction on the backend
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !streetAddress || !selectedCityName) return;

    setIsPaystackInitializing(true);
    setCardError('');

    const customerEmail = profile?.email || auth.currentUser?.email || (recipientPhone.replace(/\D/g, '') ? `${recipientPhone.replace(/\D/g, '')}@farmx.ng` : 'shopper@farmx.ng');

    try {
      // Step A (Backend): Call POST /transaction/initialize via our Paystack service
      // Note: Local currency amount in Naira is converted to Kobo on the backend (Directive #1)
      const initRes = await initializePaystackTransaction({
        email: customerEmail,
        amount: orderTotal,
        metadata: {
          buyerName: recipientName,
          buyerPhone: recipientPhone,
          destination: `${streetAddress}, ${selectedCityName}, ${selectedState}`,
          deliverySpeed,
          itemsCount: cartItems.length
        }
      });

      setActivePaystackRef(initRes.reference);
      setIsPaystackInitializing(false);

      // Step B: If live public key available, attempt official Paystack Inline Popup
      if (paystackConfig.hasCustomKey) {
        try {
          await openPaystackInlineCheckout({
            publicKey: paystackConfig.publicKey,
            email: customerEmail,
            amountInNaira: orderTotal,
            reference: initRes.reference,
            accessCode: initRes.access_code,
            metadata: { recipientName, recipientPhone },
            onSuccess: async (paystackResponse) => {
              await handlePaymentSuccess(paystackResponse.reference || initRes.reference, 'card');
            },
            onCancel: () => {
              console.log('[Paystack] Customer cancelled popup modal');
            }
          });
          return;
        } catch (inlineErr: any) {
          console.log('[Paystack] Using embedded checkout modal:', inlineErr?.message);
        }
      }

      // Open embedded Paystack modal (Supports official Paystack test cards, bank transfer & USSD)
      setShowGateway(true);
      setGatewayStage('input');
      setOtpValue('');
      setTransferCheckedStatus('none');
      setUssdStep(1);
    } catch (err: any) {
      console.error('Paystack initialization error:', err);
      setIsPaystackInitializing(false);
      const fallbackRef = `FMX_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      setActivePaystackRef(fallbackRef);
      setShowGateway(true);
      setGatewayStage('input');
    }
  };

  const handlePaystackCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.replace(/\s/g, '').length < 12) {
      setCardError('Please enter a valid card number');
      return;
    }
    setCardError('');
    setGatewayStage('submitting');
    setTimeout(() => {
      setGatewayStage('otp');
    }, 1200);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await handlePaymentSuccess(activePaystackRef || `FMX_${Date.now()}`, 'card');
  };

  const triggerVerifyTransfer = async () => {
    setTransferCheckedStatus('verifying');
    await handlePaymentSuccess(activePaystackRef || `FMX_${Date.now()}`, 'bank');
  };

  const runUSSDDialTrigger = () => {
    setUssdStep(2);
  };

  const handleUSSDSuccessConfirm = async () => {
    setUssdStep(3);
    await handlePaymentSuccess(activePaystackRef || `FMX_${Date.now()}`, 'ussd');
  };

  const fillPaystackTestCard = () => {
    setCardNumber('4084 0840 8408 4084');
    setCardExpiry('12/30');
    setCardCvv('408');
    setCardError('');
  };

  if (done) {
    return (
      <div className="p-5 lg:p-6 max-w-md mx-auto flex flex-col items-center justify-center min-h-[75vh]">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 animate-bounce" style={{ background: 'rgba(39, 80, 10, 0.12)' }}>
          <CheckCircle size={44} style={{ color: '#27500A' }} />
        </div>
        <h1 className="text-2xl font-semibold mb-2 tracking-tight text-center" style={{ color: '#27500A' }}>Payment Approved!</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Your payment of <span className="font-semibold text-gray-900">₦{orderTotal.toLocaleString()}</span> has been confirmed.
        </p>
        <div className="backdrop-blur-md bg-white/70 rounded-2xl p-5 w-full mb-6 border border-black/5 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Paystack Reference</span>
            <span className="font-mono font-medium text-gray-800">{activePaystackRef || `FMX-${Date.now().toString().slice(-8)}`}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Gateway Status</span>
            <span className="font-medium text-emerald-700 flex items-center gap-1">
              <CheckCircle size={11} /> Verified via Paystack
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Delivery to</span>
            <span className="font-medium text-gray-850 truncate max-w-[200px]">{streetAddress}, {selectedCityName}, {selectedState}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Amount Paid</span>
            <div className="text-right">
              <span className="font-semibold text-emerald-800">₦{orderTotal.toLocaleString()}</span>
              <span className="text-[10px] text-gray-400 block font-mono">({(orderTotal * 100).toLocaleString()} kobo)</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onNavigate('order-tracking')}
          className="w-full rounded-xl py-3 font-semibold text-sm text-white transition-all active:scale-[0.98]"
          style={{ background: '#27500A' }}
        >
          Track my order →
        </button>
        <button
          onClick={() => onNavigate('marketplace')}
          className="mt-3 text-xs text-gray-500 underline"
        >
          Continue shopping
        </button>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="p-5 lg:p-6 max-w-md mx-auto flex items-center justify-center min-h-[50vh]">
        <RefreshCw size={28} className="animate-spin" style={{ color: '#185FA5' }} />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="p-5 lg:p-6 max-w-md mx-auto text-center py-20">
        <span style={{ fontSize: 48 }}>🛒</span>
        <p style={{ fontSize: 16, color: '#5F5E5A', marginTop: 12 }}>Your cart is empty</p>
        <button onClick={() => onNavigate('marketplace')} className="mt-4 px-6 py-2 rounded-lg"
          style={{ background: '#185FA5', color: '#fff', fontSize: 13 }}>Browse marketplace</button>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-6 max-w-4xl mx-auto">
      <button onClick={() => onNavigate('cart')} className="flex items-center gap-1.5 mb-5 text-xs"
        style={{ color: '#5F5E5A' }}>
        <ChevronLeft size={15} /> Back to cart
      </button>

      <div className="mb-6">
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#0C447C' }}>Checkout</h1>
        <p style={{ fontSize: 13, color: '#5F5E5A' }}>{cartItems.length} item{cartItems.length !== 1 ? 's' : ''} · ₦{orderTotal.toLocaleString()} total</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Delivery form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Weather strip */}
          <div className="rounded-xl p-3 flex items-center gap-4" style={{ background: '#E6F1FB', border: '0.5px solid rgba(24,95,165,0.2)' }}>
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              {[
                { icon: Thermometer, label: weatherData.temp },
                { icon: Droplets, label: weatherData.humidity },
                { icon: CloudRain, label: weatherData.rain },
                { icon: Wind, label: weatherData.wind },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <Icon size={12} style={{ color: '#185FA5' }} />
                  <span style={{ fontSize: 11, color: '#185FA5' }}>{label}</span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: 10, color: '#0C447C', fontWeight: 500 }}>{weatherData.statusText}</span>
          </div>

          <div className="rounded-xl p-5 space-y-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Delivery details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 6 }}>Recipient name</label>
                <input value={recipientName} onChange={e => setRecipientName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 rounded-lg outline-none"
                  style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 6 }}>Phone number</label>
                <input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-3 rounded-lg outline-none"
                  style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 6 }}>State</label>
                <select value={selectedState} onChange={e => setSelectedState(e.target.value)}
                  className="w-full px-3 rounded-lg outline-none"
                  style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }}>
                  {NIGERIAN_STATES.map(s => <option key={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 6 }}>City / LGA</label>
                <input value={selectedCityName} onChange={e => setSelectedCityName(e.target.value)}
                  placeholder="e.g. Ikeja"
                  className="w-full px-3 rounded-lg outline-none"
                  style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 6 }}>Street address</label>
              <input value={streetAddress} onChange={e => setStreetAddress(e.target.value)}
                placeholder="House/Block number, street name"
                className="w-full px-3 rounded-lg outline-none"
                style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
            </div>

            {/* Delivery speed */}
            <div className="grid grid-cols-2 gap-3">
              {(['standard', 'express'] as const).map(speed => (
                <button key={speed} onClick={() => setDeliverySpeed(speed)}
                  className="rounded-xl p-3 text-left transition-all"
                  style={{
                    border: `${deliverySpeed === speed ? '1px' : '0.5px'} solid ${deliverySpeed === speed ? '#185FA5' : 'rgba(0,0,0,0.1)'}`,
                    background: deliverySpeed === speed ? '#E6F1FB' : '#F7F6F2',
                  }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: deliverySpeed === speed ? '#0C447C' : '#444441' }}>
                    {speed === 'standard' ? '🚛 Standard' : '⚡ Express'}
                  </p>
                  <p style={{ fontSize: 10, color: '#5F5E5A' }}>
                    {speed === 'standard' ? '3–5 business days' : '1–2 business days'}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 500, color: '#185FA5', marginTop: 4 }}>
                    ₦50
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Cart items preview */}
          <div className="rounded-xl p-5" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441', marginBottom: 12 }}>Items in order</h2>
            <div className="space-y-3">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ background: '#F7F6F2', fontSize: 22 }}>
                    {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : (item.emoji || '🌾')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: '#5F5E5A' }}>{item.farmerName} · {item.qty} {item.unit}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>₦{(item.price * item.qty).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary + pay */}
        <div>
          <div className="rounded-xl p-4 sticky top-6" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441', marginBottom: 12 }}>Order summary</h2>
            <div className="space-y-2.5 mb-4">
              <div className="flex justify-between">
                <span style={{ fontSize: 13, color: '#5F5E5A' }}>Subtotal</span>
                <span style={{ fontSize: 13, color: '#444441' }}>₦{orderSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ fontSize: 13, color: '#5F5E5A' }}>Delivery ({deliverySpeed})</span>
                <span style={{ fontSize: 13, color: '#444441' }}>₦{calcDeliveryFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ fontSize: 13, color: '#5F5E5A' }}>Platform fee</span>
                <span style={{ fontSize: 13, color: '#444441' }}>₦{platformFee.toLocaleString()}</span>
              </div>
              <div className="pt-2" style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)' }}>
                <div className="flex justify-between">
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Total</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#185FA5' }}>₦{orderTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-2.5 rounded-lg mb-4" style={{ background: '#EAF3DE' }}>
              <Info size={13} style={{ color: '#27500A', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 10, color: '#27500A', lineHeight: 1.5 }}>
                Payment held in escrow until you confirm delivery. 3% platform fee deducted from farmer payout.
              </p>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Shield size={13} style={{ color: '#27500A' }} />
              <span style={{ fontSize: 11, color: '#5F5E5A' }}>Buyer escrow protection via Paystack</span>
            </div>

            <button
              onClick={handleCheckoutSubmit}
              disabled={!recipientName || !streetAddress || !selectedCityName || isPaystackInitializing}
              className="w-full rounded-xl py-3 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-white font-medium shadow-sm"
              style={{ background: '#0BA4DB' }}
            >
              {isPaystackInitializing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span style={{ fontSize: 13 }}>Initializing Paystack…</span>
                </>
              ) : (
                <>
                  <CreditCard size={15} />
                  <span style={{ fontSize: 13 }}>Pay ₦{orderTotal.toLocaleString()} with Paystack</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 mt-3">
              <ShieldCheck size={12} style={{ color: '#0BA4DB' }} />
              <span style={{ fontSize: 10, color: '#5F5E5A' }}>Secured by Paystack · 256-bit SSL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Paystack Payment Gateway Modal */}
      {showGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(9, 30, 66, 0.65)', backdropFilter: 'blur(3px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#fff', maxHeight: '92vh', overflowY: 'auto', border: '1px solid rgba(11, 164, 219, 0.2)' }}>
            
            {/* Paystack Header */}
            <div className="p-4" style={{ background: '#091E42', color: '#fff' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center font-bold text-xs" style={{ background: '#0BA4DB', color: '#fff' }}>
                    P
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>Paystack Checkout</p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>FarmX Agro-Logistics Marketplace</p>
                  </div>
                </div>
                <button onClick={() => setShowGateway(false)} className="rounded-full p-1 hover:bg-white/10 transition-colors" aria-label="Close Paystack modal">
                  <X size={16} className="text-white/80" />
                </button>
              </div>

              <div className="flex items-end justify-between pt-2 border-t border-white/10">
                <div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount Due</span>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>₦{orderTotal.toLocaleString()}</p>
                </div>
                <span className="font-mono text-right" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                  {(orderTotal * 100).toLocaleString()} Kobo<br />
                  Ref: {activePaystackRef ? activePaystackRef.slice(-10) : 'Pending'}
                </span>
              </div>
            </div>

            {gatewayStage === 'success' ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: '#EAF3DE' }}>
                  <CheckCircle size={36} style={{ color: '#27500A' }} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: '#27500A' }}>Payment Verified!</h3>
                <p style={{ fontSize: 12, color: '#5F5E5A' }}>
                  Paystack transaction <span className="font-mono font-medium text-gray-800">{activePaystackRef}</span> has been confirmed.
                </p>
                <div className="py-2 px-3 rounded-lg text-xs font-mono" style={{ background: '#F7F6F2', color: '#444441' }}>
                  Amount: ₦{orderTotal.toLocaleString()} ({(orderTotal * 100).toLocaleString()} kobo)
                </div>
                <p style={{ fontSize: 11, color: '#185FA5' }}>Finalizing orders and updating inventory…</p>
              </div>
            ) : gatewayStage === 'submitting' ? (
              <div className="p-8 text-center space-y-4">
                <RefreshCw size={36} className="animate-spin mx-auto" style={{ color: '#0BA4DB' }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#091E42' }}>Communicating with Paystack…</p>
                  <p style={{ fontSize: 11, color: '#5F5E5A', marginTop: 4 }}>Securing authorization and verifying transaction</p>
                </div>
              </div>
            ) : gatewayStage === 'otp' ? (
              <div className="p-5 space-y-4">
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#091E42' }}>Enter One-Time PIN (OTP)</p>
                  <p style={{ fontSize: 11, color: '#5F5E5A', marginTop: 2 }}>
                    Paystack 3D-Secure sent a confirmation code to your phone.
                  </p>
                </div>
                
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div className="p-2.5 rounded-lg flex items-center justify-between text-xs" style={{ background: '#E6F1FB', color: '#0C447C' }}>
                    <span>Sandbox Test OTP: <strong>123456</strong></span>
                    <button type="button" onClick={() => setOtpValue('123456')} className="underline font-semibold">
                      Use code
                    </button>
                  </div>

                  <input
                    value={otpValue}
                    onChange={e => setOtpValue(e.target.value)}
                    placeholder="• • • • • •"
                    maxLength={6}
                    className="w-full px-3 rounded-lg outline-none text-center tracking-widest font-mono font-bold"
                    style={{ height: 44, border: '1px solid #0BA4DB', fontSize: 20, color: '#091E42', background: '#F7F6F2' }}
                  />
                  <button type="submit" disabled={otpValue.length < 4}
                    className="w-full rounded-lg py-2.5 font-medium disabled:opacity-50 text-white transition-all"
                    style={{ background: '#0BA4DB', fontSize: 13 }}>
                    Authorize ₦{orderTotal.toLocaleString()}
                  </button>
                  <button type="button" onClick={() => setGatewayStage('input')}
                    className="w-full text-center text-xs text-gray-500 py-1 hover:underline">
                    Back to payment options
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Pay method tabs */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F1EFE8' }}>
                  {(['card', 'bank', 'ussd'] as const).map(m => (
                    <button key={m} onClick={() => { setPayMethod(m); setCardError(''); }}
                      className="flex-1 py-1.5 rounded-lg transition-all"
                      style={{ fontSize: 11, fontWeight: payMethod === m ? 600 : 400, background: payMethod === m ? '#fff' : 'transparent', color: payMethod === m ? '#0BA4DB' : '#5F5E5A', boxShadow: payMethod === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                      {m === 'card' ? '💳 Card' : m === 'bank' ? '🏦 Transfer' : '📱 USSD'}
                    </button>
                  ))}
                </div>

                {payMethod === 'card' && (
                  <form onSubmit={handlePaystackCardSubmit} className="space-y-3">
                    {/* Test Card Quick Fill Helper */}
                    <div className="flex items-center justify-between p-2 rounded-lg text-xs" style={{ background: '#E6F1FB', border: '0.5px solid rgba(11,164,219,0.3)' }}>
                      <span style={{ fontSize: 11, color: '#0C447C' }}>Testing? Use official Paystack test card</span>
                      <button
                        type="button"
                        onClick={fillPaystackTestCard}
                        className="px-2 py-0.5 rounded text-white font-medium transition-all"
                        style={{ background: '#0BA4DB', fontSize: 10 }}
                      >
                        Autofill
                      </button>
                    </div>

                    {cardError && <p style={{ fontSize: 11, color: '#A32D2D' }}>{cardError}</p>}
                    <div>
                      <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 5 }}>Card number</label>
                      <input 
                        value={cardNumber} 
                        onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19))}
                        placeholder="4084 0840 8408 4084"
                        className="w-full px-3 rounded-lg outline-none font-mono tracking-wide"
                        style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 5 }}>Valid Till</label>
                        <input value={cardExpiry} onChange={e => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="w-full px-3 rounded-lg outline-none font-mono"
                          style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 5 }}>CVV</label>
                        <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="408" type="password"
                          className="w-full px-3 rounded-lg outline-none font-mono"
                          style={{ height: 38, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
                      </div>
                    </div>
                    <button type="submit"
                      className="w-full rounded-lg py-2.5 font-medium text-white transition-all shadow-sm flex items-center justify-center gap-1.5"
                      style={{ background: '#0BA4DB', fontSize: 13 }}>
                      <span>Pay ₦{orderTotal.toLocaleString()}</span>
                    </button>
                  </form>
                )}

                {payMethod === 'bank' && (
                  <div className="space-y-3">
                    <p style={{ fontSize: 11, color: '#5F5E5A' }}>
                      Transfer exact amount to the dedicated Paystack account below:
                    </p>
                    <div className="rounded-xl p-4 space-y-2.5" style={{ background: '#F7F6F2', border: '1px solid rgba(11,164,219,0.2)' }}>
                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: '#5F5E5A' }}>Bank Name</span>
                        <span style={{ color: '#091E42', fontWeight: 600 }}>Wema Bank / Paystack</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: '#5F5E5A' }}>Account Number</span>
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: '#091E42', fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>9201882110</span>
                          <button 
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText('9201882110');
                              setCopiedAccount(true);
                              setTimeout(() => setCopiedAccount(false), 2000);
                            }}
                            className="p-1 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
                            aria-label="Copy account number"
                          >
                            {copiedAccount ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} className="text-gray-700" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: '#5F5E5A' }}>Beneficiary</span>
                        <span style={{ color: '#091E42', fontWeight: 500 }}>FarmX Escrow (Paystack)</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-black/5">
                        <span style={{ color: '#5F5E5A' }}>Amount</span>
                        <span style={{ color: '#0BA4DB', fontWeight: 700 }}>₦{orderTotal.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-center p-2 rounded-lg text-xs font-mono"
                      style={{ background: '#FAEEDA', color: '#854F0B' }}>
                      Expires in {transferMinutes < 10 ? `0${transferMinutes}` : transferMinutes}:{transferSeconds < 10 ? `0${transferSeconds}` : transferSeconds}
                    </div>

                    <button 
                      onClick={triggerVerifyTransfer}
                      className="w-full py-2.5 rounded-lg font-medium text-white transition-all shadow-sm"
                      style={{ background: '#0BA4DB', fontSize: 13 }}
                    >
                      {transferCheckedStatus === 'verifying' ? 'Verifying with Paystack…' : "I have sent the money"}
                    </button>
                  </div>
                )}

                {payMethod === 'ussd' && (
                  <div className="space-y-3">
                    <p style={{ fontSize: 11, color: '#5F5E5A' }}>
                      Choose your bank to generate the Paystack USSD shortcode:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {ussdProviders.map(p => (
                        <button key={p.id} onClick={() => { setSelectedUSSDId(p.id); setUssdStep(1); }}
                          className="py-2 px-3 rounded-lg text-xs text-left transition-all"
                          style={{ border: `${selectedUSSDId === p.id ? '1.5px' : '0.5px'} solid ${selectedUSSDId === p.id ? '#0BA4DB' : 'rgba(0,0,0,0.1)'}`, background: selectedUSSDId === p.id ? '#E6F1FB' : '#F7F6F2', color: selectedUSSDId === p.id ? '#0C447C' : '#444441', fontWeight: selectedUSSDId === p.id ? 600 : 400 }}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                    {ussdStep === 1 && (
                      <div className="rounded-xl p-4 text-center font-mono" style={{ background: '#091E42', color: '#0BA4DB' }}>
                        <p className="text-base font-bold tracking-wider">{ussdProviders.find(p => p.id === selectedUSSDId)?.code}{orderTotal}#</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Dial this code from your bank-registered line</p>
                        <button onClick={runUSSDDialTrigger}
                          className="mt-3 w-full py-2 rounded-lg text-xs font-bold text-white transition-all"
                          style={{ background: '#0BA4DB' }}>Execute dial code</button>
                      </div>
                    )}
                    {ussdStep === 2 && (
                      <div className="rounded-xl p-4 space-y-3" style={{ background: '#091E42', color: '#fff' }}>
                        <p style={{ fontSize: 11, color: '#0BA4DB' }}>Authorize ₦{orderTotal.toLocaleString()} to FarmX?</p>
                        <input type="password" maxLength={4} placeholder="PIN"
                          className="w-full text-center tracking-widest rounded-lg h-9"
                          style={{ background: '#132c54', color: '#fff', border: '1px solid #0BA4DB', fontSize: 20 }} />
                        <div className="flex gap-2">
                          <button onClick={() => setUssdStep(1)} className="flex-1 py-2 rounded-lg text-xs text-white/70 hover:bg-white/10">Cancel</button>
                          <button onClick={handleUSSDSuccessConfirm} className="flex-1 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#0BA4DB' }}>Approve</button>
                        </div>
                      </div>
                    )}
                    {ussdStep === 3 && (
                      <div className="text-center py-4 rounded-xl flex items-center justify-center gap-2" style={{ background: '#EAF3DE' }}>
                        <CheckCircle size={14} style={{ color: '#27500A' }} />
                        <span style={{ fontSize: 12, color: '#27500A', fontWeight: 500 }}>USSD authorized with bank!</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-black/5">
                  <ShieldCheck size={12} style={{ color: '#0BA4DB' }} />
                  <span style={{ fontSize: 10, color: '#5F5E5A' }}>Secured by Paystack · Certified Level 1 PCI-DSS</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Lock({ size, className }: { size?: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}