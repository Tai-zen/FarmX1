// geocoding.service.ts
// Resilient multi-tier geocoding and reverse geocoding with zero connection refusals

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DetectedLocation {
  lat: number;
  lng: number;
  displayName: string;
  source: 'gps' | 'ip' | 'profile' | 'fallback';
}

// Built-in Nigerian States & Agricultural Hubs centroid database for instant offline resolution
interface NigerianStateCentroid {
  state: string;
  capital: string;
  lat: number;
  lng: number;
}

const NIGERIAN_STATE_HUBS: NigerianStateCentroid[] = [
  { state: 'Osun', capital: 'Osogbo', lat: 7.7827, lng: 4.5418 },
  { state: 'Oyo', capital: 'Ibadan', lat: 7.3775, lng: 3.9470 },
  { state: 'Lagos', capital: 'Ikeja', lat: 6.5244, lng: 3.3792 },
  { state: 'Ogun', capital: 'Abeokuta', lat: 7.1475, lng: 3.3619 },
  { state: 'Ondo', capital: 'Akure', lat: 7.2571, lng: 5.2058 },
  { state: 'Ekiti', capital: 'Ado-Ekiti', lat: 7.6210, lng: 5.2215 },
  { state: 'Kwara', capital: 'Ilorin', lat: 8.4966, lng: 4.5421 },
  { state: 'Kaduna', capital: 'Kaduna', lat: 10.5105, lng: 7.4165 },
  { state: 'Kano', capital: 'Kano', lat: 12.0022, lng: 8.5920 },
  { state: 'Federal Capital Territory', capital: 'Abuja', lat: 9.0765, lng: 7.3986 },
  { state: 'Plateau', capital: 'Jos', lat: 9.8965, lng: 8.8583 },
  { state: 'Benue', capital: 'Makurdi', lat: 7.7322, lng: 8.5391 },
  { state: 'Rivers', capital: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
  { state: 'Delta', capital: 'Asaba', lat: 6.1986, lng: 6.7325 },
  { state: 'Edo', capital: 'Benin City', lat: 6.3350, lng: 5.6037 },
  { state: 'Enugu', capital: 'Enugu', lat: 6.4584, lng: 7.5464 },
  { state: 'Anambra', capital: 'Awka', lat: 6.2209, lng: 7.0674 },
  { state: 'Imo', capital: 'Owerri', lat: 5.4852, lng: 7.0355 },
  { state: 'Abia', capital: 'Umuahia', lat: 5.5249, lng: 7.4943 },
  { state: 'Cross River', capital: 'Calabar', lat: 4.9757, lng: 8.3417 },
  { state: 'Akwa Ibom', capital: 'Uyo', lat: 5.0377, lng: 7.9128 },
  { state: 'Nasarawa', capital: 'Lafia', lat: 8.4932, lng: 8.5153 },
  { state: 'Niger', capital: 'Minna', lat: 9.6139, lng: 6.5569 },
  { state: 'Kogi', capital: 'Lokoja', lat: 7.7969, lng: 6.7405 },
  { state: 'Bauchi', capital: 'Bauchi', lat: 10.3158, lng: 9.8442 },
  { state: 'Gombe', capital: 'Gombe', lat: 10.2897, lng: 11.1673 },
  { state: 'Adamawa', capital: 'Yola', lat: 9.2004, lng: 12.4966 },
  { state: 'Taraba', capital: 'Jalingo', lat: 8.8937, lng: 11.3596 },
  { state: 'Borno', capital: 'Maiduguri', lat: 11.8311, lng: 13.1510 },
  { state: 'Yobe', capital: 'Damaturu', lat: 11.7470, lng: 11.9608 },
  { state: 'Katsina', capital: 'Katsina', lat: 12.9908, lng: 7.6018 },
  { state: 'Sokoto', capital: 'Sokoto', lat: 13.0059, lng: 5.2476 },
  { state: 'Kebbi', capital: 'Birnin Kebbi', lat: 12.4539, lng: 4.1975 },
  { state: 'Zamfara', capital: 'Gusau', lat: 12.1628, lng: 6.6614 },
  { state: 'Jigawa', capital: 'Dutse', lat: 11.7562, lng: 9.3390 },
  { state: 'Bayelsa', capital: 'Yenagoa', lat: 4.9267, lng: 6.2676 },
  { state: 'Ebonyi', capital: 'Abakaliki', lat: 6.3249, lng: 8.1137 },
];

/**
 * Returns nearest Nigerian state or region based on coordinates
 */
function findNearestNigerianHub(coords: Coordinates): string | null {
  // Check if coordinates lie approximately within Nigeria or neighboring border
  if (coords.lat < 4.0 || coords.lat > 14.5 || coords.lng < 2.5 || coords.lng > 15.0) {
    return null;
  }

  let minDistance = Infinity;
  let closestHub: NigerianStateCentroid | null = null;

  for (const hub of NIGERIAN_STATE_HUBS) {
    const dLat = coords.lat - hub.lat;
    const dLng = coords.lng - hub.lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDistance) {
      minDistance = dist;
      closestHub = hub;
    }
  }

  if (closestHub) {
    return `${closestHub.capital}, ${closestHub.state} State, Nigeria`;
  }
  return null;
}

