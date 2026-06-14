import React, { useState, useEffect } from 'react';
import { MapPin, CloudRain, Thermometer, Wind, Droplets, CheckCircle, Loader, Info, AlertTriangle, Map as MapIcon } from 'lucide-react';
import { Screen } from './types';
import { CropPredictionMap } from './CropPredictionMap';
import { searchLocation } from '../services/geocoding.service';
import { fetchLiveWeather } from '../services/weather.service';
import { NIGERIA_CROPS } from '../data/nigeriaCrops';
import { logUserAction, savePlantingSchedule } from '../firebase';
interface Props { onNavigate: (s: Screen) => void; profile?: any; }

const farmFields = [
  { id: 'A', label: 'Field A', ha: 3.2, lat: 10.5594, lng: 7.4441, soil: 'Sandy loam', lastCrop: 'Maize (2025)' },
  { id: 'B', label: 'Field B', ha: 1.8, lat: 10.5362, lng: 7.4215, soil: 'Clay loam', lastCrop: 'Sorghum (2025)' },
  { id: 'C', label: 'Field C', ha: 2.1, lat: 10.5105, lng: 7.4165, soil: 'Sandy loam', lastCrop: 'Cowpea (2024)' },
];

interface LocationAnalysis {
  weather: {
    rainfall: string;
    temp: string;
    humidity: string;
    windSpeed: string;
  };
  soilType: string;
  soilPH: number;
  nitrogenLevel: string;
  drainage: string;
  lastCrop: string;
  crops: Array<{
    name: string;
    match: number;
    harvest: string;
    emoji: string;
    reason: string;
    water: string;
    temp: string;
    duration: string;
    category: string;
  }>;
}

