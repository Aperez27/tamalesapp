import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext';
import type { Delivery } from '../types';
import {
  MapPin, Navigation, ExternalLink, MessageCircle,
  Loader2, AlertCircle, Package, RotateCcw,
  ChevronDown, ChevronUp, Map, X, MousePointer,
} from 'lucide-react';
import { isToday, parseISO } from 'date-fns';

// ─── Geo utilities ────────────────────────────────────────────────────────────

interface LatLng { lat: number; lng: number }

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Coordenadas de Barrancabermeja, Santander
const BARRANCABERMEJA: LatLng = { lat: 7.0644, lng: -73.8544 };

// ─── Normalización de direcciones colombianas ─────────────────────────────────

function normalizeColombianAddress(addr: string): string {
  return addr
    .replace(/\bCra\.?\s*/gi,   'Carrera ')
    .replace(/\bCll?\.\s*/gi,   'Calle ')
    .replace(/\bDg\.?\s*/gi,    'Diagonal ')
    .replace(/\bTv\.?\s*/gi,    'Transversal ')
    .replace(/\bAv\.?\s*/gi,    'Avenida ')
    .replace(/\bKm\.?\s*/gi,    'Kilometro ')
    .replace(/\bMz\.?\s*/gi,    'Manzana ')
    .replace(/\bLt\.?\s*/gi,    'Lote ')
    .replace(/#\s*/g,           ' ')
    .replace(/\s*-\s*(?=\d)/g,  ' ')
    .replace(/\s+/g,            ' ')
    .trim();
}

// ─── Geocodificación ──────────────────────────────────────────────────────────

const CACHE_KEY = 'tamales_geocache_v3';
function getCache(): Record<string, LatLng> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveCache(c: Record<string, LatLng>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

async function nominatimSearch(q: string): Promise<LatLng | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=co`,
      { headers: { 'User-Agent': 'TamalesApp/1.1' } }
    );
    const data: { lat: string; lon: string }[] = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* ignore */ }
  return null;
}

async function geocode(address: string, neighborhood = ''): Promise<LatLng | null> {
  const key = `${address}||${neighborhood}`;
  const cache = getCache();
  if (cache[key]) return cache[key];

  const CITY = 'Barrancabermeja, Santander, Colombia';
  const norm = normalizeColombianAddress(address);

  // Estrategias de búsqueda: de más específica a más general
  const queries: string[] = [
    ...(neighborhood
      ? [`${norm}, ${neighborhood}, ${CITY}`, `${address}, ${neighborhood}, ${CITY}`]
      : []),
    `${norm}, ${CITY}`,
    `${address}, ${CITY}`,
    ...(neighborhood ? [`${neighborhood}, ${CITY}`] : []),
  ];

  for (const q of queries) {
    const coords = await nominatimSearch(q);
    if (coords) {
      saveCache({ ...getCache(), [key]: coords });
      return coords;
    }
    await sleep(1100); // respeta el rate-limit de Nominatim
  }
  return null;
}

// ─── Optimización de ruta (nearest-neighbor TSP) ──────────────────────────────

function buildOptimizedRoute(origin: LatLng, points: (LatLng & { i: number })[]) {
  let cur = origin;
  const rem = [...points];
  const result: typeof points = [];
  while (rem.length > 0) {
    let best = 0, bestD = Infinity;
    rem.forEach((p, idx) => {
      const d = haversineKm(cur, p);
      if (d < bestD) { bestD = d; best = idx; }
    });
    result.push(rem[best]);
    cur = rem[best];
    rem.splice(best, 1);
  }
  return result;
}

// ─── Leaflet custom icons ─────────────────────────────────────────────────────

function userIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.25),0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -13],
  });
}

function stopIcon(n: number, status: string) {
  const bg = status === 'en_camino' ? '#10b981' : status === 'entregado' ? '#9ca3af' : '#f97316';
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;background:${bg};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px">${n}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
  });
}


// ─── Helpers de mapa ──────────────────────────────────────────────────────────

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const prev = useRef('');
  useEffect(() => {
    if (points.length === 0) return;
    const key = points.map(p => `${p.lat},${p.lng}`).join('|');
    if (key === prev.current) return;
    prev.current = key;
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, points]);
  return null;
}

function MapClickHandler({ active, onPlace }: { active: boolean; onPlace: (ll: LatLng) => void }) {
  useMapEvents({
    click: e => {
      if (!active) return;
      onPlace({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeoStop {
  delivery: Delivery;
  coords: LatLng;
  order: number;
  distKm?: number;
}

type Filter = 'today' | 'pending' | 'all';
type Phase = 'idle' | 'locating' | 'geocoding' | 'ready';

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', en_camino: 'En camino', entregado: 'Entregado',
};
const STATUS_COLOR: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  en_camino: 'bg-emerald-100 text-emerald-700',
  entregado: 'bg-gray-100 text-gray-500',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RouteMap() {
  const { state } = useApp();

  const [filter, setFilter]           = useState<Filter>('today');
  const [phase, setPhase]             = useState<Phase>('idle');
  const [locError, setLocError]       = useState('');
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
  const [userPos, setUserPos]         = useState<LatLng | null>(null);
  const [stops, setStops]             = useState<GeoStop[]>([]);
  const [failedDeliveries, setFailedDeliveries] = useState<Delivery[]>([]);
  const [isOptimized, setIsOptimized] = useState(false);
  const [listOpen, setListOpen]       = useState(true);
  const [placingFor, setPlacingFor]   = useState<string | null>(null); // delivery ID en modo ubicación manual

  // Entregas que cumplen el filtro activo
  const candidates = useMemo(() => {
    return state.deliveries.filter(d => {
      if (d.status === 'entregado' || d.status === 'fallido') return false;
      if (filter === 'today') return isToday(parseISO(d.scheduledDate));
      if (filter === 'pending') return d.status === 'pendiente';
      return true;
    });
  }, [state.deliveries, filter]);

  // Reset al cambiar filtro
  useEffect(() => {
    setStops([]);
    setFailedDeliveries([]);
    setIsOptimized(false);
    setPlacingFor(null);
    setPhase('idle');
  }, [filter]);

  // ── Obtener ubicación del repartidor ─────────────────────────────────────────
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError('Tu navegador no soporta geolocalización');
      return;
    }
    setPhase('locating');
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPhase('idle');
      },
      err => {
        setLocError(
          err.code === 1
            ? 'Permiso denegado. Habilítalo en la barra del navegador.'
            : 'No se pudo obtener la ubicación. Intenta de nuevo.'
        );
        setPhase('idle');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  useEffect(() => { getLocation(); }, []);

  // ── Geocodificar todas las entregas ───────────────────────────────────────────
  const geocodeAll = useCallback(async () => {
    if (candidates.length === 0) return;
    setPhase('geocoding');
    setStops([]);
    setFailedDeliveries([]);
    setIsOptimized(false);
    setPlacingFor(null);

    const cache = getCache();
    setGeocodeProgress({ done: 0, total: candidates.length });

    const results: GeoStop[] = [];
    const failed: Delivery[] = [];

    for (let idx = 0; idx < candidates.length; idx++) {
      const d = candidates[idx];
      const key = `${d.address}||${d.neighborhood}`;

      let coords: LatLng | null = cache[key] ?? null;
      if (!coords) coords = await geocode(d.address, d.neighborhood);

      if (coords) {
        results.push({ delivery: d, coords, order: results.length + 1 });
        setStops([...results]);
      } else {
        failed.push(d);
        setFailedDeliveries([...failed]);
      }

      setGeocodeProgress({ done: idx + 1, total: candidates.length });
    }

    setPhase('ready');
  }, [candidates]);

  // ── Ubicación manual: el usuario hace clic en el mapa ────────────────────────
  function handleManualPlace(coords: LatLng) {
    if (!placingFor) return;
    const delivery = failedDeliveries.find(d => d.id === placingFor);
    if (!delivery) return;

    // Guardar en caché para que la próxima vez se geocodifique automáticamente
    const key = `${delivery.address}||${delivery.neighborhood}`;
    saveCache({ ...getCache(), [key]: coords });

    const newStop: GeoStop = { delivery, coords, order: stops.length + 1 };
    setStops(prev => [...prev, newStop]);
    setFailedDeliveries(prev => prev.filter(d => d.id !== placingFor));
    setIsOptimized(false);
    setPlacingFor(null);
  }

  // ── Optimizar ruta ────────────────────────────────────────────────────────────
  function optimizeRoute() {
    if (stops.length === 0) return;
    const origin = userPos ?? BARRANCABERMEJA;
    const pts = stops.map((s, i) => ({ ...s.coords, i }));
    const ordered = buildOptimizedRoute(origin, pts);

    let prev = origin;
    const route: GeoStop[] = ordered.map((p, idx) => {
      const s = stops[p.i];
      const dist = haversineKm(prev, s.coords);
      prev = s.coords;
      return { ...s, order: idx + 1, distKm: dist };
    });

    setStops(route);
    setIsOptimized(true);
  }

  function resetRoute() {
    setStops(prev => prev.map((s, i) => ({ ...s, order: i + 1, distKm: undefined })));
    setIsOptimized(false);
  }

  // ── Navegación externa ────────────────────────────────────────────────────────
  function openGoogleMapsAll() {
    if (stops.length === 0) return;
    const origin = userPos ? `${userPos.lat},${userPos.lng}` : 'Mi+ubicación';
    const pts = stops.map(s => `${s.coords.lat},${s.coords.lng}`).join('/');
    window.open(`https://www.google.com/maps/dir/${origin}/${pts}`, '_blank');
  }

  function openGoogleMapsOne(s: GeoStop) {
    const q = encodeURIComponent(
      `${s.delivery.address}${s.delivery.neighborhood ? ', ' + s.delivery.neighborhood : ''}, Barrancabermeja, Santander, Colombia`
    );
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  function openWaze(s: GeoStop) {
    window.open(`https://waze.com/ul?ll=${s.coords.lat},${s.coords.lng}&navigate=yes`, '_blank');
  }

  function whatsappLink(s: GeoStop) {
    const phone = `57${s.delivery.phone.replace(/\D/g, '').slice(-10)}`;
    const msg = encodeURIComponent(`Hola ${s.delivery.customerName} 🌽, ya voy en camino con tu pedido. ¡Pronto llego!`);
    return `https://wa.me/${phone}?text=${msg}`;
  }

  // ── Datos derivados ───────────────────────────────────────────────────────────
  const totalKm = stops.filter(s => s.distKm != null).reduce((s, x) => s + (x.distKm ?? 0), 0);

  const polyline: [number, number][] = useMemo(() => {
    if (!isOptimized || stops.length === 0 || !userPos) return [];
    return [
      [userPos.lat, userPos.lng],
      ...stops.map(s => [s.coords.lat, s.coords.lng] as [number, number]),
    ];
  }, [stops, userPos, isOptimized]);

  const allMapPoints: LatLng[] = useMemo(() => {
    const pts: LatLng[] = [];
    if (userPos) pts.push(userPos);
    stops.forEach(s => pts.push(s.coords));
    return pts;
  }, [stops, userPos]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col -m-4 md:-m-6" style={{ height: 'calc(100vh - 4.5rem)' }}>

      {/* ── Barra de control superior ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-2 shrink-0">
        {/* Filtros */}
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 text-xs">
          {(['today', 'pending', 'all'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${filter === f ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {f === 'today'
                ? `Hoy (${state.deliveries.filter(d => d.status !== 'entregado' && d.status !== 'fallido' && isToday(parseISO(d.scheduledDate))).length})`
                : f === 'pending' ? 'Pendientes' : 'Todos'}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Ubicación */}
        <button onClick={getLocation} disabled={phase === 'locating'}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition-all ${
            userPos      ? 'bg-blue-50 text-blue-600 border-blue-200' :
            locError     ? 'bg-red-50 text-red-600 border-red-200' :
                           'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
          {phase === 'locating' ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
          {phase === 'locating' ? 'Obteniendo…' : userPos ? 'Ubicado ✓' : 'Mi ubicación'}
        </button>

        {/* Cargar mapa */}
        <button onClick={geocodeAll}
          disabled={phase === 'geocoding' || candidates.length === 0}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 disabled:opacity-50 transition-all">
          {phase === 'geocoding'
            ? <><Loader2 size={12} className="animate-spin" /> {geocodeProgress.done}/{geocodeProgress.total}</>
            : <><Map size={12} /> Cargar mapa</>}
        </button>

        {/* Optimizar */}
        {stops.length > 1 && !isOptimized && (
          <button onClick={optimizeRoute}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all">
            <Navigation size={12} /> Optimizar ruta
          </button>
        )}

        {isOptimized && (
          <button onClick={resetRoute}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 border border-gray-200 transition-all">
            <RotateCcw size={12} /> Reset
          </button>
        )}

        {isOptimized && (
          <button onClick={openGoogleMapsAll}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all ml-auto">
            <ExternalLink size={12} /> Iniciar ruta en Google Maps
          </button>
        )}

        {isOptimized && (
          <div className="text-xs text-gray-500 font-medium">
            {stops.length} paradas · ~{totalKm.toFixed(1)} km
          </div>
        )}
      </div>

      {/* ── Barra de error de ubicación ───────────────────────────────────── */}
      {locError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-700 shrink-0">
          <AlertCircle size={13} className="flex-shrink-0" />
          <span>{locError}</span>
          <span className="text-amber-500 ml-1">— Se usará el centro de Barrancabermeja como origen.</span>
        </div>
      )}

      {/* ── Entregas sin geocodificar → ubicación manual ──────────────────── */}
      {failedDeliveries.length > 0 && phase === 'ready' && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 shrink-0">
          <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
            <AlertCircle size={13} />
            {failedDeliveries.length} dirección{failedDeliveries.length > 1 ? 'es' : ''} no encontrada{failedDeliveries.length > 1 ? 's' : ''} — ubícalas manualmente haciendo clic en el mapa:
          </p>
          <div className="flex flex-wrap gap-2">
            {failedDeliveries.map(d => (
              <button key={d.id}
                onClick={() => setPlacingFor(prev => prev === d.id ? null : d.id)}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold border transition-all ${
                  placingFor === d.id
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-white text-red-600 border-red-300 hover:bg-red-100'
                }`}>
                <MousePointer size={10} />
                {placingFor === d.id ? 'Haz clic en el mapa…' : `Ubicar: ${d.customerName}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Mapa + sidebar ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Mapa */}
        <div className="flex-1 relative">
          {/* Inyección de cursor crosshair en el contenedor real de Leaflet */}
          {placingFor && (
            <style>{`.leaflet-container { cursor: crosshair !important; }`}</style>
          )}
          {stops.length === 0 && failedDeliveries.length === 0 && phase !== 'geocoding' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm pointer-events-none">
              <div className="text-center p-6">
                <Map size={48} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-600 font-semibold">Carga el mapa para ver las entregas</p>
                <p className="text-gray-400 text-sm mt-1">
                  {candidates.length === 0
                    ? 'No hay entregas para este filtro'
                    : `${candidates.length} entregas listas para geocodificar`}
                </p>
              </div>
            </div>
          )}

          {/* Banner de modo ubicación manual — siempre encima del mapa, sin bloquear clics */}
          {placingFor && (() => {
            const d = failedDeliveries.find(x => x.id === placingFor);
            return (
              <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
                <div className="mx-auto mt-3 w-fit bg-orange-600 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 pointer-events-auto">
                  <MousePointer size={15} className="animate-pulse flex-shrink-0" />
                  <div>
                    <p>Haz clic en el mapa donde vive</p>
                    <p className="font-normal text-orange-100 text-xs">{d?.customerName} · {d?.address}</p>
                  </div>
                  <button
                    onClick={() => setPlacingFor(null)}
                    className="ml-2 p-1 hover:bg-orange-700 rounded-lg transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })()}

          <MapContainer
            center={[BARRANCABERMEJA.lat, BARRANCABERMEJA.lng]}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />

            {/* Siempre montado — solo actúa cuando placingFor está activo */}
            <MapClickHandler active={!!placingFor} onPlace={handleManualPlace} />

            {/* Ubicación del repartidor */}
            {userPos && (
              <Marker position={[userPos.lat, userPos.lng]} icon={userIcon()}>
                <Popup>
                  <div className="text-sm">
                    <strong>📍 Tu ubicación</strong>
                    <p className="text-gray-500 text-xs mt-1">{userPos.lat.toFixed(5)}, {userPos.lng.toFixed(5)}</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Paradas geocodificadas */}
            {stops.map(s => (
              <Marker
                key={s.delivery.id}
                position={[s.coords.lat, s.coords.lng]}
                icon={stopIcon(s.order, s.delivery.status)}
              >
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <p style={{ fontWeight: 700, marginBottom: 2 }}>
                      Parada #{s.order} — {s.delivery.customerName}
                    </p>
                    <p style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
                      📍 {s.delivery.address}{s.delivery.neighborhood ? `, ${s.delivery.neighborhood}` : ''}
                    </p>
                    <p style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
                      {s.delivery.items.map(it => `${it.quantity}× ${it.productName}`).join(' · ')}
                    </p>
                    {s.distKm != null && (
                      <p style={{ fontSize: 11, color: '#f97316', marginBottom: 6 }}>
                        ~{s.distKm.toFixed(1)} km desde parada anterior
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.delivery.address + ', Barrancabermeja, Santander')}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
                        Google Maps
                      </a>
                      <a href={`https://waze.com/ul?ll=${s.coords.lat},${s.coords.lng}&navigate=yes`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, background: '#ecfeff', color: '#0e7490', padding: '3px 8px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
                        Waze
                      </a>
                      {s.delivery.phone && (
                        <a href={whatsappLink(s)} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, background: '#f0fdf4', color: '#15803d', padding: '3px 8px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Nota: no se muestran marcadores para entregas sin ubicar —
                 los marcadores interceptan los clics del mapa y rompen el modo manual */}

            {/* Línea de ruta optimizada */}
            {polyline.length > 1 && (
              <Polyline positions={polyline} color="#f97316" weight={3} dashArray="10 7" opacity={0.85} />
            )}

            {allMapPoints.length > 0 && <FitBounds points={allMapPoints} />}
          </MapContainer>
        </div>

        {/* ── Sidebar (escritorio) ────────────────────────────────────────── */}
        <div className="hidden md:flex w-72 xl:w-80 flex-col bg-white border-l border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">
                {isOptimized ? '🗺️ Ruta optimizada' : '📦 Entregas'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {stops.length > 0
                  ? `${stops.length} paradas${isOptimized ? ` · ~${totalKm.toFixed(1)} km` : ''}${failedDeliveries.length > 0 ? ` · ${failedDeliveries.length} sin ubicar` : ''}`
                  : `${candidates.length} pendientes de geocodificar`}
              </p>
            </div>
            {isOptimized && (
              <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                Optimizada
              </span>
            )}
          </div>

          {/* Sección de entregas sin ubicar */}
          {failedDeliveries.length > 0 && phase === 'ready' && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-3">
              <p className="text-[11px] font-semibold text-red-600 mb-2">Sin ubicar — clic en el mapa para colocar:</p>
              {failedDeliveries.map(d => (
                <button key={d.id}
                  onClick={() => setPlacingFor(prev => prev === d.id ? null : d.id)}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg mb-1 flex items-center gap-2 transition-all font-medium ${
                    placingFor === d.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-red-600 border border-red-200 hover:bg-red-100'
                  }`}>
                  <MousePointer size={11} />
                  <div className="min-w-0">
                    <p className="truncate">{d.customerName}</p>
                    <p className="text-[10px] truncate opacity-70">{d.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {stops.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8 text-gray-400">
                <Package size={32} className="mb-2 opacity-30" />
                <p className="text-sm">
                  {candidates.length === 0
                    ? 'Sin entregas para este filtro'
                    : 'Presiona "Cargar mapa" para ver las paradas'}
                </p>
              </div>
            ) : (
              stops.map((s, i) => (
                <div key={s.delivery.id}
                  className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5 shadow-sm ${
                      s.delivery.status === 'en_camino' ? 'bg-emerald-500' : 'bg-orange-500'
                    }`}>
                      {s.order}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{s.delivery.customerName}</p>
                      <p className="text-xs text-gray-500 truncate">{s.delivery.address}</p>
                      {s.delivery.neighborhood && (
                        <p className="text-xs text-gray-400 truncate">{s.delivery.neighborhood}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[s.delivery.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[s.delivery.status] ?? s.delivery.status}
                        </span>
                        {s.distKm != null && s.distKm > 0.05 && (
                          <span className="text-[10px] text-orange-400 font-medium">~{s.distKm.toFixed(1)} km</span>
                        )}
                        {i === 0 && isOptimized && (
                          <span className="text-[10px] text-blue-500 font-medium">Primer parada</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {s.delivery.items.map(it => `${it.quantity}× ${it.productName}`).join(', ')}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <button onClick={() => openGoogleMapsOne(s)}
                          className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold transition-colors">
                          <Navigation size={9} /> Maps
                        </button>
                        <button onClick={() => openWaze(s)}
                          className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-600 hover:bg-cyan-100 font-semibold transition-colors">
                          <Navigation size={9} /> Waze
                        </button>
                        {s.delivery.phone && (
                          <a href={whatsappLink(s)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 font-semibold transition-colors">
                            <MessageCircle size={9} /> WA
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {isOptimized && stops.length > 0 && (
            <div className="p-3 border-t border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50 space-y-2">
              <button onClick={openGoogleMapsAll}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
                <ExternalLink size={14} /> Iniciar ruta completa
              </button>
              <p className="text-xs text-orange-400 text-center">Abre las {stops.length} paradas en Google Maps</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Hoja inferior (móvil) ─────────────────────────────────────────── */}
      {(stops.length > 0 || failedDeliveries.length > 0) && (
        <div className="md:hidden bg-white border-t border-gray-200 shrink-0">
          <button onClick={() => setListOpen(v => !v)}
            className="w-full px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              {isOptimized
                ? `🗺️ Ruta (${stops.length} paradas · ~${totalKm.toFixed(1)} km)`
                : `📦 ${stops.length} entregas${failedDeliveries.length > 0 ? ` · ${failedDeliveries.length} sin ubicar` : ''}`}
            </span>
            {listOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
          </button>
          {listOpen && (
            <div className="max-h-52 overflow-y-auto border-t border-gray-100">
              {failedDeliveries.map(d => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-red-50 bg-red-50">
                  <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">?</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-700 truncate">{d.customerName}</p>
                    <p className="text-xs text-red-400 truncate">{d.address}</p>
                  </div>
                  <button onClick={() => setPlacingFor(prev => prev === d.id ? null : d.id)}
                    className={`text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0 ${
                      placingFor === d.id ? 'bg-orange-500 text-white' : 'bg-red-100 text-red-600'
                    }`}>
                    {placingFor === d.id ? 'Cancelar' : 'Ubicar'}
                  </button>
                </div>
              ))}
              {stops.map(s => (
                <div key={s.delivery.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                    s.delivery.status === 'en_camino' ? 'bg-emerald-500' : 'bg-orange-500'
                  }`}>{s.order}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.delivery.customerName}</p>
                    <p className="text-xs text-gray-500 truncate">{s.delivery.address}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openGoogleMapsOne(s)}
                      className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                      <Navigation size={14} />
                    </button>
                    {s.delivery.phone && (
                      <a href={whatsappLink(s)} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                        <MessageCircle size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {isOptimized && (
                <div className="p-3">
                  <button onClick={openGoogleMapsAll}
                    className="w-full bg-orange-500 text-white text-sm font-bold py-2 rounded-xl flex items-center justify-center gap-2">
                    <ExternalLink size={14} /> Iniciar ruta completa
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
