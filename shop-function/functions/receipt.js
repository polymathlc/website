'use strict';

// The order receipt a buyer gets by email once their order is paid: straight away
// for a card payment (written in the same transaction that records the order), and
// for PayNow when the admin presses "Mark paid" on the products page.
//
// The email is composed here on the server and dropped into the `mail` collection,
// which the project's "Trigger Email from Firestore" extension sends. Like every
// Polymath Online email it goes out as the centre's own address, and replies land in
// the same inbox. Nothing in it comes from the browser except what the order
// already holds (the buyer's name, items, address and note), and all of that is
// escaped before it goes into the HTML.
const SENDER_EMAIL = 'admin@polymathlc.com.sg';
const SENDER_NAME = 'Polymath Learning Centre';
const MAIL_COLLECTION = 'mail';
const MAIL_PREFIX = 'polymath-shop-receipt-';
const UEN = 'T16LL2365E';
const WHATSAPP_NUMBER = '6596450588';
const WHATSAPP_DISPLAY = '+65 9645 0588';
const SHOP_URL = 'https://polymathlc.com.sg/products/';
const LOGO_URL = 'https://dl.dropboxusercontent.com/scl/fi/h40yjlyg8ldefwfaa3dib/polymath-logo-sticker.png?rlkey=o1ra4taqy79gt9t8u096v82zj';
const EMAIL_PATTERN = /^[^\s@<>(),;:\\"]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i;

const validEmail = value => typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value.trim());
// The id of the n-th receipt for an order: the first is written when it is paid,
// any later ones by the admin's "Resend receipt" button.
const mailId = (code, count) => MAIL_PREFIX + code + '-' + count;

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const money = value => '$' + (Math.round((Number(value) || 0) * 100) / 100).toFixed(2);
// Firestore Timestamps, plain milliseconds and Dates all become milliseconds.
function toMillis(value, fallback) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}
const paidOn = ms => new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
}).format(new Date(ms));
const paymentLabel = order => (order.payment === 'card' ? 'Card' : 'PayNow');

function receiptLines(order) {
  return (Array.isArray(order.items) ? order.items : []).map(item => ({
    name: String(item && item.name || 'Polymath product'),
    sku: String(item && item.sku || ''),
    qty: Math.max(0, Math.floor(Number(item && item.qty) || 0)),
    lineTotal: Number(item && item.lineTotal) || 0
  }));
}

function nextSteps(order, phone) {
  if (order.fulfilment === 'delivery')
    return 'We will deliver to: ' + (order.address || '(address not given)') + '. We will WhatsApp you' + (phone ? ' on ' + phone : '') + ' to arrange it.';
  return 'Please collect your order at Polymath Learning Centre. We will WhatsApp you' + (phone ? ' on ' + phone : '') + ' when it is ready.';
}

