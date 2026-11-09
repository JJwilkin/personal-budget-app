import XCTest
@testable import BudgetApp

/// Checks the spending math against the bundled sample data. Expected values
/// match what the web dashboard shows for the same data.
final class MonthSummaryTests: XCTestCase {
    private var sample: Dashboard!

    override func setUpWithError() throws {
        sample = try SampleData.load()
    }

    func testNovemberTotals() {
        let november = MonthSummary(dashboard: sample, month: "2026-11")

        XCTAssertTrue(november.isCurrent)
        XCTAssertEqual(november.daysCovered, 8)
        XCTAssertEqual(november.transactions.count, 4)
        XCTAssertEqual(november.total, 1256.15, accuracy: 0.001)
        XCTAssertEqual(november.rent, 1200, accuracy: 0.001)
        XCTAssertEqual(november.outOfPocket, 1256.15, accuracy: 0.001)
        XCTAssertEqual(november.outOfPocketExRent, 56.15, accuracy: 0.001)
        XCTAssertEqual(november.perDayExRent, 7.02, accuracy: 0.005)
        XCTAssertEqual(november.brexEligible, 9.80, accuracy: 0.001)
        XCTAssertEqual(november.brexReceived, 0, accuracy: 0.001)
        XCTAssertEqual(november.brexWaiting, 9.80, accuracy: 0.001)
        XCTAssertEqual(november.categories.first?.category, "Rent")
    }

    func testTransactionsAreNewestFirst() {
        let november = MonthSummary(dashboard: sample, month: "2026-11")
        XCTAssertEqual(november.transactions.map(\.date), ["2026-11-06", "2026-11-05", "2026-11-03", "2026-11-02"])
    }

    func testPastMonthCountsLandedBrexAndWholeMonth() {
        let october = MonthSummary(dashboard: sample, month: "2026-10")

        XCTAssertFalse(october.isCurrent)
        XCTAssertEqual(october.daysCovered, 31)
        XCTAssertEqual(october.total, 1527.14, accuracy: 0.001)
        XCTAssertEqual(october.brexReceived, 41.25, accuracy: 0.001)
        XCTAssertEqual(october.outOfPocket, 1485.89, accuracy: 0.001)
    }

    func testMarksComeOffOutOfPocket() {
        var dashboard = sample!
        dashboard.marks = [
            Mark(transactionId: "sample-014", markType: .paidBack, amount: 20.55, note: "Split groceries", updatedAt: "2026-11-06T12:00:00Z"),
        ]
        let november = MonthSummary(dashboard: dashboard, month: "2026-11")

        XCTAssertEqual(november.marksSum, 20.55, accuracy: 0.001)
        XCTAssertEqual(november.outOfPocket, 1235.60, accuracy: 0.001)
        XCTAssertEqual(november.total, 1256.15, accuracy: 0.001, "Marks don't change total spending")
        // The marked money also comes off the chart: Nov 5's bar and the
        // Groceries total drop from $41.10 to $20.55.
        XCTAssertEqual(november.daily[4].exRent, 20.55, accuracy: 0.001)
        XCTAssertEqual(november.categories.first { $0.category == "Groceries" }?.total, 20.55, accuracy: 0.001)
    }

    func testDailySeriesLeavesRentOutAndAveragesSevenDays() {
        let november = MonthSummary(dashboard: sample, month: "2026-11")
        let exRent = november.daily.map(\.exRent)

        XCTAssertEqual(november.daily.count, 8)
        XCTAssertEqual(exRent, [0, 0, 5.25, 0, 41.10, 9.80, 0, 0])
        XCTAssertEqual(november.daily[1].rent, 1200, accuracy: 0.001)
        XCTAssertEqual(november.daily[0].trend7, 0, accuracy: 0.001)
        XCTAssertEqual(november.daily[4].trend7, (5.25 + 0 + 41.10) / 5, accuracy: 0.001)
        XCTAssertEqual(november.daily[5].trend7, (5.25 + 0 + 41.10 + 9.80) / 6, accuracy: 0.001)
    }

    func testWeeksRunMondayToSunday() {
        let weeks = MonthSummary.weeks(in: sample.transactions, marks: sample.marks)

        XCTAssertEqual(weeks.count, 9)
        XCTAssertEqual(weeks.first?.end, "2026-09-06")
        XCTAssertEqual(weeks.first?.start, "2026-08-31")
        XCTAssertEqual(weeks.last?.end, "2026-11-08")
        XCTAssertEqual(weeks.last?.exRent ?? 0, 56.15, accuracy: 0.001)
        // A Tuesday purchase belongs to the week ending the following Sunday.
        XCTAssertEqual(DayKeys.weekEnding("2026-10-27"), "2026-11-01")
        XCTAssertEqual(DayKeys.weekEnding("2026-11-08"), "2026-11-08")
    }

    func testMonthTotals() {
        let months = MonthSummary.months(in: sample.transactions, marks: sample.marks)
        XCTAssertEqual(months.map(\.month), ["2026-09", "2026-10", "2026-11"])
        XCTAssertEqual(months.last?.exRent ?? 0, 56.15, accuracy: 0.001)
    }

    func testDecodesServerPayload() throws {
        let json = """
        {"data":{"seeded":true,"meta":null,"transactions":[{"id":"t1","date":"2026-11-03","name":"Coffee","category":"Food & drink","account":"Checking","amount":4,"pending":false,"brex_eligible":true}],"marks":[{"transaction_id":"t1","mark_type":"refunded","amount":4,"note":"","updated_at":"2026-11-04T00:00:00.000Z"}]}}
        """
        struct Envelope: Decodable { let data: Dashboard }
        let dashboard = try JSONDecoder().decode(Envelope.self, from: Data(json.utf8)).data

        XCTAssertEqual(dashboard.transactions.first?.brexEligible, true)
        XCTAssertEqual(dashboard.transactions.first?.amount, 4)
        XCTAssertEqual(dashboard.marks.first?.markType, .refunded)
        XCTAssertNil(dashboard.meta)
    }
}
