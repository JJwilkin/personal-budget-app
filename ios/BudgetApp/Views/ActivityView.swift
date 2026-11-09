import SwiftUI

enum MarkFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case marked = "Marked"
    case unmarked = "Not Marked"
    var id: Self { self }
}

/// Every transaction in the month, grouped by day. Tap a row or swipe right
/// to mark it as paid back, reimbursed or refunded; swipe left to clear a mark.
struct ActivityView: View {
    @Environment(DashboardStore.self) private var store
    @State private var filter: MarkFilter = .all
    @State private var searchText = ""
    @State private var editing: Transaction?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            DashboardContainer { summary in
                let days = groupedByDay(filtered(summary.transactions))
                List {
                    if summary.marksSum > 0 && searchText.isEmpty {
                        Section {
                            LabeledContent("Paid back to you") {
                                Text(Money.format(summary.marksSum))
                                    .monospacedDigit()
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                    ForEach(days) { day in
                        Section(DayKeys.long(day.date)) {
                            ForEach(day.transactions) { transaction in
                                row(for: transaction)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .overlay {
                    if days.isEmpty {
                        emptyState
                    }
                }
                .refreshable { await store.load() }
            }
            .navigationTitle("Activity")
            .searchable(text: $searchText, prompt: "Merchant or category")
            .toolbar {
                MonthToolbar(store: store)
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Show", selection: $filter) {
                            ForEach(MarkFilter.allCases) { Text($0.rawValue).tag($0) }
                        }
                    } label: {
                        Image(systemName: filter == .all
                              ? "line.3.horizontal.decrease.circle"
                              : "line.3.horizontal.decrease.circle.fill")
                    }
                    .accessibilityLabel("Filter, showing \(filter.rawValue)")
                }
            }
            .sheet(item: $editing) { transaction in
                MarkEditorView(transaction: transaction)
            }
            .alert("Couldn't Remove the Mark", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func row(for transaction: Transaction) -> some View {
        let mark = store.mark(for: transaction.id)
        return Button {
            editing = transaction
        } label: {
            TransactionRow(transaction: transaction, mark: mark)
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button {
                editing = transaction
            } label: {
                Label(mark == nil ? "Mark" : "Edit", systemImage: "arrow.uturn.backward.circle")
            }
            .tint(.green)
        }
        .swipeActions(edge: .trailing) {
            if mark != nil {
                Button {
                    Task {
                        do {
                            try await store.clearMark(transactionId: transaction.id)
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                } label: {
                    Label("Clear Mark", systemImage: "xmark.circle")
                }
                .tint(.red)
            }
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        if !searchText.isEmpty {
            ContentUnavailableView.search(text: searchText)
        } else if filter == .marked {
            ContentUnavailableView("Nothing Marked", systemImage: "arrow.uturn.backward.circle", description: Text("Swipe right on a transaction to mark money you got back."))
        } else {
            ContentUnavailableView("No Transactions", systemImage: "tray")
        }
    }

    private func filtered(_ transactions: [Transaction]) -> [Transaction] {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        return transactions.filter { t in
            let isMarked = store.mark(for: t.id) != nil
            switch filter {
            case .all: break
            case .marked: if !isMarked { return false }
            case .unmarked: if isMarked { return false }
            }
            guard !query.isEmpty else { return true }
            return t.name.localizedCaseInsensitiveContains(query)
                || t.category.localizedCaseInsensitiveContains(query)
                || t.account.localizedCaseInsensitiveContains(query)
        }
    }

    private func groupedByDay(_ transactions: [Transaction]) -> [DayGroup] {
        let groups = Dictionary(grouping: transactions, by: \.date)
        return groups.keys.sorted(by: >).map { DayGroup(date: $0, transactions: groups[$0] ?? []) }
    }
}

private struct DayGroup: Identifiable {
    let date: String
    let transactions: [Transaction]
    var id: String { date }
}

#Preview {
    ActivityView()
        .environment(DashboardStore.preview)
}