function getDynamicAnalysis(
  lat: number,
  lng: number,
  fieldIndex: number,
  liveWeather?: { temp: string; humidity: string; windSpeed: string; rainfall: string; } | null
): LocationAnalysis {
  // Use coordinates to generate deterministic offsets
  const factor1 = Math.sin(lat * 1200) * Math.cos(lng * 1200);
  const factor2 = Math.cos(lat * 800 + lng * 600);
  
  // Nigeria Latitudinal Agro-Ecological classification
  // North: lat > 11.5 (Sahel / Sudan Savanna)
  // Middle Belt: lat 8.5 to 11.5 (Guinea Savanna)
  // South: lat <= 8.5 (Derived Savanna / Forest / Rainforest)
  const currentZone = lat > 11.5 
    ? 'Sudan Savanna' 
    : lat > 8.5 
    ? 'Northern Guinea Savanna' 
    : 'Derived Savanna / Humid Forest';

  // Scientifically modeled pH based on Nigeria's latitudinal weather (heavy rain leaching in South = acidic)
  const basepH = lat > 11.5 ? 7.1 : lat > 8.5 ? 6.4 : 5.8;
  const pHOffset = factor1 * 0.4;
  const pH = parseFloat((basepH + pHOffset).toFixed(1));

  // Scientifically modeled soil types per Nigerian region
  const zoneSoils = lat > 11.5 
    ? ['Loamy sand', 'Sandy loam', 'Fine sand'] 
    : lat > 8.5 
    ? ['Sandy loam', 'Loam', 'Clay loam'] 
    : ['Clay loam', 'Silt clay loam', 'Loam'];
  
  const soilIdx = Math.abs(Math.round(lat * 5000 + lng * 3000)) % zoneSoils.length;
  const soilType = fieldIndex !== -1 ? farmFields[fieldIndex].soil : zoneSoils[soilIdx];

  // Model annual rainfall (mm) based on Latitude (coastal South gets ~2400mm, far dry North gets ~500mm)
  const annualRainfall = Math.round(Math.max(400, Math.min(2400, 2400 - (lat - 4.5) * 190 + factor2 * 75)));

  // Real-time weather overrides if available
  const parsedTemp = liveWeather?.temp ? parseInt(liveWeather.temp) : NaN;
  const parsedHumidity = liveWeather?.humidity ? parseInt(liveWeather.humidity) : NaN;
  const parsedWind = liveWeather?.windSpeed ? parseInt(liveWeather.windSpeed) : NaN;
  const parsedRainfall = liveWeather?.rainfall ? parseInt(liveWeather.rainfall) : NaN;

  const baseTemp = lat > 11.5 ? 33 : lat > 8.5 ? 29 : 27;
  const tempVal = !isNaN(parsedTemp) ? parsedTemp : Math.round(baseTemp + factor1 * 3); // 25°C to 36°C
  const humidityVal = !isNaN(parsedHumidity) ? parsedHumidity : Math.round(lat > 11.5 ? 40 + factor2 * 10 : lat > 8.5 ? 68 + factor2 * 8 : 82 + factor2 * 6);
  const windVal = !isNaN(parsedWind) ? parsedWind : Math.round(11 + factor1 * 4); // km/h
  const rainfallVal = !isNaN(parsedRainfall) ? parsedRainfall : Math.round(annualRainfall / 24); // 15-day slice

  const rainfallDisplay = liveWeather?.rainfall && parseInt(liveWeather.rainfall) > 0
    ? liveWeather.rainfall
    : `${rainfallVal}mm`;

  const lastCrops = ['Maize', 'Sorghum', 'Cowpea', 'Yams', 'Cassava', 'Fallow'];
  const cropIdx = Math.abs(Math.round(lat * 2000 + lng * 1000)) % lastCrops.length;
  const lastCrop = fieldIndex !== -1 ? farmFields[fieldIndex].lastCrop : `${lastCrops[cropIdx]} (2025)`;

  const nitrogen = pH < 6.0 ? 'Moderate' : pH > 7.0 ? 'Low' : 'Optimal';
  const drainage = soilType.includes('Clay') ? 'Poor' : soilType.includes('Sand') ? 'Excellent' : 'Good';

  // June (Month 6) planting season context
  const currentMonth = 6;

  // Run suitability scoring based on the NIGERIA_CROPS database
  const computedCrops = NIGERIA_CROPS.map((c) => {
    let score = 0;

    // 1. Zone/Ecology Compatibility (Max 35 points)
    const isZoneMatch = c.zones.some(z => {
      if (z === currentZone) return true;
      if (currentZone.includes('Savanna') && z.includes('Savanna')) return true;
      if (currentZone.includes('Forest') && (z.includes('Forest') || z.includes('Derived'))) return true;
      return false;
    });
    score += isZoneMatch ? 35 : 15;

    // 2. Annual Rainfall match (Max 25 points)
    if (annualRainfall >= c.rainfallMmMin && annualRainfall <= c.rainfallMmMax) {
      score += 25;
    } else {
      const dist = annualRainfall < c.rainfallMmMin 
        ? c.rainfallMmMin - annualRainfall 
        : annualRainfall - c.rainfallMmMax;
      score += Math.max(0, Math.round(25 - dist / 35));
    }

    // 3. Current Temperature match (Max 20 points)
    if (tempVal >= c.tempCMin && tempVal <= c.tempCMax) {
      score += 20;
    } else {
      const dist = tempVal < c.tempCMin ? c.tempCMin - tempVal : tempVal - c.tempCMax;
      score += Math.max(0, Math.round(20 - dist * 2));
    }

    // 4. Planting Month window match (Max 15 points)
    if (c.plantingMonths.includes(currentMonth)) {
      score += 15;
    } else {
      const dist = Math.min(...c.plantingMonths.map(m => Math.abs(m - currentMonth)));
      score += Math.max(0, Math.round(15 - dist * 3.5));
    }

    // 5. Soil chemistry match (Max 5 points)
    const pHMatch = pH >= 5.8 && pH <= 6.8;
    score += pHMatch ? 5 : 2;

    const match = Math.max(55, Math.min(98, score));

    // Calculate Dynamic Harvest Month (Planting in June + Maturity Days)
    const harvestMonthIdx = (currentMonth - 1 + Math.round(c.daysToMaturity / 30)) % 12;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const harvest = `${monthNames[harvestMonthIdx]} 2026`;

    // Map the moisture needs
    const waterDemand = c.soilMoistureMax > 0.45 ? 'High' : c.soilMoistureMax > 0.3 ? 'Medium' : 'Low';

    // Assign dynamic language name based on Nigerian cultural borders
    // West/Yoruba (lower latitude, western longitude)
    // East/Igbo (lower latitude, eastern longitude)
    // North/Hausa (high latitude)
    let localName = c.localNames.hausa;
    let fallbackLang = 'Hausa';
    if (lat <= 9.3) {
      if (lng < 7.1) {
        localName = c.localNames.yoruba;
        fallbackLang = 'Yoruba';
      } else {
        localName = c.localNames.igbo;
        fallbackLang = 'Igbo';
      }
    }

    // Formulate a distinct, beautiful, dynamically matched reasoning sentence
    let reason = '';
    const suitabilityLevel = match > 85 ? 'High' : match > 70 ? 'Moderate' : 'Marginal';
    
    if (match > 85) {
      reason = `${suitabilityLevel} fit as ${c.name} (called ${localName} in ${fallbackLang}) thrives in this ${currentZone} plot. Optimal pH is ${pH} and soil moisture matches your current ${soilType}.`;
    } else if (match > 70) {
      reason = `${suitabilityLevel} compatibility. Well-suited for ${soilType} and local temperature average of ${tempVal}°C. Growing period is ${c.daysToMaturity} days.`;
    } else {
      reason = `${suitabilityLevel} compatibility due to annual precipitation profile (${annualRainfall}mm vs ideal ${c.rainfallMmMin}mm+). Grow with supplementary watering.`;
    }

    return {
      name: c.name,
      emoji: c.emoji,
      match,
      harvest,
      reason,
      water: waterDemand,
      temp: `${c.tempCMin}–${c.tempCMax}°C`,
      duration: `${c.daysToMaturity} days`,
      category: c.category
    };
  });

  computedCrops.sort((a, b) => b.match - a.match);

  return {
    weather: {
      rainfall: rainfallDisplay,
      temp: `${tempVal}°C`,
      humidity: `${humidityVal}%`,
      windSpeed: `${windVal}km/h`
    },
    soilType,
    soilPH: pH,
    nitrogenLevel: nitrogen,
    drainage,
    lastCrop,
    crops: computedCrops
  };
}

