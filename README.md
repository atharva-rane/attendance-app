# QR attendance

A small demo app: scan a QR code (camera or uploaded image), then submit to
mark attendance — it only succeeds if you're physically within range of a
venue location hardcoded in the code.

## Run it

```bash
npm install   # only needed if you deleted node_modules
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

> Location access requires HTTPS or `localhost`. Running `npm run dev` and
> opening it on the same machine works out of the box. If you open it from
> another device on your network, you'll need HTTPS for geolocation to work
> in most browsers.

## Set your venue location

Open `src/App.jsx` and edit the top of the file:

```js
const ATTENDANCE_LOCATION = {
  latitude: 19.076,
  longitude: 72.8777,
};

const ALLOWED_RADIUS_METERS = 100;
```

Get real coordinates from Google Maps: right-click the spot on the map and
click the lat/lng numbers that pop up — they're copied to your clipboard.

## How it works

1. The scanner (`src/App.jsx`, using the `html5-qrcode` library) opens with
   both a live camera view and a built-in "upload image" option — no extra
   UI needed, the library handles both scan modes.
2. Once a QR code is decoded, the "Submit / mark attendance" button becomes
   active.
3. Tapping it requests your device's GPS location and calculates the
   distance to `ATTENDANCE_LOCATION` using the Haversine formula.
4. If you're within `ALLOWED_RADIUS_METERS`, attendance is marked. If not, a
   popup tells you exactly how far away you are.

## Project structure

```
attendance-app/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx     # React entry point
    ├── App.jsx       # all app logic (scanner + geofence check)
    └── index.css     # styling
```

## Build for production

```bash
npm run build
npm run preview
```
