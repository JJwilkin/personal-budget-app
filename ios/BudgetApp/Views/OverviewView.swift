import SwiftUI

struct OverviewView: View {
    @Environment(DashboardStore.self) private var store
    @State private var showsSettings = false

    var body: some View {
        NavigationStack {
            DashboardContainer { summary in
                List {
                    if store.isUsingSampleData {
                        Section {
                            Label("Showing sample data. Connect your server in Settings.", systemImage: "info.circle")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Section {
                        SummaryHeader(summary: summary, caption: store.coverageCaption)
                    }

                    Section {
                        SpendChartCard(summary: summary, weeks: store.weeks, months: store.monthTotals)
                    }

                    Section {
                        ForEach(summary.categories) { category in
                            NavigationLink(value: category.category) {
                                CategoryRow(category: category, share: share(of: category, in: summary))
                            }
                        }
                    } header: {
                        Text("Categories")
                    } footer: {
                        Text("Rent is your share only, with your roommate's transfer already taken off.")
                    }

                    if let accounts = store.meta?.accounts, !accounts.isEmpty {
                        Section("Accounts") {
                            ForEach(accounts) { account in
                                LabeledContent(account.label) {
                                    Text(account.owed ? "\(account.balance) owed" : account.balance)
                                        .monospacedDigit()
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable { await store.load() }
                .navigationDestination(for: String.self) { category in
                    CategoryDetailView(category: category)
                }
            }
            .navigationTitle(store.navigationTitle)
            .toolbar {
                MonthToolbar(store: store)
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Settings")
                }
            }
            .sheet(isPresented: $showsSettings) {
                SettingsView()
            }
        }
    }

    private func share(of category: CategoryTotal, in summary: MonthSummary) -> Double {
        summary.total > 0 ? category.total / summary.total : 0
    }
}

private struct SummaryHeader: View {
    let summary: MonthSummary
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(caption)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("Everyday spending")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .padding(.top, 8)
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(Money.format(summary.outOfPocketExRent))
                        .font(.system(size: 36, weight: .bold))
                        .monospacedDigit()
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    if summary.rent > 0 {
                        Text("+ \(Money.whole(summary.rent)) rent")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Grid(alignment: .leading, horizontalSpacing: 12) {
                GridRow {
                    Stat(title: "Per day", value: Money.format(summary.perDayExRent))
                    Stat(title: "Out of pocket", value: Money.whole(summary.outOfPocket))
                    Stat(title: "Transactions", value: "\(summary.transactions.count)")
                }
            }

            if summary.brexWaiting > 0 || summary.marksSum > 0 {
                HStack(spacing: 8) {
                    if summary.brexWaiting > 0 {
                        Badge(text: "\(Money.format(summary.brexWaiting)) waiting on Brex", color: .orange)
                    }
                    if summary.marksSum > 0 {
                        Badge(text: "\(Money.format(summary.marksSum)) paid back", color: .green)
                    }
                }
            }
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }
}

private struct Stat: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.headline)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct CategoryRow: View {
    let category: CategoryTotal
    let share: Double

    var body: some View {
        HStack(spacing: 12) {
            CategoryIcon(category: category.category)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(category.category)
                    Spacer()
                    Text(Money.format(category.total))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                ProgressView(value: share)
                    .tint(CategoryStyle.color(category.category))
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityValue("\(Int((share * 100).rounded())) percent of the month, \(category.count) transactions")
    }
}

struct CategoryDetailView: View {
    let category: String
    @Environment(DashboardStore.self) private var store
    @State private var editing: Transaction?

    var body: some View {
        let transactions = store.summary?.transactions.filter { $0.category == category } ?? []
        List {
            Section {
                ForEach(transactions) { transaction in
                    Button {
                        editing = transaction
                    } label: {
                        TransactionRow(transaction: transaction, mark: store.mark(for: transaction.id), showsDate: true)
                    }
                    .buttonStyle(.plain)
                }
            } footer: {
                let total = transactions.reduce(0) { $0 + $1.amount }
                Text("\(transactions.count) transactions · \(Money.format(total))")
            }
        }
        .navigationTitle(category)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editing) { transaction in
            MarkEditorView(transaction: transaction)
        }
    }
}

#Preview {
    OverviewView()
        .environment(DashboardStore.preview)
}
