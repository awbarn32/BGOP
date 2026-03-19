import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    paddingHorizontal: 40,
    paddingVertical: 36,
    backgroundColor: '#ffffff',
  },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  brand: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111827' },
  brandSub: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  invoiceLabel: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#4f46e5', textAlign: 'right' },
  invoiceNumber: { fontSize: 10, color: '#6b7280', textAlign: 'right', marginTop: 2 },
  // Two-column section
  columns: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  column: { flex: 1 },
  sectionLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sectionValue: { fontSize: 10, color: '#111827', lineHeight: 1.5 },
  // Divider
  divider: { height: 1, backgroundColor: '#e5e7eb', marginBottom: 16 },
  // Line items table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  colDesc: { flex: 1 },
  colQty: { width: 40, textAlign: 'center' },
  colPrice: { width: 70, textAlign: 'right' },
  colTotal: { width: 70, textAlign: 'right' },
  cellLabel: { fontSize: 8, color: '#6b7280', fontFamily: 'Helvetica-Bold' },
  cellValue: { fontSize: 10, color: '#111827' },
  // Totals
  totalsSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  totalsBox: { width: 200 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 10, color: '#6b7280' },
  totalValue: { fontSize: 10, color: '#111827' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 2,
    borderTopColor: '#4f46e5',
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827' },
  grandTotalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#4f46e5' },
  // Footer
  footer: { marginTop: 32, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 },
  footerText: { fontSize: 8, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 },
  // Status badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusText: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  // Notes
  notesBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    padding: 10,
    marginTop: 16,
  },
  notesLabel: { fontSize: 8, color: '#9ca3af', marginBottom: 4 },
  notesText: { fontSize: 10, color: '#374151', lineHeight: 1.5 },
})

function fmt(n: number) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_COLOR: Record<string, string> = {
  quote: '#374151',
  approved: '#1d4ed8',
  deposit_paid: '#92400e',
  pending: '#c2410c',
  paid: '#065f46',
  void: '#991b1b',
}

const STATUS_BG: Record<string, string> = {
  quote: '#f3f4f6',
  approved: '#eff6ff',
  deposit_paid: '#fef3c7',
  pending: '#fff7ed',
  paid: '#d1fae5',
  void: '#fee2e2',
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface LineItem {
  description: string
  quantity: number
  sale_price: number
  line_type: string
  sku: string | null
}

interface InvoiceData {
  id: string
  invoice_number: string | null
  invoice_date: string
  status: string
  revenue_stream: string
  total_amount: number
  deposit_amount: number | null
  deposit_paid_at: string | null
  paid_amount: number | null
  payment_method: string | null
  paid_at: string | null
  notes: string | null
  customer: { full_name: string; phone: string | null; line_id: string | null; email: string | null } | null
  vehicle: { make: string; model: string; year: number; license_plate: string | null } | null
  job: {
    id: string
    description: string
    line_items: LineItem[]
  } | null
}

// ─── Component ───────────────────────────────────────────────────────────────
export function InvoicePDF({ invoice }: { invoice: InvoiceData }) {
  const customer = invoice.customer
  const vehicle = invoice.vehicle
  const lineItems: LineItem[] = invoice.job?.line_items ?? []
  const statusColor = STATUS_COLOR[invoice.status] ?? '#374151'
  const statusBg = STATUS_BG[invoice.status] ?? '#f3f4f6'

  // Calculate totals from line items if available; otherwise use invoice total
  const itemsTotal = lineItems.length > 0
    ? lineItems.reduce((s, item) => s + item.quantity * item.sale_price, 0)
    : invoice.total_amount

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Butler Garage</Text>
            <Text style={styles.brandSub}>Bangkok Premium Motorcycle Service</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>
              {invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Status + Date */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'flex-start' }}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {invoice.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, color: '#6b7280', textAlign: 'right' }}>Invoice Date</Text>
            <Text style={{ fontSize: 10, color: '#111827', textAlign: 'right' }}>{fmtDate(invoice.invoice_date)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To + Vehicle */}
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={[styles.sectionValue, { fontFamily: 'Helvetica-Bold' }]}>
              {customer?.full_name ?? '—'}
            </Text>
            {customer?.phone && <Text style={styles.sectionValue}>{customer.phone}</Text>}
            {customer?.email && <Text style={styles.sectionValue}>{customer.email}</Text>}
            {customer?.line_id && <Text style={styles.sectionValue}>LINE: {customer.line_id}</Text>}
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionLabel}>Vehicle</Text>
            {vehicle ? (
              <>
                <Text style={[styles.sectionValue, { fontFamily: 'Helvetica-Bold' }]}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </Text>
                {vehicle.license_plate && (
                  <Text style={styles.sectionValue}>Plate: {vehicle.license_plate}</Text>
                )}
              </>
            ) : (
              <Text style={styles.sectionValue}>—</Text>
            )}
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Revenue Stream</Text>
            <Text style={styles.sectionValue}>
              {invoice.revenue_stream.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Line items */}
        {lineItems.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cellLabel, styles.colDesc]}>Description</Text>
              <Text style={[styles.cellLabel, styles.colQty]}>Qty</Text>
              <Text style={[styles.cellLabel, styles.colPrice]}>Unit Price</Text>
              <Text style={[styles.cellLabel, styles.colTotal]}>Total</Text>
            </View>
            {lineItems.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <View style={styles.colDesc}>
                  <Text style={styles.cellValue}>{item.description}</Text>
                  {item.sku && <Text style={{ fontSize: 8, color: '#9ca3af' }}>SKU: {item.sku}</Text>}
                </View>
                <Text style={[styles.cellValue, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.cellValue, styles.colPrice]}>฿{fmt(item.sale_price)}</Text>
                <Text style={[styles.cellValue, styles.colTotal]}>฿{fmt(item.quantity * item.sale_price)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Job description fallback */}
        {lineItems.length === 0 && invoice.job?.description && (
          <View style={styles.tableRow}>
            <Text style={[styles.cellValue, styles.colDesc]}>{invoice.job.description}</Text>
            <Text style={[styles.cellValue, styles.colQty]}>1</Text>
            <Text style={[styles.cellValue, styles.colPrice]}>฿{fmt(invoice.total_amount)}</Text>
            <Text style={[styles.cellValue, styles.colTotal]}>฿{fmt(invoice.total_amount)}</Text>
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>฿{fmt(itemsTotal)}</Text>
            </View>
            {invoice.deposit_amount && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Deposit Paid {invoice.deposit_paid_at ? `(${fmtDate(invoice.deposit_paid_at)})` : ''}
                </Text>
                <Text style={[styles.totalValue, { color: '#065f46' }]}>
                  −฿{fmt(invoice.deposit_amount)}
                </Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>
                {invoice.status === 'paid' ? 'PAID' : 'TOTAL DUE'}
              </Text>
              <Text style={styles.grandTotalValue}>
                ฿{fmt(invoice.total_amount - (invoice.deposit_amount ?? 0))}
              </Text>
            </View>
            {invoice.payment_method && (
              <View style={[styles.totalRow, { marginTop: 4 }]}>
                <Text style={styles.totalLabel}>Payment Method</Text>
                <Text style={styles.totalValue}>
                  {invoice.payment_method.replace('_', ' ')}
                </Text>
              </View>
            )}
            {invoice.paid_at && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Paid On</Text>
                <Text style={styles.totalValue}>{fmtDate(invoice.paid_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Butler Garage · Bangkok, Thailand · Thank you for your business
          </Text>
        </View>
      </Page>
    </Document>
  )
}