/**
 * Robust reverse geocoding with BigDataCloud (client-free, CORS friendly),
 * followed by offline centroid resolution so it NEVER throws net::ERR_CONNECTION_REFUSED.
 */
export async function reverseGeocode(coords: Coordinates): Promise<string> {
  // 1. Try BigDataCloud reverse geocode client API (built specifically for browser apps, no API key, no CORS issues)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const local = data.locality || data.city || '';
      const state = data.principalSubdivision || '';
      const country = data.countryName || 'Nigeria';

      if (local && state) {
        return country && country !== 'Nigeria' ? `${local}, ${state}, ${country}` : `${local}, ${state}`;
      } else if (state) {
        return country && country !== 'Nigeria' ? `${state}, ${country}` : `${state} State, Nigeria`;
      } else if (local) {
        return `${local}, ${country}`;
      }
    }
  } catch (err) {
    // BigDataCloud fetch failed or timed out, gracefully proceed to fallbacks
  }

  // 2. Try Open-Meteo elevation / reverse or OSM Nominatim without custom User-Agent header (avoids forbidden header errors)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const { village, town, city, suburb, county, state, country } = data.address;
        const localArea = village || town || city || suburb || county || '';
        const stateName = state || '';

        if (localArea && stateName) {
          return country && country !== 'Nigeria' ? `${localArea}, ${stateName}, ${country}` : `${localArea}, ${stateName}`;
        } else if (stateName) {
          return `${stateName} State`;
        }
      }
    }
  } catch {
    // Silently continue to offline nearest-hub fallback
  }

  // 3. Fallback: High-precision built-in Nigerian Geo Hub lookup (100% offline, guaranteed zero errors)
  const nigerianHub = findNearestNigerianHub(coords);
  if (nigerianHub) {
    return nigerianHub;
  }

  return `Coordinates: ${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`;
}

/**
 * Searches for a location query by querying Open-Meteo, local database, or Nominatim
 */
export async function searchLocation(query: string): Promise<{
  lat: number;
  lng: number;
  displayName: string;
} | null> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return null;

  // 1. Instant match in Nigerian state hubs database (0ms network latency, 100% offline reliability)
  const matchedHub = NIGERIAN_STATE_HUBS.find(
    h => h.state.toLowerCase().includes(cleanQuery) || 
         h.capital.toLowerCase().includes(cleanQuery) ||
         cleanQuery.includes(h.state.toLowerCase()) ||
         cleanQuery.includes(h.capital.toLowerCase())
  );

  if (matchedHub) {
    return {
      lat: matchedHub.lat,
      lng: matchedHub.lng,
      displayName: `${matchedHub.capital}, ${matchedHub.state} State, Nigeria`,
    };
  }

  // 2. Try Open-Meteo Geocoding API (Fast, CORS enabled, no rate-limiting, free)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        const item = data.results[0];
        const stateStr = item.admin1 ? `, ${item.admin1}` : '';
        const countryStr = item.country ? `, ${item.country}` : '';
        return {
          lat: item.latitude,
          lng: item.longitude,
          displayName: `${item.name}${stateStr}${countryStr}`,
        };
      }
    }
  } catch {
    // Fall through to Nominatim
  }

  // 3. Try Nominatim with abort controller (without custom headers)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=ng&format=json&limit=1`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.length) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name || query,
        };
      }
    }
  } catch {
    // Return null if search exhausted
  }

  return null;
}

/**
 * Detects current user location using GPS with IP and profile fallbacks
 */
export async function detectCurrentLocation(profileLocation?: string): Promise<DetectedLocation> {
  // 1. Try browser HTML5 Geolocation API
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 6000,
          enableHighAccuracy: true,
          maximumAge: 60000,
        });
      });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const displayName = await reverseGeocode({ lat, lng });
      return {
        lat,
        lng,
        displayName: displayName || `Current Location (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
        source: 'gps',
      };
    } catch {
      // Browser GPS denied or timed out
    }
  }

  // 2. Try IP-based location fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.latitude && data.longitude) {
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);
        const city = data.city || data.region || 'Current Location';
        const region = data.region || '';
        const country = data.country_name || 'Nigeria';
        const displayName = region && region !== city ? `${city}, ${region}, ${country}` : `${city}, ${country}`;
        return {
          lat,
          lng,
          displayName,
          source: 'ip',
        };
      }
    }
  } catch {
    // IP lookup unavailable
  }

  // 3. Try user's profile location if provided
  if (profileLocation) {
    const searchRes = await searchLocation(profileLocation);
    if (searchRes) {
      return {
        lat: searchRes.lat,
        lng: searchRes.lng,
        displayName: searchRes.displayName,
        source: 'profile',
      };
    }
  }

  // 4. Default fallback: Osun / Central agricultural region
  return {
    lat: 7.7827,
    lng: 4.5418,
    displayName: 'Osogbo, Osun State, Nigeria',
    source: 'fallback',
  };
}
