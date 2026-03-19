/**
 * LINE message templates — all Phase 1 notification triggers.
 *
 * Every message is bilingual: Thai first, English second.
 * Format per plan Section 10.2:
 *
 *   🔧 Butler Garage
 *
 *   [Thai message]
 *
 *   [English message]
 *
 *   —
 *   Butler Garage | Bangkok
 */

import type { TextMessage } from './client'

function wrap(thai: string, english: string): TextMessage {
  return {
    type: 'text',
    text: [
      '🔧 Butler Garage',
      '',
      thai,
      '',
      english,
      '',
      '—',
      'Butler Garage | Bangkok',
    ].join('\n'),
  }
}

// ── Phase 1 Templates ─────────────────────────────────────────────────────────

export function intakeConfirmation(customerName: string): TextMessage {
  return wrap(
    `สวัสดีคุณ ${customerName} 🙏\nเราได้รับคำขอบริการของคุณเรียบร้อยแล้ว ทีมงานจะติดต่อกลับเร็วๆ นี้`,
    `Hi ${customerName}, we've received your service request. Our team will be in touch shortly.`
  )
}

export function jobConfirmed(customerName: string, vehicleLabel: string): TextMessage {
  return wrap(
    `คุณ ${customerName} งานซ่อม ${vehicleLabel} ของคุณได้รับการยืนยันแล้ว 🎉\nเราจะแจ้งให้ทราบเมื่อรถมาถึงร้าน`,
    `Hi ${customerName}, your service for ${vehicleLabel} has been confirmed! We'll notify you when your bike arrives at the shop.`
  )
}

export function bikeReceivedAtShop(customerName: string, vehicleLabel: string): TextMessage {
  return wrap(
    `คุณ ${customerName} รถ ${vehicleLabel} มาถึงร้าน Butler Garage เรียบร้อยแล้ว 🏍️\nช่างกำลังจัดคิวงานของคุณ`,
    `Hi ${customerName}, your ${vehicleLabel} has arrived at Butler Garage! Our mechanics are scheduling your work now.`
  )
}

export function workCompleted(customerName: string, vehicleLabel: string, isPickup: boolean): TextMessage {
  const thai = isPickup
    ? `คุณ ${customerName} รถ ${vehicleLabel} ของคุณซ่อมเสร็จแล้ว ✅\nคนขับจะมารับและส่งรถให้คุณเร็วๆ นี้`
    : `คุณ ${customerName} รถ ${vehicleLabel} ของคุณซ่อมเสร็จแล้ว ✅\nสามารถมารับรถได้ที่ร้านได้เลย`
  const english = isPickup
    ? `Hi ${customerName}, your ${vehicleLabel} is ready! Our driver will be in touch shortly to arrange delivery.`
    : `Hi ${customerName}, your ${vehicleLabel} is ready for pickup! You can collect it from the shop at your convenience.`
  return wrap(thai, english)
}

export function quoteSent(
  customerName: string,
  vehicleLabel: string,
  totalThb: number,
  lineItems: string
): TextMessage {
  return wrap(
    `คุณ ${customerName} นี่คือใบเสนอราคาสำหรับ ${vehicleLabel}\n\n${lineItems}\n\nยอดรวม: ฿${totalThb.toLocaleString()}\n\nกรุณาตอบกลับเพื่ออนุมัติหรือสอบถามเพิ่มเติม`,
    `Hi ${customerName}, here's your quote for ${vehicleLabel}\n\n${lineItems}\n\nTotal: ฿${totalThb.toLocaleString()}\n\nPlease reply to approve or ask any questions.`
  )
}

export function scopeChangeApproved(customerName: string): TextMessage {
  return wrap(
    `คุณ ${customerName} ขอบคุณที่อนุมัติงานเพิ่มเติม ✅\nช่างจะดำเนินการต่อทันที`,
    `Hi ${customerName}, thank you for approving the additional work! Our mechanic will proceed immediately.`
  )
}

export function scopeChangeDeclined(customerName: string): TextMessage {
  return wrap(
    `คุณ ${customerName} เราได้รับการปฏิเสธงานเพิ่มเติมของคุณแล้ว\nทีมงานจะติดต่อกลับเพื่อหารือขั้นตอนถัดไป`,
    `Hi ${customerName}, we've noted your decision on the additional work. Our team will be in touch to discuss next steps.`
  )
}

export function paymentReceived(customerName: string, amountThb: number): TextMessage {
  return wrap(
    `คุณ ${customerName} เราได้รับการชำระเงิน ฿${amountThb.toLocaleString()} เรียบร้อยแล้ว 🙏\nขอบคุณที่ใช้บริการ Butler Garage`,
    `Hi ${customerName}, we've received your payment of ฿${amountThb.toLocaleString()}. Thank you for choosing Butler Garage!`
  )
}

export function invoiceOverdue7Days(customerName: string, amountThb: number, daysPast: number): TextMessage {
  return wrap(
    `คุณ ${customerName} ขอเตือนว่ายังมียอดค้างชำระ ฿${amountThb.toLocaleString()} (${daysPast} วันที่ผ่านมา)\nกรุณาติดต่อทีมงานเพื่อชำระเงิน`,
    `Hi ${customerName}, a friendly reminder that you have an outstanding balance of ฿${amountThb.toLocaleString()} (${daysPast} days overdue). Please contact us to arrange payment.`
  )
}

export function driverEnRoute(customerName: string, orderType: 'pickup' | 'delivery'): TextMessage {
  const thai = orderType === 'pickup'
    ? `คุณ ${customerName} คนขับของเรากำลังเดินทางไปรับรถของคุณ 🚛`
    : `คุณ ${customerName} คนขับของเรากำลังนำรถมาส่งให้คุณ 🚛`
  const english = orderType === 'pickup'
    ? `Hi ${customerName}, our driver is on the way to collect your bike.`
    : `Hi ${customerName}, our driver is on the way to return your bike to you.`
  return wrap(thai, english)
}
