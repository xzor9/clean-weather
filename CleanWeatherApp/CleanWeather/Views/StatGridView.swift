import SwiftUI

struct StatGridView: View {
    @EnvironmentObject var store: WeatherStore

    var body: some View {
        guard let cur = store.weather?.current else { return AnyView(EmptyView()) }
        let unit = store.useCelsius ? "°C" : "°F"
        return AnyView(
            GlassCard {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    StatCell(icon: "thermometer.medium",     label: "Feels Like",  value: "\(Int(cur.feelsLike.rounded()))\(unit)")
                    StatCell(icon: "humidity.fill",          label: "Humidity",    value: "\(cur.humidity)%")
                    StatCell(icon: "wind",                   label: "Wind",        value: "\(Int(cur.windSpeed.rounded())) mph")
                    StatCell(icon: "sun.max.fill",           label: "UV Index",    value: uvLabel(cur.uvIndex))
                }
                .padding(16)
            }
        )
    }

    private func uvLabel(_ uv: Double) -> String {
        switch uv {
        case ..<3:  return "\(Int(uv)) Low"
        case ..<6:  return "\(Int(uv)) Moderate"
        case ..<8:  return "\(Int(uv)) High"
        case ..<11: return "\(Int(uv)) Very High"
        default:    return "\(Int(uv)) Extreme"
        }
    }
}

struct StatCell: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .symbolRenderingMode(.multicolor)
                    .font(.system(size: 14))
                Text(label)
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.65))
            }
            Text(value)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }
}
