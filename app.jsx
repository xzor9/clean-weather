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

async function fetchAllergies(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: "alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen",
    timezone: "auto",
    forecast_days: 4,
  });
  const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
  if (!r.ok) return null;
  const j = await r.json();
  return j?.hourly?.time ? j : null;
}

async function fetchWeatherBundle(lat, lon) {
  const [forecast, allergies] = await Promise.all([
    fetchForecast(lat, lon),
    fetchAllergies(lat, lon).catch(() => null),
  ]);
  return { ...forecast, allergies };
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
// Daytime palettes are weather-toned; night palettes stay dark.
function gradientFor(temp, group, isDay) {
  // Night → deep indigos and near-blacks
  if (!isDay) {
    if (group === "storm") return ["#160a2e", "#241247", "#06040f"];
    if (group === "rain")  return ["#0e1a33", "#1a2a4d", "#05080f"];
    if (group === "snow")  return ["#15243a", "#27395a", "#0a1020"];
    if (group === "fog")   return ["#181b24", "#2a2e3a", "#0a0c12"];
    if (group === "cloud") return ["#101520", "#1c2430", "#080c14"];
    if (group === "partly")return ["#0c1838", "#182448", "#060c20"];
    return                 ["#080e30", "#121c48", "#040818"]; // clear night
  }
  // Daytime — weather-toned colours (dark enough to keep white text readable)
  if (group === "storm")  return ["#2d2d3a", "#434355", "#1e1e28"]; // dark purple-grey
  if (group === "rain")   return ["#263238", "#37474f", "#1a2428"]; // slate grey-blue
  if (group === "snow")   return ["#2a4a6a", "#4a7090", "#1a3050"]; // icy blue-grey
  if (group === "fog")    return ["#4a5060", "#6a7080", "#303540"]; // muted grey
  if (group === "cloud")  return ["#455a64", "#607d8b", "#2c3e47"]; // blue-grey
  if (group === "partly") return ["#1565c0", "#42a5f5", "#0d47a1"]; // partly-sunny blue
  // clear sky — temperature-based sky colours
  if (temp >= 90) return ["#bf360c", "#e64a19", "#870000"]; // scorching orange
  if (temp >= 75) return ["#0277bd", "#29b6f6", "#01579b"]; // bright warm sky
  if (temp >= 60) return ["#1565c0", "#1e88e5", "#0d47a1"]; // classic sky blue
  if (temp >= 40) return ["#1a3a6a", "#2a5a9a", "#0e2550"]; // cool clear blue
  return                  ["#283593", "#3949ab", "#1a237e"]; // cold indigo
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
    case "allergy":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M12 20V9" />
          <path d="M12 15c-4.5 0-7-2.7-7-7 4.3 0 7 2.4 7 7z" />
          <path d="M12 12c4.5 0 7-2.7 7-7-4.3 0-7 2.4-7 7z" />
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

function parseLocalDateTime(iso) {
  if (!iso) return null;
  const [date, time = "00:00"] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  return { y, m, d, hh, mm };
}

function localAsUtcDate(iso) {
  const p = parseLocalDateTime(iso);
  return p ? new Date(Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm)) : null;
}

function fmtHour(iso) {
  const p = parseLocalDateTime(iso);
  if (!p) return "—";
  const h = p.hh % 12 || 12;
  return `${h} ${p.hh < 12 ? "AM" : "PM"}`;
}

function fmtPreviewTime(iso) {
  const d = localAsUtcDate(iso);
  return d
    ? d.toLocaleString("en-US", { weekday: "short", hour: "numeric", hour12: true, timeZone: "UTC" })
    : "—";
}

function fmtDay(iso, idx) {
  if (idx === 0) return "Today";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function fmtTime(iso) {
  if (!iso) return "—";
  const p = parseLocalDateTime(iso);
  if (!p) return "—";
  const h = p.hh % 12 || 12;
  return `${h}:${String(p.mm).padStart(2, "0")} ${p.hh < 12 ? "AM" : "PM"}`;
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

function dayIndexForTime(daily, iso) {
  const day = iso?.slice(0, 10);
  const idx = daily?.time?.findIndex(d => d === day) ?? -1;
  return idx >= 0 ? idx : 0;
}

const POLLEN_TYPES = [
  { key: "alder_pollen", label: "Alder" },
  { key: "birch_pollen", label: "Birch" },
  { key: "grass_pollen", label: "Grass" },
  { key: "mugwort_pollen", label: "Mugwort" },
  { key: "olive_pollen", label: "Olive" },
  { key: "ragweed_pollen", label: "Ragweed" },
];

function allergyLevel(value) {
  if (value == null) return { label: "Unavailable", sub: "No pollen data", value: "—" };
  if (value < 1) return { label: "Low", sub: "Minimal pollen", value: "Low" };
  if (value < 20) return { label: "Moderate", sub: `${Math.round(value)} grains/m³`, value: "Mod" };
  if (value < 80) return { label: "High", sub: `${Math.round(value)} grains/m³`, value: "High" };
  return { label: "Very High", sub: `${Math.round(value)} grains/m³`, value: "Very" };
}

function allergySummary(allergies, day) {
  const hourly = allergies?.hourly;
  if (!hourly?.time?.length || !day) {
    return null;
  }

  let top = null;
  for (const type of POLLEN_TYPES) {
    const values = hourly.time
      .map((t, i) => t.startsWith(day) ? hourly[type.key]?.[i] : null)
      .filter(v => typeof v === "number" && Number.isFinite(v));
    if (!values.length) continue;
    const max = Math.max(...values);
    if (!top || max > top.max) top = { ...type, max };
  }

  if (!top) return null;
  const level = allergyLevel(top.max);
  return {
    value: level.value,
    sub: `${level.label} · ${top.label} ${level.sub.toLowerCase()}`,
  };
}

/* ---------------------------------------------------------------------------
   UI Components
--------------------------------------------------------------------------- */

function UnitToggle({ units, setUnits }) {
  return (
    <div className="glass rounded-full p-1 flex items-center text-sm shrink-0" role="group" aria-label="Temperature units">
      <button
        type="button"
        onClick={() => setUnits("metric")}
        className={`min-h-10 px-4 rounded-full transition ${
          units === "metric" ? "bg-white/25 font-medium" : "opacity-75 hover:opacity-100"
        }`}
        aria-pressed={units === "metric"}
      >
        °C
      </button>
      <button
        type="button"
        onClick={() => setUnits("imperial")}
        className={`min-h-10 px-4 rounded-full transition ${
          units === "imperial" ? "bg-white/25 font-medium" : "opacity-75 hover:opacity-100"
        }`}
        aria-pressed={units === "imperial"}
      >
        °F
      </button>
    </div>
  );
}

function TopBar({ place, onSearch, onLocate, query, setQuery, units, setUnits, locating }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-3">
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onLocate}
          title="Use my location"
          aria-label="Use my location"
          disabled={locating}
          className="icon-btn"
        >
          <Icon name="location" className="w-5 h-5" />
        </button>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="text-xs sm:text-sm uppercase tracking-[0.2em] opacity-75 truncate">{place?.country || " "}</div>
          <div className="text-xl sm:text-2xl font-semibold leading-tight truncate">{place?.name || "—"}</div>
        </div>

        <div className="hidden sm:block">
          <UnitToggle units={units} setUnits={setUnits} />
        </div>

        <button
          type="button"
          onClick={() => { if (open) setQuery(""); setOpen(o => !o); }}
          title="Search city"
          aria-label="Search city"
          className="icon-btn"
          aria-expanded={open}
        >
          <Icon name="search" className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-20 px-4 sm:px-6 lg:px-8 z-20">
          <form
            onSubmit={(e) => { e.preventDefault(); onSearch(query); setOpen(false); }}
            className="glass-strong search-panel mx-auto max-w-2xl p-2 flex items-center gap-2"
          >
            <Icon name="search" className="w-5 h-5 ml-2 opacity-80" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city"
              className="min-h-11 flex-1 bg-transparent outline-none placeholder-white/60 px-1"
            />
            <button type="submit" className="min-h-11 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-medium">Go</button>
          </form>
        </div>
      )}
    </header>
  );
}

