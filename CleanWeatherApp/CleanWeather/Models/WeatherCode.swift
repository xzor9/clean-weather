import SwiftUI

struct WeatherCodeInfo {
    let label: String
    let sfSymbol: String
    let group: WeatherGroup
}

enum WeatherGroup {
    case clear, partlyCloudy, cloudy, fog, drizzle, rain, snow, thunderstorm
}

let weatherCodeMap: [Int: WeatherCodeInfo] = [
    0:  WeatherCodeInfo(label: "Clear Sky",          sfSymbol: "sun.max.fill",                group: .clear),
    1:  WeatherCodeInfo(label: "Mostly Clear",        sfSymbol: "sun.max.fill",                group: .clear),
    2:  WeatherCodeInfo(label: "Partly Cloudy",       sfSymbol: "cloud.sun.fill",              group: .partlyCloudy),
    3:  WeatherCodeInfo(label: "Overcast",            sfSymbol: "cloud.fill",                  group: .cloudy),
    45: WeatherCodeInfo(label: "Foggy",               sfSymbol: "cloud.fog.fill",              group: .fog),
    48: WeatherCodeInfo(label: "Icy Fog",             sfSymbol: "cloud.fog.fill",              group: .fog),
    51: WeatherCodeInfo(label: "Light Drizzle",       sfSymbol: "cloud.drizzle.fill",          group: .drizzle),
    53: WeatherCodeInfo(label: "Drizzle",             sfSymbol: "cloud.drizzle.fill",          group: .drizzle),
    55: WeatherCodeInfo(label: "Heavy Drizzle",       sfSymbol: "cloud.drizzle.fill",          group: .drizzle),
    61: WeatherCodeInfo(label: "Light Rain",          sfSymbol: "cloud.rain.fill",             group: .rain),
    63: WeatherCodeInfo(label: "Rain",                sfSymbol: "cloud.rain.fill",             group: .rain),
    65: WeatherCodeInfo(label: "Heavy Rain",          sfSymbol: "cloud.heavyrain.fill",        group: .rain),
    71: WeatherCodeInfo(label: "Light Snow",          sfSymbol: "cloud.snow.fill",             group: .snow),
    73: WeatherCodeInfo(label: "Snow",                sfSymbol: "cloud.snow.fill",             group: .snow),
    75: WeatherCodeInfo(label: "Heavy Snow",          sfSymbol: "cloud.snow.fill",             group: .snow),
    77: WeatherCodeInfo(label: "Snow Grains",         sfSymbol: "cloud.snow.fill",             group: .snow),
    80: WeatherCodeInfo(label: "Light Showers",       sfSymbol: "cloud.sun.rain.fill",         group: .rain),
    81: WeatherCodeInfo(label: "Showers",             sfSymbol: "cloud.rain.fill",             group: .rain),
    82: WeatherCodeInfo(label: "Heavy Showers",       sfSymbol: "cloud.heavyrain.fill",        group: .rain),
    85: WeatherCodeInfo(label: "Snow Showers",        sfSymbol: "cloud.snow.fill",             group: .snow),
    86: WeatherCodeInfo(label: "Heavy Snow Showers",  sfSymbol: "cloud.snow.fill",             group: .snow),
    95: WeatherCodeInfo(label: "Thunderstorm",        sfSymbol: "cloud.bolt.fill",             group: .thunderstorm),
    96: WeatherCodeInfo(label: "Thunderstorm w/ Hail",sfSymbol: "cloud.bolt.rain.fill",        group: .thunderstorm),
    99: WeatherCodeInfo(label: "Thunderstorm w/ Hail",sfSymbol: "cloud.bolt.rain.fill",        group: .thunderstorm),
]

func weatherInfo(for code: Int) -> WeatherCodeInfo {
    weatherCodeMap[code] ?? WeatherCodeInfo(label: "Unknown", sfSymbol: "questionmark.circle", group: .cloudy)
}
