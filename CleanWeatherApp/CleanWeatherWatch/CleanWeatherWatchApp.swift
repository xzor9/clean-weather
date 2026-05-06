import SwiftUI

@main
struct CleanWeatherWatchApp: App {
    @StateObject private var store = WatchWeatherStore()

    var body: some Scene {
        WindowGroup {
            WatchContentView()
                .environmentObject(store)
        }
    }
}