// Returns the `mail` document for one order's receipt, or null when the order has
// no usable email address (an old PayNow order placed before email was required).
function receiptMail(order, { now = Date.now(), resend = false } = {}) {
  const customer = order && order.customer || {};
  const to = String(customer.email || '').trim();
  if (!validEmail(to)) return null;
  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const lines = receiptLines(order);
  const subtotal = order.subtotal !== undefined ? Number(order.subtotal) || 0 : lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const fee = Number(order.deliveryFee) || 0;
  const total = Number(order.total) || subtotal + fee;
  const when = paidOn(toMillis(order.paidAt, now));
  const how = paymentLabel(order);
  const howInProse = how === 'Card' ? 'card' : how;
  const reference = String(order.reference || ('PLC ' + order.code));
  const greeting = name ? 'Hi ' + name + ',' : 'Hello,';
  const subject = 'Your Polymath order ' + order.code + ': receipt';
  const steps = nextSteps(order, phone);
  const note = String(order.note || '').trim();

  const text = [
    greeting,
    '',
    'Thank you for your order. We have received your ' + howInProse + ' payment of ' + money(total) + '.' + (resend ? ' Here is your receipt again.' : ''),
    '',
    'Order code: ' + order.code,
    'Reference: ' + reference,
    'Paid on: ' + when,
    'Paid by: ' + how,
    '',
    ...lines.map(line => line.qty + ' x ' + line.name + (line.sku ? ' (' + line.sku + ')' : '') + '  ' + money(line.lineTotal)),
    ...(fee > 0 ? ['Subtotal  ' + money(subtotal), 'Delivery fee  ' + money(fee)] : []),
    'Total paid  ' + money(total),
    '',
    steps,
    ...(note ? ['', 'Your note: ' + note] : []),
    '',
    'Questions? Reply to this email or WhatsApp us at ' + WHATSAPP_DISPLAY + ' (https://wa.me/' + WHATSAPP_NUMBER + ').',
    '',
    'Thank you,',
    SENDER_NAME,
    'UEN ' + UEN
  ].join('\n');

  const cell = 'padding:10px 0;border-bottom:1px solid #F0E6D6;font-size:15px;line-height:1.5;vertical-align:top';
  const rows = lines.map(line =>
    '<tr><td style="' + cell + '">' + line.qty + ' &times; ' + escapeHtml(line.name)
      + (line.sku ? '<br><span style="font-size:12px;color:#8A8A8A">' + escapeHtml(line.sku) + '</span>' : '') + '</td>'
      + '<td style="' + cell + ';text-align:right;white-space:nowrap">' + money(line.lineTotal) + '</td></tr>').join('');
  const sumRow = (label, value, strong) => '<tr><td style="padding:8px 0 0;font-size:' + (strong ? '16px;font-weight:700' : '14px;color:#5C5C5C') + '">' + label
    + '</td><td style="padding:8px 0 0;text-align:right;white-space:nowrap;font-size:' + (strong ? '16px;font-weight:700' : '14px;color:#5C5C5C') + '">' + value + '</td></tr>';
  const fact = (label, value) => '<tr><td style="padding:3px 16px 3px 0;font-size:14px;color:#8A8A8A;white-space:nowrap">' + label
    + '</td><td style="padding:3px 0;font-size:14px;color:#1A1A1A;font-weight:600">' + escapeHtml(value) + '</td></tr>';
  const html =
    '<div style="font-family:\'Century Gothic\',CenturyGothic,AppleGothic,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1A1A1A">'
    + '<img src="' + LOGO_URL + '" alt="Polymath Learning Centre" height="56" style="height:56px;margin-bottom:24px">'
    + '<p style="font-size:16px;line-height:1.6;margin:0 0 12px">' + escapeHtml(greeting) + '</p>'
    + '<p style="font-size:16px;line-height:1.6;margin:0 0 24px">Thank you for your order. We have received your <b>' + howInProse + '</b> payment of <b>' + money(total) + '</b>.'
    + (resend ? ' Here is your receipt again.' : '') + '</p>'
    + '<div style="background:#FFF8EE;border:1px solid #FFE0B2;border-radius:14px;padding:16px 18px;margin:0 0 24px">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
    + fact('Order code', order.code) + fact('Reference', reference) + fact('Paid on', when) + fact('Paid by', how)
    + '</table></div>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 8px">' + rows
    + (fee > 0 ? sumRow('Subtotal', money(subtotal)) + sumRow('Delivery fee', money(fee)) : '')
    + sumRow('Total paid', money(total), true)
    + '</table>'
    + '<p style="font-size:15px;line-height:1.6;margin:24px 0 0">' + escapeHtml(steps) + '</p>'
    + (note ? '<p style="font-size:14px;line-height:1.6;color:#5C5C5C;margin:12px 0 0">Your note: ' + escapeHtml(note) + '</p>' : '')
    + '<p style="font-size:14px;line-height:1.6;color:#5C5C5C;margin:24px 0 0">Questions? Reply to this email or WhatsApp us at '
    + '<a href="https://wa.me/' + WHATSAPP_NUMBER + '" style="color:#8A5A12">' + WHATSAPP_DISPLAY + '</a>.</p>'
    + '<p style="font-size:15px;line-height:1.6;margin:24px 0 0">Thank you,<br>' + SENDER_NAME + '</p>'
    + '<p style="font-size:12px;line-height:1.6;color:#8A8A8A;margin:28px 0 0">' + SENDER_NAME + ' &middot; UEN ' + UEN
    + ' &middot; <a href="' + SHOP_URL + '" style="color:#8A5A12">polymathlc.com.sg/products</a></p>'
    + '</div>';

  return {
    to: [to],
    from: SENDER_NAME + ' <' + SENDER_EMAIL + '>',
    replyTo: SENDER_EMAIL,
    message: { subject, text, html },
    polymathShop: { code: order.code, kind: resend ? 'receipt-resend' : 'receipt' }
  };
}

