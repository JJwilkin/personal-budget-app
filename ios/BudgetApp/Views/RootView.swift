import SwiftUI

struct RootView: View {
    @Environment(DashboardStore.self) private var store

    var body: some View {
        TabView {
            OverviewView()
                .tabItem { Label("Overview", systemImage: "chart.bar.fill") }
            ActivityView()
                .tabItem { Label("Activity", systemImage: "list.bullet") }
            BrexView()
                .tabItem { Label("Brex", systemImage: "creditcard.fill") }
            BillsView()
                .tabItem { Label("Bills", systemImage: "doc.text.fill") }
        }
        .task {
            if store.dashboard == nil {
                await store.load()
            }
        }
    }
}

#Preview {
    RootView()
        .environment(DashboardStore.preview)
}
