/**
 * useLocationViewModel
 * MVVM ViewModel for Location-Based Services module.
 * Handles permission, current GPS position, weather fetching, and map state.
 */

import { useState, useCallback } from 'react';
import { GeoLocation, WeatherData } from '../models/Location';
import { getCurrentLocation, formatLocationLabel } from '../services/locationService';
import { fetchWeather } from '../services/weatherService';
import { getItem, setItem, STORAGE_KEYS } from '../services/storageService';

interface LocationViewModel {
  currentLocation: GeoLocation | null;
  weather: WeatherData | null;
  isLoadingLocation: boolean;
  isLoadingWeather: boolean;
  locationError: string | null;
  weatherError: string | null;
  locationLabel: string;
  selectedMapLocation: GeoLocation | null;
  fetchCurrentLocation: () => Promise<void>;
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

  const fetchCurrentLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    setLocationError(null);
    try {
      const location = await getCurrentLocation();
      if (!location) {
        setLocationError('Location permission denied. Enable it in Settings.');
        return;
      }
      setCurrentLocation(location);
      await fetchWeatherForLocation(location);
    } catch {
      setLocationError('Failed to get current location.');
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  const fetchWeatherForLocation = useCallback(
    async (location: GeoLocation) => {
      setIsLoadingWeather(true);
      setWeatherError(null);
      try {
        // Try cache first (5-minute TTL)
        const cached = await getItem<WeatherData>(STORAGE_KEYS.WEATHER_CACHE);
        if (cached) {
          const age = Date.now() - new Date(cached.fetchedAt).getTime();
          if (age < 5 * 60 * 1000) {
            setWeather(cached);
            return;
          }
        }
        const label = formatLocationLabel(location);
        const data = await fetchWeather(location.latitude, location.longitude, label);
        setWeather(data);
        await setItem(STORAGE_KEYS.WEATHER_CACHE, data);
      } catch {
        setWeatherError('Unable to fetch weather data.');
      } finally {
        setIsLoadingWeather(false);
      }
    },
    [],
  );

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
