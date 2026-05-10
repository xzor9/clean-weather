/* ---------------------------------------------------------------------------
   Clean Weather — a minimalist weather app
   A small React app that fetches weather from Open-Meteo and renders it with
   gradient backgrounds, a 24-hour line chart, and an 8-day line chart with a
   per-day detail panel.
--------------------------------------------------------------------------- */

const { useState, useEffect, useMemo, useRef } = React;

/* ---------------------------------------------------------------------------
   Open-Meteo helpers
   - Geocoding: https://geocoding-api.open-meteo.com/v1/search
   - Forecast:  https://api.open-meteo.com/v1/forecast
--------------------------------------------------------------------------- */

async function geocodeCity(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Geocoding failed");
  const j = await r.json();
  return j.results || [];
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const r = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!r.ok) return null;
  const j = await r.json();
  const a = j.address || {};
  const name = a.city || a.town || a.village || a.county || null;
  const country = a.country_code?.toUpperCase() || "";
  return name ? { name, country } : null;
}

async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,uv_index",
    hourly: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,precipitation_probability,precipitation,wind_speed_10m,uv_index,is_day",
    daily:  "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
    timezone: "auto",
    forecast_days: 8,
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!r.ok) throw new Error("Forecast fetch failed");
  return r.json();
}

// Convert Celsius → Fahrenheit (gradient thresholds are calibrated in °F; data is always metric)
function toF(tempC) {
  return (tempC * 9/5) + 32;
}

// Client-side unit conversion — all API data is stored in metric
function convertTemp(c, units)   { return units === "imperial" ? (c * 9/5) + 32 : c; }
function convertWind(kmh, units) { return units === "imperial" ? kmh * 0.621371 : kmh; }
function convertPrecip(mm, units){ return units === "imperial" ? mm * 0.0393701 : mm; }

/* ---------------------------------------------------------------------------
   Weather code → label, icon, gradient
--------------------------------------------------------------------------- */

// WMO weather interpretation codes
const WX = {
  0:  { label: "Clear",            icon: "sun",       group: "clear" },
  1:  { label: "Mainly clear",     icon: "sun",       group: "clear" },
  2:  { label: "Partly cloudy",    icon: "partly",    group: "partly" },
  3:  { label: "Overcast",         icon: "cloud",     group: "cloud" },
  45: { label: "Fog",              icon: "fog",       group: "fog" },
  48: { label: "Rime fog",         icon: "fog",       group: "fog" },
  51: { label: "Light drizzle",    icon: "drizzle",   group: "rain" },
  53: { label: "Drizzle",          icon: "drizzle",   group: "rain" },
  55: { label: "Heavy drizzle",    icon: "drizzle",   group: "rain" },
  56: { label: "Freezing drizzle", icon: "sleet",     group: "rain" },
  57: { label: "Freezing drizzle", icon: "sleet",     group: "rain" },
  61: { label: "Light rain",       icon: "rain",      group: "rain" },
  63: { label: "Rain",             icon: "rain",      group: "rain" },
  65: { label: "Heavy rain",       icon: "rain",      group: "rain" },
  66: { label: "Freezing rain",    icon: "sleet",     group: "rain" },
  67: { label: "Freezing rain",    icon: "sleet",     group: "rain" },
  71: { label: "Light snow",       icon: "snow",      group: "snow" },
  73: { label: "Snow",             icon: "snow",      group: "snow" },
  75: { label: "Heavy snow",       icon: "snow",      group: "snow" },
  77: { label: "Snow grains",      icon: "snow",      group: "snow" },
  80: { label: "Rain showers",     icon: "rain",      group: "rain" },
  81: { label: "Rain showers",     icon: "rain",      group: "rain" },
  82: { label: "Heavy showers",    icon: "rain",      group: "rain" },
  85: { label: "Snow showers",     icon: "snow",      group: "snow" },
  86: { label: "Snow showers",     icon: "snow",      group: "snow" },
  95: { label: "Thunderstorm",     icon: "storm",     group: "storm" },
  96: { label: "Thunderstorm",     icon: "storm",     group: "storm" },
  99: { label: "Thunderstorm",     icon: "storm",     group: "storm" },
};