function CurrentSection({ data, units, onClearSelection }) {
  if (!data) return null;
  const { current, daily } = data;
  const info = wxInfo(current.weather_code);
  const dayIdx = current.__dayIdx ?? dayIndexForTime(daily, current.time);
  const hi = round(convertTemp(daily.temperature_2m_max[dayIdx], units));
  const lo = round(convertTemp(daily.temperature_2m_min[dayIdx], units));
  const isPreview = !!current.__selected;
  const previewLabel = isPreview ? fmtPreviewTime(current.time) : null;
  return (
    <section className="px-4 sm:px-6 lg:px-0 pt-2 pb-4 text-center lg:text-left fade-in">
      {isPreview && (
        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex items-center gap-1.5 glass rounded-full min-h-9 px-3 text-xs mb-3 hover:bg-white/15 transition"
        >
          <span className="opacity-90">Previewing {previewLabel}</span>
          <span className="opacity-70">×</span>
        </button>
      )}
      <Icon name={info.icon} className="w-14 h-14 sm:w-16 sm:h-16 mx-auto lg:mx-0 opacity-95" />
      <div className="hero-temp leading-none font-extralight num mt-2">
        {round(convertTemp(current.temperature_2m, units))}°
      </div>
      <div className="text-lg opacity-95">{info.label}</div>
      <div className="text-sm opacity-80 mt-1 num">
        H: {hi}°  ·  L: {lo}°  ·  Feels {round(convertTemp(current.apparent_temperature, units))}°
      </div>
    </section>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="glass stat-card flex flex-col items-center lg:items-start text-center lg:text-left min-w-0">
      <div className="flex items-center gap-1.5 opacity-80 text-[11px] sm:text-xs uppercase tracking-wider">
        <Icon name={icon} className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-medium num mt-1 truncate max-w-full">{value}</div>
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
    <div className="px-4 sm:px-6 lg:px-0 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
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
  const { hourly, current } = data;
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
      label: i === 0 ? "Now" : fmtHour(t),
      sublabel,
      sublabelColor,
      icon: info.icon,
      highlight: i === 0,
    };
  });

  return (
    <section className="forecast-section">
      <div className="section-title">
        Hourly Forecast
        <span className="ml-2 normal-case tracking-normal opacity-60">tap to preview</span>
      </div>
      <div className="glass chart-shell overflow-x-auto no-scrollbar">
        <TempChart
          points={points}
          units={units}
          height={170}
          colWidth={64}
          selectedIdx={selectedIdx}
          onPointClick={onSelect}
        />
      </div>
    </section>
  );
}

