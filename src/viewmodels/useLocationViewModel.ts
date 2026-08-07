/**
 * useLocationViewModel
 * MVVM ViewModel for Location-Based Services module.
 * Handles permission, current GPS position, weather fetching, and map state.
 */

import { useState, useCallback } from 'react';
import { GeoLocation, WeatherData } from '../models/Location';
import { getCurrentLocation, formatLocationLabel } from '../services/locationService';
import { fetchWeather } from '../services/weatherService';

interface LocationViewModel {
  currentLocation: GeoLocation | null;
  weather: WeatherData | null;
  isLoadingLocation: boolean;
  isLoadingWeather: boolean;
  locationError: string | null;
  weatherError: string | null;
  locationLabel: string;
  selectedMapLocation: GeoLocation | null;
  fetchCurrentLocation: () => Promise<GeoLocation | null>;
  fetchWeatherForLocation: (location: GeoLocation) => Promise<void>;
  setSelectedMapLocation: (location: GeoLocation | null) => void;
  clearErrors: () => void;
}

export function useLocationViewModel(): LocationViewModel {
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [selectedMapLocation, setSelectedMapLocation] = useState<GeoLocation | null>(null);

  const fetchWeatherForLocation = useCallback(
    async (location: GeoLocation) => {
      setIsLoadingWeather(true);
      setWeatherError(null);
      try {
        const label = formatLocationLabel(location);
        const data = await fetchWeather(location.latitude, location.longitude, label);
        setWeather(data);
      } catch {
        setWeatherError('Unable to fetch weather data.');
      } finally {
        setIsLoadingWeather(false);
      }
    },
    [],
  );

  const fetchCurrentLocation = useCallback(async (): Promise<GeoLocation | null> => {
    setIsLoadingLocation(true);
    setLocationError(null);
    try {
      const location = await getCurrentLocation();
      if (!location) {
        setLocationError('Location permission denied. Enable it in Settings.');
        return null;
      }
      setCurrentLocation(location);
      await fetchWeatherForLocation(location);
      return location;
    } catch {
      setLocationError('Failed to get current location.');
      return null;
    } finally {
      setIsLoadingLocation(false);
    }
  }, [fetchWeatherForLocation]);

  const locationLabel = currentLocation
    ? formatLocationLabel(currentLocation)
    : 'Unknown Location';

  const clearErrors = () => {
    setLocationError(null);
    setWeatherError(null);
  };

  return {
    currentLocation,
    weather,
    isLoadingLocation,
    isLoadingWeather,
    locationError,
    weatherError,
    locationLabel,
    selectedMapLocation,
    fetchCurrentLocation,
    fetchWeatherForLocation,
    setSelectedMapLocation,
    clearErrors,
  };
}
