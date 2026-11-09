import Foundation

/// Helpers for the server's string dates (`yyyy-MM-dd`) and month keys (`yyyy-MM`).
/// Dates are calendar days, so they're built in the device's time zone and never shifted.
enum DayKeys {
    static let calendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        cal.locale = Locale(identifier: "en_US_POSIX")
        return cal
    }()

    static func date(_ iso: String) -> Date? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count >= 2 else { return nil }
        let day = parts.count >= 3 ? parts[2] : 1
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: day))
    }

    static func iso(_ date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04ld-%02ld-%02ld", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func monthKey(_ iso: String) -> String {
        String(iso.prefix(7))
    }

    static func dayOfMonth(_ iso: String) -> Int {
        Int(iso.split(separator: "-").last ?? "") ?? 1
    }

    static func daysInMonth(_ monthKey: String) -> Int {
        guard let start = date(monthKey),
              let range = calendar.range(of: .day, in: .month, for: start) else { return 30 }
        return range.count
    }

    static func adding(days: Int, to iso: String) -> String {
        guard let d = date(iso), let moved = calendar.date(byAdding: .day, value: days, to: d) else { return iso }
        return self.iso(moved)
    }

    /// The Sunday that ends the Monday–Sunday week containing `iso`.
    static func weekEnding(_ iso: String) -> String {
        guard let d = date(iso) else { return iso }
        let weekday = calendar.component(.weekday, from: d) // Sunday = 1
        let daysUntilSunday = (8 - weekday) % 7
        return adding(days: daysUntilSunday, to: iso)
    }

    // MARK: Display

    /// "November"
    static func monthName(_ monthKey: String) -> String {
        date(monthKey)?.formatted(.dateTime.month(.wide)) ?? monthKey
    }

    /// "November 2026"
    static func monthTitle(_ monthKey: String) -> String {
        date(monthKey)?.formatted(.dateTime.month(.wide).year()) ?? monthKey
    }

    /// "Nov"
    static func monthShort(_ monthKey: String) -> String {
        date(monthKey)?.formatted(.dateTime.month(.abbreviated)) ?? monthKey
    }

    /// "Nov 5"
    static func short(_ iso: String) -> String {
        date(iso)?.formatted(.dateTime.month(.abbreviated).day()) ?? iso
    }

    /// "Thursday, Nov 5"
    static func long(_ iso: String) -> String {
        date(iso)?.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()) ?? iso
    }
}

enum Money {
    static func format(_ value: Double, digits: Int = 2) -> String {
        value.formatted(.currency(code: "USD").precision(.fractionLength(digits)))
    }

    static func whole(_ value: Double) -> String {
        format(value.rounded(), digits: 0)
    }
}
