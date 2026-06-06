/**
 * Weather Service
 * Integrates with Open-Meteo (https://open-meteo.com/) – free, no API key required.
 * Fetches current weather for a given lat/lon.
 */

import { WeatherData } from '../models/Location';

const BASE_URL = 'https://api.open-meteo.com/v1';

/** Maps WMO weather code → { description, emoji } */
function interpretWeatherCode(code: number): { description: string; icon: string } {
  if (code === 0) return { description: 'Clear sky', icon: '☀️' };
  if (code <= 2) return { description: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { description: 'Overcast', icon: '☁️' };
  if (code <= 49) return { description: 'Foggy', icon: '🌫️' };
  if (code <= 59) return { description: 'Drizzle', icon: '🌦️' };
  if (code <= 69) return { description: 'Rain', icon: '🌧️' };
  if (code <= 79) return { description: 'Snow', icon: '❄️' };
  if (code <= 82) return { description: 'Rain showers', icon: '🌧️' };
  if (code <= 86) return { description: 'Snow showers', icon: '🌨️' };
  if (code <= 99) return { description: 'Thunderstorm', icon: '⛈️' };
  return { description: 'Unknown', icon: '🌡️' };
}

/**
 * Fetches current weather data for a given coordinate.
 * Uses Open-Meteo's /forecast endpoint with hourly apparent_temperature and
 * current_weather for wind speed, weather code, and temperature.
 */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  locationName: string = 'Current Location',
): Promise<WeatherData> {
  const url =
    `${BASE_URL}/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current_weather=true` +
    `&hourly=relativehumidity_2m,apparent_temperature` +
    `&forecast_days=1` +
    `&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const cw = data.current_weather;

  // Pick the apparent temperature & humidity closest to current time
  const currentHour = new Date().getHours();
  const feelsLike: number = data.hourly.apparent_temperature?.[currentHour] ?? cw.temperature;
  const humidity: number = data.hourly.relativehumidity_2m?.[currentHour] ?? 0;

  const { description, icon } = interpretWeatherCode(cw.weathercode);

  return {
    temperature: Math.round(cw.temperature),
    weatherCode: cw.weathercode,
    description,
    windspeed: Math.round(cw.windspeed),
    humidity,
    feelsLike: Math.round(feelsLike),
    icon,
    fetchedAt: new Date().toISOString(),
    location: locationName,
  };
}
