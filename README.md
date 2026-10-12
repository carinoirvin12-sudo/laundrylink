# LaundryLink — Laundry Management System

A full-stack laundry management application built with **React, TypeScript, Tailwind CSS, Node.js, Express, and MongoDB Atlas**.

> **Course:** CTADWEBL — Advanced Web Programming
> **Project type:** Final Project
> **Repository:** https://github.com/carinoirvin12-sudo/laundrylink

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Group Members](#2-group-members)
3. [Technology Stack](#3-technology-stack)
4. [Features](#4-features)
5. [Laundry Services](#5-laundry-services)
6. [Business Rules and Data Processing](#6-business-rules-and-data-processing)
7. [Application Pages](#7-application-pages)
8. [Database Design](#8-database-design)
9. [Project Structure](#9-project-structure)
10. [Setup Instructions](#10-setup-instructions)
11. [Environment Variables](#11-environment-variables)
12. [REST API Documentation](#12-rest-api-documentation)
13. [Error Handling](#13-error-handling)
14. [Frontend Architecture](#14-frontend-architecture)
15. [Testing](#15-testing)
16. [Screenshots](#16-screenshots)
17. [Known Limitations](#17-known-limitations)

---

## 1. Project Overview

LaundryLink is a web-based laundry management system that helps a laundry shop run its daily operations from one place. It manages customers, laundry services, orders, washing and drying machines, payments, and reports.

It does more than store and display records. The application **computes and evaluates** data:

- Automatic order pricing with a minimum charge per service
- Bulk and loyalty discounts
- Payment balances for partial and full payments
- Machine availability and capacity checking, with double-booking prevention
- Priority-based order scheduling (first in, first out within the same priority)
- Rule-based order status transitions
- Due dates, overdue pickup detection, and revenue statistics

**Data processed:** customers, services (price per kg, minimum charge, turnaround time), orders (weight, discounts, totals, workflow status, due dates), machines (type, capacity, maintenance state), and payments (amount, method, date).

## 2. Group Members

| Member                    | GitHub                | Main Contribution                                  |
| ------------------------- | --------------------- | -------------------------------------------------- |
| IRVIN CARL T. CARIÑO      | [@carinoirvin12-sudo] | Base web setup, flow and business rules            |
| LLEYTON JOHN D. FERNANDEZ | [@dharmatown]         | Frontend design, web plan and machine and services |
| PAUL JOHN F. LUCBAN       | [@pauljohnlucban77]   | Web documentation, dashboard and reports           |
| TIFFANY AHYAN M. REYES    | [@tany903]            | Orders and customers                               |

## 3. Technology Stack

**Frontend**

- React (Vite) with TypeScript
- Tailwind CSS (custom theme with light and dark mode)
- React Router
- Axios (single configured instance)
- React Hook Form
- Zod and @hookform/resolvers

**Backend**

- Node.js and Express
- MongoDB Atlas with Mongoose
- CORS
- dotenv

**Tools:** Visual Studio Code, Git and GitHub, npm

## 4. Features

- **Landing page:** an introduction to LaundryLink with feature highlights and navigation to the system.
- **Dashboard:** active orders, status counts, machine availability, revenue, overdue pickups, and priority queue information.
- **Customer management:** create, view, update, and delete customers, with a summary page showing order history, totals, outstanding balance, and loyalty status.
- **Order management:** create, view, search, filter, and paginate orders (five per page). Notes can be edited, and eligible orders can be cancelled or deleted.
- **Point-of-sale order creation:** create an order for a new or existing customer, preview the quotation (subtotal, discounts, total, and due date), then save.
- **Machine management:** manage washers and dryers separately, with capacity, maintenance state, and computed availability.
- **Priority queue:** waiting orders are ordered Express, then Priority, then Standard, and first in, first out within the same priority.
- **Payments:** record cash, GCash, and bank payments. Partial payments are supported, but an order must be fully paid before it can be claimed.
- **Discounts:** bulk and loyalty discounts are applied automatically.
- **Overdue pickups:** a page listing ready orders that are past their due date.
- **Reports:** revenue totals, payment counts, and a breakdown by payment method, with optional date filtering.
- **Light and dark theme toggle.**

## 5. Laundry Services

| Service          | Price per kg | Minimum charge | Turnaround |
| ---------------- | ------------ | -------------- | ---------- |
| Standard Laundry | ₱50.00       | ₱50.00         | 24 hours   |
| Priority Laundry | ₱65.00       | ₱65.00         | 12 hours   |
| Express Laundry  | ₱80.00       | ₱80.00         | 6 hours    |

All three services include Wash + Dry + Fold. These are the demonstration packages. Prices and turnaround values are stored in the database and managed on the Services page.

## 6. Business Rules and Data Processing

### Weight and machine capacity

- Each order must weigh between **1 kg and 15 kg**.
- Machines have a maximum capacity of 15 kg. Loads above 15 kg must be split into separate orders.

### Pricing and discounts

`subtotal = max(weightKg × pricePerKg, minimum charge)`, then the discount percentage is deducted from the subtotal.

| Eligibility                                           | Discount |
| ----------------------------------------------------- | -------- |
| Neither condition                                     | 0%       |
| Bulk only (order weighs 10 kg or more)                | 5%       |
| Loyalty only (customer has at least 5 claimed orders) | 5%       |
| Bulk and loyalty                                      | 10%      |

**Example:** a loyal customer sends 10 kg of Standard Laundry.

| Calculation          | Amount      |
| -------------------- | ----------- |
| Subtotal: 10 × ₱50   | ₱500.00     |
| Bulk discount: 5%    | −₱25.00     |
| Loyalty discount: 5% | −₱25.00     |
| **Final total**      | **₱450.00** |

### Order workflow

```
Received → Washing → Drying → Folding → Ready → Claimed
```

| Status    | Description                                                 |
| --------- | ----------------------------------------------------------- |
| Received  | Order accepted and waiting for a washer                     |
| Washing   | A washer is assigned and occupied                           |
| Drying    | The washer is released and a dryer is assigned and occupied |
| Folding   | The dryer is released and laundry is being prepared         |
| Ready     | Laundry is ready for pickup                                 |
| Claimed   | Customer collected the fully paid order                     |
| Cancelled | Eligible unpaid order was cancelled                         |

### Machine availability

- A machine must be active and have enough capacity for the load.
- A washer is occupied while its assigned order is **Washing**. A dryer is occupied while its assigned order is **Drying**.
- Moving an order to Drying releases its washer. Moving it to Folding releases its dryer.
- Availability is derived from order assignments. It is never marked "in use" by hand.
- Status changes run inside database transactions, so two orders cannot take the same machine.

### Payments and restrictions

- Payment amounts must be at least ₱1, have at most two decimal places, and cannot exceed the remaining balance.
- Payments cannot be recorded for cancelled or claimed orders.
- An order cannot be claimed until it is fully paid.
- Only **Received** orders with no payments can be cancelled.
- Only **Received** or **Cancelled** orders can be deleted.
- A customer with orders cannot be deleted. A machine with order history cannot be deleted. A service used by an order is archived (set inactive) instead of deleted.

### Due dates and overdue orders

The due date is calculated from the selected service's turnaround time when the order is created. An order is **overdue** when it is Ready, past its due date, and not yet claimed.

## 7. Application Pages

| Page             | Route            | Purpose                                |
| ---------------- | ---------------- | -------------------------------------- |
| Landing          | `/`              | System introduction                    |
| Dashboard        | `/dashboard`     | Operational overview                   |
| Orders           | `/orders`        | Search, filter, and paginate orders    |
| New Order        | `/orders/new`    | Create an order with a price preview   |
| Order Details    | `/orders/:id`    | Workflow transitions and payments      |
| Customers        | `/customers`     | Customer management                    |
| Customer Details | `/customers/:id` | Customer information and order history |
| Machines         | `/machines`      | Machine management                     |
| Services         | `/services`      | Service management                     |
| Overdue Pickups  | `/overdue`       | Overdue monitoring                     |
| Reports          | `/reports`       | Revenue and operational reports        |

The frontend has 11 routed pages (including the landing page) and a catch-all route for unknown URLs.

## 8. Database Design

Five Mongoose models, all with timestamps (`createdAt`, `updatedAt`):

| Model    | Purpose                           | Relationships                             |
| -------- | --------------------------------- | ----------------------------------------- |
| Customer | Customer information              | Referenced by Order                       |
| Service  | Laundry packages and pricing      | Referenced by Order                       |
| Machine  | Washers and dryers                | Referenced by Order (as washer and dryer) |
| Order    | Laundry transactions and workflow | References Customer, Service, and Machine |
| Payment  | Payment transactions              | References Order                          |

**Relationships:** one customer has many orders, one service is used by many orders, an order references one washer and one dryer, and one order has many payments.

**Validation rules include:** required fields, `min` and `max` values, `enum` values, defaults, unique customer phone numbers (Philippine format `09XXXXXXXXX`), unique machine and service names, and monetary values limited to two decimal places.

## 9. Project Structure

```
laundrylink/
├── backend/
│   ├── src/
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # express.Router() modules
│   │   ├── seed/            # Optional sample data and backup scripts
│   │   ├── app.js           # Middleware, route mounting, 404, error handler
│   │   └── server.js        # Database connection and server start
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Theme provider and toggle
│   │   ├── hooks/           # useDebounce
│   │   ├── layouts/         # AppLayout
│   │   ├── pages/           # One folder per page
│   │   ├── schemas/         # Zod schemas
│   │   ├── services/        # Configured axios instance (api.ts)
│   │   └── App.tsx          # Routes
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```

## 10. Setup Instructions

### Prerequisites

- Node.js and npm
- A MongoDB Atlas cluster (the free tier works). Atlas is required because the backend uses database transactions, which need a replica set.
- Git
- A code editor such as Visual Studio Code

### 1. Get the code

```bash
git clone https://github.com/carinoirvin12-sudo/laundrylink.git
cd laundrylink
```

### 2. Prepare MongoDB Atlas

1. Create a free cluster.
2. Under **Database Access**, create a database user with a username and password.
3. Under **Network Access**, allow your IP address (or `0.0.0.0/0` for testing).
4. Click **Connect → Drivers** and copy the connection string. Replace `<password>` with your user's password and add a database name (for example `laundrylink`) before the `?`.

A group can share one cluster. Every member uses the same `MONGO_URI` in their own `.env`.

### 3. Backend

```bash
cd backend
npm install
```

Create `backend/.env` (copy `.env.example`) and fill in your values (see [Environment Variables](#11-environment-variables)). Then start the server:

```bash
npm run dev
```

The API runs at `http://localhost:5000`. All API routes start with `/api`.

### 4. Frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env` (copy `.env.example`), then start the app:

```bash
npm run dev
```

Open `http://localhost:5173` (or the URL Vite prints if that port is taken). Restart the Vite server after editing `.env`.

### 5. Add data

The database starts empty. Add data through the app itself:

1. **Services** page: add the three services listed in [Laundry Services](#5-laundry-services).
2. **Machines** page: add Washer 01, Washer 02, Dryer 01, and Dryer 02 (15 kg each, Active).
3. **Customers** and **New Order** pages: add sample customers and orders.

#### Optional: sample data script

The backend also includes a script that fills the database with sample records:

```bash
cd backend
npm run seed
```

> ⚠️ **The seed script deletes all existing customers, services, machines, orders, and payments before inserting sample data.** Do not run it on a database that holds data you want to keep.

### Troubleshooting

- **Backend cannot connect:** check `MONGO_URI`, URL-encode special characters in the password, and make sure your IP is allowed in Atlas. `server.js` sets Google DNS (8.8.8.8) for Atlas SRV lookups, which fixes some networks where SRV resolution fails.
- **Frontend shows network errors:** confirm the backend is running and `VITE_API_BASE_URL` matches its port.
- **`npm run dev` is not recognized:** run it inside `backend/` or `frontend/`, not the repository root.

### Build and syntax checks

```bash
cd frontend && npm run build
cd backend && node --check src/app.js
```

## 11. Environment Variables

| File            | Variable            | Description                     | Example                                                       |
| --------------- | ------------------- | ------------------------------- | ------------------------------------------------------------- |
| `backend/.env`  | `PORT`              | Port for the Express server     | `5000`                                                        |
| `backend/.env`  | `MONGO_URI`         | MongoDB Atlas connection string | `mongodb+srv://user:password@cluster.mongodb.net/laundrylink` |
| `frontend/.env` | `VITE_API_BASE_URL` | Base URL of the backend API     | `http://localhost:5000/api`                                   |

`.env` files are ignored by Git. Only the `.env.example` files are committed.

## 12. REST API Documentation

The API uses JSON requests and responses and has **36 endpoints**. Object IDs and timestamps vary per database. Sample responses are trimmed to the most relevant fields.

**Common error responses** (every error uses the same format):

| Status | Meaning                                                     | Body                                                                |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| 400    | Validation error or invalid ID                              | `{ "message": "Invalid order ID" }`                                 |
| 404    | Record or route not found                                   | `{ "message": "Order not found" }`                                  |
| 409    | Rule conflict (for example a duplicate or a blocked delete) | `{ "message": "Only received or cancelled orders can be deleted" }` |
| 500    | Unexpected server error                                     | `{ "message": "Internal server error" }`                            |

### 12.1 Customers

Sample customer object:

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "fullName": "Juan Dela Cruz",
  "phone": "09123456789",
  "address": "Clark, Pampanga",
  "createdAt": "2026-10-09T11:35:16.356Z",
  "updatedAt": "2026-10-09T11:35:16.356Z"
}
```

| Method | Path                         | Purpose                                        | Sample request                                                                          | Sample response                                                                                                                                                                                                                                 |
| ------ | ---------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/customers`             | List customers (sorted by name)                | `GET /api/customers`                                                                    | `200` array of customer objects                                                                                                                                                                                                                 |
| POST   | `/api/customers`             | Create a customer                              | Body: `{"fullName":"Juan Dela Cruz","phone":"09123456789","address":"Clark, Pampanga"}` | `201` the new customer object. An empty body returns `400 {"message":"Full name is required"}`                                                                                                                                                  |
| GET    | `/api/customers/:id/summary` | Customer summary with order history and totals | `GET /api/customers/507f1f77bcf86cd799439011/summary`                                   | `200` `{"customer":{...},"summary":{"totalOrders":6,"claimedOrders":5,"activeOrders":1,"cancelledOrders":0,"totalOrderValue":1800,"totalPaid":1500,"outstandingBalance":300,"isLoyalCustomer":true,"loyaltyDiscountPercent":5},"orders":[...]}` |
| GET    | `/api/customers/:id`         | Get one customer                               | `GET /api/customers/507f1f77bcf86cd799439011`                                           | `200` customer object                                                                                                                                                                                                                           |
| PUT    | `/api/customers/:id`         | Update a customer                              | Body: `{"fullName":"Juan D. Cruz","phone":"09123456789","address":"Angeles City"}`      | `200` the updated customer object                                                                                                                                                                                                               |
| DELETE | `/api/customers/:id`         | Delete a customer with no orders               | `DELETE /api/customers/507f1f77bcf86cd799439011`                                        | `200` `{"message":"Customer deleted successfully"}`. A customer with orders returns `409`                                                                                                                                                       |

### 12.2 Services

Sample service object:

```json
{
  "_id": "507f191e810c19729de860ea",
  "name": "Standard Laundry",
  "pricePerKg": 50,
  "minCharge": 50,
  "turnaroundHours": 24,
  "isActive": true
}
```

| Method | Path                | Purpose                                                  | Sample request                                                                          | Sample response                                                                                                                                                |
| ------ | ------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/services`     | List services (optional `?active=true` or `false`)       | `GET /api/services?active=true`                                                         | `200` array of service objects                                                                                                                                 |
| POST   | `/api/services`     | Create a service                                         | Body: `{"name":"Standard Laundry","pricePerKg":50,"minCharge":50,"turnaroundHours":24}` | `201` the new service object                                                                                                                                   |
| GET    | `/api/services/:id` | Get one service                                          | `GET /api/services/507f191e810c19729de860ea`                                            | `200` service object                                                                                                                                           |
| PUT    | `/api/services/:id` | Update a service (any allowed field)                     | Body: `{"pricePerKg":55}`                                                               | `200` the updated service object                                                                                                                               |
| DELETE | `/api/services/:id` | Delete an unused service, or archive one that has orders | `DELETE /api/services/507f191e810c19729de860ea`                                         | `200` `{"message":"Unused service deleted successfully","archived":false}` or `{"message":"Service archived successfully...","archived":true,"service":{...}}` |

### 12.3 Machines

Sample machine object:

```json
{
  "_id": "507f1f77bcf86cd799439021",
  "name": "Washer 01",
  "type": "washer",
  "capacityKg": 15,
  "status": "active"
}
```

| Method | Path                         | Purpose                                                    | Sample request                                               | Sample response                                                                                                      |
| ------ | ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/machines`              | List machines                                              | `GET /api/machines`                                          | `200` array of machine objects                                                                                       |
| GET    | `/api/machines/availability` | Computed availability (optional `?weightKg=` and `?type=`) | `GET /api/machines/availability?weightKg=8&type=washer`      | `200` array of machines, each with `isBusy`, `isAvailable`, `hasCapacity`, `availabilityStatus`, and `displayStatus` |
| POST   | `/api/machines`              | Create a machine                                           | Body: `{"name":"Washer 01","type":"washer","capacityKg":15}` | `201` the new machine object                                                                                         |
| GET    | `/api/machines/:id`          | Get one machine                                            | `GET /api/machines/507f1f77bcf86cd799439021`                 | `200` machine object                                                                                                 |
| PUT    | `/api/machines/:id`          | Update a machine (for example set maintenance)             | Body: `{"status":"maintenance"}`                             | `200` the updated machine object                                                                                     |
| DELETE | `/api/machines/:id`          | Delete a machine with no order history                     | `DELETE /api/machines/507f1f77bcf86cd799439021`              | `200` `{"message":"Unused machine deleted successfully"}`. A machine with history returns `409`                      |

### 12.4 Orders

Sample order object (populated and trimmed):

```json
{
  "_id": "507f1f77bcf86cd799439012",
  "customer": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "Juan Dela Cruz",
    "phone": "09123456789"
  },
  "service": {
    "_id": "507f191e810c19729de860ea",
    "name": "Standard Laundry",
    "pricePerKg": 50
  },
  "washer": null,
  "dryer": null,
  "weightKg": 5,
  "discountPercent": 0,
  "totalPrice": 250,
  "status": "received",
  "dueDate": "2026-10-10T11:35:16.356Z",
  "notes": "Handle with care"
}
```

| Method | Path                      | Purpose                                                                                                                                             | Sample request                                                                                                                                                                                                                               | Sample response                                                                                                                                                |
| ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/orders`             | List orders (newest first)                                                                                                                          | `GET /api/orders`                                                                                                                                                                                                                            | `200` array of order objects                                                                                                                                   |
| POST   | `/api/orders/pos`         | Point-of-sale creation for a new or existing customer                                                                                               | Existing customer: `{"customerType":"existing","customerId":"507f1f77bcf86cd799439011","service":"507f191e810c19729de860ea","weightKg":5}`. For a new customer, use `"customerType":"new"` and send the new customer's details in `customer` | `201` `{"message":"Laundry order created successfully","customerCreated":false,"order":{...},"pricing":{"subtotal":250,"discountPercent":0,"totalPrice":250}}` |
| POST   | `/api/orders`             | Create an order for an existing customer                                                                                                            | Body: `{"customer":"507f1f77bcf86cd799439011","service":"507f191e810c19729de860ea","weightKg":5,"notes":"Handle with care"}`                                                                                                                 | `201` `{"order":{...},"pricing":{"subtotal":250,"discountPercent":0,"totalPrice":250}}`                                                                        |
| POST   | `/api/orders/quote`       | Calculate a price quotation without saving                                                                                                          | Body: `{"customer":"507f1f77bcf86cd799439011","service":"507f191e810c19729de860ea","weightKg":10}`                                                                                                                                           | `200` `{"customer":{...},"service":{...},"weightKg":10,"subtotal":500,"discountPercent":5,"totalPrice":475,"dueDate":"..."}`                                   |
| GET    | `/api/orders/queue`       | Waiting orders by priority, then first in, first out                                                                                                | `GET /api/orders/queue`                                                                                                                                                                                                                      | `200` array of Received orders, Express first                                                                                                                  |
| GET    | `/api/orders/overdue`     | Ready orders past their due date                                                                                                                    | `GET /api/orders/overdue`                                                                                                                                                                                                                    | `200` array of overdue orders, oldest due date first                                                                                                           |
| GET    | `/api/orders/search`      | Filter by `status`, `customer`, `service`, `from`, `to`, and sort with `sort` (`newest`, `oldest`, `dueSoon`, `dueLatest`, `priceHigh`, `priceLow`) | `GET /api/orders/search?status=ready&sort=dueSoon`                                                                                                                                                                                           | `200` array of matching orders. An unknown status or sort returns `400`                                                                                        |
| GET    | `/api/orders/:id/balance` | Payment balance                                                                                                                                     | `GET /api/orders/507f1f77bcf86cd799439012/balance`                                                                                                                                                                                           | `200` `{"orderId":"...","totalPrice":250,"totalPaid":100,"balance":150,"paymentStatus":"partial","payments":[...]}`                                            |
| PATCH  | `/api/orders/:id/status`  | Rule-based status change                                                                                                                            | `{"status":"washing","washer":"<machineId>"}`, `{"status":"drying","dryer":"<machineId>"}`, `{"status":"folding"}`, `{"status":"ready"}`, `{"status":"claimed"}`, or `{"status":"cancelled"}`                                                | `200` the updated order. An invalid transition, busy machine, or unpaid claim returns `409`                                                                    |
| GET    | `/api/orders/:id`         | Get one order                                                                                                                                       | `GET /api/orders/507f1f77bcf86cd799439012`                                                                                                                                                                                                   | `200` order object. A missing order returns `404 {"message":"Order not found"}`                                                                                |
| PUT    | `/api/orders/:id`         | Update an order (only `notes` can be edited)                                                                                                        | Body: `{"notes":"Fragile items"}`                                                                                                                                                                                                            | `200` the updated order                                                                                                                                        |
| DELETE | `/api/orders/:id`         | Delete a Received or Cancelled order                                                                                                                | `DELETE /api/orders/507f1f77bcf86cd799439012`                                                                                                                                                                                                | `200` `{"message":"Order deleted successfully"}`                                                                                                               |

### 12.5 Payments

| Method | Path                | Purpose                                                  | Sample request                                                                                        | Sample response                                                                                                                                                               |
| ------ | ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/payments`     | List payments (newest first)                             | `GET /api/payments`                                                                                   | `200` array of payments with their order and customer                                                                                                                         |
| POST   | `/api/payments`     | Record a payment                                         | Body: `{"order":"507f1f77bcf86cd799439012","amount":100,"method":"cash","remarks":"Partial payment"}` | `201` `{"payment":{...},"totalPrice":250,"totalPaid":100,"balance":150,"paymentStatus":"partial"}`. Overpayment returns `400 {"message":"Payment exceeds remaining balance"}` |
| GET    | `/api/payments/:id` | Get one payment                                          | `GET /api/payments/507f1f77bcf86cd799439031`                                                          | `200` payment object                                                                                                                                                          |
| DELETE | `/api/payments/:id` | Delete a payment (not allowed once the order is claimed) | `DELETE /api/payments/507f1f77bcf86cd799439031`                                                       | `200` `{"message":"Payment deleted successfully"}`                                                                                                                            |

### 12.6 Statistics

| Method | Path                        | Purpose                                                    | Sample request                                         | Sample response                                                                                                                                                                                                                                                         |
| ------ | --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/stats/summary`        | Dashboard statistics                                       | `GET /api/stats/summary`                               | `200` `{"customers":{"total":12},"services":{"total":3,"active":3},"machines":{"total":4,"available":3,"inUse":1,"washers":2,"dryers":2},"orders":{"total":20,"received":4,"washing":1,"ready":3,"claimed":10},"priorityQueue":{"waiting":4},"revenue":{"total":5400}}` |
| GET    | `/api/stats/priority-queue` | Priority queue summary                                     | `GET /api/stats/priority-queue`                        | `200` array of waiting orders in priority order                                                                                                                                                                                                                         |
| GET    | `/api/stats/revenue`        | Revenue from payments (optional `?from=` and `?to=` dates) | `GET /api/stats/revenue?from=2026-10-01&to=2026-10-09` | `200` `{"filters":{"from":"2026-10-01","to":"2026-10-09"},"totalRevenue":5400,"paymentCount":18,"byMethod":{"cash":3000,"gcash":2000,"bank":400},"payments":[...]}`                                                                                                     |

### 12.7 Error examples

```http
POST /api/customers
{}
```

```json
{ "message": "Full name is required" }
```

_Status 400_

```http
GET /api/orders/invalid-id
```

```json
{ "message": "Invalid order ID" }
```

_Status 400_

```http
GET /api/orders/000000000000000000000000
```

```json
{ "message": "Order not found" }
```

_Status 404_

```http
GET /api/does-not-exist
```

```json
{ "message": "Route not found" }
```

_Status 404_

## 13. Error Handling

`app.js` registers middleware in this order:

1. CORS and JSON body parsing
2. Custom request logger (timestamp, method, URL)
3. Route mounting under `/api/...`
4. JSON 404 catch-all
5. Global error handler

The error handler returns a consistent `{ "message": "..." }` body and maps:

| Error                                               | Status                                            |
| --------------------------------------------------- | ------------------------------------------------- |
| Mongoose validation error                           | 400                                               |
| Invalid ObjectId (cast error)                       | 400                                               |
| Duplicate key (for example a repeated phone number) | 409                                               |
| Explicit rule conflicts                             | 409                                               |
| Anything unexpected                                 | 500, with internal details hidden from the client |

## 14. Frontend Architecture

- **Routing:** React Router with a shared `AppLayout` for the management pages.
- **API calls:** every request goes through one Axios instance (`services/api.ts`) created with `axios.create` and a base URL from `VITE_API_BASE_URL`.
- **Forms:** React Hook Form with Zod schemas defined outside the components (`schemas/`), types from `z.infer`, and per-field error messages.
- **Custom hook:** `useDebounce` (in `hooks/`) delays customer searching.
- **Orders list:** status filtering, text search, priority-aware sorting, five records per page, and Previous/Next navigation.
- **User feedback:** loading and error states on data screens, empty states, confirmation before deleting, and success messages after changes.
- **Styling:** Tailwind CSS with a custom theme, a responsive layout, and a light/dark toggle.

## 15. Testing

The following were tested manually during development:

| Test                                              | Result |
| ------------------------------------------------- | ------ |
| Create and claim an order                         | Passed |
| Washing to drying transition (washer released)    | Passed |
| Drying to folding transition (dryer released)     | Passed |
| Prevent assignment of occupied washers and dryers | Passed |
| Priority scheduling                               | Passed |
| Partial and full payment                          | Passed |
| Reject overpayment, zero, and negative payments   | Passed |
| Cancel an eligible unpaid order                   | Passed |
| Delete an eligible cancelled order                | Passed |
| Protect paid and completed orders                 | Passed |
| Bulk, loyalty, and combined discounts             | Passed |
| Orders pagination and filtering                   | Passed |
| HTTP 200, 201, 400, and 404 responses             | Passed |
| Frontend production build                         | Passed |

These are manual tests of selected cases, not automated integration, concurrency, security, or performance tests.

## 16. Screenshots

| Page                       | Screenshot                                               |
| -------------------------- | -------------------------------------------------------- |
| Landing                    | ![Landing page](docs/screenshots/landing.png)            |
| Dashboard                  | ![Dashboard](docs/screenshots/dashboard.png)             |
| Orders with pagination     | ![Orders](docs/screenshots/orders.png)                   |
| New Order quotation        | ![New order](docs/screenshots/new-order.png)             |
| Order Details and workflow | ![Order details](docs/screenshots/order-details.png)     |
| Customers                  | ![Customers](docs/screenshots/customers.png)             |
| Machines                   | ![Machines](docs/screenshots/machines.png)               |
| Overdue Pickups            | ![Overdue pickups](docs/screenshots/overdue-pickups.png) |
| Services                   | ![Services](docs/screenshots/services.png)               |
| Reports                    | ![Reports](docs/screenshots/reports.png)                 |

## 17. Known Limitations

- Requires a MongoDB Atlas (or replica set) database connection, because the backend uses transactions.
- Designed for local development and demonstration, with no live hosted deployment.
- No authentication or role-based access control.
- GCash and bank payments are recorded manually. No real payment gateway is integrated.
- Orders are limited to 15 kg.
- The system does not control physical washing or drying machines. Staff move orders through the workflow by hand.
- Multi-user concurrency and load testing has not been completed.

---

**LaundryLink — Simple. Organized. Connected.**
