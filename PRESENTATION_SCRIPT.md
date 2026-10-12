# LaundryLink Project Presentation Script

**Suggested length:** 5–7 minutes  
**Presenter:** Paul John Lucban

Use the italicized notes as cues; the quoted paragraphs are the suggested spoken script. Have the application open with demonstration data before presenting.

## 1. Introduction

“Good day. I’m Paul John Lucban, and I’ll be presenting LaundryLink, our laundry management system. The project is designed to help a laundry business manage customers, services, orders, machines, payments, and reports in one place.

“Instead of relying on separate records for each part of the business, LaundryLink connects these activities and applies rules such as service pricing, discounts, machine availability, order priority, payment balances, and overdue pickup monitoring.”

## 2. Documentation

*Show the project README and briefly point out its sections.*

“The README documents how the project is organized and how to run it. The frontend is built with React, TypeScript, Vite, and Tailwind CSS. The backend uses Node.js and Express, and MongoDB Atlas stores the application data through Mongoose models.

“It also describes the main pages, database relationships, API routes, setup steps, business rules, and the manual tests performed. The system has five main data models: Customer, Service, Machine, Order, and Payment. For example, an order connects a customer and a service, can be assigned a washer and dryer during processing, and can have multiple payment records.

“The documentation also states the system’s current limitations. It is intended for demonstration and local development, has no authentication or role-based access yet, and records GCash and bank payments manually rather than using a payment gateway.”

## 3. Dashboard demonstration

*Open the Dashboard. Point to each card and then the workflow and queue.*

“The Dashboard gives staff a quick operational overview. It shows total orders, registered customers, available machines, and recorded revenue. The workflow section breaks orders down by status, from Received through Washing, Drying, Folding, Ready, and Claimed, with Cancelled orders also shown.

“The priority queue shows orders waiting for a washer. Express orders are placed ahead of Priority orders, which are placed ahead of Standard orders. Within each service tier, older orders come first. The dashboard also provides a shortcut to create a new order and a refresh action to reload the displayed information.

“Machine availability is based on active assignments and machine status. For example, a washer is occupied during Washing, then released when its order advances to Drying. This helps staff see operational availability without manually changing a machine to ‘in use.’”

## 4. Reports demonstration

*Open Reports. Show the summary cards, date controls, payment breakdown, and transaction table.*

“The Reports page is for reviewing business activity and recorded payments. Its summary includes total revenue, total orders, completed orders, registered customers, and overdue pickups. The order activity section gives counts for key statuses.

“For the revenue report, I can choose a start and end date and generate the report for that period. The page summarizes revenue and payment count, and breaks payment totals down by Cash, GCash, and Bank. Below that, the payment transaction table shows the recorded date, customer, method, remarks, and amount.

“These figures come from recorded application data, so the report reflects the transactions entered into the system. It does not represent payments processed by an external payment provider.”

## 5. Business rules and workflow

*If time permits, show an order or its details page.*

“A new order starts as Received and proceeds through Washing, Drying, Folding, Ready, and Claimed. The configured services are Standard at 50 pesos per kilogram with a 24-hour turnaround, Priority at 65 pesos per kilogram with a 12-hour turnaround, and Express at 80 pesos per kilogram with a 6-hour turnaround.

“Orders are limited to 15 kilograms. An order of at least 10 kilograms qualifies for a 5 percent bulk discount. A customer with at least five previously claimed orders qualifies for a 5 percent loyalty discount. If both rules apply, the discounts are combined for a 10 percent total discount.

“Customers can make partial or full payments, but the system prevents overpayment and does not allow an order to be claimed until its balance is paid in full. Due dates are calculated using the selected service’s turnaround time, which supports overdue monitoring.”

## 6. My Git commits and pushed documentation

*Show the GitHub repository’s commit history if internet access is available. The hashes below are abbreviated commit IDs.*

“My recent commits in the repository are mainly documentation updates. I updated the main README and the frontend README, including wording and documentation details. The commits attributed to me include `37e3ddf`, `ed08083`, `aa0e168`, `5631764`, `2e06537`, and `bca1d78`. These changes are documentation-only; I’m not presenting them as code changes to the Dashboard or Reports pages.

“Those commits are present in the `origin/main` history. In my current local checkout, `main` is four commits behind `origin/main`, so I’ll synchronize the local branch before using it for the live demonstration.”

## 7. Closing

“To summarize, LaundryLink brings laundry orders, customer records, machine tracking, payments, and business reporting into one application. Its dashboard helps staff monitor daily operations, while the reports page summarizes order activity and payment revenue over a selected period.

“Thank you. I’m ready to demonstrate the system and answer your questions.”

## Before presenting

- Pull or otherwise synchronize the local `main` branch with `origin/main`, then confirm the app still runs.
- Start the backend and frontend and verify the MongoDB connection.
- Prepare sample customers, services, machines, orders, and payments so the dashboard and reports are populated.
- Open the Dashboard and Reports pages before the presentation.
- The README still calls for actual application screenshots and completion of the group member/contribution table; add those if they are required for submission.
- Use figures shown by the live application rather than inventing example dashboard or report totals.
