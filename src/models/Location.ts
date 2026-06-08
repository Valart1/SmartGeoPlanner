/**
 * Location Model
 * Defines data structures for Location-Based Services module.
 */

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  placeId?: string;
}

export interface WeatherData {
  temperature: number;       // °C
  weatherCode: number;       // WMO weather code
  description: string;
  windspeed: number;         // km/h
  humidity: number;          // %
  feelsLike: number;         // °C
  icon: string;              // emoji representation
  fetchedAt: string;         // ISO 8601
  location: string;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
}