function DetailRow({ icon, label, value, sub }) {
  return (
    <div className="glass detail-row flex items-center gap-3">
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
  const { daily } = data;
  const info = wxInfo(daily.weather_code[idx]);
  const date = localAsUtcDate(daily.time[idx] + "T12:00:00");
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
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
  const allergy = allergySummary(data.allergies, daily.time[idx]);

  const uvLabel =
    uv == null ? "—" :
    uv < 3 ? "Low" :
    uv < 6 ? "Moderate" :
    uv < 8 ? "High" :
    uv < 11 ? "Very High" : "Extreme";

  // Daylight length, derived from sunrise/sunset
  let daylight = "—";
  if (sunrise && sunset) {
    const ms = localAsUtcDate(sunset) - localAsUtcDate(sunrise);
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
          {allergy && (
            <DetailRow
              icon="allergy"
              label="Allergies"
              value={allergy.value}
              sub={allergy.sub}
            />
          )}
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
            value={fmtTime(sunrise)}
            sub={`Daylight ${daylight}`}
          />
          <DetailRow
            icon="sun"
            label="Sunset"
            value={fmtTime(sunset)}
            sub={null}
          />
        </div>
      </div>
    </div>
  );
}

function DailyList({ data, units, selectedIdx, onSelect }) {
  if (!data) return null;
  const { daily } = data;

  // Two lines: highs (primary) and lows (secondary). Today is the default
  // highlight, but a selected day overrides it via TempChart's selectedIdx.
  const highs = daily.time.map((d, i) => ({
    temp: convertTemp(daily.temperature_2m_max[i], units),
    label: fmtDay(d, i),
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
    <section className="forecast-section mb-6">
      <div className="section-title">
        8-Day Forecast
        <span className="ml-2 normal-case tracking-normal opacity-60">tap a day for details</span>
      </div>
      <div className="glass chart-shell overflow-x-auto no-scrollbar">
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
    </section>
  );
}

/* ---------------------------------------------------------------------------
   App
--------------------------------------------------------------------------- */

function App() {
  const [place, setPlace]       = useState({ name: "Longueuil, Quebec", country: "CA", lat: 45.5312, lon: -73.5183 });
  const [data,  setData]        = useState(null);
  const [loading, setLoading]   = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError]       = useState(null);
  const [query, setQuery]       = useState("");
  const [fetchedAt, setFetchedAt]             = useState(null);
  const [selectedHourIdx, setSelectedHourIdx] = useState(null); // null = "Now"
  const [selectedDayIdx,  setSelectedDayIdx]  = useState(0);    // 0 = Today
  const locateRequestRef = useRef(0);
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
    fetchWeatherBundle(place.lat, place.lon)
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
    if (abs < 0 || abs >= h.time.length) return data.current;
    const dayIdx = dayIndexForTime(data.daily, h.time[abs]);
    return {
      time: h.time[abs],
      temperature_2m: h.temperature_2m[abs],
      apparent_temperature: h.apparent_temperature?.[abs] ?? data.current.apparent_temperature,
      relative_humidity_2m: h.relative_humidity_2m?.[abs] ?? data.current.relative_humidity_2m,
      weather_code: h.weather_code[abs],
      wind_speed_10m: h.wind_speed_10m?.[abs] ?? data.current.wind_speed_10m,
      uv_index: h.uv_index?.[abs] ?? null,
      is_day: h.is_day?.[abs] ?? data.current.is_day,
      __dayIdx: dayIdx,
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
      locateRequestRef.current += 1;
      setLocating(false);
      setError(null);
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
    const requestId = locateRequestRef.current + 1;
    locateRequestRef.current = requestId;
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setPlace({ name: "Current location", country: "", lat: latitude, lon: longitude });
      try {
        const geo = await reverseGeocode(latitude, longitude);
        if (geo && locateRequestRef.current === requestId) {
          setPlace(prev => (
            prev.lat === latitude && prev.lon === longitude
              ? { ...prev, name: geo.name, country: geo.country }
              : prev
          ));
        }
      } catch {}
      finally {
        if (locateRequestRef.current === requestId) setLocating(false);
      }
    }, (err) => {
      if (locateRequestRef.current === requestId) {
        setError(err.message);
        setLocating(false);
      }
    }, { timeout: 8000 });
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
      <div className="pb-8 sm:pb-12 relative">
        <TopBar
          place={place}
          query={query}
          setQuery={setQuery}
          onSearch={handleSearch}
          onLocate={handleLocate}
          units={units}
          setUnits={setUnits}
          locating={locating}
        />

        {error && (
          <div className="mx-4 sm:mx-6 lg:mx-auto lg:max-w-6xl mt-2 glass rounded-xl px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-24 opacity-80">
            Loading forecast…
          </div>
        ) : data ? (
          <>
            <main className="app-shell">
              <div className="lg:sticky lg:top-5 lg:self-start">
                <CurrentSection data={viewData} units={units} onClearSelection={() => setSelectedHourIdx(null)} />
                <div className="sm:hidden flex justify-center px-4 mb-4">
                  <UnitToggle units={units} setUnits={setUnits} />
                </div>
                <StatGrid data={viewData} units={units} />
                {loading && (
                  <div className="mx-4 sm:mx-6 lg:mx-0 mt-3 text-xs opacity-70 text-center lg:text-left">
                    Updating forecast...
                  </div>
                )}
              </div>
              <div className="min-w-0">
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
              </div>
            </main>

            <div className="text-center text-[11px] opacity-60 px-5 mt-4">
              Data by Open-Meteo · Pollen by CAMS · Refreshed {fetchedAt ? fetchedAt.toLocaleTimeString() : "…"}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
