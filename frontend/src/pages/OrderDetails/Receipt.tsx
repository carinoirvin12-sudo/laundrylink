// frontend/src/pages/OrderDetails/Receipt.tsx
//
// Printable receipt (80mm thermal roll). Hidden on screen, shown only when printing.
// Trigger with: window.print()

// ==========================================
// EDIT THESE: business info shown on receipt
// ==========================================
const BUSINESS = {
  name: 'LaundryLink',
  address: 'Your street address, City',
  phone: '09XX XXX XXXX',
  footer: 'Thank you! Please present this receipt when claiming your laundry.',
}

type ReceiptPayment = {
  _id: string
  amount: number
  method: 'cash' | 'gcash' | 'bank'
  paidAt: string
}

type ReceiptOrder = {
  _id: string
  customer: { fullName: string; phone: string; address?: string } | null
  service: { name: string; pricePerKg: number; minCharge?: number } | null
  weightKg: number
  discountPercent: number
  totalPrice: number
  status: string
  dueDate: string
  notes?: string
  createdAt: string
}

type ReceiptProps = {
  order: ReceiptOrder
  payments: ReceiptPayment[]
  totalPaid: number
  balance: number
}

const peso = (value: number) =>
  `₱${Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

const METHOD_LABEL = { cash: 'Cash', gcash: 'GCash', bank: 'Bank' }

function Receipt({ order, payments, totalPaid, balance }: ReceiptProps) {
  // The order only stores the discounted total, so work backwards.
  // (If you add a `subtotal` field to the Order model, use that instead.)
  const discountRate = order.discountPercent / 100
  const subtotal =
    discountRate > 0 && discountRate < 1
      ? Math.round((order.totalPrice / (1 - discountRate)) * 100) / 100
      : order.totalPrice
  const discountAmount = Math.round((subtotal - order.totalPrice) * 100) / 100

  const paymentStatus =
    balance <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID'

  return (
    <>
      <style>{`
        .receipt-print { display: none; }

        @media print {
          @page { size: 80mm auto; margin: 0; }

          body * { visibility: hidden !important; }

          .receipt-print,
          .receipt-print * { visibility: visible !important; }

          .receipt-print {
            display: block;
            position: absolute;
            left: 0;
            top: 0;
            width: 72mm;
            padding: 4mm;
            background: #fff;
            color: #000;
            font-family: 'Courier New', ui-monospace, monospace;
            font-size: 11px;
            line-height: 1.4;
          }

          .receipt-print .center { text-align: center; }
          .receipt-print .title { font-size: 16px; font-weight: 700; }
          .receipt-print .row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
          }
          .receipt-print .row span:last-child { text-align: right; }
          .receipt-print .bold { font-weight: 700; }
          .receipt-print .big { font-size: 14px; }
          .receipt-print hr {
            border: 0;
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
        }
      `}</style>

      <div className="receipt-print" aria-hidden="true">
        <div className="center">
          <div className="title">{BUSINESS.name}</div>
          <div>{BUSINESS.address}</div>
          <div>{BUSINESS.phone}</div>
        </div>

        <hr />

        <div className="center bold">OFFICIAL RECEIPT</div>
        <div className="row">
          <span>Receipt #</span>
          <span>{order._id.slice(-8).toUpperCase()}</span>
        </div>
        <div className="row">
          <span>Date</span>
          <span>{formatDateTime(order.createdAt)}</span>
        </div>

        <hr />

        <div className="bold">Customer</div>
        <div>{order.customer?.fullName || '—'}</div>
        <div>{order.customer?.phone || ''}</div>
        {order.customer?.address && <div>{order.customer.address}</div>}

        <hr />

        <div className="bold">{order.service?.name || 'Laundry Service'}</div>
        <div className="row">
          <span>
            {order.weightKg} kg × {peso(order.service?.pricePerKg ?? 0)}
          </span>
          <span>{peso(subtotal)}</span>
        </div>

        {order.discountPercent > 0 && (
          <div className="row">
            <span>Discount ({order.discountPercent}%)</span>
            <span>-{peso(discountAmount)}</span>
          </div>
        )}

        <hr />

        <div className="row bold big">
          <span>TOTAL</span>
          <span>{peso(order.totalPrice)}</span>
        </div>

        {payments.length > 0 && (
          <>
            <hr />
            <div className="bold">Payments</div>
            {payments.map((payment) => (
              <div className="row" key={payment._id}>
                <span>
                  {METHOD_LABEL[payment.method]} ·{' '}
                  {new Date(payment.paidAt).toLocaleDateString('en-PH')}
                </span>
                <span>{peso(payment.amount)}</span>
              </div>
            ))}
          </>
        )}

        <div className="row">
          <span>Total Paid</span>
          <span>{peso(totalPaid)}</span>
        </div>
        <div className="row bold">
          <span>Balance</span>
          <span>{peso(balance)}</span>
        </div>
        <div className="row bold">
          <span>Status</span>
          <span>{paymentStatus}</span>
        </div>

        <hr />

        <div className="row">
          <span>Pickup by</span>
          <span>{formatDateTime(order.dueDate)}</span>
        </div>
        {order.notes && <div>Notes: {order.notes}</div>}

        <hr />

        <div className="center">{BUSINESS.footer}</div>
      </div>
    </>
  )
}

export default Receipt