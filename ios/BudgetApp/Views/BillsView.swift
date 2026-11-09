import SwiftUI

/// Recurring bills and subscriptions detected from repeat charges.
struct BillsView: View {
    @Environment(DashboardStore.self) private var store

    var body: some View {
        NavigationStack {
            Group {
                if let bills = store.meta?.recurring, !bills.isEmpty {
                    List {
                        Section {
                            ForEach(Array(bills.enumerated()), id: \.offset) { _, bill in
                                HStack(alignment: .firstTextBaseline) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(bill.name)
                                        Text(bill.detail)
                                            .font(.subheadline)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text(Money.format(bill.amount))
                                            .monospacedDigit()
                                        Text(bill.cadence)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .accessibilityElement(children: .combine)
                            }
                        } footer: {
                            Text("Amounts are the most recent charge. Electric, internet and car insurance are shared household bills, so they're kept out of your spending totals.")
                        }

                        Section {
                            LabeledContent("Each month, about") {
                                Text(Money.format(bills.reduce(0) { $0 + $1.amount }))
                                    .monospacedDigit()
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .refreshable { await store.load() }
                } else if store.dashboard == nil {
                    ProgressView()
                } else {
                    ContentUnavailableView("No Recurring Bills", systemImage: "doc.text", description: Text("Repeat charges will show up here once they're detected."))
                }
            }
            .navigationTitle("Bills")
        }
    }
}

#Preview {
    BillsView()
        .environment(DashboardStore.preview)
}
