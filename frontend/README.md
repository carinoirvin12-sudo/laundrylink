# LaundryLink — Frontend

React + TypeScript client for the LaundryLink laundry management system. For the project overview, business rules, and full API documentation, see the [main README](../README.md).

## Tech

- React (Vite) with TypeScript
- Tailwind CSS (custom theme, light and dark mode)
- React Router
- Axios (one shared instance in `src/services/api.ts`)
- React Hook Form with Zod and `@hookform/resolvers`

## Setup

```bash
cd frontend
npm install
```

Create a `.env` file (copy `.env.example`):

```
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:5173` (or the URL Vite prints). The backend must be running. Restart the dev server after editing `.env`.

## Scripts

| Command           | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start the Vite dev server                |
| `npm run build`   | Type-check and create a production build |
| `npm run preview` | Preview the production build locally     |
| `npm run lint`    | Run Oxlint                               |

## Structure

```
src/
├── components/   # ThemeProvider, ThemeToggle
├── hooks/        # useDebounce
├── layouts/      # AppLayout (shared navigation)
├── pages/        # One folder per page
├── schemas/      # Zod schemas
├── services/     # api.ts (configured Axios instance)
├── App.tsx       # Routes
└── main.tsx      # Entry point
```

## Pages

| Page             | Route            |
| ---------------- | ---------------- |
| Landing          | `/`              |
| Dashboard        | `/dashboard`     |
| Orders           | `/orders`        |
| New Order        | `/orders/new`    |
| Order Details    | `/orders/:id`    |
| Customers        | `/customers`     |
| Customer Details | `/customers/:id` |
| Machines         | `/machines`      |
| Services         | `/services`      |
| Overdue Pickups  | `/overdue`       |
| Reports          | `/reports`       |
