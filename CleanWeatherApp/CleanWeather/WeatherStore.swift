import Foundation
import CoreLocation
import Combine

@MainActor
final class WeatherStore: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var weather: WeatherData?
    @Published var isLoading = false
    @Published var error: String?
    @Published var useCelsius = true
    @Published var locationName = "My Location"
    @Published var selectedHourIndex: Int? = nil
    @Published var selectedDayIndex: Int? = nil

    var latitude: Double = 0
    var longitude: Double = 0

    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func requestLocation() {
        locationManager.requestWhenInUseAuthorization()
        locationManager.requestLocation()
    }

    func loadWeather(lat: Double, lon: Double, name: String) async {
        latitude = lat; longitude = lon; locationName = name
        isLoading = true; error = nil
        do {
            let data = try await WeatherService.shared.fetchWeather(lat: lat, lon: lon, useCelsius: useCelsius)
            weather = data
            persistToSharedDefaults()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func persistToSharedDefaults() {
        let defaults = UserDefaults(suiteName: "group.com.cleanweather.shared")
        defaults?.set(latitude,    forKey: "latitude")
        defaults?.set(longitude,   forKey: "longitude")
        defaults?.set(locationName,forKey: "locationName")
        defaults?.set(useCelsius,  forKey: "useCelsius")
    }

    func toggleUnit() {
        useCelsius.toggle()
        Task { await loadWeather(lat: latitude, lon: longitude, name: locationName) }
    }

    // MARK: - CLLocationManagerDelegate
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.first else { return }
        let lat = loc.coordinate.latitude
        let lon = loc.coordinate.longitude
        Task { @MainActor in
            await self.loadWeather(lat: lat, lon: lon, name: "My Location")
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.error = error.localizedDescription }
    }
}
