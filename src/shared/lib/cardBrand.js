const PATTERNS = [
  { brand: 'visa', re: /^4/ },
  { brand: 'mastercard', re: /^(5[1-5]|2[2-7])/ },
  { brand: 'amex', re: /^3[47]/ },
  { brand: 'diners', re: /^3(0[0-5]|[68])/ },
  { brand: 'discover', re: /^6(011|5)/ },
];

export function detectCardBrand(cardNumber) {
  const digits = (cardNumber || '').replace(/\D/g, '');
  for (const { brand, re } of PATTERNS) {
    if (re.test(digits)) return brand;
  }
  return null;
}

export function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  const isAmex = detectCardBrand(digits) === 'amex';
  const groups = isAmex ? [4, 6, 5] : [4, 4, 4, 4, 3];
  let out = '';
  let i = 0;
  for (const size of groups) {
    if (i >= digits.length) break;
    out += (out ? ' ' : '') + digits.slice(i, i + size);
    i += size;
  }
  return out;
}

export function isValidLuhn(cardNumber) {
  const digits = (cardNumber || '').replace(/\D/g, '');
  if (digits.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}