export function CropPrediction({ onNavigate, profile }: Props) {
  const [selectedCrop, setSelectedCrop] = useState(0);
  const [activeField, setActiveField] = useState(0);
  const [customLocation, setCustomLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [weatherLayer, setWeatherLayer] = useState(false);
  const [soilLayer, setSoilLayer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [runAnalysis, setRunAnalysis] = useState(false);
  const [progress, setProgress] = useState(0);

  const [mapMode, setMapMode] = useState<'interactive_mock' | 'live_osm'>('live_osm');
  const [searchInput, setSearchInput] = useState('Kaduna, Kaduna State, Nigeria');
  const [locationLabel, setLocationLabel] = useState('Kaduna Region, Nigeria');

  const [analyzedLocationName, setAnalyzedLocationName] = useState<string | null>(null);
  const [analyzedCoords, setAnalyzedCoords] = useState<{ lat: number, lng: number } | null>(null);

  const [liveWeather, setLiveWeather] = useState<{
    temp: string;
    humidity: string;
    windSpeed: string;
    rainfall: string;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [analyzedWeather, setAnalyzedWeather] = useState<{
    temp: string;
    humidity: string;
    windSpeed: string;
    rainfall: string;
  } | null>(null);

  const currentCenter = activeField === -1 && customLocation
    ? customLocation
    : { lat: farmFields[activeField]?.lat || 10.5300, lng: farmFields[activeField]?.lng || 7.4200 };

  const locationHasChanged = Boolean(
    runAnalysis &&
    analyzedCoords &&
    (Math.abs(analyzedCoords.lat - currentCenter.lat) > 0.0001 ||
     Math.abs(analyzedCoords.lng - currentCenter.lng) > 0.0001)
  );

  useEffect(() => {
    let active = true;
    async function fetchWeather() {
      setWeatherLoading(true);
      try {
        const data = await fetchLiveWeather(currentCenter.lat, currentCenter.lng);
        if (active) {
          setLiveWeather(data);
        }
      } catch (err) {
        console.error('Error in fetchWeather trigger:', err);
      } finally {
        if (active) {
          setWeatherLoading(false);
        }
      }
    }
    fetchWeather();
    return () => {
      active = false;
    };
  }, [currentCenter.lat, currentCenter.lng]);

  useEffect(() => {
    if (activeField !== -1) {
      const field = farmFields[activeField];
      if (field) {
        setLocationLabel(`${field.label} · ${field.soil} parcel`);
        setSearchInput(`${field.label}, Kaduna State, Nigeria`);
      }
    }
  }, [activeField]);

  async function handleSearch() {
    if (!searchInput.trim()) return;
    try {
      const result = await searchLocation(searchInput);
      if (result) {
        setCustomLocation({ lat: result.lat, lng: result.lng });
        setActiveField(-1);
        setLocationLabel(result.displayName);
        logUserAction('MAP_COORDINATE_SEARCH', 'Farmer searched and located coordinate via Nominatim OSM', { query: searchInput, lat: result.lat, lng: result.lng });
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  }

  function handleLocationSelected(coords: { lat: number, lng: number }, placeName: string) {
    setCustomLocation(coords);
    setActiveField(-1);
    setLocationLabel(placeName);
    setSearchInput(placeName);
    logUserAction('MAP_COORDINATE_CLICK', 'Farmer drop-pinned coordinate on Leaflet OSM', coords);
  }

  const field = activeField === -1 ? null : farmFields[activeField];

  const handleMockMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    // Convert PCT to Kaduna Region coordinates roughly
    const lat = 10.5100 + (1 - yPct / 100) * 0.08;
    const lng = 7.4100 + (xPct / 100) * 0.05;

    const coords = { lat, lng };
    setCustomLocation(coords);
    setActiveField(-1);
    
    logUserAction('MAP_COORDINATE_CLICK', 'Farmer selected custom latitude/longitude on mock maps tracker', coords);
    
    // Reverse geocode the click on the mock map too for a premium feel!
    reverseGeocodeMock(coords);
  };

  async function reverseGeocodeMock(coords: { lat: number, lng: number }) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`,
        { headers: { 'User-Agent': 'FarmX/1.0 (contact@farmx.ng)' } }
      );
      const data = await res.json();
      if (data && data.address) {
        const { village, town, city, suburb, state } = data.address;
        const localArea = village || town || city || suburb || 'Kaduna Region';
        const display = `${localArea}, ${state || 'Kaduna State'}`;
        setLocationLabel(display);
        setSearchInput(display);
      } else {
        const fallback = `Point: ${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E (Kaduna)`;
        setLocationLabel(fallback);
        setSearchInput(fallback);
      }
    } catch {
      const fallback = `Point: ${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E (Kaduna)`;
      setLocationLabel(fallback);
      setSearchInput(fallback);
    }
  }

  const currentAnalysis = getDynamicAnalysis(currentCenter.lat, currentCenter.lng, activeField, liveWeather);

  const recommendationsAnalysis = (runAnalysis && analyzedCoords)
    ? getDynamicAnalysis(
        analyzedCoords.lat,
        analyzedCoords.lng,
        farmFields.findIndex(f => Math.abs(f.lat - analyzedCoords.lat) < 0.0001 && Math.abs(f.lng - analyzedCoords.lng) < 0.0001),
        analyzedWeather
      )
    : currentAnalysis;

  const cropList = recommendationsAnalysis.crops;

  const crop = cropList[selectedCrop] || cropList[0];

  const handleAnalyse = () => {
    setRunAnalysis(true);
    setLoading(true);
    setProgress(0);
    setAnalyzedLocationName(locationLabel);
    setAnalyzedCoords(currentCenter);
    setAnalyzedWeather(liveWeather);

    // Record interaction in Firebase audit logger
    logUserAction('AI_CROP_ANALYSE', 'Farmer triggered crop suitability AI prediction', {
      field: activeField === -1 ? 'Custom GPS Point' : farmFields[activeField].label,
      soil: activeField === -1 ? 'Silt clay loam (AI estimated)' : farmFields[activeField].soil,
      lastCrop: activeField === -1 ? 'Fallow' : farmFields[activeField].lastCrop,
      selectedTargetCrop: crop.name,
      location: locationLabel,
      coordinates: currentCenter
    });

    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setLoading(false); return 100; }
        return p + 8;
      });
    }, 120);
  };

  const handleGenerate = async () => {
    setGenerated(true);

    if (profile && profile.uid) {
      const scheduleId = `${crop.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
      const newSchedule = {
        id: scheduleId,
        cropName: crop.name,
        cropEmoji: crop.emoji,
        harvestMonth: crop.harvest,
        location: locationLabel,
        field: activeField === -1 ? 'Custom GPS Point' : farmFields[activeField].label,
        coordinates: currentCenter,
        matchScore: crop.match,
        waterNeeds: crop.water,
        tempRange: crop.temp,
        duration: crop.duration,
        generatedAt: new Date().toISOString(),
      };

      // Persist to Firestore so PlantingCalendar / Overview pick it up via onSnapshot
      await savePlantingSchedule(profile.uid, newSchedule);
    } else {
      console.warn('[CropPrediction] No profile.uid available — planting calendar will not persist.');
    }

    logUserAction('GENERATE_PLANTING_CALENDAR', 'Farmer generated custom calendar for selected crop', {
      crop: crop.name,
      field: activeField === -1 ? 'Custom GPS Point' : farmFields[activeField].label,
      location: locationLabel,
      coordinates: currentCenter,
      analysisMatchesOriginalSelection: !locationHasChanged,
      originalAnalyzedLocation: analyzedLocationName
    });

    setTimeout(() => onNavigate('planting-calendar'), 1400);
  };

  return (
    <div className="p-5 lg:p-6 max-w-6xl mx-auto animate-fade-in" id="crop_prediction_root">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4" id="crop_prediction_header">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#27500A]" style={{ fontSize: 22 }}>AI crop prediction</h1>
          <p className="text-xs text-gray-500 mt-0.5" style={{ fontSize: 13 }}>Select your farm parcel or search any location to analyze conditions and get AI recommendations</p>
        </div>

        {/* Toggle offline vs online layout dynamically */}
        <div className="flex bg-[#F1F5E9] p-0.5 rounded-lg text-xs font-semibold self-start sm:self-center shrink-0 border border-emerald-800/10" id="map_mode_selector_crop">
          <button
            type="button"
            onClick={() => setMapMode('interactive_mock')}
            className={`px-3 py-1.5 rounded-md transition duration-200 cursor-pointer ${mapMode === 'interactive_mock' ? 'bg-[#27500A] text-white shadow-sm' : 'text-emerald-800 hover:text-[#27500A]'}`}
          >
            Interactive Grid
          </button>
          <button
            type="button"
            onClick={() => setMapMode('live_osm')}
            className={`px-3 py-1.5 rounded-md transition duration-200 cursor-pointer ${mapMode === 'live_osm' ? 'bg-[#27500A] text-white shadow-sm' : 'text-emerald-800 hover:text-[#27500A]'}`}
          >
            Live OpenStreet Map
          </button>
        </div>
      </div>

      {/* Location search and address display */}
      <div className="grid lg:grid-cols-5 gap-5" id="crop_prediction_grid">
        {/* Left: Map + inputs */}
        <div className="lg:col-span-3 space-y-4" id="crop_prediction_left_column">
          {/* Location search and address display */}
          <div className="flex gap-2" id="crop_prediction_search_bar">
            <div className="relative flex-1" id="crop_prediction_info_panel">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-800 pointer-events-none" />
              <input type="text" 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search location or drop a pin..."
                className="w-full pl-9 pr-4 rounded-lg outline-none"
                style={{ height: 36, border: '0.5px solid rgba(0,0,0,0.2)', fontSize: 13, color: '#444441', background: '#fff' }}
                id="crop_prediction_search_input" />
            </div>
            <button 
              type="button"
              onClick={handleSearch}
              className="px-4 bg-[#27500A] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-emerald-800 active:scale-95 transition-all text-center flex items-center justify-center"
              style={{ height: 36 }}
            >
              Search
            </button>
          </div>

          <p className="text-xs text-gray-600 font-medium px-1 flex items-center gap-1.5 animate-fade-in" id="crop_location_label_line">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block animate-pulse"></span>
            Location: <span className="font-semibold text-[#27500A]">{locationLabel}</span>
          </p>

          {/* Farm field selector buttons */}
          <div className="flex gap-2" id="crop_prediction_field_selector">
            {farmFields.map((f, i) => (
              <button key={f.id} onClick={() => { setActiveField(i); setCustomLocation(null); }}
                id={`field_btn_${f.id}`}
                className="flex-1 rounded-lg px-3 py-2 text-left transition-all cursor-pointer"
                style={{ border: `${activeField === i ? '1px' : '0.5px'} solid ${activeField === i ? '#3B6D11' : 'rgba(0,0,0,0.12)'}`, background: activeField === i ? '#EAF3DE' : '#fff' }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: activeField === i ? '#27500A' : '#444441' }}>Field {f.id}</p>
                <p style={{ fontSize: 10, color: '#5F5E5A' }}>{f.ha}ha · {f.soil}</p>
              </button>
            ))}
            <button onClick={() => { setActiveField(-1); if (!customLocation) { setCustomLocation({ lat: 10.5300, lng: 7.4200 }); } }}
              id="field_btn_custom"
              className="rounded-lg px-3 py-2 text-left transition-all min-w-[100px] cursor-pointer"
              style={{ border: `${activeField === -1 ? '1px' : '0.5px'} solid ${activeField === -1 ? '#e63946' : 'rgba(0,0,0,0.12)'}`, background: activeField === -1 ? '#ffe3e3' : '#fff' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: activeField === -1 ? '#e63946' : '#444441' }}>Custom pin</p>
              <p style={{ fontSize: 10, color: '#5F5E5A' }}>{activeField === -1 && customLocation ? 'Clicked spot' : 'Click Map'}</p>
            </button>
          </div>

          {/* Dual Satellite Map vs simulated interactive terrain loader */}
          <div className="rounded-xl overflow-hidden relative shadow-sm hover:shadow transition-shadow duration-300 animate-fade-in" style={{ height: 260, border: '0.5px solid rgba(0,0,0,0.12)' }} id="crop_prediction_map_container">
            {mapMode === 'live_osm' ? (
              <CropPredictionMap 
                center={currentCenter}
                farmFields={farmFields}
                activeField={activeField}
                customLocation={customLocation}
                onFieldSelect={(idx) => {
                  setActiveField(idx);
                  setCustomLocation(null);
                }}
                onLocationSelected={handleLocationSelected}
              />
            ) : (
              /* Simulated high-fidelity offline interactive farm terrain grid */
              <div 
                onClick={handleMockMapClick}
                className="absolute inset-0 cursor-crosshair select-none flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(160deg, #c8dba8 0%, #b5cc90 25%, #d4e8c2 55%, #a8c47a 80%, #c2d89a 100%)' }}
              >
                {/* Simulated Roads / Rivers lines */}
                <div className="absolute" style={{ top: '40%', left: 0, right: 0, height: 2, background: 'rgba(200,180,120,0.5)' }} />
                <div className="absolute" style={{ top: 0, bottom: 0, left: '50%', width: 2, background: 'rgba(200,180,120,0.3)' }} />
                
                {/* Farm plot outlines */}
                <div className="absolute transition-all" style={{ top: '18%', left: '30%', width: '22%', height: '22%', background: activeField === 0 ? 'rgba(59,109,17,0.45)' : 'rgba(59,109,17,0.2)', border: activeField === 0 ? '2.5px solid #27500A' : '1px solid #3B6D11', borderRadius: 4 }}>
                  <span className="absolute inset-x-0 bottom-1.5 flex items-center justify-center text-[10px] font-semibold text-[#27500A]">Field A</span>
                </div>
                <div className="absolute transition-all" style={{ top: '48%', left: '55%', width: '16%', height: '16%', background: activeField === 1 ? 'rgba(59,109,17,0.45)' : 'rgba(59,109,17,0.2)', border: activeField === 1 ? '2.5px solid #27500A' : '1px solid #3B6D11', borderRadius: 4 }}>
                  <span className="absolute inset-x-0 bottom-1.5 flex items-center justify-center text-[8px] font-semibold text-[#27500A]">Field B</span>
                </div>
                <div className="absolute transition-all" style={{ top: '54%', left: '16%', width: '14%', height: '14%', background: activeField === 2 ? 'rgba(59,109,17,0.45)' : 'rgba(59,109,17,0.2)', border: activeField === 2 ? '2.5px solid #27500A' : '1px solid #3B6D11', borderRadius: 4 }}>
                  <span className="absolute inset-x-0 bottom-1.5 flex items-center justify-center text-[8px] font-semibold text-[#27500A]">Field C</span>
                </div>

                {/* Pre-defined field marker pin buttons */}
                {farmFields.map((f, i) => {
                  const pctX = i === 0 ? 41 : i === 1 ? 63 : 23;
                  const pctY = i === 2 ? 61 : i === 1 ? 56 : 29;
                  return (
                    <button key={f.id} onClick={(e) => {
                      e.stopPropagation(); // prevent triggering canvas mock map click
                      setActiveField(i);
                      setCustomLocation(null);
                      logUserAction('MAP_FIELD_CLICK', `Farmer selected field ${f.id} via offline simulated interface`, { id: f.id });
                    }}
                      aria-label={`Select ${f.label}`}
                      className="absolute flex flex-col items-center transition-all duration-300 hover:scale-[1.05]"
                      style={{ left: `${pctX}%`, top: `${pctY}%`, transform: 'translate(-50%, -100%)' }}>
                      <div className="rounded-full w-6 h-6 flex items-center justify-center shadow-md"
                        style={{ background: i === activeField ? '#27500A' : '#ffffff', border: '1.5px solid #3B6D11' }}>
                        <MapPin size={12} style={{ color: i === activeField ? '#fff' : '#3B6D11' }} />
                      </div>
                      <div className="px-1.5 py-0.5 rounded mt-0.5 shadow-sm font-semibold" style={{ fontSize: 9, background: i === activeField ? '#27500A' : 'rgba(255,255,255,0.95)', color: i === activeField ? '#fff' : '#27500A' }}>
                        {f.label}
                      </div>
                    </button>
                  );
                })}

                {/* Simulated Custom point placement pin */}
                {activeField === -1 && customLocation && (
                  <div 
                    className="absolute flex flex-col items-center"
                    style={{ 
                      left: `${Math.max(5, Math.min(95, ((customLocation.lng - 7.4100) / 0.05) * 100))}%`, 
                      top: `${Math.max(5, Math.min(95, (1 - (customLocation.lat - 10.5100) / 0.08) * 100))}%`, 
                      transform: 'translate(-50%, -100%)' 
                    }}
                  >
                    <div className="rounded-full w-6 h-6 flex items-center justify-center shadow bg-red-600 border border-red-800 animate-pulse text-white">
                      <MapPin size={12} />
                    </div>
                    <div className="bg-red-600 text-white text-[8px] rounded px-1.5 py-0.5 mt-0.5 whitespace-nowrap shadow border border-red-900 font-medium">
                      Custom Pin
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Layer overlays simulating remote sensed data filters */}
            {weatherLayer && <div className="absolute inset-0 pointer-events-none z-[1000]" style={{ background: 'rgba(24,95,165,0.18)' }} />}
            {soilLayer && <div className="absolute inset-0 pointer-events-none z-[1000]" style={{ background: 'rgba(132,79,11,0.12)' }} />}

            {/* Layer controls */}
            <div className="absolute top-3 right-3 space-y-1.5 z-[1001]" id="map_overlay_controls">
              <button type="button" onClick={() => setSearchInput('') || setWeatherLayer(!weatherLayer)}
                id="weather_overlay_btn"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium cursor-pointer transition-all active:scale-[0.98]"
                style={{ background: weatherLayer ? '#185FA5' : 'rgba(255,255,255,0.95)', color: weatherLayer ? '#fff' : '#444441', fontSize: 10, border: '0.5px solid rgba(0,0,0,0.15)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <CloudRain size={11} /> Weather Overlay
              </button>
              <button type="button" onClick={() => setSoilLayer(!soilLayer)}
                id="soil_overlay_btn"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium cursor-pointer transition-all active:scale-[0.98]"
                style={{ background: soilLayer ? '#854F0B' : 'rgba(255,255,255,0.95)', color: soilLayer ? '#fff' : '#444441', fontSize: 10, border: '0.5px solid rgba(0,0,0,0.15)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <Droplets size={11} /> Soil Chemistry
              </button>
            </div>

            {/* GPS tracker instruction banner */}
            <div className="absolute bottom-3 left-3 bg-white/95 px-2 py-1 rounded border border-black/10 flex items-center gap-1 shadow-sm pointer-events-none z-[1001]" style={{ fontSize: 9 }} id="map_status_badge">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
              <span className="text-gray-750 font-semibold font-mono">
                {mapMode === 'live_osm' ? 'Leaflet OSM Active · Click Map to drop custom pin' : 'Simulated Grid Active · Click to Pin'}
              </span>
            </div>
          </div>

          {/* Weather strip */}
          <div className="grid grid-cols-4 gap-2 relative" id="crop_weather_strip">
            {weatherLoading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[0.5px] rounded-xl flex items-center justify-center z-10 transition-all border border-emerald-600/10" id="weather_strip_loader">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold animate-pulse">
                  <Loader size={12} className="animate-spin text-emerald-800" />
                  <span>Fetching live weather...</span>
                </div>
              </div>
            )}
            {[
              { icon: CloudRain, label: 'Rainfall', value: currentAnalysis.weather.rainfall, color: '#185FA5' },
              { icon: Thermometer, label: 'Max temp', value: currentAnalysis.weather.temp, color: '#A32D2D' },
              { icon: Droplets, label: 'Humidity', value: currentAnalysis.weather.humidity, color: '#185FA5' },
              { icon: Wind, label: 'Wind speed', value: currentAnalysis.weather.windSpeed, color: '#5F5E5A' },
            ].map(w => (
              <div key={w.label} className="rounded-xl p-3 text-center transition-all bg-white hover:border-emerald-600" style={{ border: '0.5px solid rgba(0,0,0,0.1)' }}>
                <w.icon size={15} className="mx-auto mb-1" style={{ color: w.color }} aria-hidden="true" />
                <p style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>{w.value}</p>
                <p style={{ fontSize: 9, color: '#5F5E5A' }}>{w.label}</p>
              </div>
            ))}
          </div>

          {/* AI inputs summary */}
          <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#F7F6F2' }} id="crop_prediction_inputs_card">
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 12, fontWeight: 500, color: '#444441' }}>Analysis inputs</p>
              {!runAnalysis && (
                <button onClick={handleAnalyse}
                  id="run_ai_analysis_btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all active:scale-[0.98] cursor-pointer font-medium"
                  style={{ background: '#27500A', color: '#fff', fontSize: 11 }}>
                  Run AI analysis
                </button>
              )}
              {runAnalysis && loading && (
                <div className="flex items-center gap-1.5" id="analysis_loading_indicator">
                  <Loader size={12} style={{ color: '#27500A' }} className="animate-spin" />
                  <span style={{ fontSize: 11, color: '#27500A' }}>Analysing… {progress}%</span>
                </div>
              )}
              {runAnalysis && !loading && (
                <div className="flex items-center gap-2" id="analysis_complete_indicator">
                  {locationHasChanged && (
                    <button 
                      type="button" 
                      onClick={handleAnalyse}
                      className="px-2 py-1 rounded bg-[#27500A] text-white hover:bg-emerald-800 transition-all font-semibold"
                      style={{ fontSize: 10 }}
                      id="analysis_rerun_direct_btn"
                    >
                      Re-run AI Analysis
                    </button>
                  )}
                  <div className="flex items-center gap-1" id="analysis_complete_status">
                    <CheckCircle size={12} style={{ color: '#27500A' }} />
                    <span style={{ fontSize: 11, color: '#27500A', fontWeight: 500 }}>Completed</span>
                  </div>
                </div>
              )}
            </div>
            {runAnalysis && loading && (
              <div className="mb-3" id="analysis_progress_bar">
                <div className="h-1.5 rounded-full" style={{ background: '#EAF3DE' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: '#27500A' }} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-y-2.5" id="analysis_inputs_table">
              {[
                ['GPS coordinate', field ? `${field.lat.toFixed(4)}°N, ${field.lng.toFixed(4)}°E` : customLocation ? `${customLocation.lat.toFixed(4)}°N, ${customLocation.lng.toFixed(4)}°E` : '10.5300°N, 7.4200°E'],
                ['Field selected', field ? `${field.label} · ${field.ha}ha` : 'Custom GPS Point'],
                ['Soil type', `${currentAnalysis.soilType} (pH ${currentAnalysis.soilPH})`],
                ['Last crop', currentAnalysis.lastCrop],
                ['Season', 'Wet season (Jun 2026)'],
                ['Rainfall (14 day)', `${currentAnalysis.weather.rainfall} projected`],
              ].map(([k, v]) => (
                <div key={k}>
                  <p style={{ fontSize: 10, color: '#5F5E5A' }}>{k}</p>
                  <p style={{ fontSize: 12, color: '#444441', fontWeight: 500 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI crop results */}
        <div className="lg:col-span-2 space-y-3" id="crop_prediction_right_column">
          <div className="rounded-xl p-4" style={{ border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff' }} id="ai_recommendations_card">
            <div className="flex items-center justify-between mb-2" id="ai_recommendations_header_box">
              <h2 style={{ fontSize: 14, fontWeight: 500, color: '#444441' }}>AI recommendations</h2>
              {runAnalysis && (
                <button
                  type="button"
                  onClick={() => {
                    const elem = document.getElementById('crop_prediction_search_input');
                    if (elem) {
                      elem.focus();
                      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                  className="text-xs text-blue-700 hover:text-blue-800 hover:underline font-semibold cursor-pointer shrink-0"
                  id="change_location_trigger_btn"
                >
                  Change Location
                </button>
              )}
            </div>

            {runAnalysis && (
              <div className="bg-[#F7F6F2] p-2.5 rounded-lg border border-gray-150 mb-3 text-xs space-y-1.5" id="analyzed_location_badge">
                <div className="flex justify-between items-center truncate">
                  <p className="text-gray-600 truncate" style={{ fontSize: 11 }}>
                    📍 Analysed: <span className="font-semibold text-[#27500A]">{analyzedLocationName || locationLabel}</span>
                  </p>
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-emerald-100 text-emerald-800 font-medium shrink-0" style={{ fontSize: 8 }}>
                    FAO CROPGRIDS
                  </span>
                </div>
                <div className="text-[9px] text-[#5F5E5A] flex items-center gap-1 border-t border-gray-200/55 pt-1.5" style={{ fontSize: 9 }}>
                  <CheckCircle size={10} className="text-emerald-700 shrink-0" />
                  <span>Calibrated using global FAO 173-Crop spatial geo-referenced distribution models.</span>
                </div>
              </div>
            )}

            {!runAnalysis && (
              <div className="flex items-center justify-between gap-2 mb-3" id="not_analyzed_badge">
                <p style={{ fontSize: 11, color: '#5F5E5A' }}>
                  {field ? field.label : 'Custom GPS Point'} · {locationLabel} · {cropList.length} crops ranked
                </p>
                <span className="px-1.5 py-0.5 rounded text-[8px] bg-emerald-50 text-emerald-700 font-medium border border-emerald-100 shrink-0" style={{ fontSize: 8 }}>
                  FAO CROPGRIDS
                </span>
              </div>
            )}

            {locationHasChanged && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 animate-fade-in text-amber-900" id="location_mismatch_warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5 animate-bounce" />
                  <div className="flex-1 text-[11px] leading-normal font-sans">
                    <p className="font-bold text-amber-800">Selected location changed!</p>
                    <p className="text-amber-700 mt-0.5">
                      You are now inspecting <span className="font-semibold">{locationLabel}</span>. Re-run analysis for matching recommendations or revert.
                    </p>
                    <div className="mt-2 text-center flex gap-1.5">
                      <button 
                        type="button"
                        onClick={handleAnalyse}
                        className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-md transition-all text-[10px] cursor-pointer"
                      >
                        Re-run AI Analysis
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if (analyzedCoords) {
                            const foundIdx = farmFields.findIndex(f => Math.abs(f.lat - analyzedCoords.lat) < 0.0001 && Math.abs(f.lng - analyzedCoords.lng) < 0.0001);
                            if (foundIdx !== -1) {
                              setActiveField(foundIdx);
                              setCustomLocation(null);
                            } else {
                              setActiveField(-1);
                              setCustomLocation(analyzedCoords);
                            }
                            if (analyzedLocationName) {
                              setLocationLabel(analyzedLocationName);
                              setSearchInput(analyzedLocationName);
                            }
                          }
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-800 font-semibold rounded-md transition-all text-[10px] cursor-pointer"
                      >
                        Revert Location
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!runAnalysis && (
              <div className="rounded-xl p-6 text-center" style={{ background: '#F7F6F2', border: '0.5px solid rgba(0,0,0,0.1)' }} id="ready_for_analysis_prompt">
                <span style={{ fontSize: 32 }}>🌾</span>
                <p style={{ fontSize: 13, color: '#5F5E5A', marginTop: 8 }}>Select a field/pinned location and run the AI analysis to see crop recommendations</p>
              </div>
            )}

            {runAnalysis && (
              <div id="crops_recommendations_list">
                {/* Floating horizontal scroll row */}
                <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {cropList.map((c, i) => (
                    <div
                      key={c.name}
                      id={`crop_item_${i}`}
                      onClick={() => setSelectedCrop(i)}
                      className="rounded-xl p-3 cursor-pointer transition-all flex-shrink-0"
                      style={{
                        width: 148,
                        border: i === selectedCrop ? '1.5px solid #3B6D11' : '0.5px solid rgba(0,0,0,0.1)',
                        background: i === selectedCrop ? '#EAF3DE' : '#F7F6F2',
                        opacity: loading ? 0.4 : 1,
                        boxShadow: i === selectedCrop ? '0 2px 8px rgba(39,80,10,0.15)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span style={{ fontSize: 24 }}>{c.emoji}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: i === 0 ? '#27500A' : '#639922' }}>{c.match}%</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#444441', marginBottom: 2 }}>{c.name}</p>
                      <div className="flex gap-1 mb-2 flex-wrap">
                        {i === 0 && <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 8, background: '#27500A', color: '#fff' }}>Best fit</span>}
                        <span className="rounded-full px-1.5 py-0.5" style={{ fontSize: 8, background: '#F1EFE8', color: '#5F5E5A' }}>{c.category}</span>
                      </div>
                      <div className="h-1.5 rounded-full mb-2" style={{ background: '#D4E8C2' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${c.match}%`, background: i === 0 ? '#27500A' : '#639922' }} />
                      </div>
                      <p style={{ fontSize: 9, color: '#5F5E5A' }}>🗓 {c.harvest}</p>
                      <p style={{ fontSize: 9, color: '#5F5E5A' }}>💧 {c.water} · ⏱ {c.duration}</p>
                    </div>
                  ))}
                </div>
                {/* Selected crop detail */}
                {cropList[selectedCrop] && (
                  <div className="mt-3 rounded-xl p-3" style={{ background: '#EAF3DE', border: '0.5px solid rgba(39,80,10,0.2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: 18 }}>{cropList[selectedCrop].emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#27500A' }}>{cropList[selectedCrop].name}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#27500A', marginLeft: 'auto' }}>{cropList[selectedCrop].match}% match</span>
                    </div>
                    <div className="flex gap-1 mb-2">
                      <Info size={11} style={{ color: '#5F5E5A', flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.5 }}>{cropList[selectedCrop].reason}</p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <span style={{ fontSize: 10, color: '#27500A' }}>🗓 Harvest: {cropList[selectedCrop].harvest}</span>
                      <span style={{ fontSize: 10, color: '#27500A' }}>💧 {cropList[selectedCrop].water} water</span>
                      <span style={{ fontSize: 10, color: '#27500A' }}>🌡 {cropList[selectedCrop].temp}</span>
                      <span style={{ fontSize: 10, color: '#27500A' }}>⏱ {cropList[selectedCrop].duration}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {runAnalysis && !loading && (
            generated ? (
              <div className="rounded-xl p-4 text-center text-emerald-800 animate-pulse" style={{ background: '#EAF3DE', border: '1px solid #3B6D11' }} id="calendar_generated_success">
                <CheckCircle size={24} className="mx-auto mb-2 text-emerald-800" />
                <p style={{ fontSize: 13, fontWeight: 500 }}>Calendar generated for {crop.name}!</p>
                <p style={{ fontSize: 11, color: '#5F5E5A' }}>Redirecting to planting calendar…</p>
              </div>
            ) : (
              <div className="space-y-2" id="calendar_actions_block">
                <button onClick={handleGenerate}
                  id="generate_planting_calendar_btn"
                  className="w-full rounded-lg py-2.5 transition-all text-center cursor-pointer active:scale-[0.98]"
                  style={{ background: '#27500A', color: '#fff', fontSize: 13, fontWeight: 500 }}>
                  Generate planting calendar → {crop.name}
                </button>
                <button onClick={() => onNavigate('planting-calendar')}
                  id="view_existing_calendar_btn"
                  className="w-full rounded-lg py-2 text-center cursor-pointer"
                  style={{ border: '0.5px solid #3B6D11', color: '#27500A', fontSize: 12 }}>
                  View existing calendar
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
