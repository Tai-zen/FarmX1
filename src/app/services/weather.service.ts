// weather.service.ts
// Uses Open-Meteo — completely free, no API key required
// Falls back to OpenWeather if VITE_OPENWEATHER_API_KEY is set

export interface LiveWeatherData {
  temp: string;
  humidity: string;
  windSpeed: string;
  rainfall: string;      // current precipitation
  tempRaw: number;       // raw °C for scoring
  humidityRaw: number;   // raw % for scoring
  rainfallRaw: number;   // raw mm for scoring
}

export interface ClimateData {
  totalRainfallMmPerYear: number;
  avgTempC: number;
  avgMaxTempC: number;
  monthly: Array<{ month: number; rainfallMm: number; avgTempC: number }>;
  droughtRisk: 'low' | 'medium' | 'high';
}

/**
 * Fetches live weather for given coordinates using Open-Meteo (free, no key).
 */
export async function fetchLiveWeather(lat: number, lng: number): Promise<LiveWeatherData | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation` +
      `&timezone=Africa%2FLagos`
    );
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const data = await res.json();

    if (!data?.current) return null;
    const c = data.current;
    const tempRaw     = Math.round(c.temperature_2m ?? 0);
    const humidityRaw = Math.round(c.relative_humidity_2m ?? 0);
    const rainfallRaw = Math.round((c.precipitation ?? 0) * 10) / 10;

    return {
      temp:         `${tempRaw}°C`,
      humidity:     `${humidityRaw}%`,
      windSpeed:    `${Math.round(c.wind_speed_10m ?? 0)}km/h`,
      rainfall:     rainfallRaw > 0 ? `${rainfallRaw}mm` : '0mm',
      tempRaw,
      humidityRaw,
      rainfallRaw,
    };
  } catch (err) {
    console.error('[Weather] Open-Meteo fetch failed:', err);
    return null;
  }
}

/**
 * Fetches 12-month historical climate summary from Open-Meteo Archive API.
 * Free, no key needed. Used for annual rainfall and seasonal analysis.
 */
export async function fetchClimateHistory(lat: number, lng: number): Promise<ClimateData | null> {
  try {
    const endDate   = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);

    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const res = await fetch(
      `https://archive-api.open-meteo.com/v1/archive` +
      `?latitude=${lat}&longitude=${lng}` +
      `&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}` +
      `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min` +
      `&timezone=Africa%2FLagos`
    );
    if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}`);
    const data = await res.json();

    const dates:    string[] = data.daily?.time ?? [];
    const precip:   number[] = data.daily?.precipitation_sum ?? [];
    const tempMax:  number[] = data.daily?.temperature_2m_max ?? [];
    const tempMin:  number[] = data.daily?.temperature_2m_min ?? [];

    const totalRainfall = precip.reduce((s, v) => s + (v ?? 0), 0);
    const avgTemps      = dates.map((_, i) => ((tempMax[i] ?? 0) + (tempMin[i] ?? 0)) / 2);
    const avgTempC      = Math.round(avgTemps.reduce((s, v) => s + v, 0) / (avgTemps.length || 1));
    const avgMaxTempC   = Math.round(tempMax.reduce((s, v) => s + (v ?? 0), 0) / (tempMax.length || 1));

    // Monthly breakdown
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const idx = dates
        .map((d, i) => new Date(d).getMonth() === m ? i : -1)
        .filter(i => i >= 0);
      return {
        month:      m + 1,
        rainfallMm: Math.round(idx.reduce((s, i) => s + (precip[i] ?? 0), 0)),
        avgTempC:   idx.length
          ? Math.round(idx.reduce((s, i) => s + avgTemps[i], 0) / idx.length)
          : avgTempC,
      };
    });

    return {
      totalRainfallMmPerYear: Math.round(totalRainfall),
      avgTempC,
      avgMaxTempC,
      monthly,
      droughtRisk: totalRainfall < 600 ? 'high' : totalRainfall < 1000 ? 'medium' : 'low',
    };
  } catch (err) {
    console.error('[Climate] Archive fetch failed:', err);
    return null;
  }
}
