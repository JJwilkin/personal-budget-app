import Foundation
import Observation

enum SettingsKey {
    static let useServer = "useServer"
    static let serverURL = "serverURL"
    static let defaultServerURL = "http://localhost:5173"
}

/// App-wide state: the loaded dashboard, the month being viewed, and the
/// actions that change marks. Without a server configured it runs on the
/// bundled sample data and keeps marks in memory only.
@Observable
final class DashboardStore {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    var dashboard: Dashboard?
    var state: LoadState = .idle
    var selectedMonth: String?
    private(set) var isUsingSampleData = true

    // MARK: Derived data

    var months: [String] {
        guard let dashboard else { return [] }
        return Set(dashboard.transactions.map { DayKeys.monthKey($0.date) }).sorted()
    }

    var activeMonth: String? {
        if let selectedMonth, months.contains(selectedMonth) { return selectedMonth }
        return months.last
    }

    var summary: MonthSummary? {
        guard let dashboard, let activeMonth else { return nil }
        return MonthSummary(dashboard: dashboard, month: activeMonth)
    }

    var weeks: [WeekBucket] {
        MonthSummary.weeks(in: dashboard?.transactions ?? [])
    }

    var monthTotals: [MonthTotal] {
        MonthSummary.months(in: dashboard?.transactions ?? [])
    }

    var meta: DashboardMeta? { dashboard?.meta }

    func mark(for transactionId: String) -> Mark? {
        dashboard?.marks.first { $0.transactionId == transactionId }
    }

    // MARK: Month navigation

    private var activeIndex: Int? {
        guard let activeMonth else { return nil }
        return months.firstIndex(of: activeMonth)
    }

    var previousMonth: String? {
        guard let i = activeIndex, i > 0 else { return nil }
        return months[i - 1]
    }

    var nextMonth: String? {
        guard let i = activeIndex, i + 1 < months.count else { return nil }
        return months[i + 1]
    }

    func show(month: String?) {
        guard let month else { return }
        selectedMonth = month
    }

    // MARK: Loading

    private var client: APIClient? {
        let defaults = UserDefaults.standard
        guard defaults.bool(forKey: SettingsKey.useServer) else { return nil }
        let raw = defaults.string(forKey: SettingsKey.serverURL) ?? SettingsKey.defaultServerURL
        return Self.makeClient(raw)
    }

    static func makeClient(_ raw: String) -> APIClient? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), let scheme = url.scheme, ["http", "https"].contains(scheme), url.host != nil else {
            return nil
        }
        return APIClient(baseURL: url)
    }

    @MainActor
    func load() async {
        state = .loading
        do {
            if let client {
                dashboard = try await client.getDashboard()
                isUsingSampleData = false
            } else {
                // Keep marks made during this session when reloading sample data.
                let keptMarks = isUsingSampleData ? dashboard?.marks : nil
                var sample = try SampleData.load()
                if let keptMarks { sample.marks = keptMarks }
                dashboard = sample
                isUsingSampleData = true
            }
            state = .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func useSampleData() async {
        UserDefaults.standard.set(false, forKey: SettingsKey.useServer)
        await load()
    }

    /// Tries a server address without changing settings. Returns a sentence for the user.
    static func testConnection(_ raw: String) async -> String {
        guard let client = makeClient(raw) else {
            return "That doesn't look like a server address. Use one like http://192.168.1.20:5173."
        }
        do {
            let dashboard = try await client.getDashboard()
            return "Connected. The server has \(dashboard.transactions.count) transactions."
        } catch {
            return "Couldn't connect: \(error.localizedDescription)"
        }
    }

    // MARK: Marks

    @MainActor
    func saveMark(transactionId: String, type: MarkType, amount: Double, note: String) async throws {
        if let client {
            try await client.saveMark(SaveMarkArgs(transactionId: transactionId, markType: type, amount: amount, note: note))
            await load()
        } else {
            let mark = Mark(
                transactionId: transactionId,
                markType: type,
                amount: amount,
                note: note,
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )
            dashboard?.marks.removeAll { $0.transactionId == transactionId }
            dashboard?.marks.append(mark)
        }
    }

    @MainActor
    func clearMark(transactionId: String) async throws {
        if let client {
            try await client.clearMark(transactionId: transactionId)
            await load()
        } else {
            dashboard?.marks.removeAll { $0.transactionId == transactionId }
        }
    }

    /// Asks the server to pull new transactions from the linked accounts.
    @MainActor
    func refreshFromAccounts() async -> String {
        guard let client else {
            return "Connect to your server first. Sample data can't be refreshed."
        }
        do {
            let result = try await client.refreshFromPlaid()
            return result.started
                ? "Refresh started. New transactions will appear once it finishes."
                : "This server runs on sample data, so there's nothing to refresh. The hosted version refreshes from your accounts."
        } catch {
            return "Couldn't start the refresh: \(error.localizedDescription)"
        }
    }
}

extension DashboardStore {
    /// A store already loaded with sample data, for previews.
    static var preview: DashboardStore {
        let store = DashboardStore()
        store.dashboard = try? SampleData.load()
        store.state = .loaded
        return store
    }
}
