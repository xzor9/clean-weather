import SwiftUI

struct SearchView: View {
    @EnvironmentObject var store: WeatherStore
    @Environment(\.dismiss) var dismiss

    @State private var query = ""
    @State private var results: [GeocodingResult] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            List {
                if results.isEmpty && !query.isEmpty && !isSearching {
                    Text("No results found").foregroundStyle(.secondary)
                }
                ForEach(results) { result in
                    Button(action: {
                        Task {
                            await store.loadWeather(lat: result.latitude, lon: result.longitude, name: result.displayName)
                            dismiss()
                        }
                    }) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.name).font(.headline)
                            if let sub = [result.admin1, result.country].compactMap({ $0 }).joined(separator: ", ").nilIfEmpty {
                                Text(sub).font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Search Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "City name")
            .onChange(of: query) { _, newValue in
                searchTask?.cancel()
                guard newValue.count >= 2 else { results = []; return }
                searchTask = Task {
                    try? await Task.sleep(nanoseconds: 350_000_000)
                    guard !Task.isCancelled else { return }
                    isSearching = true
                    results = (try? await WeatherService.shared.searchLocations(query: newValue)) ?? []
                    isSearching = false
                }
            }
            .overlay {
                if isSearching { ProgressView() }
            }
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
