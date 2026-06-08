# Smart Geo-Planner

Smart Geo-Planner is a cross-platform React Native app built with Expo and TypeScript. It includes local authentication, task management, a calendar, location tagging, maps, weather data, and local reminders.

## Tech Stack

- Expo SDK 54
- React Native 0.81
- TypeScript
- React Navigation
- AsyncStorage for local app data
- Expo Location
- Expo Notifications
- React Native Maps
- Jest for tests

## Requirements

Install these before running the project:

- Node.js LTS v24.16.0
- npm  11.13.0
- Git
- Expo Go on your phone
- Android Studio if you want to run an Android emulator

Important: this project is configured for Expo SDK 54. Your phone's Expo Go app must support SDK 54.

## Clone And Install

```powershell
git clone https://github.com/Valart1/SmartGeoPlanner.git
cd SmartGeoPlanner
npm install
```

If PowerShell blocks npm scripts on Windows, use `npm.cmd` instead:

```powershell
npm.cmd install
```

## Start The App

For the normal Expo Go QR code:

```powershell
npm.cmd run start:lan
```

Then scan the QR code with Expo Go. Your phone and computer must be on the same Wi-Fi network.

If Expo CLI shows `TypeError: fetch failed`, use the offline startup command:

```powershell
npm.cmd start
```

There is also a Windows helper script:

```powershell
.\start-expo-go-sdk54.cmd
```

## Useful Commands

Run tests:

```powershell
npm.cmd test
```

Run TypeScript checks:

```powershell
npx.cmd tsc --noEmit
```

Open in an Android emulator or connected Android device:

```powershell
npm.cmd run android
```

Start web mode:

```powershell
npm.cmd run web
```

## App Login Notes

The app uses local account storage with AsyncStorage. This means:

- A user must create an account before signing in.
- Duplicate emails and duplicate usernames are rejected.
- Logging in again with the same account restores that user's saved tasks, events, and dashboard stats.
- Data is saved on the same device only.

This is not a cloud backend. If you need multiple phones to share the same accounts and events live, connect the app to Firebase, Supabase, or another backend database.

## Notifications

The app uses local notifications through `expo-notifications`.

To test notifications:

1. Start the app on a real phone with Expo Go.
2. Allow notifications when the system asks.
3. Open the Dashboard.
4. Tap `Test Notification`.
5. A notification should appear after about 10 seconds.

Task and event reminders are scheduled when you create a task/event with a future date and time.

Notes:

- Android users must allow notifications for Expo Go in phone settings.
- Local notifications work best on a real phone, not the web build.
- Remote push notifications are not implemented in this project.
- Expo Go supports local notifications, but remote push notifications require a development build or production build.

## Project Structure

```text
src/
  context/       Global auth and planner state providers
  models/        TypeScript interfaces and app data models
  navigation/    Auth and main tab navigation
  services/      Storage, auth, weather, location, and notification services
  theme/         Shared colors, spacing, and typography
  viewmodels/    MVVM business logic hooks
  views/         Screens and presentation components
__tests__/       Jest tests
```

## Troubleshooting

If Expo Go says the SDK version is unsupported:

```powershell
npx.cmd expo install --check
```

If dependencies are wrong:

```powershell
npx.cmd expo install --fix
```

If Metro cache is stale:

```powershell
npm.cmd start
```

If the phone cannot connect:

- Confirm the phone and computer are on the same Wi-Fi.
- Try `npm.cmd run start:lan`.
- Disable VPN temporarily.
- Allow Node.js through Windows Firewall if prompted.

## Verification

Before submitting or sharing the project, run:

```powershell
npx.cmd tsc --noEmit
npm.cmd test
```





