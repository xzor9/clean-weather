import SwiftUI

struct HeroView: View {
    @EnvironmentObject var store: WeatherStore

    private var display: (temp: Double, code: Int, isDay: Bool, feelsLike: Double) {
        if let i = store.selectedHourIndex, let h = store.weather?.hourly[i] {
            let fl = store.weather?.current.feelsLike ?? h.temperature
            return (h.temperature, h.weatherCode, h.isDay, fl)
        }
        if let w = store.weather?.current {
            return (w.temperature, w.weatherCode, w.isDay, w.feelsLike)
        }
        return (20, 0, true, 20)
    }

    var body: some View {
        let d = display
        let info = weatherInfo(for: d.code)
        let unit = store.useCelsius ? "°C" : "°F"

        VStack(spacing: 4) {
            Image(systemName: info.sfSymbol)
                .symbolRenderingMode(.multicolor)
                .font(.system(size: 64))
                .shadow(color: .black.opacity(0.2), radius: 8, y: 4)

            Text(tempString(d.temp, unit: unit))
                .font(.system(size: 96, weight: .thin, design: .rounded))
                .foregroundStyle(.white)

            Text(info.label)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(.white.opacity(0.85))

            Text("Feels like \(tempString(d.feelsLike, unit: unit))")
                .font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.65))
        }
        .padding(.bottom, 8)
    }

    private func tempString(_ val: Double, unit: String) -> String {
        "\(Int(val.rounded()))\(unit)"
    }
}