// ─── The centre's own "new order" email ───────────────────────────────────────
// Every order placed on /products tells the centre about itself, so a sale is never
// only found by opening the admin page. It goes to these two inboxes and nobody
// else; the browser never chooses a recipient.
//   Card:    written by finalize() in the same transaction that records the paid
//            order, so it goes out exactly once however often Stripe calls in.
//   PayNow:  the page calls notifyShopOrder the moment the order is saved; the
//            server reads the order back from shop_orders and composes this itself.
// One email per order code: the id is fixed, and a second call finds it there.
const NOTIFY_EMAILS = Object.freeze(['chungzhikai@gmail.com', 'admin@polymathlc.com.sg']);
const NOTIFY_PREFIX = 'polymath-shop-order-';
const ADMIN_URL = SHOP_URL + '#admin';
const notifyMailId = code => NOTIFY_PREFIX + code + '-admin';

// What the centre has to do next, which depends on how the order was paid.
function notifyStatus(order) {
  if (order.payment === 'card') return { tag: 'PAID by card', line: 'Paid by card through Stripe. Nothing to check; the stock has been taken out.' };
  if (order.status === 'paid' || order.status === 'collected') return { tag: 'PAID by PayNow', line: 'Paid by PayNow and already marked paid.' };
  return {
    tag: 'PayNow: check payment',
    line: 'The buyer says they have paid by PayNow. Check the bank for reference "' + String(order.reference || ('PLC ' + order.code))
      + '", then press Mark paid on the orders page (that emails their receipt).'
  };
}

