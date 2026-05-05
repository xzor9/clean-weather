# Clean Weather

A minimalist weather app inspired by Mercury Weather. Real forecasts powered by [Open-Meteo](https://open-meteo.com/), rendered with smooth temperature charts, gradient backgrounds that shift with the conditions, and a per-day detail view.

## Features

- **Current conditions** with a large temperature, condition icon, and dynamic gradient background that adapts to temperature, weather group, and time of day.
- **24-hour line chart** — tap any hour to preview the forecast for that time. The hero section, stats, and gradient all update.
- **8-day line chart** with separate lines for highs and lows. Tap any day to open a detail panel below with feels-like, precipitation amount and chance, wind speed/gusts/direction, max UV, and sunrise/sunset times.
- **Stat grid** showing feels like, humidity, wind, and UV index.
- **City search and geolocation** via Open-Meteo's geocoding API.
- **°C / °F toggle** with the choice persisted across reloads.

## Tech

- React 18 (loaded from a CDN, no build step)
- Tailwind CSS (CDN)
- Babel Standalone for in-browser JSX transpilation
- SVG charts and icons (no chart library)
- [Open-Meteo](https://open-meteo.com/) — free weather API, no key required

## Project structure

```
clean-weather/
├── index.html     # Entry point: loads React/Tailwind/Babel and the app
├── styles.css     # Global styles and custom utility classes
├── app.jsx        # The full React app: components, API helpers, charts
├── README.md
└── LICENSE
```

## Running it locally

Because the app loads `app.jsx` via a `<script src>` tag and Babel transpiles it in the browser, you need to serve the files over HTTP (browsers block local file fetches over `file://`).

Pick whichever you have handy:

```bash
# Python (built in on macOS / most Linux):
python3 -m http.server 8000

# Node:
npx serve

# VS Code:
# Install the "Live Server" extension, then right-click index.html → "Open with Live Server"
```

Then open `http://localhost:8000` in your browser.

## Credits

- Weather data: [Open-Meteo](https://open-meteo.com/)
- Design inspiration: [Mercury Weather](https://mercuryweather.app/)

## License

[MIT](LICENSE)
