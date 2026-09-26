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
  html,body{height:100%;margin:0;padding:0;overflow:hidden;background:#FAF6ED;touch-action:none;}
  /* The map is a square as big as the screen's diagonal, centered, and rotated as
     ONE block with CSS. Tiles, route line and stops can never slide apart. */
  #map{position:absolute;background:#FAF6ED;transform-origin:50% 50%;--nb:0deg;}
  ${tileFilter}
  .ctrl{position:absolute;left:10px;top:10px;z-index:1000;display:flex;flex-direction:column;gap:10px;}
  .ctrl .box{background:#fff;border:2px solid #18181B;border-radius:4px;overflow:hidden;}
  .ctrl a{display:flex;align-items:center;justify-content:center;width:30px;height:30px;color:#18181B;font:900 20px/30px sans-serif;text-decoration:none;}
  .ctrl .box a + a{border-top:1px solid #18181B;}
  #compass{display:none;}
  #compass svg{transition:transform .1s linear;}
  /* keep text and jeep icons upright while the map is turned */
  .up{display:inline-block;transform:rotate(var(--nb));}
  .leaflet-tooltip.lbl{background:transparent;border:0;box-shadow:none;padding:0;}
  .leaflet-tooltip.lbl:before{display:none;}
  .lbl .up{transform-origin:0 50%;background:#fff;border:1px solid #bbb;border-radius:3px;padding:4px 6px;box-shadow:0 1px 3px rgba(0,0,0,.4);white-space:nowrap;color:#222;font-size:12px;}
</style>
</head><body>
<div id="map"></div>
<div class="ctrl">
  <div class="box"><a href="#" id="zin">+</a><a href="#" id="zout">&minus;</a></div>
  <div class="box" id="compass"><a href="#" title="Face north"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 1 L14 10 L6 10 Z" fill="#FF4757" stroke="#18181B" stroke-width="1.2"/><path d="M10 19 L14 10 L6 10 Z" fill="#FFFFFF" stroke="#18181B" stroke-width="1.2"/></svg></a></div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var mapEl = document.getElementById('map');
  function sizeMap() {
    var w = window.innerWidth, h = window.innerHeight, d = Math.ceil(Math.sqrt(w * w + h * h));
    mapEl.style.width = d + 'px'; mapEl.style.height = d + 'px';
    mapEl.style.left = ((w - d) / 2) + 'px'; mapEl.style.top = ((h - d) / 2) + 'px';
  }
  sizeMap();

  // Lock the map to Metro Manila + nearby fringes (Bulacan / Cavite / Rizal)
  var NCR = L.latLngBounds([[14.10, 120.72], [14.98, 121.38]]);
  var map = L.map('map', {
    zoomControl: false,       // our own buttons below (Leaflet's would turn with the map)
    attributionControl: false,
    minZoom: 10,
    maxBounds: NCR,
    maxBoundsViscosity: 1.0,
    dragging: false,          // one-finger pan is handled below so it works when turned
    touchZoom: 'center',      // pinch zooms around the middle of the screen
    doubleClickZoom: 'center',
    scrollWheelZoom: 'center',
    boxZoom: false
  }).setView([${lat}, ${lng}], 15);
  window.addEventListener('resize', function() { sizeMap(); map.invalidateSize(); });

  // keepBuffer loads extra tiles around the view so swiping doesn't show blank squares
  L.tileLayer('${tileUrl}', { maxZoom: 20, keepBuffer: 6, updateWhenIdle: false, updateWhenZooming: false, ${subdomains} }).addTo(map);

  // when you drag or zoom by hand, auto-follow pauses for a bit so the map doesn't fight you
  var pausedUntil = 0;
  function pauseFollow() { pausedUntil = Date.now() + 12000; }

  // ---------- rotation ----------
  var bearing = 0; // degrees, clockwise
  var needle = document.querySelector('#compass svg');
  function setBearing(b) {
    bearing = ((b % 360) + 540) % 360 - 180;
    mapEl.style.transform = 'rotate(' + bearing + 'deg)';
    mapEl.style.setProperty('--nb', (-bearing) + 'deg');
    needle.style.transform = 'rotate(' + bearing + 'deg)';
    document.getElementById('compass').style.display = Math.abs(bearing) < 0.5 ? 'none' : 'block';
  }
  function tapBtn(sel, fn) {
    document.querySelector(sel).addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); fn(); });
  }
  tapBtn('#zin', function() { pauseFollow(); map.zoomIn(); });
  tapBtn('#zout', function() { pauseFollow(); map.zoomOut(); });
  tapBtn('#compass a', function() { setBearing(0); });

  // ---------- gestures ----------
  // One finger pans (the finger's movement is turned back by the bearing so the
  // map moves under your finger). Two fingers: Leaflet pinch-zooms; we add the
  // twist, which only starts after ~12 degrees so a plain pinch doesn't wobble.
  var last = null, twist = null;
  function angleOf(t) { return Math.atan2(t[1].clientY - t[0].clientY, t[1].clientX - t[0].clientX) * 180 / Math.PI; }
  function panByScreen(dx, dy) {
    var r = bearing * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    map.panBy([-(dx * c + dy * s), -(-dx * s + dy * c)], { animate: false });
  }
  function onStart(e) {
    var t = e.touches;
    pauseFollow();
    if (t.length === 1) { last = { x: t[0].clientX, y: t[0].clientY }; twist = null; }
    else if (t.length === 2) { last = null; twist = { a0: angleOf(t), b0: bearing, on: false }; }
  }
  function onMove(e) {
    var t = e.touches;
    if (t.length === 1 && last) {
      panByScreen(t[0].clientX - last.x, t[0].clientY - last.y);
      last = { x: t[0].clientX, y: t[0].clientY };
    } else if (t.length === 2 && twist) {
      var d = angleOf(t) - twist.a0;
      d = ((d % 360) + 540) % 360 - 180;
      if (!twist.on && Math.abs(d) > 12) { twist.on = true; twist.a0 += d > 0 ? 12 : -12; d = d > 0 ? d - 12 : d + 12; }
      if (twist.on) setBearing(twist.b0 + d);
    }
    e.preventDefault();
  }
  function onEnd(e) {
    var t = e.touches;
    if (t.length === 1) { last = { x: t[0].clientX, y: t[0].clientY }; twist = null; } // lifted one of two fingers
    else if (t.length === 0) { last = null; twist = null; }
  }
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', onEnd, { passive: true });
  // mouse drag (Expo web / desktop)
  var mouse = null;
  mapEl.addEventListener('mousedown', function(e) { mouse = { x: e.clientX, y: e.clientY }; pauseFollow(); });
  window.addEventListener('mousemove', function(e) { if (!mouse) return; panByScreen(e.clientX - mouse.x, e.clientY - mouse.y); mouse = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('mouseup', function() { mouse = null; });

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
      var icon = L.divIcon({ html: '<div class="up" style="transform-origin:24px 28px">' + jeepSvg(m.color) + '</div>', className: '', iconSize: [48, 32], iconAnchor: [24, 28] });
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
        .bindTooltip('<span class="up">' + s.name + '</span>', { className: 'lbl', direction: 'right', offset: [8, 0], permanent: s.kind === 'dest' || s.kind === 'next' })
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
