import Foundation
import CoreLocation
import WatchKit

@MainActor
final class WatchWeatherStore: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var weather: WeatherData?
    @Published var isLoading = false
    @Published var error: String?
    @Published var useCelsius = true
    @Published var locationName = "My Location"

    private var lat: Double = 0
    private var lon: Double = 0
    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
        // Read saved location from shared app group (set by iPhone app)
        let defaults = UserDefaults(suiteName: "group.com.cleanweather.shared")
        lat = defaults?.double(forKey: "latitude")   ?? 0
        lon = defaults?.double(forKey: "longitude")  ?? 0
        locationName = defaults?.string(forKey: "locationName") ?? "My Location"
        useCelsius = defaults?.bool(forKey: "useCelsius") ?? true

        if lat != 0 || lon != 0 {
            Task { await loadWeather() }
        } else {
            locationManager.requestWhenInUseAuthorization()
            locationManager.requestLocation()
        }
    }

    func loadWeather() async {
        isLoading = true; error = nil
        do {
            weather = try await WeatherService.shared.fetchWeather(lat: lat, lon: lon, useCelsius: useCelsius)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.first else { return }
        Task { @MainActor in
            self.lat = loc.coordinate.latitude
            self.lon = loc.coordinate.longitude
            await self.loadWeather()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.error = error.localizedDescription }
    }
}
