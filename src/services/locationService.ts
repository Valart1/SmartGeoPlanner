/**
 * Location Service
 * Wraps expo-location to request permissions, get current position, and
 * reverse-geocode coordinates to human-readable addresses.
 */

import * as ExpoLocation from 'expo-location';
import { GeoLocation, LocationPermissionStatus } from '../models/Location';

/**
 * Request foreground location permission from the OS.
 */
export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  const { status, canAskAgain } =
    await ExpoLocation.requestForegroundPermissionsAsync();
  return {
    granted: status === ExpoLocation.PermissionStatus.GRANTED,
    canAskAgain,
  };
}

/**
 * Get the device's current GPS coordinates (high accuracy).
 * Resolves null if permission was not granted.
 */
export async function getCurrentLocation(): Promise<GeoLocation | null> {
  const { granted } = await requestLocationPermission();
  if (!granted) return null;

  const position = await ExpoLocation.getCurrentPositionAsync({
    accuracy: ExpoLocation.Accuracy.High,
  });

  const { latitude, longitude } = position.coords;
  const geocoded = await reverseGeocode(latitude, longitude);

  return {
    latitude,
    longitude,
    ...geocoded,
  };
}

/**
 * Reverse-geocode a lat/lon to a city + country string.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<{ address?: string; city?: string; country?: string }> {
  try {
    const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
    if (results.length === 0) return {};
    const r = results[0];
    return {
      address: [r.street, r.streetNumber].filter(Boolean).join(' ') || undefined,
      city: r.city || r.district || r.subregion || undefined,
      country: r.country || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Format a GeoLocation into a short display string.
 */
export function formatLocationLabel(location: GeoLocation): string {
  if (location.city && location.country) {
    return `${location.city}, ${location.country}`;
  }
  if (location.city) return location.city;
  if (location.address) return location.address;
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}
