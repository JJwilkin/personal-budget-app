import SwiftUI

@main
struct BudgetApp: App {
    @State private var store = DashboardStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
        }
    }
}
