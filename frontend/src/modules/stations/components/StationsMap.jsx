import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Badge, Button } from 'reactstrap';

// Leaflet CSS — required for map tiles and controls to render correctly
import 'leaflet/dist/leaflet.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  normal: '#2dce89',
  warning: '#fb6340',
  critical: '#f5365c',
  offline: '#adb5bd',
};

const STATUS_BADGE_COLORS = {
  normal: 'success',
  warning: 'warning',
  critical: 'danger',
  offline: 'secondary',
};

// Default map center (Morocco) used as fallback when no station has coordinates
const DEFAULT_CENTER = [31.7917, -7.0926];
const DEFAULT_ZOOM = 6;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if a station has usable GPS coordinates */
function hasValidCoords(station) {
  const lat = Number(station.latitude);
  const lng = Number(station.longitude);
  return !Number.isNaN(lat) && !Number.isNaN(lng) && (lat !== 0 || lng !== 0);
}

/** Build a colored circle divIcon for a station status */
function makeMarkerIcon(status) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 20px; height: 20px;
      border-radius: 50%;
      background: ${color};
      border: 3px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.40);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -14],
  });
}

// ─── BoundsFitter — child component that auto-fits map to all markers ────────

function BoundsFitter({ stations }) {
  const map = useMap();

  useEffect(() => {
    if (!stations.length) return;
    const points = stations.map((s) => [Number(s.latitude), Number(s.longitude)]);
    if (points.length === 1) {
      map.setView(points[0], 12);
    } else {
      map.fitBounds(points, { padding: [48, 48] });
    }
  }, [stations, map]);

  return null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * StationsMap
 *
 * Props:
 *   stations  {Array}  — from stationsSlice (already fetched by StationsPage)
 */
export default function StationsMap({ stations = [] }) {
  const navigate = useNavigate();

  const mappable = stations.filter(hasValidCoords);

  return (
    <div style={{ position: 'relative' }}>
      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          background: 'white',
          borderRadius: 6,
          padding: '8px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontSize: 12,
          lineHeight: '1.8',
        }}
      >
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="d-flex align-items-center" style={{ gap: 6 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: color,
                border: '2px solid #fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                flexShrink: 0,
              }}
            />
            <span className="text-capitalize">{status}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: 500, width: '100%', borderRadius: '0 0 6px 6px' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fit map to all mappable stations */}
        {mappable.length > 0 && <BoundsFitter stations={mappable} />}

        {mappable.map((station) => (
          <Marker
            key={station.id}
            position={[Number(station.latitude), Number(station.longitude)]}
            icon={makeMarkerIcon(station.status)}
          >
            <Popup minWidth={200}>
              <div>
                <p className="font-weight-bold mb-1" style={{ fontSize: 14 }}>
                  {station.name}
                </p>
                {station.location && (
                  <p className="text-muted mb-1" style={{ fontSize: 12 }}>
                    <i className="ni ni-pin-3 mr-1" />
                    {station.location}
                  </p>
                )}
                <div className="mb-2">
                  <Badge color={STATUS_BADGE_COLORS[station.status] || 'secondary'}>
                    {station.status}
                  </Badge>
                  <span className="ml-2 text-muted" style={{ fontSize: 11 }}>
                    {station.type}
                  </span>
                </div>
                {station.sensors?.length > 0 && (
                  <p className="text-muted mb-2" style={{ fontSize: 12 }}>
                    {station.sensors.length} sensor{station.sensors.length !== 1 ? 's' : ''}
                  </p>
                )}
                <Button
                  size="sm"
                  color="primary"
                  block
                  onClick={() => navigate(`/admin/stations/${station.id}`)}
                >
                  View Details →
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Notice when some stations are missing coordinates */}
      {stations.length > mappable.length && (
        <div className="px-3 py-2 text-muted text-sm border-top">
          <i className="ni ni-info mr-1" />
          {stations.length - mappable.length} station
          {stations.length - mappable.length !== 1 ? 's' : ''} not shown (no GPS
          coordinates set). Edit those stations to add latitude/longitude.
        </div>
      )}

      {/* Empty state when no stations have coordinates */}
      {stations.length > 0 && mappable.length === 0 && (
        <div className="text-center text-muted py-5">
          <i className="ni ni-map-big d-block mb-2" style={{ fontSize: 32 }} />
          <p className="mb-0">
            No stations have GPS coordinates yet.
            <br />
            Edit each station to add a latitude and longitude.
          </p>
        </div>
      )}
    </div>
  );
}
