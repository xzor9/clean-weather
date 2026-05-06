import SwiftUI
import Charts

struct HourlyForecastView: View {
    @EnvironmentObject var store: WeatherStore

    var body: some View {
        guard let hourly = store.weather?.hourly, !hourly.isEmpty else { return AnyView(EmptyView()) }
        return AnyView(
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    Label("Hourly Forecast", systemImage: "clock")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.7))
                        .textCase(.uppercase)

                    // Chart
                    Chart {
                        ForEach(hourly.indices, id: \.self) { i in
                            let h = hourly[i]
                            LineMark(
                                x: .value("Hour", i),
                                y: .value("Temp", h.temperature)
                            )
                            .interpolationMethod(.catmullRom)
                            .foregroundStyle(.white.opacity(0.9))
                            .lineStyle(StrokeStyle(lineWidth: 2))

                            if store.selectedHourIndex == i {
                                PointMark(
                                    x: .value("Hour", i),
                                    y: .value("Temp", h.temperature)
                                )
                                .foregroundStyle(.white)
                                .symbolSize(60)
                            }
                        }
                    }
                    .chartXAxis(.hidden)
                    .chartYAxis(.hidden)
                    .frame(height: 70)
                    .chartOverlay { proxy in
                        GeometryReader { geo in
                            Rectangle().fill(Color.clear).contentShape(Rectangle())
                                .gesture(DragGesture(minimumDistance: 0).onChanged { val in
                                    let x = val.location.x
                                    let count = hourly.count
                                    let idx = Int((x / geo.size.width) * CGFloat(count))
                                    store.selectedHourIndex = max(0, min(count - 1, idx))
                                }.onEnded { _ in
                                    // keep selection
                                })
                        }
                    }

                    // Hour pills
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(hourly.indices, id: \.self) { i in
                                let h = hourly[i]
                                let selected = store.selectedHourIndex == i
                                VStack(spacing: 4) {
                                    Text(hourLabel(h.time))
                                        .font(.system(size: 11))
                                        .foregroundStyle(.white.opacity(0.7))
                                    Image(systemName: weatherInfo(for: h.weatherCode).sfSymbol)
                                        .symbolRenderingMode(.multicolor)
                                        .font(.system(size: 16))
                                    Text("\(Int(h.temperature.rounded()))°")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(.white)
                                }
                                .padding(.vertical, 8)
                                .padding(.horizontal, 6)
                                .background(selected ? .white.opacity(0.25) : .clear, in: RoundedRectangle(cornerRadius: 10))
                                .onTapGesture { store.selectedHourIndex = selected ? nil : i }
                            }
                        }
                        .padding(.horizontal, 2)
                    }
                }
                .padding(16)
            }
        )
    }

    private func hourLabel(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "ha"
        return f.string(from: date).lowercased()
    }
}
