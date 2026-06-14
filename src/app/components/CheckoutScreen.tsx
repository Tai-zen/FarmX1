import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Shield, CreditCard, Building, Phone, MapPin, 
  CloudRain, Thermometer, Droplets, Wind, Info, Map as MapIcon, 
  Compass, AlertTriangle, CheckCircle, RefreshCw, X, ArrowRight,
  Sparkles, Wifi, ShieldCheck, HelpCircle
} from 'lucide-react';
import { Screen } from './types';
import { logUserAction, createOrder, auth, subscribeToCart, CartItemDoc, clearCart } from '../firebase';

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
  const baseLogisticsFee = isLocal ? 500 : 1200;
  const calcDeliveryFee = deliverySpeed === 'express' ? baseLogisticsFee + 500 : baseLogisticsFee;

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

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowGateway(true);
    setGatewayStage('input');
    setOtpValue('');
    setTransferCheckedStatus('none');
    setUssdStep(1);
  };

  const handlePaystackCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.length < 12) {
      setCardError('Please enter a valid card number');
      return;
    }
    setCardError('');
    setGatewayStage('submitting');
    setTimeout(() => {
      setGatewayStage('otp');
    }, 1500);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setGatewayStage('submitting');
    setTimeout(async () => {
      setGatewayStage('success');

      logUserAction('CHECKOUT_PAYMENT_SUCCESS', 'Consumer finalized checkout payment with Credit Card', {
        amount: orderTotal,
        destination: `${streetAddress}, ${selectedCityName}, ${selectedState}`,
        distance: distanceInKm
      });
      try {
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
            paymentMethod: 'card',
          });
        }));
        const uid = auth.currentUser?.uid;
        if (uid) await clearCart(uid);
      } catch (err) {
        console.error('createOrder failed (card):', err);
      }

      setTimeout(async () => {
        const uid = auth.currentUser?.uid;
        if (uid) await clearCart(uid).catch(() => {});
        setShowGateway(false);
        setDone(true);
      }, 1500);
    }, 2000);
  };

  const triggerVerifyTransfer = () => {
    setTransferCheckedStatus('verifying');
    setTimeout(async () => {
      setTransferCheckedStatus('found');

      logUserAction('CHECKOUT_TRANSFER_SUCCESS', 'Consumer finalized checkout payment with Bank Transfer', {
        amount: orderTotal,
        destination: `${streetAddress}, ${selectedCityName}, ${selectedState}`,
        distance: distanceInKm
      });
      try {
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
            paymentMethod: 'bank',
          });
        }));
        const uid = auth.currentUser?.uid;
        if (uid) await clearCart(uid);
      } catch (err) {
        console.error('createOrder failed (bank):', err);
      }
      setTimeout(async () => {
        const uid = auth.currentUser?.uid;
        if (uid) await clearCart(uid).catch(() => {});
        setShowGateway(false);
        setDone(true);
      }, 1500);
    }, 2000);
  };

  const runUSSDDialTrigger = () => {
    setUssdStep(2);
  };

  const handleUSSDSuccessConfirm = async () => {
    setUssdStep(3);

    logUserAction('CHECKOUT_USSD_SUCCESS', 'Consumer finalized checkout payment with USSD Dial code', {
      amount: orderTotal,
      destination: `${streetAddress}, ${selectedCityName}, ${selectedState}`,
      distance: distanceInKm
    });

    try {
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
          paymentMethod: 'ussd',
        });
      }));
      const uid = auth.currentUser?.uid;
      if (uid) await clearCart(uid);
    } catch (err) {
      console.error('createOrder failed (ussd):', err);
    }
    setTimeout(async () => {
      const uid = auth.currentUser?.uid;
      if (uid) await clearCart(uid).catch(() => {});
      setShowGateway(false);
      setDone(true);
    }, 1500);
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
            <span className="text-gray-500">Transaction ID</span>
            <span className="font-mono font-medium text-gray-800">FMX-{Date.now().toString().slice(-8)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Delivery to</span>
            <span className="font-medium text-gray-850 truncate max-w-[200px]">{streetAddress}, {selectedCityName}, {selectedState}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Amount</span>
            <span className="font-semibold text-emerald-800">₦{orderTotal.toLocaleString()}</span>
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
                    ₦{(speed === 'standard' ? baseLogisticsFee : baseLogisticsFee + 500).toLocaleString()}
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
              <span style={{ fontSize: 11, color: '#5F5E5A' }}>Buyer protection guaranteed</span>
            </div>

            <button
              onClick={handleCheckoutSubmit}
              disabled={!recipientName || !streetAddress || !selectedCityName}
              className="w-full rounded-lg py-2.5 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: '#185FA5', color: '#fff', fontSize: 13, fontWeight: 500 }}
            >
              Proceed to payment →
            </button>
          </div>
        </div>
      </div>

      {/* Payment Gateway Modal */}
      {showGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>Secure payment</p>
                <p style={{ fontSize: 11, color: '#5F5E5A' }}>₦{orderTotal.toLocaleString()}</p>
              </div>
              <button onClick={() => setShowGateway(false)} aria-label="Close payment">
                <X size={18} style={{ color: '#5F5E5A' }} />
              </button>
            </div>

            {gatewayStage === 'success' ? (
              <div className="p-8 text-center">
                <CheckCircle size={48} style={{ color: '#27500A', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 16, fontWeight: 500, color: '#27500A' }}>Payment successful!</p>
                <p style={{ fontSize: 12, color: '#5F5E5A', marginTop: 4 }}>Redirecting you to order tracking…</p>
              </div>
            ) : gatewayStage === 'submitting' ? (
              <div className="p-8 text-center">
                <RefreshCw size={36} className="animate-spin mx-auto mb-4" style={{ color: '#185FA5' }} />
                <p style={{ fontSize: 13, color: '#5F5E5A' }}>Processing payment…</p>
              </div>
            ) : gatewayStage === 'otp' ? (
              <div className="p-5 space-y-4">
                <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>Enter OTP</p>
                <p style={{ fontSize: 12, color: '#5F5E5A' }}>A one-time code was sent to your registered phone number.</p>
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <input
                    value={otpValue}
                    onChange={e => setOtpValue(e.target.value)}
                    placeholder="• • • • • •"
                    maxLength={6}
                    className="w-full px-3 rounded-lg outline-none text-center tracking-widest font-mono"
                    style={{ height: 44, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 20, color: '#444441', background: '#F7F6F2' }}
                  />
                  <button type="submit" disabled={otpValue.length < 4}
                    className="w-full rounded-lg py-2.5 font-medium disabled:opacity-50"
                    style={{ background: '#185FA5', color: '#fff', fontSize: 13 }}>
                    Verify OTP
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Pay method tabs */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F1EFE8' }}>
                  {(['card', 'bank', 'ussd'] as const).map(m => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className="flex-1 py-1.5 rounded-lg transition-all"
                      style={{ fontSize: 11, fontWeight: payMethod === m ? 500 : 400, background: payMethod === m ? '#fff' : 'transparent', color: payMethod === m ? '#27500A' : '#5F5E5A' }}>
                      {m === 'card' ? '💳 Card' : m === 'bank' ? '🏦 Transfer' : '📱 USSD'}
                    </button>
                  ))}
                </div>

                {payMethod === 'card' && (
                  <form onSubmit={handlePaystackCardSubmit} className="space-y-3">
                    {cardError && <p style={{ fontSize: 11, color: '#A32D2D' }}>{cardError}</p>}
                    <div>
                      <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 5 }}>Card number</label>
                      <input value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                        placeholder="0000 0000 0000 0000"
                        className="w-full px-3 rounded-lg outline-none font-mono"
                        style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 5 }}>Expiry</label>
                        <input value={cardExpiry} onChange={e => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="w-full px-3 rounded-lg outline-none font-mono"
                          style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#5F5E5A', display: 'block', marginBottom: 5 }}>CVV</label>
                        <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="•••" type="password"
                          className="w-full px-3 rounded-lg outline-none font-mono"
                          style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#F7F6F2' }} />
                      </div>
                    </div>
                    <button type="submit"
                      className="w-full rounded-lg py-2.5 font-medium"
                      style={{ background: '#185FA5', color: '#fff', fontSize: 13 }}>
                      Pay ₦{orderTotal.toLocaleString()}
                    </button>
                  </form>
                )}

                {payMethod === 'bank' && (
                  <div className="space-y-3">
                    <div className="rounded-xl p-4 space-y-3" style={{ background: '#F7F6F2', border: '0.5px solid rgba(0,0,0,0.1)' }}>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#5F5E5A' }}>Bank</span>
                        <span style={{ color: '#444441', fontWeight: 500 }}>Wema Bank</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#5F5E5A' }}>Account</span>
                        <span style={{ color: '#444441', fontWeight: 500, fontFamily: 'monospace' }}>9201882110</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: '#5F5E5A' }}>Amount</span>
                        <span style={{ color: '#27500A', fontWeight: 500 }}>₦{orderTotal.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-center p-2 rounded-lg text-xs font-mono"
                      style={{ background: '#FAEEDA', color: '#854F0B' }}>
                      Expires in {transferMinutes < 10 ? `0${transferMinutes}` : transferMinutes}:{transferSeconds < 10 ? `0${transferSeconds}` : transferSeconds}
                    </div>
                    {transferCheckedStatus === 'found' ? (
                      <div className="text-center py-3 rounded-xl flex items-center justify-center gap-2"
                        style={{ background: '#EAF3DE' }}>
                        <CheckCircle size={14} style={{ color: '#27500A' }} />
                        <span style={{ fontSize: 12, color: '#27500A', fontWeight: 500 }}>Payment confirmed!</span>
                      </div>
                    ) : (
                      <button onClick={triggerVerifyTransfer}
                        className="w-full py-2.5 rounded-lg font-medium"
                        style={{ background: '#27500A', color: '#fff', fontSize: 13 }}>
                        {transferCheckedStatus === 'verifying' ? 'Verifying…' : "I've made this transfer"}
                      </button>
                    )}
                  </div>
                )}

                {payMethod === 'ussd' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {ussdProviders.map(p => (
                        <button key={p.id} onClick={() => { setSelectedUSSDId(p.id); setUssdStep(1); }}
                          className="py-2 px-3 rounded-lg text-xs text-left"
                          style={{ border: `${selectedUSSDId === p.id ? '1px' : '0.5px'} solid ${selectedUSSDId === p.id ? '#27500A' : 'rgba(0,0,0,0.1)'}`, background: selectedUSSDId === p.id ? '#EAF3DE' : '#F7F6F2', color: selectedUSSDId === p.id ? '#27500A' : '#444441' }}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                    {ussdStep === 1 && (
                      <div className="rounded-xl p-4 text-center font-mono" style={{ background: '#0f172a', color: '#00ffcc' }}>
                        <p className="text-sm font-bold break-all">{ussdProviders.find(p => p.id === selectedUSSDId)?.code}{orderTotal}#</p>
                        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Dial this on your phone</p>
                        <button onClick={runUSSDDialTrigger}
                          className="mt-3 w-full py-2 rounded-lg text-xs font-bold"
                          style={{ background: '#27500A', color: '#fff' }}>Execute dial</button>
                      </div>
                    )}
                    {ussdStep === 2 && (
                      <div className="rounded-xl p-4 space-y-3" style={{ background: '#0f172a', color: '#e2e8f0' }}>
                        <p style={{ fontSize: 11, color: '#00ffcc' }}>Pay ₦{orderTotal.toLocaleString()} to FarmX?</p>
                        <input type="password" maxLength={4} placeholder="PIN"
                          className="w-full text-center tracking-widest rounded-lg h-9"
                          style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', fontSize: 20 }} />
                        <div className="flex gap-2">
                          <button onClick={() => setUssdStep(1)} className="flex-1 py-2 rounded-lg text-xs" style={{ background: '#7f1d1d', color: '#fecaca' }}>Cancel</button>
                          <button onClick={handleUSSDSuccessConfirm} className="flex-1 py-2 rounded-lg text-xs font-bold" style={{ background: '#00ffcc', color: '#0f172a' }}>Approve</button>
                        </div>
                      </div>
                    )}
                    {ussdStep === 3 && (
                      <div className="text-center py-4 rounded-xl flex items-center justify-center gap-2" style={{ background: '#EAF3DE' }}>
                        <CheckCircle size={14} style={{ color: '#27500A' }} />
                        <span style={{ fontSize: 12, color: '#27500A', fontWeight: 500 }}>USSD authorized!</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 pt-2">
                  <ShieldCheck size={12} style={{ color: '#27500A' }} />
                  <span style={{ fontSize: 10, color: '#5F5E5A' }}>Secured · CBN licensed processor</span>
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