import SwiftUI

// MARK: Category styling

enum CategoryStyle {
    static func color(_ category: String) -> Color {
        switch category {
        case "Rent": Color(hex: 0x0E6B4F)
        case "Food & drink": Color(hex: 0xD97C1E)
        case "Groceries": Color(hex: 0x5E9E4A)
        case "Shopping": Color(hex: 0x2A7F9E)
        case "Transport & rides": Color(hex: 0x4A6FA5)
        case "Travel": Color(hex: 0xC2504E)
        case "Entertainment": Color(hex: 0x8E5EA2)
        case "Utilities & bills": Color(hex: 0x5B8C5A)
        case "Health": Color(hex: 0x3D9B8F)
        case "Home": Color(hex: 0xA67C52)
        case "Personal care": Color(hex: 0xC97B9A)
        case "Donations & fees": Color(hex: 0x8A8D3C)
        case "People & transfers": Color(hex: 0x6B7F8E)
        default: Color(hex: 0x8E8E93)
        }
    }

    static func symbol(_ category: String) -> String {
        switch category {
        case "Rent": "house.fill"
        case "Food & drink": "fork.knife"
        case "Groceries": "cart.fill"
        case "Shopping": "bag.fill"
        case "Transport & rides": "car.fill"
        case "Travel": "airplane"
        case "Entertainment": "ticket.fill"
        case "Utilities & bills": "bolt.fill"
        case "Health": "cross.case.fill"
        case "Home": "sofa.fill"
        case "Personal care": "sparkles"
        case "Donations & fees": "heart.fill"
        case "People & transfers": "person.2.fill"
        default: "square.grid.2x2.fill"
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// A Settings-style rounded square with the category's symbol.
struct CategoryIcon: View {
    let category: String
    var size: CGFloat = 30

    var body: some View {
        Image(systemName: CategoryStyle.symbol(category))
            .font(.system(size: size * 0.5, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(CategoryStyle.color(category), in: RoundedRectangle(cornerRadius: size * 0.24, style: .continuous))
            .accessibilityHidden(true)
    }
}

// MARK: Transaction row

struct TransactionRow: View {
    let transaction: Transaction
    let mark: Mark?
    var showsDate = false

    var body: some View {
        HStack(spacing: 12) {
            CategoryIcon(category: transaction.category)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(transaction.name)
                        .lineLimit(1)
                    if transaction.brexEligible {
                        Badge(text: "Brex", color: .orange)
                    }
                    if transaction.pending {
                        Badge(text: "Pending", color: .gray)
                    }
                }
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(mark == nil ? Color.secondary : Color.green)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text(Money.format(transaction.amount))
                    .monospacedDigit()
                    .strikethrough(mark != nil, color: .secondary)
                    .foregroundStyle(mark == nil ? Color.primary : Color.secondary)
                if let mark {
                    Text(Money.format(max(0, transaction.amount - mark.amount)))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                }
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens the mark editor")
    }

    private var subtitle: String {
        if let mark {
            return "\(mark.markType.shortLabel) \(Money.format(mark.amount))"
        }
        let base = "\(transaction.category) · \(transaction.account)"
        return showsDate ? "\(DayKeys.short(transaction.date)) · \(base)" : base
    }
}

struct Badge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .foregroundStyle(color)
            .background(color.opacity(0.15), in: Capsule())
    }
}

// MARK: Loading and month switching

/// Shows `content` once a month is loaded, otherwise a loading or error state.
struct DashboardContainer<Content: View>: View {
    @Environment(DashboardStore.self) private var store
    @ViewBuilder var content: (MonthSummary) -> Content

    var body: some View {
        if let summary = store.summary {
            content(summary)
        } else if case .failed(let message) = store.state {
            ContentUnavailableView {
                Label("Can't Load Your Spending", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("Try Again") { Task { await store.load() } }
                    .buttonStyle(.borderedProminent)
                Button("Use Sample Data") { Task { await store.useSampleData() } }
            }
        } else if store.dashboard != nil {
            ContentUnavailableView("No Transactions Yet", systemImage: "tray", description: Text("Spending will show up here once your accounts sync."))
        } else {
            ProgressView("Loading your spending…")
        }
    }
}

/// "‹ Oct" and "Dec ›" buttons in the navigation bar.
struct MonthToolbar: ToolbarContent {
    let store: DashboardStore

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                withAnimation { store.show(month: store.previousMonth) }
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "chevron.left")
                    Text(store.previousMonth.map(DayKeys.monthShort) ?? "")
                }
            }
            .disabled(store.previousMonth == nil)
            .accessibilityLabel(store.previousMonth.map { "Show \(DayKeys.monthName($0))" } ?? "No earlier month")
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                withAnimation { store.show(month: store.nextMonth) }
            } label: {
                HStack(spacing: 3) {
                    Text(store.nextMonth.map(DayKeys.monthShort) ?? "")
                    Image(systemName: "chevron.right")
                }
            }
            .disabled(store.nextMonth == nil)
            .accessibilityLabel(store.nextMonth.map { "Show \(DayKeys.monthName($0))" } ?? "No later month")
        }
    }
}

extension DashboardStore {
    var navigationTitle: String {
        activeMonth.map(DayKeys.monthName) ?? "Spending"
    }

    /// "Through Sunday, Nov 8" for the current month, "All of October" otherwise.
    var coverageCaption: String {
        guard let summary else { return "" }
        if summary.isCurrent, let asOf = meta?.asOf {
            return "Through \(DayKeys.long(asOf))"
        }
        return "All of \(DayKeys.monthTitle(summary.month))"
    }
}
