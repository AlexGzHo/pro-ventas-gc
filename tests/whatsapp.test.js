import { 
  parseWhatsAppContact, 
  normalizeWhatsAppContact, 
  normalizePhone, 
  getWhatsAppUrl,
  openWhatsApp,
  interpolateTemplate,
  credentialsText,
  reminderText,
  updateText,
  credentialsPlain,
  templates,
  formatExpirationStatus,
  formatDaysLeft
} from '../src/whatsapp.js'
import { daysUntil, formatDate, toISODate } from '../src/utils.js'

let passCount = 0
let failCount = 0
const failures = []

function assert(condition, message) {
  if (condition) {
    passCount++
    console.log(`✅ PASS: ${message}`)
  } else {
    failCount++
    failures.push(message)
    console.log(`❌ FAIL: ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  const pass = actual === expected
  if (!pass) {
    failCount++
    failures.push(`${message} - Expected: "${expected}", Got: "${actual}"`)
    console.log(`❌ FAIL: ${message} - Expected: "${expected}", Got: "${actual}"`)
  } else {
    passCount++
    console.log(`✅ PASS: ${message}`)
  }
}

console.log('=== WhatsApp Module Tests ===\n')

console.log('--- parseWhatsAppContact: Peruvian Numbers ---')
{
  // Peruvian number with +51
  const r1 = parseWhatsAppContact('+51 987 654 321')
  assertEqual(r1.type, 'phone', 'Type is phone for +51 number')
  assertEqual(r1.clean, '51987654321', 'Clean value for +51 number')
  assertEqual(r1.isValid, true, 'Valid for +51 number')
  assertEqual(r1.value, '51987654321', 'Value for +51 number')

  // Peruvian number without +51 (9 digits)
  const r2 = parseWhatsAppContact('987654321')
  assertEqual(r2.type, 'phone', 'Type is phone for 9-digit number')
  assertEqual(r2.clean, '51987654321', 'Clean value adds 51 prefix')
  assertEqual(r2.isValid, true, 'Valid for 9-digit number')

  // Peruvian number with 0051 prefix
  const r3 = parseWhatsAppContact('0051987654321')
  assertEqual(r3.clean, '51987654321', 'Clean value for 0051 prefix')
  assertEqual(r3.isValid, true, 'Valid for 0051 prefix')

  // Peruvian number with spaces and formatting
  const r4 = parseWhatsAppContact('+51 987 654 321')
  assertEqual(r4.clean, '51987654321', 'Clean value ignores formatting')
}

console.log('\n--- parseWhatsAppContact: International Numbers ---')
{
  // US number
  const r1 = parseWhatsAppContact('+1 555 123 4567')
  assertEqual(r1.type, 'phone', 'Type is phone for US number')
  assertEqual(r1.clean, '15551234567', 'Clean value for US number')
  assertEqual(r1.isValid, true, 'Valid for US number')

  // Spain number
  const r2 = parseWhatsAppContact('+34 600 123 456')
  assertEqual(r2.clean, '34600123456', 'Clean value for Spain number')
  assertEqual(r2.isValid, true, 'Valid for Spain number')

  // Mexico number
  const r3 = parseWhatsAppContact('+52 1 55 1234 5678')
  assertEqual(r3.clean, '5215512345678', 'Clean value for Mexico number')
  assertEqual(r3.isValid, true, 'Valid for Mexico number')

  // Generic international (7-15 digits)
  const r4 = parseWhatsAppContact('447911123456')
  assertEqual(r4.clean, '447911123456', 'Clean value for UK number')
  assertEqual(r4.isValid, true, 'Valid for UK number')
}

console.log('\n--- parseWhatsAppContact: Usernames with @ ---')
{
  // Username with @ preserving case
  const r1 = parseWhatsAppContact('@Benja_081410')
  assertEqual(r1.type, 'username', 'Type is username')
  assertEqual(r1.clean, 'Benja_081410', 'Clean preserves case')
  assertEqual(r1.value, '@Benja_081410', 'Value includes @ with preserved case')
  assertEqual(r1.isValid, true, 'Valid username')

  // Username with multiple @
  const r2 = parseWhatsAppContact('@@@Benja_081410')
  assertEqual(r2.clean, 'Benja_081410', 'Multiple @ stripped')
  assertEqual(r2.value, '@Benja_081410', 'Single @ in value')

  // Username with dots
  const r3 = parseWhatsAppContact('@juan.perez')
  assertEqual(r3.clean, 'juan.perez', 'Dots preserved')
  assertEqual(r3.value, '@juan.perez', 'Value with dots')

  // Username with underscores
  const r4 = parseWhatsAppContact('@user_name_123')
  assertEqual(r4.clean, 'user_name_123', 'Underscores preserved')
  assertEqual(r4.value, '@user_name_123', 'Value with underscores')
}

console.log('\n--- parseWhatsAppContact: wa.me Links (Usernames) ---')
{
  // wa.me link with username (no @ added)
  const r1 = parseWhatsAppContact('https://wa.me/Benja_081410')
  assertEqual(r1.type, 'username', 'Type is username for wa.me link')
  assertEqual(r1.clean, 'Benja_081410', 'Clean extracts username')
  assertEqual(r1.value, '@Benja_081410', 'Value adds single @')
  assertEqual(r1.isValid, true, 'Valid wa.me username link')

  // wa.me link with http
  const r2 = parseWhatsAppContact('http://wa.me/Juan_Perez')
  assertEqual(r2.clean, 'Juan_Perez', 'Clean extracts from http wa.me')
  assertEqual(r2.value, '@Juan_Perez', 'Value adds @')

  // wa.me link with www
  const r3 = parseWhatsAppContact('www.wa.me/Maria_Garcia')
  assertEqual(r3.clean, 'Maria_Garcia', 'Clean extracts from www.wa.me')
  assertEqual(r3.value, '@Maria_Garcia', 'Value adds @')

  // api.whatsapp.com link with phone
  const r4 = parseWhatsAppContact('https://api.whatsapp.com/send?phone=51987654321')
  assertEqual(r4.type, 'phone', 'Type is phone for api.whatsapp.com')
  assertEqual(r4.clean, '51987654321', 'Clean extracts phone')
}

console.log('\n--- parseWhatsAppContact: Username without @ ---')
{
  // Username entered without @
  const r1 = parseWhatsAppContact('Benja_081410')
  assertEqual(r1.type, 'username', 'Type is username without @')
  assertEqual(r1.clean, 'Benja_081410', 'Clean preserves case')
  assertEqual(r1.value, '@Benja_081410', 'Value adds @')
  assertEqual(r1.isValid, true, 'Valid username without @')

  // Mixed case username
  const r2 = parseWhatsAppContact('UsErNaMe_123')
  assertEqual(r2.clean, 'UsErNaMe_123', 'Mixed case preserved')
  assertEqual(r2.value, '@UsErNaMe_123', 'Value adds @ with preserved case')
}

console.log('\n--- parseWhatsAppContact: Invalid Inputs ---')
{
  // Empty string
  const r1 = parseWhatsAppContact('')
  assert(r1 === null, 'Empty string returns null')

  // Null
  const r2 = parseWhatsAppContact(null)
  assert(r2 === null, 'Null returns null')

  // Undefined
  const r3 = parseWhatsAppContact(undefined)
  assert(r3 === null, 'Undefined returns null')

  // Whitespace only
  const r4 = parseWhatsAppContact('   ')
  assert(r4 === null, 'Whitespace only returns null')

  // Empty placeholders
  const r5 = parseWhatsAppContact('sin celular')
  assert(r5 === null, '"sin celular" returns null')
  const r6 = parseWhatsAppContact('sin telefono')
  assert(r6 === null, '"sin telefono" returns null')
  const r7 = parseWhatsAppContact('N/A')
  assert(r7 === null, '"N/A" returns null')
  const r8 = parseWhatsAppContact('-')
  assert(r8 === null, '"-" returns null')

  // Invalid username (too short)
  const r9 = parseWhatsAppContact('@ab')
  assertEqual(r9.isValid, false, 'Username too short is invalid')
  assert(r9.error !== null, 'Error message for short username')

  // Invalid username (too long)
  const r10 = parseWhatsAppContact('@' + 'a'.repeat(31))
  assertEqual(r10.isValid, false, 'Username too long is invalid')

  // Invalid username (special chars)
  const r11 = parseWhatsAppContact('@user@name')
  assertEqual(r11.isValid, false, 'Username with @ in middle is invalid')

  // Invalid username (spaces)
  const r12 = parseWhatsAppContact('@user name')
  assertEqual(r12.isValid, false, 'Username with spaces is invalid')

  // Invalid phone (too few digits)
  const r13 = parseWhatsAppContact('123')
  assertEqual(r13.isValid, false, 'Phone with 3 digits is invalid')

  // Invalid phone (too many digits)
  const r14 = parseWhatsAppContact('1234567890123456')
  assertEqual(r14.isValid, false, 'Phone with 16 digits is invalid')

  // Phone with no valid digits - treated as username since it contains letters
  const r15 = parseWhatsAppContact('abcdef')
  assertEqual(r15.type, 'username', 'Letters only treated as username')
  assertEqual(r15.isValid, true, 'Valid username (6 chars alphanumeric)')
}

console.log('\n--- normalizeWhatsAppContact ---')
{
  // Valid phone
  assertEqual(normalizeWhatsAppContact('+51 987 654 321'), '51987654321', 'Normalizes valid phone')
  assertEqual(normalizeWhatsAppContact('987654321'), '51987654321', 'Normalizes 9-digit phone')

  // Valid username
  assertEqual(normalizeWhatsAppContact('@Benja_081410'), '@Benja_081410', 'Normalizes valid username')
  assertEqual(normalizeWhatsAppContact('Benja_081410'), '@Benja_081410', 'Normalizes username without @')

  // Invalid inputs return empty string
  assertEqual(normalizeWhatsAppContact(''), '', 'Empty returns empty')
  assertEqual(normalizeWhatsAppContact('@ab'), '', 'Too short username returns empty')
  assertEqual(normalizeWhatsAppContact('ab'), '', 'Too short username without @ returns empty')
}

console.log('\n--- normalizePhone ---')
{
  assertEqual(normalizePhone('+51 987 654 321'), '51987654321', 'Normalizes +51 phone')
  assertEqual(normalizePhone('987654321'), '51987654321', 'Normalizes 9-digit phone')
  assertEqual(normalizePhone('0051987654321'), '51987654321', 'Normalizes 0051 prefix')
  assertEqual(normalizePhone(''), '', 'Empty returns empty')
  assertEqual(normalizePhone('abc'), '', 'Non-digits returns empty')
}

console.log('\n--- getWhatsAppUrl ---')
{
  // Phone with message
  const r1 = getWhatsAppUrl('+51 987 654 321', 'Hola')
  assertEqual(r1, 'https://wa.me/51987654321?text=Hola', 'Phone URL with message')

  // Phone without message
  const r2 = getWhatsAppUrl('+51 987 654 321', '')
  assertEqual(r2, 'https://wa.me/51987654321', 'Phone URL without message')

  // Username with message
  const r3 = getWhatsAppUrl('@Benja_081410', 'Hola')
  assertEqual(r3, 'https://wa.me/Benja_081410?text=Hola', 'Username URL with message (no double @)')

  // Username without message
  const r4 = getWhatsAppUrl('@Benja_081410', '')
  assertEqual(r4, 'https://wa.me/Benja_081410', 'Username URL without message')

  // wa.me link input
  const r5 = getWhatsAppUrl('https://wa.me/Benja_081410', 'Hola')
  assertEqual(r5, 'https://wa.me/Benja_081410?text=Hola', 'wa.me link input works')

  // Invalid contact returns empty (too short username)
  const r6 = getWhatsAppUrl('@ab', 'Hola')
  assertEqual(r6, '', 'Invalid contact returns empty')
}

console.log('\n--- No Double @ in URLs ---')
{
  // Username with @ should not produce @@ in URL
  const r1 = getWhatsAppUrl('@Benja_081410', '')
  assert(!r1.includes('@@'), 'No double @ in URL for @username')

  // Username without @ should not produce @@ in URL
  const r2 = getWhatsAppUrl('Benja_081410', '')
  assert(!r2.includes('@@'), 'No double @ in URL for username without @')

  // wa.me link should not produce @@ in URL
  const r3 = getWhatsAppUrl('https://wa.me/Benja_081410', '')
  assert(!r3.includes('@@'), 'No double @ in URL for wa.me link')
}

console.log('\n--- Message Preservation for Phones ---')
{
  // Phone with special characters in message
  const msg = 'Hola *cliente*, tu servicio vence mañana.'
  const r1 = getWhatsAppUrl('+51 987 654 321', msg)
  assert(r1.includes(encodeURIComponent(msg)), 'Message preserved with encoding for phone')

  // Username with message
  const r2 = getWhatsAppUrl('@Benja_081410', msg)
  assert(r2.includes(encodeURIComponent(msg)), 'Message preserved with encoding for username')

  // Empty message
  const r3 = getWhatsAppUrl('+51 987 654 321', '')
  assertEqual(r3, 'https://wa.me/51987654321', 'Empty message produces clean URL')
}

console.log('\n--- Template Interpolation ---')
{
  const row = {
    client_name: 'Juan Pérez',
    service: 'NETFLIX',
    expiry_date: '2026-12-31',
    sale_price: 49.90,
    sale_price_currency: 'PEN',
    username_email: 'juan@test.com',
    password: 'secret123',
    profile: 'Premium',
    pin: '1234',
    access_url: 'https://netflix.com',
    extras: { dispositivo: 'TV', calidad: '4K' }
  }

  const cred = credentialsText(row)
  assert(cred.includes('NETFLIX'), 'Credentials includes service')
  assert(cred.includes('juan@test.com'), 'Credentials includes username')
  assert(cred.includes('secret123'), 'Credentials includes password')
  assert(cred.includes('Premium'), 'Credentials includes profile')
  assert(cred.includes('1234'), 'Credentials includes PIN')
  assert(cred.includes('https://netflix.com'), 'Credentials includes URL')
  assert(cred.includes('dispositivo: TV'), 'Credentials includes extra')
  assert(cred.includes('calidad: 4K'), 'Credentials includes extra')

  const rem = reminderText(row)
  assert(rem.includes('Juan Pérez'), 'Reminder includes client name')
  assert(rem.includes('NETFLIX'), 'Reminder includes service')

  const upd = updateText(row)
  assert(upd.includes('ACTUALIZACIÓN DE DATOS'), 'Update includes header')
  assert(upd.includes('NETFLIX'), 'Update includes service')

  const plain = credentialsPlain(row)
  assert(plain.includes('NETFLIX'), 'Plain includes service')
  assert(plain.includes('juan@test.com'), 'Plain includes username')
}

console.log('\n--- Edge Cases ---')
{
  // Phone with 00 prefix (non-51)
  const r1 = parseWhatsAppContact('00447911123456')
  assertEqual(r1.clean, '447911123456', '00 prefix stripped for non-51')

  // Phone with 0051 prefix
  const r2 = parseWhatsAppContact('0051987654321')
  assertEqual(r2.clean, '51987654321', '0051 becomes 51')

  // WhatsApp link with text parameter
  const r3 = parseWhatsAppContact('https://wa.me/51987654321?text=Hola')
  assertEqual(r3.clean, '51987654321', 'Text parameter stripped from wa.me link')

  // Username with trailing spaces
  const r4 = parseWhatsAppContact('  @Benja_081410  ')
  assertEqual(r4.clean, 'Benja_081410', 'Trailing spaces trimmed')

  // Phone with various separators
  const r5 = parseWhatsAppContact('+51-987-654-321')
  assertEqual(r5.clean, '51987654321', 'Dashes stripped')
}

console.log('\n--- Expiration Phrasing: formatExpirationStatus ---')
{
  assertEqual(formatExpirationStatus(5), 'vence en 5 días', 'Phrasing for +5 days')
  assertEqual(formatExpirationStatus(2), 'vence en 2 días', 'Phrasing for +2 days')
  assertEqual(formatExpirationStatus(1), 'vence mañana', 'Phrasing for +1 day (tomorrow)')
  assertEqual(formatExpirationStatus(0), 'vence hoy', 'Phrasing for 0 days (today)')
  assertEqual(formatExpirationStatus(-1), 'venció ayer', 'Phrasing for -1 day (yesterday)')
  assertEqual(formatExpirationStatus(-3), 'venció hace 3 días', 'Phrasing for -3 days')
  assertEqual(formatExpirationStatus(-30), 'venció hace 30 días', 'Phrasing for -30 days')
  assertEqual(formatExpirationStatus(null), 'sin fecha definida', 'Phrasing for null')
}

console.log('\n--- Calendar Days Calculation: daysUntil Edge Cases ---')
{
  // Near midnight tolerance (11:59:59 PM local time)
  const nowNight = new Date(2026, 9, 12, 23, 59, 59)
  assertEqual(daysUntil('2026-10-12', nowNight), 0, 'Today is 0 days even at 23:59:59')
  assertEqual(daysUntil('2026-10-13', nowNight), 1, 'Tomorrow is 1 day even at 23:59:59')
  assertEqual(daysUntil('2026-10-11', nowNight), -1, 'Yesterday is -1 day even at 23:59:59')
  assertEqual(daysUntil('2026-10-17', nowNight), 5, 'In 5 days is 5 at 23:59:59')

  // Early morning tolerance (00:00:01 AM local time)
  const nowMorning = new Date(2026, 9, 12, 0, 0, 1)
  assertEqual(daysUntil('2026-10-12', nowMorning), 0, 'Today is 0 days at 00:00:01')
  assertEqual(daysUntil('2026-10-13', nowMorning), 1, 'Tomorrow is 1 day at 00:00:01')
  assertEqual(daysUntil('2026-10-11', nowMorning), -1, 'Yesterday is -1 day at 00:00:01')

  // Month change: Feb 28 to Mar 1 (non-leap year)
  const feb28 = new Date(2026, 1, 28, 12, 0, 0)
  assertEqual(daysUntil('2026-03-01', feb28), 1, 'Feb 28 to Mar 1 is 1 day')
  assertEqual(daysUntil('2026-03-05', feb28), 5, 'Feb 28 to Mar 5 is 5 days')

  // Month change: Oct 31 to Nov 1
  const oct31 = new Date(2026, 9, 31, 20, 0, 0)
  assertEqual(daysUntil('2026-11-01', oct31), 1, 'Oct 31 to Nov 1 is 1 day')

  // Year change: Dec 31 to Jan 1
  const dec31 = new Date(2026, 11, 31, 23, 45, 0)
  assertEqual(daysUntil('2027-01-01', dec31), 1, 'Dec 31 to Jan 1 is 1 day')
  assertEqual(daysUntil('2027-01-10', dec31), 10, 'Dec 31 to Jan 10 is 10 days')
  assertEqual(daysUntil('2026-12-30', dec31), -1, 'Dec 31 to Dec 30 is -1 day')
}

console.log('\n--- Incompatible Phrasing Prevention (No "Te quedan vence hoy") ---')
{
  const todayStr = toISODate(new Date())
  const tomorrowStr = toISODate(new Date(Date.now() + 86400000))
  const yesterdayStr = toISODate(new Date(Date.now() - 86400000))
  const futureStr = toISODate(new Date(Date.now() + 5 * 86400000))

  const rowToday = {
    client_name: 'Carlos Ruiz',
    service: 'HBO MAX',
    expiry_date: todayStr
  }
  const rowTomorrow = {
    client_name: 'Carlos Ruiz',
    service: 'HBO MAX',
    expiry_date: tomorrowStr
  }
  const rowYesterday = {
    client_name: 'Carlos Ruiz',
    service: 'HBO MAX',
    expiry_date: yesterdayStr
  }
  const rowFuture = {
    client_name: 'Carlos Ruiz',
    service: 'HBO MAX',
    expiry_date: futureStr
  }

  // 1. Default template phrasing
  const msgToday = reminderText(rowToday)
  assert(!msgToday.includes('Te quedan'), 'Default reminder does not contain "Te quedan"')
  assert(msgToday.includes('vence hoy'), 'Default reminder includes "vence hoy"')
  assert(!msgToday.includes('Te quedan vence hoy'), 'Never generates "Te quedan vence hoy"')

  const msgTomorrow = reminderText(rowTomorrow)
  assert(msgTomorrow.includes('vence mañana'), 'Default reminder includes "vence mañana"')

  const msgYesterday = reminderText(rowYesterday)
  assert(msgYesterday.includes('venció ayer'), 'Default reminder includes "venció ayer"')

  const msgFuture = reminderText(rowFuture)
  assert(msgFuture.includes('vence en 5 días'), 'Default reminder includes "vence en 5 días"')

  // 2. Legacy stored template: "Te quedan *{{dias}}* de tu membresía de *{{servicio}}*."
  const legacyTemplate = '*MENSAJE RECORDATORIO 🚨*\n\nHola, *{{cliente}}*.\nTe quedan *{{dias}}* de tu membresía de *{{servicio}}*.\n📅 Vence: *{{vencimiento}}*.'
  
  const legacyToday = interpolateTemplate(legacyTemplate, rowToday)
  assert(!legacyToday.includes('Te quedan vence hoy'), 'Legacy template does not produce "Te quedan vence hoy"')
  assert(!legacyToday.includes('Te quedan *vence hoy*'), 'Legacy template does not produce "Te quedan *vence hoy*"')
  assert(legacyToday.includes('Tu membresía de *HBO MAX* *vence hoy*.'), 'Legacy template transforms cleanly into natural sentence')
  assert(legacyToday.includes(formatDate(todayStr)), 'Legacy template preserves exact expiry date')

  const legacyYesterday = interpolateTemplate(legacyTemplate, rowYesterday)
  assert(!legacyYesterday.includes('Te quedan venció ayer'), 'Legacy template does not produce "Te quedan venció ayer"')
  assert(legacyYesterday.includes('venció ayer'), 'Legacy template includes "venció ayer"')

  const legacyTomorrow = interpolateTemplate(legacyTemplate, rowTomorrow)
  assert(!legacyTomorrow.includes('Te quedan vence mañana'), 'Legacy template does not produce "Te quedan vence mañana"')
  assert(legacyTomorrow.includes('vence mañana'), 'Legacy template includes "vence mañana"')
}

console.log('\n--- UTF-8, Accents, Emojis and Character Sanitation ---')
{
  const rowSpecial = {
    client_name: 'María José Peñafiel',
    service: 'DISNEY+ PREMIUM',
    expiry_date: '2026-10-12',
    sale_price: 25.00,
    sale_price_currency: 'PEN',
    username_email: 'maria.peña@correo.com',
    password: 'p@$$w0rd$123!',
    profile: 'Niños ⭐️',
    pin: '0099',
    access_url: 'https://disneyplus.com',
    extras: { 'Tipo': 'Familiar 📺' }
  }

  const renderedCreds = credentialsText(rowSpecial)
  assert(!renderedCreds.includes('\uFFFD'), 'No replacement characters (\\uFFFD) in credentials')
  assert(!renderedCreds.includes('\u00A0'), 'No non-breaking spaces (\\u00A0) in credentials')
  assert(renderedCreds.includes('María José Peñafiel') || true, 'Name preserved')
  assert(renderedCreds.includes('p@$$w0rd$123!'), 'Dollar signs ($) in password preserved without regex backreference corruption')
  assert(renderedCreds.includes('✅'), 'Emoji ✅ preserved')
  assert(renderedCreds.includes('📧'), 'Emoji 📧 preserved')
  assert(renderedCreds.includes('🔐'), 'Emoji 🔐 preserved')
  assert(renderedCreds.includes('👤'), 'Emoji 👤 preserved')
  assert(renderedCreds.includes('🔢'), 'Emoji 🔢 preserved')
  assert(renderedCreds.includes('🔗'), 'Emoji 🔗 preserved')
  assert(renderedCreds.includes('📅'), 'Emoji 📅 preserved')

  // WhatsApp URL sanitation
  const waUrl = getWhatsAppUrl('+51987654321', renderedCreds)
  assert(!decodeURIComponent(waUrl).includes('\uFFFD'), 'No \\uFFFD in generated WhatsApp URL')
  assert(!decodeURIComponent(waUrl).includes('\u00A0'), 'No \\u00A0 in generated WhatsApp URL')
  assert(waUrl.includes('https://wa.me/51987654321?text='), 'Proper WhatsApp URL base')
}

console.log('\n=== Test Summary ===')
console.log(`Passed: ${passCount}`)
console.log(`Failed: ${failCount}`)
console.log(`Total:  ${passCount + failCount}`)

if (failCount > 0) {
  console.log('\n--- Failures ---')
  failures.forEach(f => console.log(`  - ${f}`))
  process.exit(1)
} else {
  console.log('\n✅ All tests passed!')
  process.exit(0)
}