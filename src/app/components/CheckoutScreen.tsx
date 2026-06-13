import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Shield, CreditCard, Building, Phone, MapPin, 
  CloudRain, Thermometer, Droplets, Wind, Info, Map as MapIcon, 
  Compass, AlertTriangle, CheckCircle, RefreshCw, X, ArrowRight,
  Sparkles, Wifi, ShieldCheck, HelpCircle
} from 'lucide-react';
import { Screen } from './types';
import { logUserAction, createOrder, auth } from '../firebase';

interface Props { onNavigate: (s: Screen) => void; }

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
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

export function CheckoutScreen({ onNavigate }: Props) {
  // State Management
  const [recipientName, setRecipientName] = useState('Deji Okafor');
  const [recipientPhone, setRecipientPhone] = useState('+234 803 123 4567');
  const [selectedState, setSelectedState] = useState(NIGERIAN_STATES[0].name);
  const [selectedCityName, setSelectedCityName] = useState('Lekki');
  const [streetAddress, setStreetAddress] = useState('12 Adeola Odeku Street');
  const [deliverySpeed, setDeliverySpeed] = useState<'standard' | 'express'>('standard');
  
  // Weather API states
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

  // Checkout Payment Gateway Modal state
  const [showGateway, setShowGateway] = useState(false);
  const [payMethod, setPayMethod] = useState<'card' | 'bank' | 'ussd'>('card');
  const [gatewayStage, setGatewayStage] = useState<'input' | 'otp' | 'submitting' | 'success'>('input');
  
  // Card Inputs
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [cardError, setCardError] = useState('');

  // Bank Transfer sandbox
  const [transferMinutes, setTransferMinutes] = useState(14);
  const [transferSeconds, setTransferSeconds] = useState(59);
  const [transferCheckedStatus, setTransferCheckedStatus] = useState<'none' | 'verifying' | 'found' | 'error'>('none');

  // USSD sandbox
  const [selectedUSSDId, setSelectedUSSDId] = useState('gtb');
  const [ussdOverlayActive, setUssdOverlayActive] = useState(false);
  const [ussdStep, setUssdStep] = useState(1); // 1 = Dialing, 2 = Pin/Confirm screen, 3 = Completed

  // Completion states
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  // Dynamic calculations
  const matchedState = NIGERIAN_STATES.find(s => s.name.trim().toLowerCase() === selectedState.trim().toLowerCase()) || NIGERIAN_STATES[0];
  const activeLat = matchedState.lat;
  const activeLng = matchedState.lng;

  const distanceInKm = getHaversineDistance(
    ESCROW_WAREHOUSE_COORDS.lat, 
    ESCROW_WAREHOUSE_COORDS.lng, 
    activeLat, 
    activeLng
  );

  // Highly affordable consumer shipping fee rates: Lagos is ₦505, other states standard is ₦1,200. Express adds ₦500.
  const isLocal = selectedState.trim().toLowerCase() === 'lagos';
  const baseLogisticsFee = isLocal ? 500 : 1200;
  const calcDeliveryFee = deliverySpeed === 'express' ? baseLogisticsFee + 500 : baseLogisticsFee;

  const orderSubtotal = 8350;
  const platformFee = 250; // Dynamic escort packing insurance
  const orderTotal = orderSubtotal + calcDeliveryFee + platformFee;

  // Interswitch gateway options
  const ussdProviders = [
    { id: 'gtb', name: 'GTBank', code: '*737*1*2*' },
    { id: 'zenith', name: 'Zenith Bank', code: '*966*3*' },
    { id: 'access', name: 'Access Bank', code: '*901*2*' },
    { id: 'uer', name: 'United Bank for Africa', code: '*919*8*' }
  ];

  // Map dragging element reference for simulated boundaries
  const mockCanvasRef = useRef<HTMLDivElement>(null);

  // Fetch real, live weather forecast parameters via public Open-Meteo API
  useEffect(() => {
    setIsWeatherLoading(true);
    setWeatherError(false);
    
    // Non-blocking query to Open-Meteo
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
        console.warn('Weather API fetch failed, loading static seasonal averages', err);
        setWeatherError(true);
        // Fallback robust simulation based on latitude
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

  // Bank Transfer Sandbox countdown clock logic
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



  // Run pay operation
  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowGateway(true);
    setGatewayStage('input');
    setOtpValue('');
    setTransferCheckedStatus('none');
    setUssdStep(1);
  };

  // Card payment flows trigger OTP
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
    setTimeout(() => {
      setGatewayStage('success');

      // Log payment audit action to Firestore
      logUserAction('CHECKOUT_PAYMENT_SUCCESS', 'Consumer finalized checkout payment with Credit Card', {
        amount: orderTotal,
        destination: `${streetAddress}, ${selectedCityName}, ${selectedState}`,
        distance: distanceInKm
      });

      setTimeout(() => {
        setShowGateway(false);
        setDone(true);
      }, 1500);
    }, 2000);
  };

  // Fast verify bank payment transfer
  const triggerVerifyTransfer = () => {
    setTransferCheckedStatus('verifying');
    setTimeout(() => {
      setTransferCheckedStatus('found');

      // Log payment audit action to Firestore
      logUserAction('CHECKOUT_TRANSFER_SUCCESS', 'Consumer finalized checkout payment with Bank Transfer', {
        amount: orderTotal,
        destination: `${streetAddress}, ${selectedCityName}, ${selectedState}`,
        distance: distanceInKm
      });

      setTimeout(() => {
        setShowGateway(false);
        setDone(true);
      }, 1500);
    }, 2000);
  };

  // USSD Dial helper trigger
  const runUSSDDialTrigger = () => {
    setUssdStep(2);
  };

  const handleUSSDSuccessConfirm = () => {
    setUssdStep(3);

    // Log payment audit action to Firestore
    logUserAction('CHECKOUT_USSD_SUCCESS', 'Consumer finalized checkout payment with USSD Dial code', {
      amount: orderTotal,
      destination: `${streetAddress}, ${selectedCityName}, ${selectedState}`,
      distance: distanceInKm
    });

    setTimeout(() => {
      setShowGateway(false);
      setDone(true);
    }, 1500);
  };

  if (done) {
    return (
      <div className="p-5 lg:p-6 max-w-md mx-auto flex flex-col items-center justify-center min-h-[75vh]" id="checkout-finished-container">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 animate-bounce" style={{ background: 'rgba(39, 80, 10, 0.12)' }}>
          <CheckCircle size={44} style={{ color: '#27500A' }} />
        </div>
        <h1 className="text-2xl font-semibold mb-2 tracking-tight text-center" style={{ color: '#27500A' }}>Payment Approved!</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Your payment of <span className="font-semibold text-gray-900">₦{orderTotal.toLocaleString()}</span> has been confirmed by the Interswitch network.
        </p>
        
        <div className="backdrop-blur-md bg-white/70 rounded-2xl p-5 w-full mb-6 border border-black/5 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Transaction ID</span>
            <span className="font-mono font-medium text-gray-800">ISW-90218-AF</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Escrow Address</span>
            <span className="font-medium text-gray-850 truncate max-w-[200px]" title={`${streetAddress}, ${selectedCityName}, ${selectedState}`}>
              {streetAddress}, {selectedCityName}, {selectedState}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Delivery Zone</span>
            <span className="font-medium text-gray-800">{selectedState} State</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Transit Weather</span>
            <span className="font-medium text-blue-600 flex items-center gap-1">
              <CloudRain size={12} /> {weatherData.temp} ({weatherData.rain})
            </span>
          </div>
        </div>

        <button onClick={() => onNavigate('order-tracking')} className="w-full rounded-xl py-3 mb-3 bg-[#0C447C] hover:bg-[#185FA5] text-white text-sm font-medium transition-all shadow-sm">
          Track Delivery Status
        </button>
        <button onClick={() => onNavigate('marketplace')} className="w-full rounded-xl py-3 border border-black/10 hover:bg-black/5 text-gray-600 text-sm font-medium transition-all">
          Back to Farmer Market
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto" id="checkout-main-container">
      {/* Navigation Headers */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => onNavigate('cart')} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-black transition-all">
          <ChevronLeft size={16} /> Back to my basket
        </button>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />
          <span className="text-xs text-gray-500">Escrow Protected Checkout</span>
        </div>
      </div>

      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-850">Checkout</h1>
          <p className="text-xs text-gray-500 mt-1">Provide your shipping address, select delivery speed, and make secure payment.</p>
        </div>
      </div>

      {/* Main Grid Checkout Layout */}
      <form onSubmit={handleCheckoutSubmit} className="grid lg:grid-cols-3 gap-6" id="checkout-form-details">
        {/* Left Columns - Delivery Route & API settings */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Section 1: Delivery Address & Dispatch Speed Selection */}
          <div className="backdrop-blur-md bg-white/75 rounded-2xl p-5 border border-black/10 shadow-sm relative overflow-hidden" id="maps-card-panel">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <MapPin size={16} className="text-emerald-700" /> Delivery Address Details
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Please provide your contact details, destination state, city, and exact street address for safe escrow delivery.</p>
            </div>

            {/* Recipient Details Row */}
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Enter full name..."
                  className="w-full h-9 px-3 rounded-lg text-xs bg-gray-50 border border-black/15 outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Active Contact Number</label>
                <input
                  type="text"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="E.g. +234 803 123 4567"
                  className="w-full h-9 px-3 rounded-lg text-xs bg-gray-50 border border-black/15 outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
                  required
                />
              </div>
            </div>

            {/* Address Auto preset / dropdown and input fields */}
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Delivery State</label>
                <input
                  type="text"
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  placeholder="E.g. Lagos, Oyo, Kano..."
                  className="w-full h-9 px-3 rounded-lg text-xs bg-gray-50 border border-black/15 outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">City / Town</label>
                <input
                  type="text"
                  value={selectedCityName}
                  onChange={(e) => setSelectedCityName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-xs bg-gray-50 border border-black/15 outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
                  placeholder="E.g. Lekki, Ikeja, Zaria"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Street Address</label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="E.g. Apartment, suite, house number"
                  className="w-full h-9 px-3 rounded-lg text-xs bg-gray-50 border border-black/15 outline-none focus:ring-1 focus:ring-green-500 text-gray-700"
                  required
                />
              </div>
            </div>

            {/* Delivery Methods Options select directly */}
            <div className="mb-4">
              <label className="text-[11px] font-medium text-gray-500 block mb-1.5">Select Delivery Speed</label>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeliverySpeed('standard')}
                  className={`p-3 rounded-xl border text-left transition flex justify-between items-center ${deliverySpeed === 'standard' ? 'border-[#27500A] bg-emerald-50 bg-opacity-30' : 'border-black/5 hover:border-black/15'}`}
                >
                  <div>
                    <span className="font-semibold text-xs block text-slate-800">Standard Secure Dispatch</span>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">Estimated delivery in 3 to 5 business days</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-gray-700">₦{baseLogisticsFee.toLocaleString()}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliverySpeed('express')}
                  className={`p-3 rounded-xl border text-left transition flex justify-between items-center ${deliverySpeed === 'express' ? 'border-[#0C447C] bg-blue-50 bg-opacity-30' : 'border-black/5 hover:border-black/15'}`}
                >
                  <div>
                    <span className="font-semibold text-xs block text-[#0C447C] flex items-center gap-1">
                      Express Smart Shipping <Sparkles size={11} className="text-yellow-500" />
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">Delivered in 1 to 2 days, priority packing</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#0C447C]">₦{(baseLogisticsFee + 1500).toLocaleString()}</span>
                </button>
              </div>
            </div>

            {/* Address Summary details */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-4 text-xs">
              <div className="bg-slate-100 bg-opacity-70 rounded-xl p-3 border border-black/5">
                <span className="text-gray-500 block text-[10px]">Destination State</span>
                <span className="font-semibold text-slate-850 truncate max-w-full block mt-0.5">{selectedState || 'Not specified'}</span>
              </div>
              <div className="bg-slate-100 bg-opacity-70 rounded-xl p-3 border border-black/5">
                <span className="text-gray-500 block text-[10px]">City / Town</span>
                <span className="font-semibold text-slate-850 truncate max-w-full block mt-0.5">{selectedCityName || 'Not specified'}</span>
              </div>
              <div className="bg-slate-100 bg-opacity-70 rounded-xl p-3 border border-black/5">
                <span className="text-gray-500 block text-[10px]/[14px]">Dispatch Service</span>
                <span className="font-semibold text-gray-800 block mt-0.5 capitalize">
                  {deliverySpeed} shipping
                </span>
              </div>
            </div>

            {/* Weather forecasting Live API Integration Box */}
            <div className={`p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all border ${weatherData.code >= 51 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 bg-opacity-60 border-emerald-100'}`} id="weather-api-box">
              <div className="flex gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${weatherData.code >= 51 ? 'bg-amber-600 text-white' : 'bg-emerald-700 text-white'}`}>
                  {isWeatherLoading ? (
                    <RefreshCw size={20} className="animate-spin text-white" />
                  ) : (
                    <CloudRain size={20} className="animate-pulse" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wider">Live Transit Weather Advisory</h3>
                    {isWeatherLoading && <span className="text-[9px] text-gray-400">updating API...</span>}
                    {weatherError && <span className="text-[9px] text-red-500 font-mono italic">weather offline mode</span>}
                  </div>
                  <p className="text-[11px] text-gray-600 font-medium mt-0.5">{weatherData.statusText}</p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                    {weatherData.code >= 51 
                      ? '⚠️ Mud risk warnings active on unpaved village collector roads. Farmer will securely pack items in heavy military-grade moisture-seal crates.' 
                      : '✅ Warm, wind-safe clearway values analyzed. Crop moisture loading is stable. Perfect transportation condition for open-bed agro carriage.'}
                  </p>
                </div>
              </div>

              {/* Weather statistics columns */}
              <div className="flex gap-4 self-center md:self-auto flex-shrink-0 text-center font-mono">
                <div className="px-2.5 py-1 text-xs">
                  <span className="text-gray-400 block text-[9px] lowercase font-sans">Temp</span>
                  <span className="font-bold text-gray-700">{weatherData.temp}</span>
                </div>
                <div className="px-2.5 py-1 text-xs border-l border-gray-200">
                  <span className="text-gray-400 block text-[9px] lowercase font-sans">Raindepth</span>
                  <span className="font-bold text-gray-750">{weatherData.rain}</span>
                </div>
                <div className="px-2.5 py-1 text-xs border-l border-gray-200">
                  <span className="text-gray-400 block text-[9px] lowercase font-sans">Wind</span>
                  <span className="font-bold text-gray-700">{weatherData.wind}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Section 2: Farm Escrow Safeguard Details */}
          <div className="backdrop-blur-md bg-white/70 rounded-2xl p-5 border border-black/10 shadow-sm" id="escrow-safeguard-panel">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#27500A]/10 flex items-center justify-center text-[#27500A] flex-shrink-0 mt-0.5">
                <Shield size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800">FarmX Two-Way Escrow Policy</h2>
                <p className="text-[11px] text-gray-500 leading-normal mt-1">
                  Once your payment is approved, your funds are secured in a decentralized escrow smart settlement contract. 
                  The farmer receives the money only AFTER you physically receive the crops and tap "Confirm delivery" in your Order Tracking center.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Interactive Payment Trigger */}
        <div className="space-y-4">
          <div className="backdrop-blur-md bg-white/75 rounded-2xl p-5 border border-black/10 shadow-lg sticky top-6" id="payment-trigger-panel">
            <h2 className="text-sm font-semibold text-gray-850 mb-3 border-b border-black/10 pb-2">Order summary</h2>
            
            <div className="space-y-2.5 mb-4">
              {[
                { title: 'Roma Tomatoes', q: '5kg', p: 3500 },
                { title: 'Maize (Dried white)', q: '10kg', p: 3500 },
                { title: 'White Onions', q: '3kg', p: 1350 }
              ].map(item => (
                <div key={item.title} className="flex justify-between text-xs">
                  <span className="text-gray-600 block">{item.title} ({item.q})</span>
                  <span className="font-mono text-gray-800">₦{item.p.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Calculations Area */}
            <div className="border-t border-black/10 pt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Cart Subtotal</span>
                <span className="font-mono text-gray-700">₦{orderSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                <div>
                  <span className="text-blue-800 font-medium block">Logistics Surcharge</span>
                  <span className="text-[9px] text-[#0C447C]">Standard dispatch shipping fee</span>
                </div>
                <span className="font-mono text-blue-900 font-semibold">₦{calcDeliveryFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Packing & Risk Insurance</span>
                <span className="font-mono text-gray-700">₦{platformFee}</span>
              </div>
              <div className="flex justify-between border-t border-black/10 pt-2 text-sm font-semibold">
                <span className="text-gray-850">Total Payable</span>
                <span className="font-mono text-blue-800">₦{orderTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-orange-50 text-[10px] text-orange-850 flex gap-2 border border-orange-100 leading-normal" id="checkout-meta-notice">
              <Info size={14} className="text-orange-700 flex-shrink-0" />
              <p>Escrow protects your cash! Funds are locked safely. Disbursal code executes immediately upon delivery verification.</p>
            </div>

            {/* CTA action button */}
            <button
              type="submit"
              className="w-full mt-4 py-3 rounded-xl bg-[#0C447C] hover:bg-[#185FA5] hover:shadow-md text-white md:text-sm text-xs font-semibold transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Secure Gateway Payment</span>
              <ArrowRight size={14} />
            </button>
            <div className="flex items-center justify-center gap-1 mt-3">
              <ShieldCheck size={12} className="text-gray-400" />
              <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wide">PCI-DSS Compliant Endpoint</span>
            </div>
          </div>
        </div>
      </form>

      {/* Embedded High Fidelity Interswitch / Paystack Sandbox Checkout Overlay Popup */}
      {showGateway && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" id="payment-gateway-modal">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-black/10 transform scale-100 transition-all">
            
            {/* Header section styled elegantly like high-end banks/fintech page */}
            <div className="bg-gradient-to-r from-emerald-800 to-green-700 p-5 text-white flex justify-between items-center relative">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg">
                  🇳🇬
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight uppercase">Interswitch WebPay Sandbox</h3>
                  <p className="text-[10px] text-white/70">Payment Portal ID: SW-281-AF</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowGateway(false);
                  setGatewayStage('input');
                }} 
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
                aria-label="Cancel transaction"
              >
                <X size={16} />
              </button>
            </div>

            {/* Merchant detail bar */}
            <div className="bg-slate-50 px-5 py-3 border-b border-black/5 flex justify-between items-center text-xs text-gray-600">
              <div>
                <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Merchant</span>
                <span className="font-semibold text-gray-800 flex items-center gap-1">🌾 FarmX Cooperative Ltd</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Transaction Amount</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">₦{orderTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Gateway Body content handles multiple stages dynamically */}
            {gatewayStage === 'submitting' ? (
              <div className="p-10 flex flex-col items-center justify-center min-h-[300px]">
                <RefreshCw size={44} className="text-emerald-700 animate-spin mb-4" />
                <h4 className="text-sm font-semibold text-gray-800">Processing Secure Transaction...</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm text-center">Contacting card issuing bank and verifying central switch escrow ledger. Do not close this browser window.</p>
              </div>
            ) : gatewayStage === 'success' ? (
              <div className="p-10 flex flex-col items-center justify-center min-h-[300px]" id="gateway-stage-success">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 text-emerald-700">
                  <CheckCircle size={36} />
                </div>
                <h4 className="text-sm font-semibold text-emerald-900 uppercase tracking-widest">Transaction Approved</h4>
                <p className="text-xs text-gray-500 mt-1 text-center">Receipt sent to email. Returning back to merchant portal...</p>
              </div>
            ) : gatewayStage === 'otp' ? (
              // OTP SMS Code verification gate simulation
              <form onSubmit={handleVerifyOtp} className="p-6 space-y-4" id="gateway-stage-otp">
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-105 text-[#0C447C] flex gap-3">
                  <Shield size={18} className="flex-shrink-0 text-blue-700" />
                  <div className="text-xs">
                    <p className="font-semibold">Interswitch SafeToken System</p>
                    <p className="text-gray-600 mt-1">
                      A unique One-Time-Password (SafeToken) has been generated and dispatched to your phone linked to this card/bank account (+234 803 **** 8821).
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-500 block mb-1">Enter 6-Digit OTP</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={otpValue}
                    onChange={(e) => setOtpValue(e.target.value)}
                    placeholder="E.g. 123456"
                    className="w-full h-11 px-4 rounded-xl text-center text-lg font-mono tracking-[0.5rem] bg-gray-50 border border-black/15 outline-none focus:ring-1 focus:ring-emerald-700 text-gray-800"
                    required
                  />
                  <p className="text-[10px] text-gray-400 text-center mt-1.5 font-mono">Any 6-digit test code works to simulate approvals</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setGatewayStage('input')}
                    className="flex-1 py-2.5 rounded-xl border border-black/10 text-gray-600 text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 transition-all cursor-pointer"
                  >
                    Submit Code
                  </button>
                </div>
              </form>
            ) : (
              // Gateway input tab screens
              <div className="flex flex-col md:flex-row min-h-[340px]" id="gateway-channels-wrapper">
                {/* Method selector sidebar */}
                <div className="md:w-1/3 bg-slate-50 border-r border-black/5 flex md:flex-col flex-row overflow-x-auto">
                  {[
                    { id: 'card', name: 'Card Pay', desc: 'Secure ATM card', icon: CreditCard },
                    { id: 'bank', name: 'Bank Transfer', desc: 'Instant escrow escrow', icon: Building },
                    { id: 'ussd', name: 'USSD Dial', desc: 'No internet required', icon: Phone }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPayMethod(tab.id as any)}
                      className={`p-4 text-left border-b border-black/5 md:w-full min-w-[130px] flex flex-col transition cursor-pointer ${payMethod === tab.id ? 'bg-white border-l-4 border-l-emerald-800' : 'hover:bg-black/5'}`}
                    >
                      <span className="font-semibold text-xs text-gray-800 flex items-center gap-1.5">
                        <tab.icon size={13} className={payMethod === tab.id ? 'text-emerald-850' : 'text-gray-400'} />
                        {tab.name}
                      </span>
                      <span className="text-[10px] text-gray-400 block mt-1">{tab.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Method details pane */}
                <div className="flex-1 p-5 min-h-[300px]">
                  {payMethod === 'card' && (
                    <form onSubmit={handlePaystackCardSubmit} className="space-y-4" id="interswitch-card-form">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Card details setup</h4>
                      
                      {cardError && (
                        <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs flex gap-1.5 items-center">
                          <AlertTriangle size={12} />
                          <span>{cardError}</span>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 block mb-1">ATM Card Number</label>
                          <input
                            type="text"
                            maxLength={19}
                            value={cardNumber}
                            onChange={(e) => {
                              // Auto format with spaces for credit/debit card numbers
                              const val = e.target.value.replace(/\D/g, '');
                              const formatted = val.match(/.{1,4}/g)?.join(' ') || '';
                              setCardNumber(formatted);
                            }}
                            placeholder="5061 2819 0182 2811"
                            className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-black/15 text-xs text-gray-800 outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Validity (MM/YY)</label>
                            <input
                              type="text"
                              maxLength={5}
                              value={cardExpiry}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                if (val.length >= 3) {
                                  setCardExpiry(`${val.slice(0, 2)}/${val.slice(2, 4)}`);
                                } else {
                                  setCardExpiry(val);
                                }
                              }}
                              placeholder="12/28"
                              className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-black/15 text-xs text-gray-800 outline-none focus:ring-1 focus:ring-emerald-700 text-center font-mono"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Secure CVV</label>
                            <input
                              type="password"
                              maxLength={3}
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              placeholder="***"
                              className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-black/15 text-xs text-gray-800 outline-none focus:ring-1 focus:ring-emerald-700 text-center font-mono"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-black/5 text-[10px] text-gray-400 font-light flex items-start gap-1.5">
                        <Lock size={12} className="text-emerald-700 flex-shrink-0 mt-0.5" />
                        <span>FarmX encrypts your banking tokens using military-grade security tunnels (SHA-256 standard encryption keys). All data is strictly sandboxed.</span>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 transition-all flex items-center justify-center gap-1.5 shadow-sm mt-2 cursor-pointer"
                      >
                        <ShieldCheck size={14} />
                        <span>Authorize card ₦{orderTotal.toLocaleString()}</span>
                      </button>
                    </form>
                  )}

                  {payMethod === 'bank' && (
                    <div className="space-y-4 text-xs" id="interswitch-bank-transfer-form">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Agritech Escrow Bank settlement</h4>
                      <p className="text-[11px] text-gray-500 leading-normal">
                        Transfer the exact amount to the temporary automated escrow trust account allocated for your order.
                      </p>

                      <div className="bg-slate-50 rounded-xl p-4 border border-black/5 space-y-2.5 font-mono">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-400">Beneficiary Bank</span>
                          <span className="font-semibold text-gray-800">Providus Bank [AgriAgro Switch]</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-400">Account Number</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 tracking-wider">9201882110</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-400">Exact Amount</span>
                          <span className="font-bold text-emerald-800">₦{orderTotal.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Timer */}
                      <div className="text-center p-2 bg-orange-50 border border-orange-100 rounded-lg text-orange-900 text-[10px] font-mono flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-ping" />
                        <span>Transfer Window Expiry: {transferMinutes < 10 ? `0${transferMinutes}` : transferMinutes}:{transferSeconds < 10 ? `0${transferSeconds}` : transferSeconds}</span>
                      </div>

                      {transferCheckedStatus === 'verifying' ? (
                        <div className="text-center py-4 space-y-2 select-none border border-black/5 rounded-xl">
                          <RefreshCw size={24} className="animate-spin text-emerald-700 mx-auto" />
                          <p className="text-[11px] text-gray-600">Checking central ledger switch database notifications...</p>
                        </div>
                      ) : transferCheckedStatus === 'found' ? (
                        <div className="text-center py-3 bg-emerald-50 text-emerald-800 border-emerald-100 border rounded-xl flex items-center justify-center gap-2">
                          <CheckCircle size={14} />
                          <span className="font-semibold text-[11px]">Payment detected! Approved</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={triggerVerifyTransfer}
                          className="w-full py-3 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <RefreshCw size={12} />
                          <span>I have made this transfer</span>
                        </button>
                      )}
                    </div>
                  )}

                  {payMethod === 'ussd' && (
                    <div className="space-y-4 text-xs" id="interswitch-ussd-form">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">USSD Mobile banking gateway</h4>
                      <p className="text-[11px] text-gray-500">
                        Dial this structured mobile USSD offline dialer string to authorize immediate funds from your bank ledger.
                      </p>

                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-gray-500 block">Select Banking Institution</label>
                        <div className="grid grid-cols-2 gap-2">
                          {ussdProviders.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedUSSDId(p.id);
                                setUssdStep(1);
                              }}
                              className={`py-2 px-3 text-left rounded-lg text-xs truncate border ${selectedUSSDId === p.id ? 'border-emerald-700 bg-emerald-50 text-emerald-850 font-semibold' : 'border-black/5 bg-gray-50 hover:bg-black/5'}`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* USSD screen interactive simulator */}
                      {ussdStep === 1 && (
                        <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-center shadow-inner font-mono relative overflow-hidden text-xs">
                          <p className="text-emerald-400 font-bold tracking-widest text-[#00ffcc]" style={{ color: '#00ffcc' }}>
                            {ussdProviders.find(p => p.id === selectedUSSDId)?.code}28116*₦{orderTotal}#
                          </p>
                          <p className="text-[10px] text-gray-400 mt-2">FarmX cooperative checkout dial string</p>
                          <button
                            type="button"
                            onClick={runUSSDDialTrigger}
                            className="mt-4 w-full py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg border border-emerald-950 shadow transition-all cursor-pointer"
                          >
                            Execute dial command
                          </button>
                        </div>
                      )}

                      {/* Dial window popup screen */}
                      {ussdStep === 2 && (
                        <div className="bg-slate-950 p-4 rounded-xl font-mono text-slate-200 border border-slate-800 text-xs space-y-4">
                          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2 text-[#00ffcc] text-[10px]" style={{ color: '#00ffcc' }}>
                            <p className="font-bold">SMART SCREEN SIMULATOR:</p>
                            <p className="text-white">Pay FarmX ₦{orderTotal.toLocaleString()} for {selectedCityName}, {selectedState} shipping?</p>
                            <p className="text-slate-400">Enter secure ATM banking PIN:</p>
                          </div>
                          
                          <div className="space-y-2">
                            <input
                              type="password"
                              maxLength={4}
                              placeholder="****"
                              className="w-full text-center tracking-[0.5rem] bg-slate-900 text-white border border-slate-700 h-9 font-bold rounded-lg"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setUssdStep(1)}
                                className="flex-1 py-2 bg-red-950 text-red-100 border border-red-900 text-[10px] font-bold rounded-lg"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleUSSDSuccessConfirm}
                                className="flex-1 py-2 bg-[#00ffcc] text-slate-950 text-[10px] font-bold rounded-lg"
                              >
                                Approve Debit
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {ussdStep === 3 && (
                        <div className="text-center py-5 bg-emerald-100/50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold text-xs flex items-center justify-center gap-2 animate-pulse">
                          <CheckCircle size={14} className="text-emerald-700" />
                          <span>USSD request authorized! Approved</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer with legal shield */}
            <div className="p-4 bg-slate-50 border-t border-black/5 text-center flex items-center justify-center gap-2">
              <ShieldCheck size={12} className="text-emerald-700" />
              <span className="text-[10px] text-gray-400 font-light tracking-wide uppercase">Secured by CBN licensed processor</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// Low-volume component dependencies mockup 
function Lock({ size, className }: { size?: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
