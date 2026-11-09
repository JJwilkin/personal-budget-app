import SwiftUI

struct SettingsView: View {
    @Environment(DashboardStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @AppStorage(SettingsKey.useServer) private var useServer = false
    @AppStorage(SettingsKey.serverURL) private var serverURL = SettingsKey.defaultServerURL
    @State private var connectionMessage: String?
    @State private var refreshMessage: String?
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Connect to my server", isOn: $useServer)
                    if useServer {
                        TextField("Server address", text: $serverURL)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .textContentType(.URL)
                        Button("Test Connection") {
                            Task {
                                isWorking = true
                                connectionMessage = await DashboardStore.testConnection(serverURL)
                                isWorking = false
                            }
                        }
                        .disabled(isWorking)
                    }
                } header: {
                    Text("Data")
                } footer: {
                    if let connectionMessage {
                        Text(connectionMessage)
                    } else if useServer {
                        Text("Run the budget server on your computer, then enter its address, like http://192.168.1.20:5173. The simulator can use http://localhost:5173.")
                    } else {
                        Text("Showing the built-in sample data. Marks you make in this mode last until you quit the app.")
                    }
                }

                if useServer {
                    Section {
                        Button("Refresh From My Accounts") {
                            Task {
                                isWorking = true
                                refreshMessage = await store.refreshFromAccounts()
                                isWorking = false
                            }
                        }
                        .disabled(isWorking)
                    } footer: {
                        Text(refreshMessage ?? "Asks the server to pull new transactions from your linked accounts. Your marks are kept.")
                    }
                }

                Section("About") {
                    LabeledContent("Data through", value: store.meta.map { DayKeys.long($0.asOf) } ?? "Not loaded")
                    LabeledContent("Transactions", value: "\(store.dashboard?.transactions.count ?? 0)")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                        Task { await store.load() }
                    }
                }
            }
            .onChange(of: useServer) {
                connectionMessage = nil
                refreshMessage = nil
            }
        }
    }
}

#Preview {
    SettingsView()
        .environment(DashboardStore.preview)
}
