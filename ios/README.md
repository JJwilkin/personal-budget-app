# Budget for iOS

A native SwiftUI app for the spending dashboard, separate from the web
client. It's built mobile first in the iOS style: large titles, inset grouped
lists, a Day / Week / Month chart, swipe actions, and a tab bar
(Overview · Activity · Brex · Bills).

It talks to the same server as the web dashboard (`POST /actions`), so marks
you save on the phone show up on the web and the other way around. Until you
connect a server it runs on the bundled sample data
(`BudgetApp/Resources/SampleDashboard.json`, the same invented data as
`server/src/seedData.ts`).

## Requirements

- Xcode 15 or later (iOS 17 SDK). The app targets iOS 17.
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) to create the Xcode project
  from `project.yml`.

## Open it in Xcode

```bash
brew install xcodegen
```

```bash
cd ios && xcodegen generate && open BudgetApp.xcodeproj
```

Pick an iPhone simulator and press Run. For a real phone, choose your team
under Signing & Capabilities and change the bundle identifier
(`com.example.personalbudget.app`) to one you own.

The generated `BudgetApp.xcodeproj` is gitignored. Edit `project.yml` and run
`xcodegen generate` again rather than changing project settings in Xcode.

## Connect to the server

1. From the repo root, start the local server:

   ```bash
   bun run dev
   ```

2. In the app, open Overview → the gear icon → turn on **Connect to my
   server**.
3. Enter the address:
   - Simulator: `http://localhost:5173`
   - iPhone on the same Wi-Fi: your computer's address, like
     `http://192.168.1.20:5173`. iOS asks for local network permission the
     first time.
4. Tap **Test Connection**, then **Done**.

Plain `http` works only for local addresses (`NSAllowsLocalNetworking` in
`Support/Info.plist`). A server on the internet needs `https`.

## Layout

- `BudgetApp/Models/`: `Dashboard.swift` (the server payload),
  `MonthSummary.swift` (all spending math, matching the web dashboard),
  `DayKeys.swift` (date and money formatting)
- `BudgetApp/Services/`: `APIClient.swift` (the `/actions` endpoint),
  `DashboardStore.swift` (app state, marks, settings), `SampleData.swift`
- `BudgetApp/Views/`: one file per screen, plus shared pieces in
  `Components.swift`
- `BudgetAppTests/`: tests for the spending math against the sample data

## How the numbers work

The same rules as the web dashboard:

- **Out of pocket** is the month's spending minus Brex reimbursements that
  actually landed, minus anything you marked as paid back, reimbursed or
  refunded.
- **Everyday spending** is out of pocket with rent set aside. Rent is your
  share only, net of your roommate's transfer.
- Charts leave rent out of the bars so the rest of your spending is readable.
  The daily chart's orange line is the trailing 3-day average.
- One difference from the web chart: the daily series includes days with no
  spending as zeros, so the 3-day average covers calendar days.

Run the tests with ⌘U in Xcode.
