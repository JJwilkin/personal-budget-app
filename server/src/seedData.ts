// SAMPLE DATA ONLY — every transaction, balance and bill below is invented
// for demo/development. No real spending data lives in this repo. Replace
// this file with your own data (same shape) to run the dashboard for real.
// Seeded once into the DB by seedIfEmpty; afterwards the DB is the source of truth.
export const SEED_TRANSACTIONS = [
 {
  "id": "sample-001",
  "date": "2026-09-03",
  "name": "Corner Coffee",
  "category": "Food & drink",
  "account": "Checking",
  "amount": 4.5,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-002",
  "date": "2026-09-05",
  "name": "Green Grocer",
  "category": "Groceries",
  "account": "Checking",
  "amount": 62.3,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-003",
  "date": "2026-09-07",
  "name": "City Transit",
  "category": "Transport & rides",
  "account": "Checking",
  "amount": 2.75,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-004",
  "date": "2026-09-12",
  "name": "Bookstore",
  "category": "Shopping",
  "account": "Credit Card",
  "amount": 18.99,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-005",
  "date": "2026-09-15",
  "name": "Rideshare",
  "category": "Transport & rides",
  "account": "Credit Card",
  "amount": 12.4,
  "pending": false,
  "brex_eligible": true
 },
 {
  "id": "rent-2026-09",
  "date": "2026-09-02",
  "name": "Rent — your share",
  "category": "Rent",
  "account": "Checking",
  "amount": 1200,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-006",
  "date": "2026-09-20",
  "name": "Cinema",
  "category": "Entertainment",
  "account": "Credit Card",
  "amount": 16,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-007",
  "date": "2026-10-04",
  "name": "Restaurant",
  "category": "Food & drink",
  "account": "Credit Card",
  "amount": 48.2,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-008",
  "date": "2026-10-09",
  "name": "Food Delivery",
  "category": "Food & drink",
  "account": "Credit Card",
  "amount": 22.15,
  "pending": false,
  "brex_eligible": true
 },
 {
  "id": "sample-009",
  "date": "2026-10-11",
  "name": "Gym",
  "category": "Health",
  "account": "Credit Card",
  "amount": 20,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-010",
  "date": "2026-10-16",
  "name": "Online Store",
  "category": "Shopping",
  "account": "Credit Card",
  "amount": 34.99,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-011",
  "date": "2026-10-21",
  "name": "Pharmacy",
  "category": "Health",
  "account": "Checking",
  "amount": 12.8,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "rent-2026-10",
  "date": "2026-10-02",
  "name": "Rent — your share",
  "category": "Rent",
  "account": "Checking",
  "amount": 1200,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-012",
  "date": "2026-10-27",
  "name": "Airline",
  "category": "Travel",
  "account": "Credit Card",
  "amount": 189,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-013",
  "date": "2026-11-03",
  "name": "Corner Coffee",
  "category": "Food & drink",
  "account": "Checking",
  "amount": 5.25,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-014",
  "date": "2026-11-05",
  "name": "Green Grocer",
  "category": "Groceries",
  "account": "Checking",
  "amount": 41.1,
  "pending": false,
  "brex_eligible": false
 },
 {
  "id": "sample-015",
  "date": "2026-11-06",
  "name": "Rideshare",
  "category": "Transport & rides",
  "account": "Credit Card",
  "amount": 9.8,
  "pending": false,
  "brex_eligible": true
 },
 {
  "id": "rent-2026-11",
  "date": "2026-11-02",
  "name": "Rent — your share",
  "category": "Rent",
  "account": "Checking",
  "amount": 1200,
  "pending": false,
  "brex_eligible": false
 }
];
export const SEED_META = {
 "asOf": "2026-11-08",
 "accounts": [
  {
   "label": "Checking",
   "balance": "$2,450.00",
   "owed": false
  },
  {
   "label": "Credit Card",
   "balance": "$860.20",
   "owed": true
  }
 ],
 "brexDeposits": [
  {
   "date": "Sep 28, 2026",
   "payer": "ACME INC BREX REIMB",
   "amount": 25.5
  },
  {
   "date": "Oct 9, 2026",
   "payer": "ACME INC BREX REIMB",
   "amount": 41.25
  }
 ],
 "brexReceivedByMonth": {
  "2026-09": 25.5,
  "2026-10": 41.25,
  "2026-11": 0
 },
 "recurring": [
  {
   "name": "Rent — your share",
   "detail": "Checking · monthly",
   "amount": 1200,
   "cadence": "monthly · last Nov 2"
  },
  {
   "name": "Internet",
   "detail": "Checking",
   "amount": 60,
   "cadence": "monthly · last Oct 23"
  },
  {
   "name": "Electric",
   "detail": "Credit Card · varies with usage",
   "amount": 45,
   "cadence": "monthly · last Oct 17"
  },
  {
   "name": "Car insurance",
   "detail": "Credit Card",
   "amount": 110,
   "cadence": "monthly · last Oct 16"
  },
  {
   "name": "Streaming",
   "detail": "Credit Card",
   "amount": 11,
   "cadence": "monthly · last Oct 10"
  }
 ]
} as const;
