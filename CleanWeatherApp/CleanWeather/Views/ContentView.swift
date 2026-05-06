import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: WeatherStore
    @State private var showSearch = false

    private var displayWeather: (temp: Double, code: Int, isDay: Bool) {
        if let i = store.selectedHourIndex, let h = store.weather?.hourly[i] {
            return (h.temperature, h.weatherCode, h.isDay)
        }
        if let w = store.weather?.current {
            return (w.temperature, w.weatherCode, w.isDay)
        }
        return (20, 0, true)
    }

    private var gradColors: [Color] {
        let d = displayWeather
        let info = weatherInfo(for: d.code)
        let celsius = store.useCelsius ? d.temp : (d.temp - 32) * 5 / 9
        return gradientColors(for: celsius, group: info.group, isDay: d.isDay, useCelsius: true)
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: gradColors, startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .animation(.easeInOut(duration: 0.6), value: gradColors.map { $0.description })

            if store.isLoading && store.weather == nil {
                ProgressView().tint(.white).scaleEffect(1.5)
            } else if let weather = store.weather {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 20) {
                        HeroView()
                        HourlyForecastView()
                        DailyForecastView()
                        StatGridView()
                        Spacer(minLength: 40)
                    }
                    .padding(.top, 60)
                }
            } else if let err = store.error {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.white.opacity(0.8))
                    Text(err)
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    Button("Try Again") { store.requestLocation() }
                        .buttonStyle(.bordered)
                        .tint(.white)
                }
            }

            // Top bar
            VStack {
                HStack {
                    Button(action: { showSearch = true }) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundStyle(.white)
                            .padding(10)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                    Spacer()
                    Text(store.locationName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                    Button(action: { store.toggleUnit() }) {
                        Text(store.useCelsius ? "°C" : "°F")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(10)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                Spacer()
            }
        }
        .sheet(isPresented: $showSearch) {
            SearchView()
                .environmentObject(store)
        }
    }
}
