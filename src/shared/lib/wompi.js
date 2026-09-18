// Tokeniza una tarjeta directamente contra la API de Wompi desde el navegador,
// usando la llave PÚBLICA (segura de exponer, igual que la publishable key de
// Stripe). El número, CVC y fecha de la tarjeta viajan directo a Wompi — nunca
// pasan por nuestro servidor. El token resultante es lo único que se envía a
// /api/create-local-payment para crear la transacción.
//
// Documentación: https://docs.wompi.co/docs/colombia/tokens-de-tarjetas/
const WOMPI_PUBLIC_KEY = import.meta.env.VITE_WOMPI_PUBLIC_KEY;
const WOMPI_ENV = import.meta.env.VITE_WOMPI_ENV === 'production' ? 'production' : 'sandbox';
const WOMPI_API_BASE =
  WOMPI_ENV === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';

export function isWompiConfigured() {
  return !!WOMPI_PUBLIC_KEY;
}

/**
 * card: { number, expMonth, expYear (2 dígitos), cvc, cardHolder }
 * Devuelve { token } o { error }.
 */
export async function tokenizeWompiCard(card) {
  if (!WOMPI_PUBLIC_KEY) {
    return { error: 'not-configured' };
  }
  try {
    const res = await fetch(`${WOMPI_API_BASE}/tokens/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WOMPI_PUBLIC_KEY}`,
      },
      body: JSON.stringify({
        number: card.number.replace(/\s/g, ''),
        exp_month: card.expMonth,
        exp_year: card.expYear,
        cvc: card.cvc,
        card_holder: card.cardHolder,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.data?.id) {
      return { error: 'generic', detail: data?.error?.reason };
    }
    return { token: data.data.id };
  } catch (err) {
    console.error('Error tokenizando tarjeta con Wompi:', err);
    return { error: 'generic' };
  }
}

// Bancos habilitados para PSE en Colombia (código real usado por Wompi/ACH Colombia).
export const PSE_BANKS = [
  { code: '1007', name: 'Bancolombia' },
  { code: '1051', name: 'Davivienda' },
  { code: '1001', name: 'Banco de Bogotá' },
  { code: '1023', name: 'Banco de Occidente' },
  { code: '1062', name: 'Banco Falabella' },
  { code: '1019', name: 'Scotiabank Colpatria' },
  { code: '1040', name: 'Banco Agrario' },
  { code: '1052', name: 'Banco AV Villas' },
  { code: '1013', name: 'BBVA Colombia' },
  { code: '1006', name: 'Banco Itaú' },
  { code: '1032', name: 'Banco Caja Social' },
  { code: '1002', name: 'Banco Popular' },
  { code: '1292', name: 'Nequi' },
  { code: '1551', name: 'Banco Nu' },
];
