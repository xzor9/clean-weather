import SwiftUI

struct WatchContentView: View {
    @EnvironmentObject var store: WatchWeatherStore

    private var grad: [Color] {
        guard let w = store.weather else { return [.blue, .indigo] }
        let info = weatherInfo(for: w.current.weatherCode)
        let celsius = store.useCelsius ? w.current.temperature : (w.current.temperature - 32) * 5 / 9
        return gradientColors(for: celsius, group: info.group, isDay: w.current.isDay, useCelsius: true)
    }

    var body: some View {
        if store.isLoading {
            ProgressView().tint(.white)
        } else if let weather = store.weather {
            TabView {
                WatchCurrentView(weather: weather.current)
                WatchHourlyView(hourly: Array(weather.hourly.prefix(12)))
                WatchDailyView(daily: Array(weather.daily.prefix(5)))
            }
            .tabViewStyle(.verticalPage)
            .background(
                LinearGradient(colors: grad, startPoint: .top, endPoint: .bottom)
                    .ignoresSafeArea()
            )
        } else {
            VStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle").foregroundStyle(.yellow)
                Text(store.error ?? "No data").font(.caption2).multilineTextAlignment(.center)
                Button("Retry") { Task { await store.loadWeather() } }
            }
        }
    }
}

struct WatchCurrentView: View {
    let weather: CurrentWeather
    @EnvironmentObject var store: WatchWeatherStore

    var body: some View {
        let info = weatherInfo(for: weather.weatherCode)
        let unit = store.useCelsius ? "°" : "°F"
        VStack(spacing: 6) {
            Image(systemName: info.sfSymbol)
                .symbolRenderingMode(.multicolor)
                .font(.system(size: 28))
            Text("\(Int(weather.temperature.rounded()))\(unit)")
                .font(.system(size: 42, weight: .thin, design: .rounded))
                .foregroundStyle(.white)
            Text(info.label)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.75))
            HStack(spacing: 12) {
                Label("\(weather.humidity)%", systemImage: "humidity.fill")
                Label("\(Int(weather.windSpeed.rounded()))", systemImage: "wind")
            }
            .font(.caption2)
            .foregroundStyle(.white.opacity(0.65))
        }
    }
}

struct WatchHourlyView: View {
    let hourly: [HourlyWeather]
    @EnvironmentObject var store: WatchWeatherStore

    var body: some View {
        let unit = store.useCelsius ? "°" : "°F"
        ScrollView {
            VStack(spacing: 4) {
                Text("Hourly")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(hourly) { h in
                    HStack {
                        Text(hourLabel(h.time))
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.7))
                            .frame(width: 38, alignment: .leading)
                        Image(systemName: weatherInfo(for: h.weatherCode).sfSymbol)
                            .symbolRenderingMode(.multicolor)
                            .font(.system(size: 12))
                        Spacer()
                        Text("\(Int(h.temperature.rounded()))\(unit)")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white)
                    }
                    Divider().background(.white.opacity(0.1))
                }
            }
            .padding(.horizontal, 4)
        }
    }

    private func hourLabel(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "ha"
        return f.string(from: date).lowercased()
    }
}

struct WatchDailyView: View {
    let daily: [DailyWeather]
    @EnvironmentObject var store: WatchWeatherStore

    var body: some View {
        let unit = store.useCelsius ? "°" : "°F"
        ScrollView {
            VStack(spacing: 4) {
                Text("Forecast")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(daily.indices, id: \.self) { i in
                    let d = daily[i]
                    HStack {
                        Text(i == 0 ? "Today" : dayLabel(d.date))
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.7))
                            .frame(width: 40, alignment: .leading)
                        Image(systemName: weatherInfo(for: d.weatherCode).sfSymbol)
                            .symbolRenderingMode(.multicolor)
                            .font(.system(size: 12))
                        Spacer()
                        Text("\(Int(d.tempMin.rounded()))\(unit)")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.5))
                        Text("\(Int(d.tempMax.rounded()))\(unit)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    Divider().background(.white.opacity(0.1))
                }
            }
            .padding(.horizontal, 4)
        }
    }

    private func dayLabel(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "EEE"
        return f.string(from: date)
    }
}