function wxInfo(code) {
  return WX[code] || { label: "—", icon: "cloud", group: "cloud" };
}

// Build a gradient based on temperature and condition group (and day/night).
// All palettes are dark-mode: low luminance with a hue that hints at the weather.
function gradientFor(temp, group, isDay) {
  // Night → deepest indigos and near-blacks
  if (!isDay) {
    if (group === "storm") return ["#160a2e", "#241247", "#06040f"];
    if (group === "rain")  return ["#0e1a33", "#1a2a4d", "#05080f"];
    if (group === "snow")  return ["#15243a", "#27395a", "#0a1020"];
    if (group === "fog")   return ["#181b24", "#2a2e3a", "#0a0c12"];
    return                ["#0a0f24", "#1a214a", "#04060f"];
  }
  // Daytime — still dark, but with a hint of the weather's color
  if (group === "storm")   return ["#1f2238", "#2e3354", "#0d0f1c"];
  if (group === "snow")    return ["#1f3148", "#34516e", "#0e1825"]; // muted icy blue
  if (group === "rain")    return ["#15293f", "#264761", "#080f17"];
  if (group === "fog")     return ["#22262f", "#383d4a", "#0e1015"];
  if (temp >= 90)          return ["#3a0f0a", "#6b2317", "#1a0604"]; // deep ember
  if (temp >= 75)          return ["#321a0a", "#5a2f14", "#160805"]; // warm amber-dark
  if (temp >= 60)          return ["#0f2c2a", "#1d4a47", "#06120f"]; // deep teal
  if (temp >= 40)          return ["#161a3a", "#262c5e", "#080a1a"]; // dusk indigo
  return                   ["#0d1f3a", "#1c3358", "#040810"]; // chilly midnight blue
}

/* ---------------------------------------------------------------------------
   Minimalist SVG icons (line style, single color = currentColor)
--------------------------------------------------------------------------- */

function Icon({ name, className = "w-8 h-8" }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "sun":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "partly":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <circle cx="8" cy="9" r="3.2" />
          <path d="M8 2.5v1.5M3.2 9H1.7M4.3 4.3l1 1M11.7 4.3l-1 1" />
          <path d="M17 19a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 8 19h9z" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M17 18a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 8 18h9z" />
        </svg>
      );
    case "rain":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M17 14a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 8 14h9z" />
          <path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3" />
        </svg>
      );
    case "drizzle":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M17 14a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 8 14h9z" />
          <path d="M10 17v1.5M14 17v1.5M12 19v1.5" />
        </svg>
      );
    case "snow":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M17 14a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 8 14h9z" />
          <path d="M9 18l.01.01M13 18l.01.01M17 18l.01.01M11 20l.01.01M15 20l.01.01" />
        </svg>
      );
    case "sleet":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M17 14a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 8 14h9z" />
          <path d="M10 17l-1 2M14 17l-.01.01M17 17l-1 2M12 19l.01.01" />
        </svg>
      );
    case "fog":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M4 10h12M6 14h14M4 18h12" />
        </svg>
      );
    case "storm":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M17 13a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 8 13h9z" />
          <path d="M11 14l-2 4h3l-1 4 4-6h-3l1-2z" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case "location":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      );
    case "wind":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M3 9h12a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3" />
        </svg>
      );
    case "drop":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z" />
        </svg>
      );
    case "uv":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6 6l1.4 1.4M16.6 16.6L18 18" />
        </svg>
      );
    case "feels":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z" />
        </svg>
      );
    default:
      return null;
  }
}

/* ---------------------------------------------------------------------------
   Formatting helpers
--------------------------------------------------------------------------- */

function fmtHour(iso, tz) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: tz });
}

function fmtDay(iso, tz, idx) {
  if (idx === 0) return "Today";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
}

function fmtTime(iso, tz) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
  });
}

function fmtPrecip(mm, units) {
  const unit = units === "imperial" ? "in" : "mm";
  if (mm == null || mm < 0.05) return `0 ${unit}`;
  if (units === "imperial") {
    const inches = convertPrecip(mm, units);
    return inches < 0.1 ? `${inches.toFixed(2)} in` : `${inches.toFixed(1)} in`;
  }
  if (mm < 1) return `${mm.toFixed(1)} mm`;
  return `${Math.round(mm)} mm`;
}

