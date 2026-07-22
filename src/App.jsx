import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import "./index.css";

// ==========================================================
// ATTENDANCE LOCATION
// Replace these coordinates with your actual venue
// ==========================================================
const ATTENDANCE_LOCATION = {
  latitude: 19.060518054087595,
  longitude: 72.88269359210045,
};

const ALLOWED_RADIUS_METERS = 75;

// ==========================================================
// Haversine Formula
// ==========================================================
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ==========================================================
// QR Field Formatting
// ==========================================================
const FIELD_LABELS = {
  VOLUNTEERNAME: "Volunteer Name",
  MOBNO: "Mobile Number",
  SEVA: "Seva",
};

const FIELD_ICONS = {
  VOLUNTEERNAME: "👤",
  MOBNO: "📱",
  SEVA: "🛠️",
};

function formatLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];

  return key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatIcon(key) {
  return FIELD_ICONS[key] || "•";
}

function formatDistance(distance) {
  if (distance == null) return "";

  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(2)} km`;
  }

  return `${Math.round(distance)} m`;
}

export default function App() {
  // =====================================
  // Scanner Mode
  // null
  // camera
  // upload
  // =====================================

  const [mode, setMode] = useState(null);

  const [scannerOpen, setScannerOpen] = useState(false);

  const [qrData, setQrData] = useState("");

  const [checking, setChecking] = useState(false);

  const [marked, setMarked] = useState(false);

  const [popup, setPopup] = useState("");

  const [distance, setDistance] = useState(null);

  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  const scannerRef = useRef(null);

  // =====================================
  // Parsed QR Fields (falls back to raw text if not JSON)
  // =====================================

  const parsedQrFields = useMemo(() => {
    if (!qrData) return null;

    try {
      const parsed = JSON.parse(qrData);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.entries(parsed);
      }

      return null;
    } catch {
      return null;
    }
  }, [qrData]);

  // =====================================
  // Reset everything
  // =====================================

  const resetAttendance = () => {
    setMode(null);
    setScannerOpen(false);
    setQrData("");
    setMarked(false);
    setChecking(false);
    setPopup("");
    setDistance(null);
    setGpsAccuracy(null);

    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
  };
  // =====================================
  // Open Camera Scanner
  // =====================================

  const openCameraScanner = () => {
    setMode("camera");
    setScannerOpen(true);
  };

  // =====================================
  // Open Upload Scanner
  // =====================================

  const openUploadScanner = () => {
    setMode("upload");
    setScannerOpen(true);
  };

  // =====================================
  // Initialize Scanner
  // =====================================

  useEffect(() => {
    if (!scannerOpen || !mode) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250,
        },
        rememberLastUsedCamera: true,
        videoConstraints: {
          facingMode: { ideal: "environment" },
        },
        supportedScanTypes:
          mode === "camera"
            ? [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
            : [Html5QrcodeScanType.SCAN_TYPE_FILE],
      },
      false,
    );

    scanner.render(
      (decodedText) => {
        setQrData(decodedText);

        setScannerOpen(false);
        setMode(null);

        scanner.clear().catch(() => {});
      },
      () => {
        // Ignore continuous scan failures while camera is searching
      },
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scannerOpen, mode]);

  // =====================================
  // Check Location & Mark Attendance
  // =====================================

  const markAttendance = useCallback(() => {
    if (!qrData) return;

    if (!("geolocation" in navigator)) {
      setPopup("Geolocation is not supported on this browser.");
      return;
    }

    setChecking(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        setGpsAccuracy(Math.round(accuracy));

        const dist = getDistanceInMeters(
          latitude,
          longitude,
          ATTENDANCE_LOCATION.latitude,
          ATTENDANCE_LOCATION.longitude,
        );

        setDistance(dist);

        setChecking(false);

        // Accuracy Check
        // if (accuracy > 50) {
        //   setPopup(
        //     `GPS accuracy is poor (~${Math.round(
        //       accuracy,
        //     )} m). Please move outdoors and try again.`,
        //   );
        //   return;
        // }
        if (accuracy > 100) {
          setPopup(
            `GPS accuracy is poor (~${Math.round(
              accuracy,
            )} m). Please move outdoors and try again.`,
          );
          return;
        }

        if (dist <= ALLOWED_RADIUS_METERS) {
          setMarked(true);
        } else {
          setPopup(
            `You are ${formatDistance(
              dist,
            )} away from the attendance location.\n\nMove closer than ${ALLOWED_RADIUS_METERS} meters to mark attendance.`,
          );
        }
      },
      (error) => {
        setChecking(false);

        switch (error.code) {
          case 1:
            setPopup(
              "Location permission denied.\nPlease enable location permission and try again.",
            );
            break;

          case 2:
            setPopup(
              "Unable to determine your location.\nTry moving outdoors.",
            );
            break;

          case 3:
            setPopup("Location request timed out.\nPlease try again.");
            break;

          default:
            setPopup("Something went wrong while fetching your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, [qrData]);
  return (
    <div className="page">
      <div className="card">
        {/* ================= Header ================= */}

        <div className="header">
          <h1>QR Attendance</h1>
        </div>

        <p className="subtitle">
          Scan the attendance QR code and verify your location before marking
          attendance.
        </p>

        {/* ================= Initial Screen ================= */}

        {!scannerOpen && !qrData && (
          <div className="choose-mode">
            <button className="primary-btn" onClick={openCameraScanner}>
              📷 Scan QR Code
            </button>

            <button className="secondary-btn" onClick={openUploadScanner}>
              🖼 Upload QR Image
            </button>
          </div>
        )}

        {/* ================= Scanner ================= */}

        {scannerOpen && (
          <>
            <div className="scanner-box">
              <div id="qr-reader"></div>
            </div>

            <button
              className="secondary-btn"
              style={{ marginTop: 16 }}
              onClick={resetAttendance}
            >
              Close Scanner
            </button>
          </>
        )}

        {/* ================= QR Success ================= */}

        {qrData && !marked && (
          <div className="qr-confirm">
            <p className="label">✅ QR Code Scanned Successfully</p>

            {parsedQrFields ? (
              <div className="qr-fields">
                {parsedQrFields.map(([key, value]) => (
                  <div className="qr-field" key={key}>
                    <span className="qr-field-icon">{formatIcon(key)}</span>

                    <div className="qr-field-text">
                      <p className="qr-field-label">{formatLabel(key)}</p>
                      <p className="qr-field-value">{String(value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="value">{qrData}</p>
            )}

            <button className="link-btn" onClick={resetAttendance}>
              Scan another QR
            </button>
          </div>
        )}

        {/* ================= Location Info ================= */}

        {distance !== null && !marked && (
          <div className="location-info">
            <p>
              <strong>Distance :</strong> {formatDistance(distance)}
            </p>

            {gpsAccuracy && (
              <p>
                <strong>GPS Accuracy :</strong> ~{gpsAccuracy} m
              </p>
            )}
          </div>
        )}

        {/* ================= Attendance Button ================= */}

        {!marked && qrData && (
          <button
            className="primary-btn"
            onClick={markAttendance}
            disabled={checking}
          >
            {checking ? (
              <>
                <span className="spinner"></span>
                Checking Location...
              </>
            ) : (
              "📍 Mark Attendance"
            )}
          </button>
        )}

        {/* ================= Success ================= */}

        {marked && (
          <div className="success-box">
            <p className="title">✅ Attendance Marked Successfully</p>

            <p className="detail">Distance : {formatDistance(distance)}</p>

            {gpsAccuracy && (
              <p className="detail">GPS Accuracy : ~{gpsAccuracy} m</p>
            )}

            <button
              className="primary-btn"
              style={{ marginTop: 18 }}
              onClick={resetAttendance}
            >
              Mark Another Attendance
            </button>
          </div>
        )}
      </div>

      {/* ================= Popup ================= */}

      {popup && (
        <div className="overlay">
          <div className="modal">
            <p
              style={{
                whiteSpace: "pre-line",
              }}
            >
              {popup}
            </p>

            <button className="primary-btn" onClick={() => setPopup("")}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
