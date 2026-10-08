# LaundryLink — Laundry Management System

## Project Overview

LaundryLink is a full-stack web application designed to help laundry businesses manage customer records, laundry orders, services, machines, and payments in one centralized system.

The application provides a point-of-sale order creation workflow, tracks laundry processing from receiving to claiming, monitors machine availability, and displays operational and financial summaries.

## Technology Stack

**Frontend**
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- React Hook Form
- Zod

**Backend**
- Node.js
- Express.js
- MongoDB Atlas
- Mongoose

## Main Features

1. **Dashboard** — View customer counts, laundry orders, revenue, available machines, and overdue pickups.
2. **Order Management** — Create, view, update order notes and statuses, search, filter, and safely delete eligible orders.
3. **Point-of-Sale Workflow** — Create laundry orders for new or existing customers.
4. **Customer Management** — Add, edit, view, and delete customers, including order history.
5. **Service Management** — Manage laundry services, pricing, minimum charges, and turnaround times.
6. **Machine Management** — Track machine information, capacity, maintenance status, and availability.
7. **Payment Management** — Record cash, GCash, and bank payments, including partial payments.
8. **Overdue Pickup Monitoring** — Identify laundry orders that are ready but past their due date.
9. **Reports** — View operational and revenue information.

## Business Rules

- Laundry orders must weigh between 1 and 15 kg.
- Larger laundry loads must be divided into separate orders.
- A 10% bulk discount applies to qualifying orders of at least 10 kg.
- A 5% loyalty discount applies to customers with at least five claimed orders.
- Only the highest applicable discount is used.
- Order statuses follow: Received → Washing → Ready → Claimed.
- Cancellation is allowed only before washing starts and when no payment has been recorded.
- Orders must be fully paid before they can be claimed.
- Orders with recorded payments cannot be deleted.
- Machine capacity, maintenance status, and current usage are checked when assigning laundry orders.

## Project Structure

```text
laundrylink/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── seed/
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.tsx
│   ├── .env.example
│   └── package.json
└── README.md
```

## Installation and Setup

### Prerequisites

Install Node.js and npm, and prepare a MongoDB Atlas database with a valid connection string.

### Backend Setup

Open a terminal:

```bash
cd backend
npm install
```

Create a `.env` file inside `backend` using `.env.example` as a reference.

```env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
```

Start the backend:

```bash
npm run dev
```

The API runs locally at:

```text
http://localhost:5000/api
```

### Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside `frontend`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Open the local URL displayed by Vite.

## API Documentation

The API uses JSON request and response bodies.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/customers` | Get all customers |
| POST | `/api/customers` | Create a customer |
| GET | `/api/customers/:id` | Get customer details |
| PUT | `/api/customers/:id` | Update a customer |
| DELETE | `/api/customers/:id` | Delete an eligible customer |
| GET | `/api/customers/:id/summary` | Get customer order and payment summary |
| GET | `/api/services` | Get all services |
| POST | `/api/services` | Create a service |
| PUT | `/api/services/:id` | Update a service |
| DELETE | `/api/services/:id` | Delete an eligible service |
| GET | `/api/machines` | Get all machines |
| GET | `/api/machines/availability` | Get machine availability |
| POST | `/api/machines` | Create a machine |
| PUT | `/api/machines/:id` | Update a machine |
| DELETE | `/api/machines/:id` | Delete an eligible machine |
| GET | `/api/orders` | Get all orders |
| POST | `/api/orders` | Create an order for an existing customer |
| POST | `/api/orders/pos` | Create an order through the POS workflow |
| POST | `/api/orders/quote` | Preview order pricing |
| GET | `/api/orders/search` | Filter and sort orders |
| GET | `/api/orders/overdue` | Get overdue pickups |
| GET | `/api/orders/:id` | Get order details |
| GET | `/api/orders/:id/balance` | Get payment balance and history |
| PUT | `/api/orders/:id` | Update order notes |
| PATCH | `/api/orders/:id/status` | Update order status |
| DELETE | `/api/orders/:id` | Delete an eligible order |
| GET | `/api/payments` | Get payment records |
| POST | `/api/payments` | Record a payment |
| GET | `/api/stats/summary` | Get dashboard statistics |
| GET | `/api/stats/revenue` | Get revenue reports |

### Example: Create a Customer

**Request**

```http
POST /api/customers
Content-Type: application/json
```

```json
{
  "fullName": "Juan Dela Cruz",
  "phone": "09123456789",
  "address": "Pampanga"
}
```

**Example successful response**

Returns HTTP `201 Created` with the new customer record.

### Example: Create a Laundry Order

**Request**

```http
POST /api/orders
Content-Type: application/json
```

```json
{
  "customer": "CUSTOMER_OBJECT_ID",
  "service": "SERVICE_OBJECT_ID",
  "machine": "MACHINE_OBJECT_ID",
  "weightKg": 5,
  "notes": "Handle with care"
}
```

**Example successful response**

Returns HTTP `201 Created` with the created order and pricing information.

### Example: Record a Payment

**Request**

```http
POST /api/payments
Content-Type: application/json
```

```json
{
  "order": "ORDER_OBJECT_ID",
  "amount": 100,
  "method": "cash",
  "remarks": "Partial payment"
}
```

### Example Error Response

```json
{
  "message": "Invalid order ID"
}
```

## Screenshots

Add screenshots of the completed application before submission:

- Dashboard
- Order list
- New Order / POS
- Order Details and Payment
- Customers
- Machines
- Services
- Reports

Suggested location: `docs/screenshots/`.

## Limitations

- The application requires a working MongoDB Atlas connection.
- Payment records are entered manually; the system does not process real GCash or bank transactions.
- Laundry loads exceeding 15 kg must be split into separate orders.
- Authentication and user-role management are not included in the current version.
- The project is configured primarily for local development.

## Development Team

**Project:** LaundryLink — Laundry Management System

**Course:** CTADWEBL

**Members:** [Add group member names]

**Repository:** [Add GitHub repository URL]

## Project Status

The application is undergoing final code review and integration testing. Features and API behavior should be verified before final submission.
