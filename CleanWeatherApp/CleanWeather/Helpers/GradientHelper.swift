import SwiftUI

func gradientColors(for temperature: Double, group: WeatherGroup, isDay: Bool, useCelsius: Bool) -> [Color] {
    let celsius = useCelsius ? temperature : (temperature - 32) * 5 / 9

    let baseColors: (Color, Color) = {
        switch group {
        case .thunderstorm:
            return (Color(hue: 0.72, saturation: 0.5, brightness: isDay ? 0.25 : 0.15),
                    Color(hue: 0.75, saturation: 0.4, brightness: isDay ? 0.15 : 0.08))
        case .snow:
            return (Color(hue: 0.58, saturation: 0.3, brightness: isDay ? 0.7 : 0.35),
                    Color(hue: 0.6,  saturation: 0.2, brightness: isDay ? 0.55 : 0.25))
        case .rain, .drizzle:
            return (Color(hue: 0.62, saturation: 0.45, brightness: isDay ? 0.35 : 0.2),
                    Color(hue: 0.65, saturation: 0.35, brightness: isDay ? 0.22 : 0.12))
        case .fog:
            return (Color(hue: 0.6, saturation: 0.15, brightness: isDay ? 0.55 : 0.3),
                    Color(hue: 0.6, saturation: 0.1,  brightness: isDay ? 0.4  : 0.2))
        case .clear, .partlyCloudy, .cloudy:
            return tempGradient(celsius: celsius, isDay: isDay)
        }
    }()

    return [baseColors.0, baseColors.1]
}

private func tempGradient(celsius: Double, isDay: Bool) -> (Color, Color) {
    struct Stop { let temp: Double; let hue: Double; let sat: Double; let bri: Double }
    let stops: [Stop] = [
        Stop(temp: -20, hue: 0.62, sat: 0.6,  bri: 0.3),
        Stop(temp: 0,   hue: 0.60, sat: 0.5,  bri: 0.35),
        Stop(temp: 10,  hue: 0.55, sat: 0.45, bri: 0.38),
        Stop(temp: 20,  hue: 0.50, sat: 0.4,  bri: 0.4),
        Stop(temp: 30,  hue: 0.08, sat: 0.55, bri: 0.42),
        Stop(temp: 45,  hue: 0.02, sat: 0.7,  bri: 0.38),
    ]

    let clamped = max(stops.first!.temp, min(stops.last!.temp, celsius))
    var lo = stops.first!, hi = stops.last!
    for i in 0..<stops.count - 1 {
        if clamped >= stops[i].temp && clamped <= stops[i+1].temp {
            lo = stops[i]; hi = stops[i+1]; break
        }
    }
    let t = (clamped - lo.temp) / (hi.temp - lo.temp)
    let h = lo.hue + (hi.hue - lo.hue) * t
    let s = lo.sat + (hi.sat - lo.sat) * t
    let b = (lo.bri + (hi.bri - lo.bri) * t) * (isDay ? 1.0 : 0.65)

    return (
        Color(hue: h, saturation: s, brightness: b),
        Color(hue: h, saturation: s + 0.05, brightness: max(0, b - 0.12))
    )
}

func tempColor(celsius: Double) -> Color {
    struct Stop { let temp: Double; let color: Color }
    let stops: [Stop] = [
        Stop(temp: -20, color: Color(hue: 0.62, saturation: 0.7, brightness: 0.9)),
        Stop(temp: 0,   color: Color(hue: 0.58, saturation: 0.6, brightness: 0.95)),
        Stop(temp: 10,  color: Color(hue: 0.52, saturation: 0.5, brightness: 1.0)),
        Stop(temp: 20,  color: .white),
        Stop(temp: 30,  color: Color(hue: 0.08, saturation: 0.6, brightness: 1.0)),
        Stop(temp: 45,  color: Color(hue: 0.02, saturation: 0.8, brightness: 1.0)),
    ]
    let clamped = max(stops.first!.temp, min(stops.last!.temp, celsius))
    for i in 0..<stops.count - 1 {
        if clamped <= stops[i+1].temp {
            let t = CGFloat((clamped - stops[i].temp) / (stops[i+1].temp - stops[i].temp))
            return blend(stops[i].color, stops[i+1].color, t: t)
        }
    }
    return .white
}

private func blend(_ a: Color, _ b: Color, t: CGFloat) -> Color {
    let ca = UIColor(a)
    var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
    var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
    ca.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
    UIColor(b).getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
    return Color(red: r1 + (r2 - r1) * t, green: g1 + (g2 - g1) * t, blue: b1 + (b2 - b1) * t)
}
