// Lógica pura del código de entrada por WhatsApp (index.ts la usa; tests al lado).

export const DEFAULT_TEMPLATE = 'micra_codigo';
export const DEFAULT_LANG = 'es';

/**
 * El número al que se escribe, como lo pide la Cloud API («573001234567»).
 * Solo celulares de Colombia: así nadie gasta el saldo pidiendo códigos a otros países.
 */
export function otpPhone(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  return /^573\d{9}$/.test(d) ? d : null;
}

/** El código que manda Supabase: solo números, de 4 a 10. */
export function otpCode(raw) {
  const c = String(raw ?? '');
  return /^\d{4,10}$/.test(c) ? c : null;
}

/**
 * La plantilla de autenticación de Meta: el código va en el cuerpo y en el
 * botón «Copiar código» (Meta pide el mismo código en los dos).
 */
export function otpPayload({ to, code, template = DEFAULT_TEMPLATE, lang = DEFAULT_LANG }) {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ],
    },
  };
}

/** La respuesta de error que entiende Supabase Auth (y le muestra a la app). */
export function hookError(message, httpCode = 400) {
  return { error: { http_code: httpCode, message } };
}

/** El secreto del hook como lo da el dashboard («v1,whsec_…») a lo que pide standardwebhooks. */
export function hookSecret(raw) {
  return String(raw ?? '').replace(/^v1,whsec_/, '');
}