function compassDir(deg) {
  if (deg == null) return "—";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

function round(n) { return Math.round(n); }

/* ---------------------------------------------------------------------------
   UI Components
--------------------------------------------------------------------------- */

function TopBar({ place, onSearch, onLocate, query, setQuery }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 px-5 pt-5 pb-2">
      <button
        onClick={onLocate}
        title="Use my location"
        className="p-2 rounded-full glass hover:bg-white/20 transition"
      >
        <Icon name="location" className="w-5 h-5" />
      </button>
      <div className="flex-1 text-center">
        <div className="text-sm uppercase tracking-[0.2em] opacity-80">{place?.country || ""}</div>
        <div className="text-xl font-semibold leading-tight">{place?.name || "—"}</div>
      </div>
      <button
        onClick={() => { if (open) setQuery(""); setOpen(o => !o); }}
        title="Search city"
        className="p-2 rounded-full glass hover:bg-white/20 transition"
      >
        <Icon name="search" className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-20 px-5 z-20">
          <form
            onSubmit={(e) => { e.preventDefault(); onSearch(query); setOpen(false); }}
            className="glass-strong rounded-2xl p-2 flex items-center gap-2"
          >
            <Icon name="search" className="w-5 h-5 ml-2 opacity-80" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city…"
              className="flex-1 bg-transparent outline-none placeholder-white/60 px-1 py-2"
            />
            <button className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-sm">Go</button>
          </form>
        </div>
      )}
    </div>
  );
}

function CurrentSection({ data, units, onClearSelection }) {
  if (!data) return null;
  const { current, daily, timezone } = data;
  const info = wxInfo(current.weather_code);
  const hi = round(convertTemp(daily.temperature_2m_max[0], units));
  const lo = round(convertTemp(daily.temperature_2m_min[0], units));
  const isPreview = !!current.__selected;
  const previewLabel = isPreview
    ? new Date(current.time).toLocaleString("en-US", { weekday: "short", hour: "numeric", hour12: true, timeZone: timezone })
    : null;
  return (
    <div className="px-6 pt-2 pb-4 text-center fade-in">
      {isPreview && (
        <button
          onClick={onClearSelection}
          className="inline-flex items-center gap-1.5 glass rounded-full px-3 py-1 text-xs mb-2 hover:bg-white/15 transition"
        >
          <span className="opacity-90">Previewing {previewLabel}</span>
          <span className="opacity-70">×</span>
        </button>
      )}
      <Icon name={info.icon} className="w-16 h-16 mx-auto opacity-95" />
      <div className="text-[7rem] leading-none font-extralight num mt-2">
        {round(convertTemp(current.temperature_2m, units))}°
      </div>
      <div className="text-lg opacity-95">{info.label}</div>
      <div className="text-sm opacity-80 mt-1 num">
        H: {hi}°  ·  L: {lo}°  ·  Feels {round(convertTemp(current.apparent_temperature, units))}°
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="glass rounded-2xl p-3 flex flex-col items-center text-center min-w-0">
      <div className="flex items-center gap-1.5 opacity-80 text-xs uppercase tracking-wider">
        <Icon name={icon} className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-medium num mt-1 truncate">{value}</div>
      {sub && <div className="text-xs opacity-75 mt-0.5">{sub}</div>}
    </div>
  );
}

