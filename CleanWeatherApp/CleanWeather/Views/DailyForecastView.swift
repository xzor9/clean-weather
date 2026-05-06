import SwiftUI
import Charts

struct DailyForecastView: View {
    @EnvironmentObject var store: WeatherStore

    var body: some View {
        guard let daily = store.weather?.daily, !daily.isEmpty else { return AnyView(EmptyView()) }
        return AnyView(
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    Label("8-Day Forecast", systemImage: "calendar")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.7))
                        .textCase(.uppercase)

                    // Dual-line chart
                    Chart {
                        ForEach(daily.indices, id: \.self) { i in
                            LineMark(x: .value("Day", i), y: .value("High", daily[i].tempMax))
                                .foregroundStyle(.white.opacity(0.85))
                                .interpolationMethod(.catmullRom)
                                .lineStyle(StrokeStyle(lineWidth: 2))
                            LineMark(x: .value("Day", i), y: .value("Low", daily[i].tempMin))
                                .foregroundStyle(.white.opacity(0.4))
                                .interpolationMethod(.catmullRom)
                                .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                        }
                    }
                    .chartXAxis(.hidden)
                    .chartYAxis(.hidden)
                    .frame(height: 60)

                    // Day rows
                    VStack(spacing: 0) {
                        ForEach(daily.indices, id: \.self) { i in
                            let d = daily[i]
                            let selected = store.selectedDayIndex == i
                            VStack(spacing: 0) {
                                HStack {
                                    Text(dayLabel(d.date, isToday: i == 0))
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundStyle(.white)
                                        .frame(width: 80, alignment: .leading)
                                    Image(systemName: weatherInfo(for: d.weatherCode).sfSymbol)
                                        .symbolRenderingMode(.multicolor)
                                        .font(.system(size: 18))
                                    Spacer()
                                    if d.precipitationProbability > 0 {
                                        Text("\(d.precipitationProbability)%")
                                            .font(.system(size: 12))
                                            .foregroundStyle(.cyan.opacity(0.85))
                                            .frame(width: 32)
                                    } else {
                                        Spacer().frame(width: 32)
                                    }
                                    Text("\(Int(d.tempMin.rounded()))°")
                                        .font(.system(size: 15))
                                        .foregroundStyle(.white.opacity(0.5))
                                        .frame(width: 36, alignment: .trailing)
                                    Text("\(Int(d.tempMax.rounded()))°")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(.white)
                                        .frame(width: 36, alignment: .trailing)
                                }
                                .padding(.vertical, 10)
                                .contentShape(Rectangle())
                                .onTapGesture { store.selectedDayIndex = selected ? nil : i }

                                if selected {
                                    DayDetailView(day: d)
                                        .padding(.bottom, 10)
                                }

                                if i < daily.count - 1 {
                                    Divider().background(.white.opacity(0.15))
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
        )
    }

    private func dayLabel(_ date: Date, isToday: Bool) -> String {
        if isToday { return "Today" }
        let f = DateFormatter()
        f.dateFormat = "EEEE"
        return f.string(from: date)
    }
}

private struct DayDetailView: View {
    let day: DailyWeather
    @EnvironmentObject var store: WeatherStore

    var body: some View {
        let unit = store.useCelsius ? "°C" : "°F"
        VStack(spacing: 8) {
            Divider().background(.white.opacity(0.15))
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                DetailCell(icon: "thermometer.medium", label: "Feels Like", value: "\(Int(day.feelsLikeMax.rounded()))/\(Int(day.feelsLikeMin.rounded()))\(unit)")
                DetailCell(icon: "wind",               label: "Wind",       value: "\(Int(day.windSpeedMax.rounded())) mph")
                DetailCell(icon: "sun.max.fill",       label: "UV Index",   value: "\(Int(day.uvIndexMax.rounded()))")
                DetailCell(icon: "drop.fill",          label: "Precip",     value: "\(day.precipitationProbability)%")
                DetailCell(icon: "sunrise.fill",       label: "Sunrise",    value: timeString(day.sunrise))
                DetailCell(icon: "sunset.fill",        label: "Sunset",     value: timeString(day.sunset))
            }
        }
    }

    private func timeString(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeStyle = .short
        return f.string(from: date)
    }
}

private struct DetailCell: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .symbolRenderingMode(.multicolor)
                .font(.system(size: 16))
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(.white.opacity(0.6))
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
    }
}
