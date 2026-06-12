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

    // Extract the most useful parts for a Nigerian farmer
    const { village, town, city, suburb, county, state } = data.address;
    const localArea = village || town || city || suburb || county || '';
    const stateName = state || '';

    if (localArea && stateName) {
      return `${localArea}, ${stateName}`;
    } else if (stateName) {
      return `${stateName} Region`;
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