function StatGrid({ data, units }) {
  if (!data) return null;
  const c = data.current;
  const uv = c.uv_index;
  const uvLabel =
    uv == null ? "—" :
    uv < 3 ? "Low" :
    uv < 6 ? "Moderate" :
    uv < 8 ? "High" :
    uv < 11 ? "Very High" : "Extreme";
  const windUnit = units === "imperial" ? "mph" : "km/h";
  return (
    <div className="px-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard icon="feels" label="Feels Like" value={`${round(convertTemp(c.apparent_temperature, units))}°`} />
      <StatCard icon="drop"  label="Humidity"   value={`${round(c.relative_humidity_2m)}%`} />
      <StatCard icon="wind"  label="Wind"       value={`${round(convertWind(c.wind_speed_10m, units))} ${windUnit}`} />
      <StatCard icon="uv"    label="UV Index"   value={uv != null ? round(uv) : "—"} sub={uvLabel} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   TempChart — SVG line chart used by both hourly and daily forecasts.
   - `points` is an array of objects: { temp, label, sublabel?, icon, highlight? }
   - The line is a smooth Catmull-Rom-like curve drawn through every point.
   - Each point shows: temp label above the dot, then icon, then x-label, then sublabel.
--------------------------------------------------------------------------- */

// Build a smooth path through a list of [x, y] points using a Catmull-Rom-like cubic.
function smoothPath(pts) {
  if (pts.length < 2) return "";
  const d = [`M ${pts[0][0]},${pts[0][1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18; // tension
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d.push(`C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`);
  }
  return d.join(" ");
}

function rgb([r, g, b]) { return `rgb(${r}, ${g}, ${b})`; }

// Map a temperature (in °C) to a color along a cool→warm scale.
function tempColor(tC) {
  const stops = [
    { t: -20, c: [125, 211, 252] }, // sky-300
    { t:   0, c: [147, 197, 253] }, // blue-300
    { t:  10, c: [165, 243, 252] }, // cyan-200
    { t:  20, c: [253, 230, 138] }, // amber-200
    { t:  28, c: [251, 191,  36] }, // amber-400
    { t:  35, c: [251, 146,  60] }, // orange-400
    { t:  45, c: [239,  68,  68] }, // red-500
  ];
  if (tC <= stops[0].t) return rgb(stops[0].c);
  if (tC >= stops[stops.length - 1].t) return rgb(stops[stops.length - 1].c);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (tC >= a.t && tC <= b.t) {
      const k = (tC - a.t) / (b.t - a.t);
      return rgb([
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * k),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * k),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * k),
      ]);
    }
  }
  return "#fff";
}

// Convert any displayed temperature to °C for the color scale.
function toC(temp, units) {
  return units === "imperial" ? (temp - 32) * 5/9 : temp;
}

function TempChart({ points, units, secondary = null, height = 170, colWidth = 64, padTop = 32, padBottom = 56, onPointClick = null, selectedIdx = null }) {
  if (!points?.length) return null;
  const W = points.length * colWidth;
  const H = height;
  const innerTop = padTop;
  const innerBottom = H - padBottom;
  const innerH = Math.max(40, innerBottom - innerTop);

  // Range across the primary line (and secondary, if given) for a shared y-scale
  const allTemps = secondary
    ? [...points.map(p => p.temp), ...secondary.map(p => p.temp)]
    : points.map(p => p.temp);
  const minT = Math.min(...allTemps);
  const maxT = Math.max(...allTemps);
  const span = Math.max(1, maxT - minT);

  const yFor = (t) => innerBottom - ((t - minT) / span) * innerH;
  const xFor = (i) => i * colWidth + colWidth / 2;

  const linePts = points.map((p, i) => [xFor(i), yFor(p.temp)]);
  const linePath = smoothPath(linePts);

  const secPts = secondary ? secondary.map((p, i) => [xFor(i), yFor(p.temp)]) : null;
  const secPath = secPts ? smoothPath(secPts) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
      {/* "Now" / today highlight column. When selectedIdx is provided, the
           selection takes over the highlight from p.highlight. */}
      {points.map((p, i) => {
        const isHighlighted = selectedIdx != null ? i === selectedIdx : p.highlight;
        return isHighlighted ? (
          <rect
            key={`hl-${i}`}
            x={i * colWidth + 2}
            y={4}
            width={colWidth - 4}
            height={H - 8}
            rx="10"
            fill={selectedIdx != null && i === selectedIdx ? "rgba(125,211,252,0.18)" : "rgba(255,255,255,0.08)"}
            stroke={selectedIdx != null && i === selectedIdx ? "rgba(125,211,252,0.45)" : "none"}
            strokeWidth="1"
          />
        ) : null;
      })}

      {/* Secondary (low) line — drawn first so the primary sits on top */}
      {secPath && (
        <>
          <path d={secPath} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
          {secPts.map(([x, y], i) => (
            <circle key={`sc-${i}`} cx={x} cy={y} r="2.5" fill="rgba(255,255,255,0.6)" />
          ))}
          {secondary.map((p, i) => {
            // Place the low label above the dot when there's room; otherwise below.
            // Clamp so it never crashes into the icon row at the bottom.
            const [, sy] = secPts[i];
            const [, hy] = linePts[i];
            const gap = sy - hy; // distance between high (above) and low (below) on this column
            const placeAbove = gap > 22;
            const yOffset = placeAbove ? -8 : 16;
            const labelY = Math.min(innerBottom + 14, sy + yOffset);
            return (
              <text
                key={`sl-${i}`}
                x={secPts[i][0]}
                y={labelY}
                textAnchor="middle"
                fontSize="11"
                fill="rgba(255,255,255,0.7)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(p.temp)}°
              </text>
            );
          })}
        </>
      )}

      {/* Primary (high) line */}
      <path d={linePath} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />

      {/* Temperature label + dot per point */}
      {points.map((p, i) => {
        const [x, y] = linePts[i];
        const color = tempColor(toC(p.temp, units));
        const labelY = Math.max(14, y - 10);
        return (
          <g key={`p-${i}`}>
            <text
              x={x}
              y={labelY}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill={color}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(p.temp)}°
            </text>
            <circle cx={x} cy={y} r="3" fill={color} />
          </g>
        );
      })}

      {/* Bottom row: icon + x-label (+ optional sublabel) */}
      {points.map((p, i) => {
        const x = xFor(i);
        return (
          <g key={`b-${i}`}>
            <foreignObject x={x - 11} y={H - padBottom + 6} width="22" height="22">
              <div style={{ color: "#fff", opacity: 0.9 }}>
                <Icon name={p.icon} className="w-[22px] h-[22px]" />
              </div>
            </foreignObject>
            <text
              x={x}
              y={H - padBottom + 38}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(255,255,255,0.85)"
              style={{ fontVariantNumeric: "tabular-nums", fontWeight: p.highlight ? 600 : 400 }}
            >
              {p.label}
            </text>
            {p.sublabel && (
              <text
                x={x}
                y={H - padBottom + 51}
                textAnchor="middle"
                fontSize="10"
                fill={p.sublabelColor || "rgba(255,255,255,0.6)"}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {p.sublabel}
              </text>
            )}
          </g>
        );
      })}

      {/* Click overlay — invisible rects, one per column, capture taps */}
      {onPointClick && points.map((p, i) => (
        <rect
          key={`tap-${i}`}
          x={i * colWidth}
          y={0}
          width={colWidth}
          height={H}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onClick={() => onPointClick(i)}
        >
          <title>{`${p.label}: ${Math.round(p.temp)}°`}</title>
        </rect>
      ))}
    </svg>
  );
}

function HourlyStrip({ data, units, selectedIdx, onSelect }) {
  if (!data) return null;
  const { hourly, current, timezone } = data;
  // current.time may be minute-aligned ("…T12:55") while hourly.time is hour-aligned,
  // so match on the "YYYY-MM-DDTHH" prefix.
  const hourPrefix = (current.time || "").slice(0, 13);
  let startIdx = hourly.time.findIndex(t => t.startsWith(hourPrefix));
  if (startIdx < 0) startIdx = 0;
  const slice = (arr) => arr.slice(startIdx, startIdx + 24);
  const times  = slice(hourly.time);
  const temps  = slice(hourly.temperature_2m);
  const codes  = slice(hourly.weather_code);
  const pop    = slice(hourly.precipitation_probability || []);
  const precip = slice(hourly.precipitation || []);

  const points = times.map((t, i) => {
    const info = wxInfo(codes[i]);
    const precipMm = precip[i];
    let sublabel = "";
    let sublabelColor = "rgba(255,255,255,0.6)";
    if (precipMm != null && precipMm >= 0.1) {
      sublabel = fmtPrecip(precipMm, units);
      sublabelColor = "#7dd3fc";
    } else if (pop[i] >= 30) {
      sublabel = `${pop[i]}%`;
      sublabelColor = "#7dd3fc";
    }
    return {
      temp: convertTemp(temps[i], units),
      label: i === 0 ? "Now" : fmtHour(t, timezone),
      sublabel,
      sublabelColor,
      icon: info.icon,
      highlight: i === 0,
    };
  });

  return (
    <div className="px-5 mt-4">
      <div className="text-xs uppercase tracking-[0.2em] opacity-75 mb-2 px-1">
        Hourly Forecast
        <span className="ml-2 normal-case tracking-normal opacity-60">· tap to preview</span>
      </div>
      <div className="glass rounded-2xl py-2 overflow-x-auto no-scrollbar">
        <TempChart
          points={points}
          units={units}
          height={170}
          colWidth={64}
          selectedIdx={selectedIdx}
          onPointClick={onSelect}
        />
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, sub }) {
  return (
    <div className="glass rounded-xl px-3 py-2.5 flex items-center gap-3">
      <div className="opacity-80"><Icon name={icon} className="w-5 h-5" /></div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
        <div className="text-base num font-medium truncate">{value}</div>
        {sub && <div className="text-[11px] opacity-70 num truncate">{sub}</div>}
      </div>
    </div>
  );
}

function DailyDetail({ data, units, idx }) {
  if (!data || idx == null) return null;
  const { daily, timezone } = data;
  const info = wxInfo(daily.weather_code[idx]);
  const date = new Date(daily.time[idx] + "T12:00:00");
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: timezone,
  });
  const hi = round(convertTemp(daily.temperature_2m_max[idx], units));
  const lo = round(convertTemp(daily.temperature_2m_min[idx], units));
  const feelsHi = daily.apparent_temperature_max?.[idx];
  const feelsLo = daily.apparent_temperature_min?.[idx];
  const pop = (daily.precipitation_probability_max || [])[idx];
  const precip = (daily.precipitation_sum || [])[idx];
  const wind = (daily.wind_speed_10m_max || [])[idx];
  const gust = (daily.wind_gusts_10m_max || [])[idx];
  const windDir = (daily.wind_direction_10m_dominant || [])[idx];
  const uv = (daily.uv_index_max || [])[idx];
  const sunrise = (daily.sunrise || [])[idx];
  const sunset  = (daily.sunset  || [])[idx];
  const windUnit = units === "imperial" ? "mph" : "km/h";

  const uvLabel =
    uv == null ? "—" :
    uv < 3 ? "Low" :
    uv < 6 ? "Moderate" :
    uv < 8 ? "High" :
    uv < 11 ? "Very High" : "Extreme";

  // Daylight length, derived from sunrise/sunset
  let daylight = "—";
  if (sunrise && sunset) {
    const ms = new Date(sunset) - new Date(sunrise);
    const h = Math.floor(ms / 3.6e6);
    const m = Math.floor((ms - h * 3.6e6) / 6e4);
    daylight = `${h}h ${m}m`;
  }

  return (
    <div className="mt-3 fade-in" key={idx}>
      <div className="glass-strong rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] opacity-70">{idx === 0 ? "Today" : "Forecast"}</div>
            <div className="text-base font-medium truncate">{dateStr}</div>
            <div className="text-sm opacity-90">{info.label}</div>
          </div>
          <div className="flex items-center gap-3">
            <Icon name={info.icon} className="w-10 h-10 opacity-95" />
            <div className="text-right">
              <div className="text-2xl num font-medium leading-none">{hi}°</div>
              <div className="text-sm num opacity-75 mt-0.5">{lo}°</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <DetailRow
            icon="feels"
            label="Feels Like"
            value={feelsHi != null ? `${round(convertTemp(feelsHi, units))}°` : "—"}
            sub={feelsLo != null ? `Low ${round(convertTemp(feelsLo, units))}°` : null}
          />
          <DetailRow
            icon="drop"
            label="Precipitation"
            value={pop != null ? `${pop}%` : "—"}
            sub={precip != null ? `${fmtPrecip(precip, units)} expected` : null}
          />
          <DetailRow
            icon="wind"
            label="Wind"
            value={wind != null ? `${round(convertWind(wind, units))} ${windUnit}` : "—"}
            sub={
              [
                gust != null ? `Gusts ${round(convertWind(gust, units))} ${windUnit}` : null,
                windDir != null ? `from ${compassDir(windDir)}` : null,
              ].filter(Boolean).join(" · ") || null
            }
          />
          <DetailRow
            icon="uv"
            label="Max UV"
            value={uv != null ? `${round(uv)}` : "—"}
            sub={uvLabel}
          />
          <DetailRow
            icon="sun"
            label="Sunrise"
            value={fmtTime(sunrise, timezone)}
            sub={`Daylight ${daylight}`}
          />
          <DetailRow
            icon="sun"
            label="Sunset"
            value={fmtTime(sunset, timezone)}
            sub={null}
          />
        </div>
      </div>
    </div>
  );
}

function DailyList({ data, units, selectedIdx, onSelect }) {
  if (!data) return null;
  const { daily, timezone } = data;

  // Two lines: highs (primary) and lows (secondary). Today is the default
  // highlight, but a selected day overrides it via TempChart's selectedIdx.
  const highs = daily.time.map((d, i) => ({
    temp: convertTemp(daily.temperature_2m_max[i], units),
    label: fmtDay(d, timezone, i),
    icon: wxInfo(daily.weather_code[i]).icon,
    highlight: i === 0,
    sublabel: ((daily.precipitation_probability_max || [])[i] >= 30)
      ? `${(daily.precipitation_probability_max || [])[i]}%`
      : "",
    sublabelColor: "#7dd3fc",
  }));
  const lows = daily.time.map((d, i) => ({
    temp: convertTemp(daily.temperature_2m_min[i], units),
    icon: wxInfo(daily.weather_code[i]).icon,
  }));

  return (
    <div className="px-5 mt-4 mb-6">
      <div className="text-xs uppercase tracking-[0.2em] opacity-75 mb-2 px-1">
        8-Day Forecast
        <span className="ml-2 normal-case tracking-normal opacity-60">· tap a day for details</span>
      </div>
      <div className="glass rounded-2xl py-2 overflow-x-auto no-scrollbar">
        <TempChart
          points={highs}
          secondary={lows}
          units={units}
          height={230}
          colWidth={72}
          padTop={36}
          padBottom={70}
          selectedIdx={selectedIdx}
          onPointClick={onSelect}
        />
      </div>

      <DailyDetail data={data} units={units} idx={selectedIdx ?? 0} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   App
--------------------------------------------------------------------------- */

function App() {
  const [place, setPlace]       = useState({ name: "Longueuil, Quebec", country: "CA", lat: 45.5312, lon: -73.5183 });
  const [data,  setData]        = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [query, setQuery]       = useState("");
  const [fetchedAt, setFetchedAt]             = useState(null);
  const [selectedHourIdx, setSelectedHourIdx] = useState(null); // null = "Now"
  const [selectedDayIdx,  setSelectedDayIdx]  = useState(0);    // 0 = Today
  const [units, setUnits]       = useState(() => {
    try { return localStorage.getItem("cleanweather.units") || "metric"; }
    catch { return "metric"; }
  });

  // Persist unit choice
  useEffect(() => {
    try { localStorage.setItem("cleanweather.units", units); } catch {}
  }, [units]);

  // Load forecast whenever place or units change. Reset selections too.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedHourIdx(null);
    setSelectedDayIdx(0);
    fetchForecast(place.lat, place.lon)
      .then(d => { if (!cancelled) { setData(d); setFetchedAt(new Date()); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [place.lat, place.lon]);

  // Find the index in hourly arrays that corresponds to "now" (absolute, not the slice).
  const nowAbsIdx = useMemo(() => {
    if (!data) return 0;
    const prefix = (data.current.time || "").slice(0, 13);
    const idx = data.hourly.time.findIndex(t => t.startsWith(prefix));
    return idx < 0 ? 0 : idx;
  }, [data]);

  // Either the live current, or a synthetic snapshot at the selected hour.
  const displayCurrent = useMemo(() => {
    if (!data) return null;
    if (selectedHourIdx == null) return data.current;
    const abs = nowAbsIdx + selectedHourIdx;
    const h = data.hourly;
    return {
      time: h.time[abs],
      temperature_2m: h.temperature_2m[abs],
      apparent_temperature: h.apparent_temperature?.[abs] ?? data.current.apparent_temperature,
      relative_humidity_2m: h.relative_humidity_2m?.[abs] ?? data.current.relative_humidity_2m,
      weather_code: h.weather_code[abs],
      wind_speed_10m: h.wind_speed_10m?.[abs] ?? data.current.wind_speed_10m,
      uv_index: h.uv_index?.[abs] ?? null,
      is_day: h.is_day?.[abs] ?? data.current.is_day,
      __selected: true,
    };
  }, [data, selectedHourIdx, nowAbsIdx]);

  // View-data swaps the current section's source.
  const viewData = useMemo(() => {
    if (!data) return null;
    return { ...data, current: displayCurrent };
  }, [data, displayCurrent]);

  const handleSearch = async (q) => {
    if (!q?.trim()) return;
    try {
      const results = await geocodeCity(q);
      if (!results.length) { setError(`No matches for "${q}"`); return; }
      const r = results[0];
      setPlace({
        name: r.name + (r.admin1 ? `, ${r.admin1}` : ""),
        country: r.country_code,
        lat: r.latitude,
        lon: r.longitude,
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) { setError("Geolocation not available"); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setPlace({ name: "Current location", country: "", lat: latitude, lon: longitude });
      try {
        const geo = await reverseGeocode(latitude, longitude);
        if (geo) setPlace(prev => ({ ...prev, name: geo.name, country: geo.country }));
      } catch {}
    }, (err) => setError(err.message), { timeout: 8000 });
  };

  // Gradient (thresholds calibrated in °F)
  const gradient = useMemo(() => {
    if (!viewData) return ["#3a6fb5", "#9bc9e8", "#1d3f73"];
    const c = viewData.current;
    const tF = toF(c.temperature_2m);
    const g = wxInfo(c.weather_code).group;
    const isDay = !!c.is_day;
    return gradientFor(tF, g, isDay);
  }, [viewData, units]);

  const bgStyle = {
    backgroundImage: `linear-gradient(160deg, ${gradient[0]} 0%, ${gradient[1]} 50%, ${gradient[2]} 100%)`,
  };

  return (
    <div className="min-h-screen bg-anim relative" style={bgStyle}>
      <div className="max-w-2xl mx-auto pb-10 relative">
        <TopBar
          place={place}
          query={query}
          setQuery={setQuery}
          onSearch={handleSearch}
          onLocate={handleLocate}
        />

        {error && (
          <div className="mx-5 mt-2 glass rounded-xl px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-24 opacity-80">
            Loading forecast…
          </div>
        ) : data ? (
          <>
            <CurrentSection data={viewData} units={units} onClearSelection={() => setSelectedHourIdx(null)} />
            <StatGrid data={viewData} units={units} />
            <HourlyStrip
              data={data}
              units={units}
              selectedIdx={selectedHourIdx}
              onSelect={(i) => setSelectedHourIdx(prev => prev === i ? null : i)}
            />
            <DailyList
              data={data}
              units={units}
              selectedIdx={selectedDayIdx}
              onSelect={(i) => setSelectedDayIdx(i)}
            />

            {/* Unit toggle */}
            <div className="flex justify-center mt-6 px-5">
              <div className="glass rounded-full p-1 flex items-center text-sm">
                <button
                  onClick={() => setUnits("metric")}
                  className={`px-4 py-1.5 rounded-full transition ${
                    units === "metric" ? "bg-white/25 font-medium" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  °C
                </button>
                <button
                  onClick={() => setUnits("imperial")}
                  className={`px-4 py-1.5 rounded-full transition ${
                    units === "imperial" ? "bg-white/25 font-medium" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  °F
                </button>
              </div>
            </div>

            <div className="text-center text-[11px] opacity-60 px-5 mt-3">
              Data by Open-Meteo · Refreshed {fetchedAt ? fetchedAt.toLocaleTimeString() : "…"}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
