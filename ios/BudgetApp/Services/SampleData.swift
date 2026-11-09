import Foundation

/// The invented sample dataset bundled with the app (a snapshot of the web
/// app's mock data). Used on first launch, in previews, and in tests.
enum SampleData {
    static func load(bundle: Bundle = .main) throws -> Dashboard {
        guard let url = bundle.url(forResource: "SampleDashboard", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try JSONDecoder().decode(Dashboard.self, from: Data(contentsOf: url))
    }
}
