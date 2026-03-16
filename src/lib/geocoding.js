/**
 * Geocoding utility using Nominatim (OpenStreetMap)
 * No API key required for low volume requests.
 */

export async function geocodeAddress(address) {
  if (!address) return null;
  
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        'User-Agent': 'KitchenControlApp/1.0'
      }
    });
    
    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Fallback coordinates for common locations in the project context (if geocoding fails)
export const FALLBACK_COORDINATES = {
  'Bếp Trung Tâm': { lat: 10.8231, lng: 106.6297 }, // Example: Ho Chi Minh City
  'District 1': { lat: 10.7769, lng: 106.7009 },
  'District 7': { lat: 10.7269, lng: 106.7211 },
};
