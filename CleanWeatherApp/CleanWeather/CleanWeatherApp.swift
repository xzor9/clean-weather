import SwiftUI

@main
struct CleanWeatherApp: App {
    @StateObject private var store = WeatherStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .onAppear { store.requestLocation() }
        }
    }
}
