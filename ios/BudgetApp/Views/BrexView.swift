import SwiftUI

/// Brex-eligible charges against reimbursements that actually landed.
/// Only landed reimbursements come off out of pocket.
struct BrexView: View {
    @Environment(DashboardStore.self) private var store

    var body: some View {
        NavigationStack {
            DashboardContainer { summary in
                List {
                    Section {
                        BrexSummary(summary: summary)
                    } footer: {
                        Text("Charges still waiting on Brex stay in your out-of-pocket total until the reimbursement lands in checking.")
                    }

                    Section("Eligible in \(DayKeys.monthName(summary.month))") {
                        if summary.brexEligibleTransactions.isEmpty {
                            Text("No Brex-eligible charges this month.")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(summary.brexEligibleTransactions) { transaction in
                                TransactionRow(transaction: transaction, mark: store.mark(for: transaction.id), showsDate: true)
                            }
                        }
                    }

                    if let deposits = store.meta?.brexDeposits, !deposits.isEmpty {
                        Section {
                            ForEach(Array(deposits.enumerated()), id: \.offset) { _, deposit in
                                LabeledContent {
                                    Text(Money.format(deposit.amount))
                                        .monospacedDigit()
                                        .foregroundStyle(.green)
                                } label: {
                                    Text(deposit.date)
                                    Text(deposit.payer)
                                }
                            }
                        } header: {
                            Text("Reimbursements received")
                        } footer: {
                            Text("\(Money.format(deposits.reduce(0) { $0 + $1.amount })) received all time.")
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable { await store.load() }
            }
            .navigationTitle("Brex")
            .toolbar { MonthToolbar(store: store) }
        }
    }
}

private struct BrexSummary: View {
    let summary: MonthSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                Amount(title: "Eligible", value: summary.brexEligible, color: .primary)
                Amount(title: "Received", value: summary.brexReceived, color: .green)
                Amount(title: "Waiting", value: summary.brexWaiting, color: .orange)
            }
            ProgressView(
                value: min(summary.brexReceived, summary.brexEligible),
                total: max(summary.brexEligible, 0.01)
            )
            .tint(.green)
            .accessibilityLabel("Received \(Money.format(summary.brexReceived)) of \(Money.format(summary.brexEligible))")
        }
        .padding(.vertical, 6)
    }
}

private struct Amount: View {
    let title: String
    let value: Double
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(Money.format(value))
                .font(.title3.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    BrexView()
        .environment(DashboardStore.preview)
}
