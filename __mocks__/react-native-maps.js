/**
 * react-native-maps mock for Jest
 * Replaces native map components with simple React Native View stubs.
 */

const React = require('react');
const { View } = require('react-native');

const MapView = ({ children, ...props }) =>
  React.createElement(View, { testID: 'MapView', ...props }, children);

const Marker = ({ children, ...props }) =>
  React.createElement(View, { testID: 'Marker', ...props }, children);

const Callout = ({ children, ...props }) =>
  React.createElement(View, { testID: 'Callout', ...props }, children);

MapView.Animated = MapView;

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = Marker;
module.exports.Callout = Callout;
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.PROVIDER_DEFAULT = null;
