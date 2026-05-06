import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Entry
struct WeatherEntry: TimelineEntry {
    let date: Date
    let temperature: Double
    let feelsLike: Double
    let weatherCode: Int
    let isDay: Bool
    let locationName: String
    let tempMax: Double
    let tempMin: Double
    let useCelsius: Bool
}

// MARK: - Provider
struct WeatherProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: .now, temperature: 22, feelsLike: 21, weatherCode: 0,
                     isDay: true, locationName: "San Francisco",
                     tempMax: 25, tempMin: 16, useCelsius: true)
    }

    func snapshot(for configuration: WeatherConfiguration, in context: Context) async -> WeatherEntry {
        await fetchEntry(configuration: configuration) ?? placeholder(in: context)
    }

    func timeline(for configuration: WeatherConfiguration, in context: Context) async -> Timeline<WeatherEntry> {
        if let entry = await fetchEntry(configuration: configuration) {
            return Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(30 * 60)))
        }
        return Timeline(entries: [placeholder(in: context)], policy: .after(.now.addingTimeInterval(15 * 60)))
    }

    private func fetchEntry(configuration: WeatherConfiguration) async -> WeatherEntry? {
        // Read last known coordinates from shared UserDefaults (app group)
        let defaults = UserDefaults(suiteName: "group.com.cleanweather.shared")
        let lat = defaults?.double(forKey: "latitude")  ?? 37.7749
        let lon = defaults?.double(forKey: "longitude") ?? -122.4194
        let name = defaults?.string(forKey: "locationName") ?? "My Location"
        let useCelsius = defaults?.bool(forKey: "useCelsius") ?? true

        guard let weather = try? await WeatherService.shared.fetchWeather(lat: lat, lon: lon, useCelsius: useCelsius) else {
            return nil
        }
        let cur = weather.current
        let today = weather.daily.first
        return WeatherEntry(
            date: .now,
            temperature: cur.temperature,
            feelsLike: cur.feelsLike,
            weatherCode: cur.weatherCode,
            isDay: cur.isDay,
            locationName: name,
            tempMax: today?.tempMax ?? cur.temperature,
            tempMin: today?.tempMin ?? cur.temperature,
            useCelsius: useCelsius
        )
    }
}

// MARK: - Intent
struct WeatherConfiguration: AppIntent, WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Weather Widget"
    static var description = IntentDescription("Shows current weather conditions.")
}

// MARK: - Views
struct WeatherWidgetEntryView: View {
    let entry: WeatherEntry
    @Environment(\.widgetFamily) var family

    private var info: WeatherCodeInfo { weatherInfo(for: entry.weatherCode) }
    private var unit: String { entry.useCelsius ? "°C" : "°F" }
    private var celsius: Double { entry.useCelsius ? entry.temperature : (entry.temperature - 32) * 5 / 9 }
    private var grad: [Color] { gradientColors(for: celsius, group: info.group, isDay: entry.isDay, useCelsius: true) }

    var body: some View {
        switch family {
        case .systemSmall:   smallView
        case .systemMedium:  mediumView
        case .systemLarge:   largeView
        case .accessoryCircular: accessoryCircular
        case .accessoryRectangular: accessoryRectangular
        case .accessoryInline: accessoryInline
        default: smallView
        }
    }

    private var smallView: some View {
        ZStack {
            LinearGradient(colors: grad, startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(alignment: .leading, spacing: 4) {
                Image(systemName: info.sfSymbol)
                    .symbolRenderingMode(.multicolor)
                    .font(.system(size: 28))
                Spacer()
                Text("\(Int(entry.temperature.rounded()))\(unit)")
                    .font(.system(size: 36, weight: .thin, design: .rounded))
                    .foregroundStyle(.white)
                Text(entry.locationName)
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1)
                Text("H:\(Int(entry.tempMax.rounded()))° L:\(Int(entry.tempMin.rounded()))°")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .padding(14)
        }
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var mediumView: some View {
        ZStack {
            LinearGradient(colors: grad, startPoint: .topLeading, endPoint: .bottomTrailing)
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.locationName)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white.opacity(0.8))
                        .lineLimit(1)
                    Text("\(Int(entry.temperature.rounded()))\(unit)")
                        .font(.system(size: 48, weight: .thin, design: .rounded))
                        .foregroundStyle(.white)
                    Text(info.label)
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.75))
                }
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: info.sfSymbol)
                        .symbolRenderingMode(.multicolor)
                        .font(.system(size: 40))
                    Text("H:\(Int(entry.tempMax.rounded()))°  L:\(Int(entry.tempMin.rounded()))°")
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.65))
                    Text("Feels \(Int(entry.feelsLike.rounded()))\(unit)")
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.55))
                }
            }
            .padding(16)
        }
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var largeView: some View {
        ZStack {
            LinearGradient(colors: grad, startPoint: .top, endPoint: .bottom)
            VStack(spacing: 0) {
                mediumView
                    .frame(height: 160)
                Divider().background(.white.opacity(0.2))
                VStack(spacing: 12) {
                    HStack {
                        WidgetStatCell(icon: "humidity.fill",    label: "Humidity",   value: "--")
                        WidgetStatCell(icon: "wind",             label: "Wind",       value: "--")
                        WidgetStatCell(icon: "sun.max.fill",     label: "UV",         value: "--")
                    }
                }
                .padding(16)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    // Lock screen / Always On
    private var accessoryCircular: some View {
        VStack(spacing: 1) {
            Image(systemName: info.sfSymbol).font(.system(size: 14))
            Text("\(Int(entry.temperature.rounded()))°").font(.system(size: 14, weight: .semibold))
        }
    }

    private var accessoryRectangular: some View {
        HStack(spacing: 8) {
            Image(systemName: info.sfSymbol).font(.system(size: 22))
            VStack(alignment: .leading, spacing: 1) {
                Text("\(Int(entry.temperature.rounded()))\(unit)  \(info.label)")
                    .font(.system(size: 13, weight: .medium))
                Text("H:\(Int(entry.tempMax.rounded()))°  L:\(Int(entry.tempMin.rounded()))°")
                    .font(.system(size: 11))
            }
        }
    }

    private var accessoryInline: some View {
        Label("\(Int(entry.temperature.rounded()))\(unit) · \(info.label)", systemImage: info.sfSymbol)
            .font(.system(size: 12))
    }
}

private struct WidgetStatCell: View {
    let icon: String
    let label: String
    let value: String
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon).symbolRenderingMode(.multicolor).font(.system(size: 18))
            Text(label).font(.system(size: 10)).foregroundStyle(.white.opacity(0.6))
            Text(value).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Widget Bundle
@main
struct CleanWeatherWidgetBundle: WidgetBundle {
    var body: some Widget {
        CleanWeatherWidget()
    }
}

struct CleanWeatherWidget: Widget {
    let kind = "CleanWeatherWidget"
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: WeatherConfiguration.self, provider: WeatherProvider()) { entry in
            WeatherWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Clean Weather")
        .description("Current conditions at a glance.")
        .supportedFamilies([
            .systemSmall, .systemMedium, .systemLarge,
            .accessoryCircular, .accessoryRectangular, .accessoryInline
        ])
    }
}
