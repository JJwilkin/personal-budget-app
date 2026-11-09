import SwiftUI

/// Records money that came back on a transaction: paid back by others,
/// reimbursed, or refunded, for all or part of the amount.
struct MarkEditorView: View {
    let transaction: Transaction

    @Environment(DashboardStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var type: MarkType = .paidBack
    @State private var amountText = ""
    @State private var note = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var didLoadExisting = false

    private var existing: Mark? { store.mark(for: transaction.id) }

    private var amount: Double? {
        var text = amountText
            .replacingOccurrences(of: "$", with: "")
            .trimmingCharacters(in: .whitespaces)
        // Accept "4,50" from comma-decimal keyboards as well as "1,200.00".
        if text.contains(","), !text.contains(".") {
            text = text.replacingOccurrences(of: ",", with: ".")
        } else {
            text = text.replacingOccurrences(of: ",", with: "")
        }
        return Double(text)
    }

    private var isValid: Bool {
        guard let amount else { return false }
        return amount > 0 && amount <= transaction.amount + 0.001
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 12) {
                        CategoryIcon(category: transaction.category, size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(transaction.name).font(.headline)
                            Text("\(DayKeys.long(transaction.date)) · \(transaction.account)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(Money.format(transaction.amount))
                            .font(.headline)
                            .monospacedDigit()
                    }
                    .accessibilityElement(children: .combine)
                }

                Section("What happened") {
                    Picker("Type", selection: $type) {
                        ForEach(MarkType.allCases) { Text($0.shortLabel).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                Section {
                    HStack {
                        Text("Amount back")
                        Spacer()
                        TextField("0.00", text: $amountText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                            .frame(maxWidth: 140)
                            .accessibilityLabel("Amount back in dollars")
                    }
                    HStack(spacing: 8) {
                        ForEach([25, 50, 75, 100], id: \.self) { percent in
                            Button("\(percent)%") {
                                setAmount(transaction.amount * Double(percent) / 100)
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                            .frame(maxWidth: .infinity)
                        }
                    }
                    Menu {
                        ForEach(2...6, id: \.self) { people in
                            Button("\(people) people, \(Money.format(transaction.amount / Double(people))) each") {
                                setAmount(transaction.amount * Double(people - 1) / Double(people))
                            }
                        }
                    } label: {
                        Label("Split evenly", systemImage: "person.2")
                    }
                    if isValid, let amount {
                        LabeledContent("Your share") {
                            Text(Money.format(transaction.amount - amount))
                                .monospacedDigit()
                                .fontWeight(.semibold)
                        }
                    }
                } header: {
                    Text("Amount")
                } footer: {
                    Text("Anything from \(Money.format(0.01)) up to \(Money.format(transaction.amount)). Splitting evenly counts everyone else's share as paid back.")
                }

                Section("Note") {
                    TextField("e.g. Roommate paid their half", text: $note, axis: .vertical)
                        .lineLimit(1...3)
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }

                if existing != nil {
                    Section {
                        Button("Remove Mark", role: .destructive) {
                            Task { await remove() }
                        }
                        .disabled(isSaving)
                    }
                }
            }
            .navigationTitle(existing == nil ? "Mark Transaction" : "Edit Mark")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") {
                        Task { await save() }
                    }
                    .disabled(!isValid || isSaving)
                }
            }
            .onAppear { loadExisting() }
        }
        .presentationDetents([.large])
    }

    private func loadExisting() {
        guard !didLoadExisting else { return }
        didLoadExisting = true
        if let existing {
            type = existing.markType
            amountText = String(format: "%.2f", existing.amount)
            note = existing.note
        }
    }

    private func setAmount(_ value: Double) {
        amountText = String(format: "%.2f", (value * 100).rounded() / 100)
        errorMessage = nil
    }

    @MainActor
    private func save() async {
        guard isValid, let amount else {
            errorMessage = "Enter an amount between \(Money.format(0.01)) and \(Money.format(transaction.amount))."
            return
        }
        isSaving = true
        defer { isSaving = false }
        do {
            try await store.saveMark(
                transactionId: transaction.id,
                type: type,
                amount: (amount * 100).rounded() / 100,
                note: String(note.trimmingCharacters(in: .whitespacesAndNewlines).prefix(200))
            )
            dismiss()
        } catch {
            errorMessage = "Couldn't save. Check your connection and try again."
        }
    }

    @MainActor
    private func remove() async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await store.clearMark(transactionId: transaction.id)
            dismiss()
        } catch {
            errorMessage = "Couldn't remove the mark. Try again."
        }
    }
}

#Preview {
    let store = DashboardStore.preview
    return MarkEditorView(transaction: store.dashboard!.transactions.last!)
        .environment(store)
}
