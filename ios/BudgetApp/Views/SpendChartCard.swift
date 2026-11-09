import Charts
import SwiftUI

enum ChartRange: String, CaseIterable, Identifiable {
    case day = "Day"
    case week = "Week"
    case month = "Month"
    var id: Self { self }
}

/// The one spending chart, with a Day / Week / Month switch. Rent is left out
/// of every bar so everyday spending stays readable; tap or drag to inspect a bar.
struct SpendChartCard: View {
    let summary: MonthSummary
    let weeks: [WeekBucket]
    let months: [MonthTotal]

    @State private var range: ChartRange = .day
    @State private var selectedDate: Date?
    @State private var selectedLabel: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Picker("Chart range", selection: $range) {
                ForEach(ChartRange.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)

            header

            Group {
                switch range {
                case .day: dailyChart
                case .week: weeklyChart
                case .month: monthlyChart
                }
            }
            .frame(height: 190)

            Text(footnote)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
        .onChange(of: range) {
            selectedDate = nil
            selectedLabel = nil
        }
        .onChange(of: summary.month) {
            selectedDate = nil
        }
    }

    // MARK: Header

    private var header: some View {
        let (caption, value, detail) = headerText
        return VStack(alignment: .leading, spacing: 2) {
            Text(caption)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(value)
                .font(.title2.weight(.bold))
                .monospacedDigit()
                .contentTransition(.numericText())
            Text(detail)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .animation(.snappy, value: value)
    }

    private var headerText: (String, String, String) {
        switch range {
        case .day:
            if let point = selectedDay {
                return (DayKeys.long(point.iso), Money.format(point.exRent), "3-day average \(Money.format(point.trend3))")
            }
            return ("Daily average, rent aside", Money.format(summary.perDayExRent), "\(Money.format(summary.outOfPocketExRent)) over \(summary.daysCovered) days")
        case .week:
            if let week = weeks.first(where: { $0.label == selectedLabel }) {
                return ("\(DayKeys.short(week.start)) – \(DayKeys.short(week.end))", Money.format(week.exRent), week.rent > 0 ? "+ \(Money.whole(week.rent)) rent" : "No rent this week")
            }
            let average = weeks.isEmpty ? 0 : weeks.map(\.exRent).reduce(0, +) / Double(weeks.count)
            return ("Weekly average, rent aside", Money.format(average), "Across \(weeks.count) weeks")
        case .month:
            if let month = months.first(where: { $0.label == selectedLabel }) {
                return (DayKeys.monthTitle(month.month), Money.format(month.exRent), "+ \(Money.whole(month.rent)) rent")
            }
            let average = months.isEmpty ? 0 : months.map(\.exRent).reduce(0, +) / Double(months.count)
            return ("Monthly average, rent aside", Money.format(average), "Across \(months.count) months")
        }
    }

    private var footnote: String {
        switch range {
        case .day: "Rent is left out of the bars. The orange line is the 3-day moving average."
        case .week: "Weeks run Monday to Sunday. Rent is left out of the bars."
        case .month: "Rent is left out of the bars. Tap a month to see its total."
        }
    }

    // MARK: Charts

    private var selectedDay: DailyPoint? {
        guard let selectedDate else { return nil }
        return summary.daily.first { DayKeys.calendar.isDate($0.date, inSameDayAs: selectedDate) }
    }

    private var dailyChart: some View {
        Chart {
            ForEach(summary.daily) { point in
                BarMark(
                    x: .value("Day", point.date, unit: .day),
                    y: .value("Spending", point.exRent)
                )
                .foregroundStyle(barColor(isSelected: point.id == selectedDay?.id))
                .cornerRadius(3)
            }
            ForEach(summary.daily) { point in
                LineMark(
                    x: .value("Day", point.date, unit: .day),
                    y: .value("3-day average", point.trend3)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(.orange)
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
            }
        }
        .chartXSelection(value: $selectedDate)
        .chartXAxis {
            AxisMarks(values: .stride(by: .day, count: 7)) { _ in
                AxisGridLine()
                AxisValueLabel(format: .dateTime.day())
            }
        }
        .chartYAxis { moneyAxis }
        .accessibilityLabel("Daily spending in \(DayKeys.monthName(summary.month)), rent left out")
    }

    private var weeklyChart: some View {
        Chart(weeks) { week in
            BarMark(
                x: .value("Week ending", week.label),
                y: .value("Spending", week.exRent)
            )
            .foregroundStyle(barColor(isSelected: week.label == selectedLabel, hasSelection: selectedLabel != nil))
            .cornerRadius(3)
        }
        .chartXSelection(value: $selectedLabel)
        .chartXAxis {
            AxisMarks { _ in
                AxisValueLabel().font(.caption2)
            }
        }
        .chartYAxis { moneyAxis }
        .accessibilityLabel("Weekly spending, rent left out")
    }

    private var monthlyChart: some View {
        Chart(months) { month in
            BarMark(
                x: .value("Month", month.label),
                y: .value("Spending", month.exRent)
            )
            .foregroundStyle(barColor(isSelected: month.label == selectedLabel || (selectedLabel == nil && month.month == summary.month), hasSelection: true))
            .cornerRadius(4)
        }
        .chartXSelection(value: $selectedLabel)
        .chartYAxis { moneyAxis }
        .accessibilityLabel("Monthly spending, rent left out")
    }

    private var moneyAxis: some AxisContent {
        AxisMarks(position: .leading) { value in
            AxisGridLine()
            AxisValueLabel {
                if let amount = value.as(Double.self) {
                    Text(Money.whole(amount))
                }
            }
        }
    }

    private func barColor(isSelected: Bool, hasSelection: Bool? = nil) -> Color {
        let anySelected = hasSelection ?? (selectedDate != nil)
        if !anySelected || isSelected { return .accentColor }
        return .accentColor.opacity(0.3)
    }
}

#Preview {
    let store = DashboardStore.preview
    return List {
        if let summary = store.summary {
            SpendChartCard(summary: summary, weeks: store.weeks, months: store.monthTotals)
        }
    }
}
