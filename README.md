# 🎮 SquadLink — Cross-Platform Gaming Companion App

SquadLink is a $0-budget, cross-platform gaming companion app designed specifically for squads gaming together (e.g. Valorant). It combines low-latency LiveKit voice channels, real-time Supabase chat, 10-minute battery-friendly GPS squad radar, automated 30-day data retention & storage protection, and native packaging for Windows Desktop and Android.

---

## 🏗️ Project Architecture

```
SquadLink/
├── web/                 # Next.js 16 Web Application (Tailwind CSS, LiveKit, Leaflet, Supabase)
│   ├── src/
│   │   ├── app/         # App router (login, signup, auth callback, livekit API, main dashboard)
│   │   ├── components/  # Sleek UI (server-sidebar, channel-sidebar, main-viewport, modals)
│   │   │   ├── chat/    # Real-time WebSocket Supabase chat
│   │   │   ├── voice/   # LiveKit voice, Mute/Deafen controls, getDisplayMedia screen share
│   │   │   ├── map/     # Leaflet Dark Matter radar, member avatars, "last updated X min ago"
│   │   │   └── modals/  # Settings (profile, location toggle, theme toggle, logout) & server create/join
│   │   └── lib/         # Supabase client/server singletons and schema types
├── mobile/              # React Native (Expo) Mobile App (Android APK)
│   ├── app/             # Expo router screens (auth, server & channel navigation, chat)
│   ├── lib/             # expo-location background task (10-minute GPS updates)
│   └── build-apk.bat    # 1-click script to compile release Android .apk
└── desktop/             # Standalone Windows Desktop App (Electron)
    ├── main.js          # Electron window wrapper
    └── package-windows.bat # 1-click script to compile Windows installer (.exe)
```

---

## ⚡ Setup & Credentials (Configured)

All tokens and database migrations have been executed directly:
- **Supabase Project URL**: `https://pcikzpktdiwdgzchftmv.supabase.co`
- **Database Schema**: `users`, `servers`, `server_members`, `channels`, `messages`, `locations`.
- **LiveKit Voice Integration**: `APIudkZHvzrLPak` token injected into `/api/livekit-token` with mute, deafen, and screen sharing.

---

## 🛡️ Automated Data & Storage Management

Applied directly to Supabase via database functions and triggers:
1. **30-Day Auto Retention**: Any message or stale location older than 30 days is automatically purged via PostgreSQL function `cleanup_old_messages()`.
2. **90% Storage Quota Auto-Prune**: If storage/message count approaches threshold, PostgreSQL function `enforce_storage_quota()` automatically deletes the oldest 70% of data and ensures **only the latest 30% of data remains**.
3. **Automated Trigger**: `trg_cleanup_messages` runs automatically on insertions with zero manual maintenance required.

---

## 🚀 How to Run

### 1. Web Application
```bash
cd web
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Windows Desktop (.exe)
Double-click `desktop\package-windows.bat` or run:
```bash
cd desktop
npm install
npm run build
```
The output `.exe` installer will be generated in `desktop\dist\SquadLink Setup 1.0.0.exe`.

### 3. Android Mobile (.apk)
Double-click `mobile\build-apk.bat` or run:
```bash
cd mobile
npm install
npx eas-cli build --platform android --profile preview --local
```
This builds a standalone `.apk` you can send directly to your friends to sideload on Android without using the Google Play Store!
