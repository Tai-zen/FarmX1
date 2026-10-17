// geocoding.service.ts
// Nominatim is OpenStreetMap's free geocoding service — no key needed

export interface Coordinates {
  lat: number;
  lng: number;
}

export async function reverseGeocode(coords: Coordinates): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`,
      {
        headers: {
          // Nominatim requires a User-Agent identifying your app
          'User-Agent': 'AgriFarm/1.0 (contact@agrifarm.ng)',
        },
      }
    );
    const data = await res.json();

    if (!data || !data.address) {
      return `Custom Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
    }

    // Extract the most useful parts for a farmer
    const { village, town, city, suburb, county, state, country } = data.address;
    const localArea = village || town || city || suburb || county || '';
    const stateName = state || '';

    if (localArea && stateName) {
      return country && country !== 'Nigeria' ? `${localArea}, ${stateName}, ${country}` : `${localArea}, ${stateName}`;
    } else if (stateName) {
      return country && country !== 'Nigeria' ? `${stateName}, ${country}` : `${stateName} Region`;
    } else if (localArea) {
      return country ? `${localArea}, ${country}` : localArea;
    }
    return `Location (${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E)`;
  } catch (error) {
    console.error('Error in reverseGeocode:', error);
    return `Point: ${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`;
  }
}

export async function searchLocation(query: string): Promise<{
  lat: number;
  lng: number;
  displayName: string;
} | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=ng&format=json&limit=1`,
      { headers: { 'User-Agent': 'AgriFarm/1.0 (contact@agrifarm.ng)' } }
    );
    const data = await res.json();
    if (!data || !data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name || query,
    };
  } catch (error) {
    console.error('Error in searchLocation:', error);
    return null;
  }
}

export interface DetectedLocation {
  lat: number;
  lng: number;
  displayName: string;
  source: 'gps' | 'ip' | 'profile' | 'fallback';
}

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
    } catch (err) {
      console.warn('[Geolocation] Browser GPS unavailable or dismissed:', err);
    }
  }

  // 2. Try IP-based location fallback (works seamlessly on web without prompt)
  try {
    const res = await fetch('https://ipapi.co/json/');
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
  } catch (err) {
    console.warn('[Geolocation] IP lookup unavailable:', err);
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

  // 4. Default fallback
  return {
    lat: 10.5300,
    lng: 7.4200,
    displayName: 'Kaduna Region, Nigeria',
    source: 'fallback',
  };
}
