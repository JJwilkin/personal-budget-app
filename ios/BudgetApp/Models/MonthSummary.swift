import Foundation

struct CategoryTotal: Identifiable, Equatable {
    let category: String
    let count: Int
    let total: Double
    var id: String { category }
}

struct DailyPoint: Identifiable, Equatable {
    let iso: String
    let date: Date
    let total: Double
    let rent: Double
    /// Trailing 3-day average of `exRent` (fewer days at the start of the month).
    let trend3: Double

    var id: String { iso }
    var exRent: Double { total - rent }
}

struct WeekBucket: Identifiable, Equatable {
    let start: String
    let end: String
    let total: Double
    let rent: Double

    var id: String { end }
    var exRent: Double { total - rent }
    var label: String { DayKeys.short(end) }
}

struct MonthTotal: Identifiable, Equatable {
    let month: String
    let total: Double
    let rent: Double

    var id: String { month }
    var exRent: Double { total - rent }
    var label: String { DayKeys.monthShort(month) }
}

/// Everything the app shows for one month. The arithmetic matches the web
/// dashboard (`client/src/App.tsx`):
/// - out of pocket = spending − Brex reimbursements that landed − marked paybacks
/// - rent is your share only, already net of the roommate's transfer
struct MonthSummary {
    let month: String
    /// Newest first.
    let transactions: [Transaction]
    let total: Double
    let marksSum: Double
    let brexReceived: Double
    let brexEligible: Double
    let rent: Double
    let isCurrent: Bool
    /// Days covered so far: the as-of day for the current month, else the whole month.
    let daysCovered: Int
    let categories: [CategoryTotal]
    /// One point per calendar day from the 1st through `daysCovered`.
    let daily: [DailyPoint]

    var outOfPocket: Double { total - brexReceived - marksSum }
    var outOfPocketExRent: Double { outOfPocket - rent }
    var perDayExRent: Double { outOfPocketExRent / Double(max(1, daysCovered)) }
    var brexWaiting: Double { max(0, brexEligible - brexReceived) }
    var brexEligibleTransactions: [Transaction] { transactions.filter(\.brexEligible) }

    init(dashboard: Dashboard, month: String) {
        self.month = month
        let marks = Dictionary(dashboard.marks.map { ($0.transactionId, $0) }, uniquingKeysWith: { a, _ in a })
        let txns = dashboard.transactions
            .filter { DayKeys.monthKey($0.date) == month }
            .sorted { $0.date == $1.date ? $0.amount > $1.amount : $0.date > $1.date }
        transactions = txns

        total = txns.reduce(0) { $0 + $1.amount }
        marksSum = txns.reduce(0) { $0 + (marks[$1.id]?.amount ?? 0) }
        brexReceived = dashboard.meta?.brexReceivedByMonth[month] ?? 0
        brexEligible = txns.filter(\.brexEligible).reduce(0) { $0 + $1.amount }
        rent = txns.filter { $0.category == "Rent" }.reduce(0) { $0 + $1.amount }

        let asOf = dashboard.meta?.asOf ?? ""
        isCurrent = !asOf.isEmpty && DayKeys.monthKey(asOf) == month
        let fullMonth = DayKeys.daysInMonth(month)
        daysCovered = isCurrent ? min(fullMonth, max(1, DayKeys.dayOfMonth(asOf))) : fullMonth

        var byCategory: [String: (count: Int, total: Double)] = [:]
        for t in txns {
            let current = byCategory[t.category] ?? (0, 0)
            byCategory[t.category] = (current.count + 1, current.total + t.amount)
        }
        categories = byCategory
            .map { CategoryTotal(category: $0.key, count: $0.value.count, total: $0.value.total) }
            .sorted { $0.total == $1.total ? $0.category < $1.category : $0.total > $1.total }

        var totalsByDay: [Int: (total: Double, rent: Double)] = [:]
        for t in txns {
            let day = DayKeys.dayOfMonth(t.date)
            let current = totalsByDay[day] ?? (0, 0)
            totalsByDay[day] = (current.total + t.amount, current.rent + (t.category == "Rent" ? t.amount : 0))
        }
        let lastDay = max(daysCovered, totalsByDay.keys.max() ?? 1)
        var exRentSeries: [Double] = []
        var points: [DailyPoint] = []
        for day in 1...lastDay {
            let iso = String(format: "%@-%02ld", month, day)
            let values = totalsByDay[day] ?? (0, 0)
            exRentSeries.append(values.total - values.rent)
            let window = exRentSeries.suffix(3)
            let trend = window.reduce(0, +) / Double(window.count)
            points.append(DailyPoint(
                iso: iso,
                date: DayKeys.date(iso) ?? Date(),
                total: values.total,
                rent: values.rent,
                trend3: trend
            ))
        }
        daily = points
    }

    /// Monday–Sunday weeks across every transaction, oldest first.
    static func weeks(in transactions: [Transaction]) -> [WeekBucket] {
        var buckets: [String: (total: Double, rent: Double)] = [:]
        for t in transactions {
            let end = DayKeys.weekEnding(t.date)
            let current = buckets[end] ?? (0, 0)
            buckets[end] = (current.total + t.amount, current.rent + (t.category == "Rent" ? t.amount : 0))
        }
        return buckets.keys.sorted().map { end in
            let values = buckets[end] ?? (0, 0)
            return WeekBucket(start: DayKeys.adding(days: -6, to: end), end: end, total: values.total, rent: values.rent)
        }
    }

    /// Spending per month across every transaction, oldest first.
    static func months(in transactions: [Transaction]) -> [MonthTotal] {
        var buckets: [String: (total: Double, rent: Double)] = [:]
        for t in transactions {
            let key = DayKeys.monthKey(t.date)
            let current = buckets[key] ?? (0, 0)
            buckets[key] = (current.total + t.amount, current.rent + (t.category == "Rent" ? t.amount : 0))
        }
        return buckets.keys.sorted().map { key in
            let values = buckets[key] ?? (0, 0)
            return MonthTotal(month: key, total: values.total, rent: values.rent)
        }
    }
}