function orderNotifyMail(order, { now = Date.now() } = {}) {
  if (!order || !order.code) return null;
  const customer = order.customer || {};
  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const email = String(customer.email || '').trim();
  const lines = receiptLines(order);
  const subtotal = order.subtotal !== undefined ? Number(order.subtotal) || 0 : lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const fee = Number(order.deliveryFee) || 0;
  const total = Number(order.total) || subtotal + fee;
  const reference = String(order.reference || ('PLC ' + order.code));
  const status = notifyStatus(order);
  const when = paidOn(toMillis(order.paidAt, toMillis(order.createdAt, now)));
  const note = String(order.note || '').trim();
  const address = String(order.address || '').trim();
  const fulfilment = order.fulfilment === 'delivery' ? 'Delivery to: ' + (address || '(address not given)') : 'Collect at the centre';
  const screenshot = typeof order.receiptUrl === 'string' && /^https:\/\//.test(order.receiptUrl) ? order.receiptUrl : '';
  const warnings = [];
  if (Array.isArray(order.stockShort) && order.stockShort.length) warnings.push('Stock ran short on ' + order.stockShort.length + ' line(s): this order oversold. Check the orders page.');
  if (Array.isArray(order.paymentChecks) && order.paymentChecks.length) warnings.push('Payment check: ' + order.paymentChecks.join(', ') + '. Compare the amount in Stripe.');
  const subject = 'New order ' + order.code + ': ' + money(total) + ' (' + status.tag + ')' + (name ? ' from ' + name.slice(0, 60) : '');

  const text = [
    'A new order was placed on polymathlc.com.sg/products.',
    '',
    status.line,
    ...warnings.map(warning => 'WARNING: ' + warning),
    '',
    'Order code: ' + order.code,
    'Reference: ' + reference,
    'Placed: ' + when,
    'Total: ' + money(total),
    '',
    ...lines.map(line => line.qty + ' x ' + line.name + (line.sku ? ' (' + line.sku + ')' : '') + '  ' + money(line.lineTotal)),
    ...(fee > 0 ? ['Subtotal  ' + money(subtotal), 'Delivery fee  ' + money(fee)] : []),
    '',
    'Name: ' + (name || '(not given)'),
    'WhatsApp: ' + (phone || '(not given)'),
    'Email: ' + (email || '(not given)'),
    fulfilment,
    ...(note ? ['Note: ' + note] : []),
    ...(screenshot ? ['Payment screenshot: ' + screenshot] : []),
    '',
    'Orders page: ' + ADMIN_URL
  ].join('\n');

  const cell = 'padding:10px 0;border-bottom:1px solid #F0E6D6;font-size:15px;line-height:1.5;vertical-align:top';
  const rows = lines.map(line =>
    '<tr><td style="' + cell + '">' + line.qty + ' &times; ' + escapeHtml(line.name)
      + (line.sku ? '<br><span style="font-size:12px;color:#8A8A8A">' + escapeHtml(line.sku) + '</span>' : '') + '</td>'
      + '<td style="' + cell + ';text-align:right;white-space:nowrap">' + money(line.lineTotal) + '</td></tr>').join('');
  const fact = (label, value) => '<tr><td style="padding:3px 16px 3px 0;font-size:14px;color:#8A8A8A;white-space:nowrap;vertical-align:top">' + label
    + '</td><td style="padding:3px 0;font-size:14px;color:#1A1A1A;font-weight:600">' + escapeHtml(value) + '</td></tr>';
  const paid = order.payment === 'card' || order.status === 'paid' || order.status === 'collected';
  const html =
    '<div style="font-family:\'Century Gothic\',CenturyGothic,AppleGothic,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1A1A1A">'
    + '<p style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#8A5A12;margin:0 0 8px">New order on /products</p>'
    + '<p style="font-size:24px;font-weight:700;line-height:1.3;margin:0 0 16px">' + money(total) + ' &middot; ' + escapeHtml(order.code) + '</p>'
    + '<div style="background:' + (paid ? '#EAF7EE;border:1px solid #BFE5C8' : '#FFF4E0;border:1px solid #FFD28A') + ';border-radius:14px;padding:14px 18px;margin:0 0 20px;font-size:15px;line-height:1.6">'
    + '<b>' + escapeHtml(status.tag) + '</b><br>' + escapeHtml(status.line) + '</div>'
    + warnings.map(warning => '<div style="background:#FDECEC;border:1px solid #F5B5B5;border-radius:14px;padding:12px 18px;margin:0 0 12px;font-size:14px;line-height:1.6">' + escapeHtml(warning) + '</div>').join('')
    + '<div style="background:#FFF8EE;border:1px solid #FFE0B2;border-radius:14px;padding:16px 18px;margin:0 0 24px">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
    + fact('Order code', order.code) + fact('Reference', reference) + fact('Placed', when)
    + fact('Name', name || '(not given)') + fact('WhatsApp', phone || '(not given)') + fact('Email', email || '(not given)')
    + fact(order.fulfilment === 'delivery' ? 'Deliver to' : 'Fulfilment', order.fulfilment === 'delivery' ? (address || '(address not given)') : 'Collect at the centre')
    + (note ? fact('Note', note) : '')
    + '</table></div>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 8px">' + rows
    + (fee > 0 ? '<tr><td style="padding:8px 0 0;font-size:14px;color:#5C5C5C">Delivery fee</td><td style="padding:8px 0 0;text-align:right;font-size:14px;color:#5C5C5C">' + money(fee) + '</td></tr>' : '')
    + '<tr><td style="padding:8px 0 0;font-size:16px;font-weight:700">Total</td><td style="padding:8px 0 0;text-align:right;font-size:16px;font-weight:700">' + money(total) + '</td></tr>'
    + '</table>'
    + (screenshot ? '<p style="font-size:14px;line-height:1.6;margin:20px 0 0"><a href="' + escapeHtml(screenshot) + '" style="color:#8A5A12">View the payment screenshot</a></p>' : '')
    + '<p style="margin:28px 0 0"><a href="' + ADMIN_URL + '" style="display:inline-block;background:#1A1A1A;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;padding:12px 22px;border-radius:12px">Open the orders page</a></p>'
    + '<p style="font-size:12px;line-height:1.6;color:#8A8A8A;margin:28px 0 0">Sent automatically by polymathlc.com.sg/products to ' + NOTIFY_EMAILS.join(' and ') + '.</p>'
    + '</div>';

  return {
    to: [...NOTIFY_EMAILS],
    from: SENDER_NAME + ' <' + SENDER_EMAIL + '>',
    // Replying goes straight to the buyer.
    replyTo: validEmail(email) ? email : SENDER_EMAIL,
    message: { subject, text, html },
    polymathShop: { code: order.code, kind: 'order-notify' }
  };
}

module.exports = { SENDER_EMAIL, SENDER_NAME, MAIL_COLLECTION, MAIL_PREFIX, UEN, NOTIFY_EMAILS, NOTIFY_PREFIX,
  validEmail, mailId, notifyMailId, escapeHtml, receiptMail, orderNotifyMail };
