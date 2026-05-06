import Foundation

struct WeatherData {
    let current: CurrentWeather
    let hourly: [HourlyWeather]
    let daily: [DailyWeather]
    let timezone: String
}

struct CurrentWeather {
    let temperature: Double
    let feelsLike: Double
    let humidity: Int
    let windSpeed: Double
    let uvIndex: Double
    let weatherCode: Int
    let isDay: Bool
    let time: Date
}

struct HourlyWeather: Identifiable {
    let id = UUID()
    let time: Date
    let temperature: Double
    let weatherCode: Int
    let isDay: Bool
    let precipitationProbability: Int
}

struct DailyWeather: Identifiable {
    let id = UUID()
    let date: Date
    let tempMax: Double
    let tempMin: Double
    let weatherCode: Int
    let precipitationProbability: Int
    let windSpeedMax: Double
    let uvIndexMax: Double
    let feelsLikeMax: Double
    let feelsLikeMin: Double
    let sunrise: Date
    let sunset: Date
}

struct GeocodingResult: Identifiable, Decodable {
    let id: Int
    let name: String
    let latitude: Double
    let longitude: Double
    let country: String?
    let admin1: String?

    var displayName: String {
        [name, admin1, country].compactMap { $0 }.joined(separator: ", ")
    }
}
