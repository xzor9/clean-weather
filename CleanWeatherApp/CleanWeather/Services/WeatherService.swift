import Foundation
import CoreLocation

actor WeatherService {
    static let shared = WeatherService()

    func fetchWeather(lat: Double, lon: Double, useCelsius: Bool) async throws -> WeatherData {
        let unit = useCelsius ? "celsius" : "fahrenheit"
        var components = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        components.queryItems = [
            URLQueryItem(name: "latitude",              value: "\(lat)"),
            URLQueryItem(name: "longitude",             value: "\(lon)"),
            URLQueryItem(name: "current",               value: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,uv_index,weather_code,is_day"),
            URLQueryItem(name: "hourly",                value: "temperature_2m,weather_code,is_day,precipitation_probability"),
            URLQueryItem(name: "daily",                 value: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset"),
            URLQueryItem(name: "temperature_unit",      value: unit),
            URLQueryItem(name: "wind_speed_unit",       value: "mph"),
            URLQueryItem(name: "timezone",              value: "auto"),
            URLQueryItem(name: "forecast_days",         value: "8"),
            URLQueryItem(name: "forecast_hours",        value: "24"),
        ]
        let (data, _) = try await URLSession.shared.data(from: components.url!)
        return try parseWeather(data: data)
    }

    func searchLocations(query: String) async throws -> [GeocodingResult] {
        var components = URLComponents(string: "https://geocoding-api.open-meteo.com/v1/search")!
        components.queryItems = [
            URLQueryItem(name: "name",    value: query),
            URLQueryItem(name: "count",   value: "8"),
            URLQueryItem(name: "language",value: "en"),
            URLQueryItem(name: "format",  value: "json"),
        ]
        let (data, _) = try await URLSession.shared.data(from: components.url!)
        struct Response: Decodable { let results: [GeocodingResult]? }
        let decoded = try JSONDecoder().decode(Response.self, from: data)
        return decoded.results ?? []
    }

    private func parseWeather(data: Data) throws -> WeatherData {
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        let tz = json["timezone"] as? String ?? "auto"
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoBasic = ISO8601DateFormatter()
        isoBasic.formatOptions = [.withFullDate, .withTime, .withColonSeparatorInTime]

        func parseDate(_ str: String) -> Date {
            iso.date(from: str) ?? isoBasic.date(from: str) ?? Date()
        }

        // Current
        let cur = json["current"] as! [String: Any]
        let current = CurrentWeather(
            temperature:  cur["temperature_2m"]        as! Double,
            feelsLike:    cur["apparent_temperature"]  as! Double,
            humidity:     cur["relative_humidity_2m"]  as! Int,
            windSpeed:    cur["wind_speed_10m"]         as! Double,
            uvIndex:      cur["uv_index"]               as! Double,
            weatherCode:  cur["weather_code"]           as! Int,
            isDay:        (cur["is_day"] as! Int) == 1,
            time:         parseDate(cur["time"] as! String)
        )

        // Hourly
        let hourly = json["hourly"] as! [String: Any]
        let hTimes  = hourly["time"]                     as! [String]
        let hTemps  = hourly["temperature_2m"]            as! [Double]
        let hCodes  = hourly["weather_code"]              as! [Int]
        let hIsDay  = hourly["is_day"]                    as! [Int]
        let hPrecip = hourly["precipitation_probability"] as! [Int]

        let hourlyWeather = zip(hTimes.indices, hTimes).map { i, t in
            HourlyWeather(
                time: parseDate(t),
                temperature: hTemps[i],
                weatherCode: hCodes[i],
                isDay: hIsDay[i] == 1,
                precipitationProbability: hPrecip[i]
            )
        }

        // Daily
        let daily  = json["daily"] as! [String: Any]
        let dDates   = daily["time"]                            as! [String]
        let dMax     = daily["temperature_2m_max"]              as! [Double]
        let dMin     = daily["temperature_2m_min"]              as! [Double]
        let dCodes   = daily["weather_code"]                    as! [Int]
        let dPrecip  = daily["precipitation_probability_max"]   as! [Int]
        let dWind    = daily["wind_speed_10m_max"]              as! [Double]
        let dUV      = daily["uv_index_max"]                    as! [Double]
        let dFLMax   = daily["apparent_temperature_max"]        as! [Double]
        let dFLMin   = daily["apparent_temperature_min"]        as! [Double]
        let dSunrise = daily["sunrise"]                         as! [String]
        let dSunset  = daily["sunset"]                          as! [String]

        let dailyWeather = dDates.indices.map { i in
            DailyWeather(
                date:                    parseDate(dDates[i]),
                tempMax:                 dMax[i],
                tempMin:                 dMin[i],
                weatherCode:             dCodes[i],
                precipitationProbability:dPrecip[i],
                windSpeedMax:            dWind[i],
                uvIndexMax:              dUV[i],
                feelsLikeMax:            dFLMax[i],
                feelsLikeMin:            dFLMin[i],
                sunrise:                 parseDate(dSunrise[i]),
                sunset:                  parseDate(dSunset[i])
            )
        }

        return WeatherData(current: current, hourly: hourlyWeather, daily: dailyWeather, timezone: tz)
    }
}
