import Foundation

/// The payload returned by the server's `getDashboard` action.
/// Mirrors `dashboardResponse` in `server/src/actions.ts`.
struct Dashboard: Codable, Equatable {
    var seeded: Bool
    var meta: DashboardMeta?
    var transactions: [Transaction]
    var marks: [Mark]
}

struct DashboardMeta: Codable, Equatable {
    /// Last day the data covers, as `yyyy-MM-dd`.
    var asOf: String
    var accounts: [Account]
    var brexDeposits: [BrexDeposit]
    /// Brex reimbursements that actually landed, keyed by `yyyy-MM`.
    var brexReceivedByMonth: [String: Double]
    var recurring: [RecurringBill]
}

struct Account: Codable, Equatable, Identifiable {
    var label: String
    /// Preformatted by the server, e.g. "$2,450.00".
    var balance: String
    /// True for credit balances you owe.
    var owed: Bool

    var id: String { label }
}

struct BrexDeposit: Codable, Equatable {
    /// Preformatted, e.g. "Oct 9, 2026".
    var date: String
    var payer: String
    var amount: Double
}

struct RecurringBill: Codable, Equatable {
    var name: String
    var detail: String
    var amount: Double
    var cadence: String
}

struct Transaction: Codable, Equatable, Hashable, Identifiable {
    var id: String
    /// `yyyy-MM-dd`.
    var date: String
    var name: String
    var category: String
    var account: String
    var amount: Double
    var pending: Bool
    var brexEligible: Bool

    enum CodingKeys: String, CodingKey {
        case id, date, name, category, account, amount, pending
        case brexEligible = "brex_eligible"
    }
}

enum MarkType: String, Codable, CaseIterable, Identifiable {
    case paidBack = "paid_back"
    case reimbursed
    case refunded

    var id: String { rawValue }

    /// Short label for segmented controls.
    var shortLabel: String {
        switch self {
        case .paidBack: "Paid back"
        case .reimbursed: "Reimbursed"
        case .refunded: "Refunded"
        }
    }

    var longLabel: String {
        switch self {
        case .paidBack: "Paid back by others"
        case .reimbursed: "Reimbursed"
        case .refunded: "Refunded"
        }
    }
}

/// A user's note that part (or all) of a transaction came back to them.
struct Mark: Codable, Equatable {
    var transactionId: String
    var markType: MarkType
    var amount: Double
    var note: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case transactionId = "transaction_id"
        case markType = "mark_type"
        case amount, note
        case updatedAt = "updated_at"
    }
}
