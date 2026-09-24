import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { Coords } from '../hooks/useLocation';
import { tileUrl, useMapTiler } from '../mapConfig';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  label?: string;
}

export interface StopMarker {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  kind?: 'stop' | 'next' | 'dest';
}

interface LeafletMapProps {
  center: Coords;
  user: Coords | null;
  markers?: MapMarker[];
  stops?: StopMarker[];
  line?: [number, number][]; // route line as [lat, lng] points
  follow?: Coords | null; // when set, the map keeps this point centered (ride mode)
  followZoom?: number; // zoom to hold while following
  style?: StyleProp<ViewStyle>;
}

function buildHtml(lat: number, lng: number): string {
  const tileFilter = useMapTiler
    ? ''
    : '.leaflet-tile-pane{filter:sepia(0.35) saturate(0.8) brightness(1.06) contrast(0.9) hue-rotate(-8deg);}';
  const subdomains = useMapTiler ? '' : "subdomains: 'abc',";

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#FAF6ED;}
  ${tileFilter}
  .leaflet-control-zoom a{border:2px solid #18181B !important;color:#18181B !important;font-weight:900;}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  // Lock the map to Metro Manila + nearby fringes (Bulacan / Cavite / Rizal)
  var NCR = L.latLngBounds([[14.10, 120.72], [14.98, 121.38]]);
  var map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    minZoom: 10,
    maxBounds: NCR,
    maxBoundsViscosity: 1.0
  }).setView([${lat}, ${lng}], 15);

  // keepBuffer loads extra tiles around the view so swiping doesn't show blank squares
  L.tileLayer('${tileUrl}', { maxZoom: 20, keepBuffer: 6, updateWhenIdle: false, updateWhenZooming: false, ${subdomains} }).addTo(map);

  // when you drag or zoom by hand, auto-follow pauses for a bit so the map doesn't fight you
  var pausedUntil = 0;
  function pauseFollow() { pausedUntil = Date.now() + 12000; }
  map.on('dragstart', pauseFollow); // one-finger swipe (only fires for your finger)
  map.getContainer().addEventListener('touchstart', function(e) { if (e.touches && e.touches.length > 1) pauseFollow(); }, { passive: true }); // pinch zoom
  var zc = document.querySelector('.leaflet-control-zoom'); if (zc) zc.addEventListener('click', pauseFollow); // + / - buttons

  var routeLayer = L.layerGroup().addTo(map);
  var userMarker = null, jeepLayer = L.layerGroup().addTo(map), centeredOnce = false;

  function jeepSvg(color) {
    return '<svg width="48" height="32" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="2" y="7" width="40" height="15" rx="3.5" fill="' + color + '" stroke="#18181B" stroke-width="2.5"/>' +
      '<rect x="6" y="9.5" width="30" height="6.5" rx="1.5" fill="#FAF6ED" stroke="#18181B" stroke-width="1.5"/>' +
      '<line x1="16" y1="9.5" x2="16" y2="16" stroke="#18181B" stroke-width="1.3"/>' +
      '<line x1="26" y1="9.5" x2="26" y2="16" stroke="#18181B" stroke-width="1.3"/>' +
      '<rect x="38" y="10.5" width="7" height="9" rx="2" fill="' + color + '" stroke="#18181B" stroke-width="2"/>' +
      '<circle cx="13" cy="25" r="4.5" fill="#18181B"/><circle cx="13" cy="25" r="1.6" fill="#FAF6ED"/>' +
      '<circle cx="31" cy="25" r="4.5" fill="#18181B"/><circle cx="31" cy="25" r="1.6" fill="#FAF6ED"/>' +
      '</svg>';
  }

  window.setUser = function(la, ln) {
    if (!userMarker) {
      userMarker = L.circleMarker([la, ln], { radius: 8, color: '#18181B', weight: 3, fillColor: '#3A86FF', fillOpacity: 1 }).addTo(map);
    } else { userMarker.setLatLng([la, ln]); }
    if (!centeredOnce) { map.setView([la, ln], 16); centeredOnce = true; }
  };

  // Ride mode: keep a point centered as the rider moves. Smooth pan, holds zoom.
  window.follow = function(la, ln, zoom) {
    if (Date.now() < pausedUntil) return; // you're looking around; resume in a few seconds
    var z = zoom || Math.max(map.getZoom(), 16);
    map.setView([la, ln], z, { animate: true, duration: 0.7 });
    centeredOnce = true;
  };

  window.setMarkers = function(arr) {
    jeepLayer.clearLayers();
    arr.forEach(function(m) {
      var icon = L.divIcon({ html: jeepSvg(m.color), className: '', iconSize: [48, 32], iconAnchor: [24, 28] });
      var mk = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(jeepLayer);
      if (m.label) { mk.bindPopup(m.label); }
    });
  };

  window.setRoute = function(line, arr) {
    routeLayer.clearLayers();
    var pts = line && line.length ? line : arr.map(function(s){ return [s.latitude, s.longitude]; });
    if (pts.length > 1) {
      L.polyline(pts, { color: '#18181B', weight: 9, opacity: 0.9 }).addTo(routeLayer);
      L.polyline(pts, { color: '#3A86FF', weight: 5, opacity: 1 }).addTo(routeLayer);
    }
    arr.forEach(function(s) {
      var fill = s.kind === 'dest' ? '#FF4757' : s.kind === 'next' ? '#FFC700' : '#FFFFFF';
      var r = s.kind === 'dest' ? 9 : 6;
      L.circleMarker([s.latitude, s.longitude], { radius: r, color: '#18181B', weight: 2.5, fillColor: fill, fillOpacity: 1 })
        .bindTooltip(s.name, { direction: 'right', offset: [8, 0], permanent: s.kind === 'dest' || s.kind === 'next' })
        .addTo(routeLayer);
    });
  };

  if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage('ready'); }
</script></body></html>`;
}

export default function LeafletMap({ center, user, markers = [], stops = [], line = [], follow = null, followZoom, style }: LeafletMapProps) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const source = useMemo(() => ({ html: buildHtml(center.latitude, center.longitude) }), []);

  useEffect(() => {
    if (ready && user && ref.current) {
      ref.current.injectJavaScript(`window.setUser(${user.latitude}, ${user.longitude}); true;`);
    }
  }, [ready, user]);

  // ride mode: pan the map to keep the rider centered as they move
  useEffect(() => {
    if (ready && follow && ref.current) {
      ref.current.injectJavaScript(`window.follow(${follow.latitude}, ${follow.longitude}, ${followZoom || 0}); true;`);
    }
  }, [ready, follow?.latitude, follow?.longitude, followZoom]);

  useEffect(() => {
    if (ready && ref.current) {
      ref.current.injectJavaScript(`window.setMarkers(${JSON.stringify(markers)}); true;`);
    }
  }, [ready, markers]);

  useEffect(() => {
    if (ready && ref.current) {
      ref.current.injectJavaScript(`window.setRoute(${JSON.stringify(line)}, ${JSON.stringify(stops)}); true;`);
    }
  }, [ready, stops, line]);

  return (
    <WebView
      ref={ref}
      originWhitelist={['*']}
      source={source}
      style={style}
      javaScriptEnabled
      domStorageEnabled
      nestedScrollEnabled
      onMessage={(e) => {
        if (e.nativeEvent.data === 'ready') setReady(true);
      }}
    />
  );
}
