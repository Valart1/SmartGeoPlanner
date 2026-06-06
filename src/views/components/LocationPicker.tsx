/**
 * LocationPicker – Presentational component
 * Allows the user to set a location on a map or use current GPS position.
 * Used inside Task/Event forms.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { GeoLocation } from '../../models/Location';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';

interface LocationPickerProps {
  location: GeoLocation | null;
  onPickLocation: (location: GeoLocation) => void;
  onUseCurrentLocation: () => Promise<void>;
  onClearLocation: () => void;
  isLoading?: boolean;
}

export default function LocationPicker({
  location,
  onPickLocation,
  onUseCurrentLocation,
  onClearLocation,
  isLoading = false,
}: LocationPickerProps) {
  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onPickLocation({ latitude, longitude });
  };

  const region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 51.505,
        longitude: -0.09,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>📍 Location</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onUseCurrentLocation}
            disabled={isLoading}
            accessibilityLabel="Use current location"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.actionBtnText}>Use GPS</Text>
            )}
          </TouchableOpacity>
          {location && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.clearBtn]}
              onPress={onClearLocation}
              accessibilityLabel="Clear location"
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {location && (
        <Text style={styles.addressText}>
          {[location.address, location.city, location.country]
            .filter(Boolean)
            .join(', ') ||
            `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
        </Text>
      )}

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          region={region}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {location && (
            <Marker
              coordinate={{ latitude: location.latitude, longitude: location.longitude }}
              pinColor={Colors.primary}
            />
          )}
        </MapView>
        <Text style={styles.mapHint}>Tap map to set location</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: Typography.fontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    minWidth: 64,
    alignItems: 'center',
  },
  actionBtnText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
  clearBtn: {
    backgroundColor: Colors.surfaceElevated,
  },
  clearBtnText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
  },
  addressText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  mapContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  map: {
    height: 180,
  },
  mapHint: {
    textAlign: 'center',
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
  },
});
