/**
 * WeatherWidget – Presentational component
 * Displays current weather data from the WeatherData model.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WeatherData } from '../../models/Location';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  locationLabel: string;
}

export default function WeatherWidget({
  weather,
  isLoading,
  error,
  locationLabel,
}: WeatherWidgetProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadingText}>Fetching weather…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Enable location to see weather</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.locationTitle}>Current weather at</Text>
      <Text style={styles.locationBadge}>📍 {locationLabel}</Text>

      <View style={styles.mainRow}>
        <Text style={styles.icon}>{weather.icon}</Text>
        <View>
          <Text style={styles.temp}>{weather.temperature}°C</Text>
          <Text style={styles.description}>{weather.description}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <DetailChip label="Feels like" value={`${weather.feelsLike}°C`} />
        <DetailChip label="Wind" value={`${weather.windspeed} km/h`} />
        <DetailChip label="Humidity" value={`${weather.humidity}%`} />
      </View>
    </View>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    fontSize: 44,
  },
  temp: {
    fontSize: Typography.fontSize.xxxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 36,
  },
  description: {
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  locationTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationBadge: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  details: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  chip: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    alignItems: 'center',
  },
  chipLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  chipValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
