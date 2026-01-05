/**
 * Geocoding utilities for address search and reverse geocoding
 * Uses OpenStreetMap Nominatim API
 */

export interface GeocodingResult {
  lat: number
  lng: number
  name: string
  address: string
}

export interface ReverseGeocodingResult {
  formatted: string
  address?: {
    house_number?: string
    road?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
  }
}

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'YardRover Control Panel'

/**
 * Geocode an address to coordinates
 * @param query - Address search query
 * @param limit - Maximum number of results (default: 5)
 * @returns Array of geocoding results
 */
export async function geocodeAddress(
  query: string,
  limit: number = 5
): Promise<GeocodingResult[]> {
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: {
          'User-Agent': USER_AGENT
        }
      }
    )

    if (!response.ok) {
      throw new Error('Geocoding request failed')
    }

    const results = await response.json()

    return results.map((result: any) => ({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      name: result.name || result.display_name.split(',')[0],
      address: result.display_name
    }))
  } catch (error) {
    console.error('Geocoding error:', error)
    return []
  }
}

/**
 * Reverse geocode coordinates to an address
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Formatted address string
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'User-Agent': USER_AGENT
        }
      }
    )

    if (!response.ok) {
      throw new Error('Reverse geocoding failed')
    }

    const result: any = await response.json()
    // Nominatim returns 'display_name' not 'formatted'
    return result.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
}

/**
 * Get the current position using browser geolocation API
 * @param options - Geolocation options
 * @returns Promise with coordinates and accuracy
 */
export function getCurrentPosition(options?: PositionOptions): Promise<{
  lat: number
  lng: number
  accuracy: number
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
      },
      (error) => {
        let message = 'Unable to get your location'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied'
            break
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable'
            break
          case error.TIMEOUT:
            message = 'Location request timed out'
            break
        }
        reject(new Error(message))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        ...options
      }
    )
  })
}

/**
 * Format coordinates for display
 * @param lat - Latitude
 * @param lng - Longitude
 * @param decimals - Number of decimal places (default: 6)
 * @returns Formatted coordinate string
 */
export function formatCoordinates(lat: number, lng: number, decimals: number = 6): string {
  return `${lat.toFixed(decimals)}, ${lng.toFixed(decimals)}`
}
