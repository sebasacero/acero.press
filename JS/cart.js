/* ============================================
   FUNCIONALIDADES FALTANTES — acero.press
   Pégalo antes de </body>, después de main.js:
   <script src="js/cart.js"></script>

   IMPORTANTE: cada sección está envuelta en su
   propio try/catch. Si una falla (por ejemplo por
   el bug de IDs duplicados en #recipeFilter), las
   demás (botón de WhatsApp, checkout, carrito)
   igual se ejecutan. Revisa la consola del navegador
   (F12 → Console) si algo no aparece: ahí vas a ver
   exactamente cuál sección falló y por qué.
   ============================================ */

/* ---------------------------------------------
   CONFIG WHATSAPP — cambia el número por el real
   Formato: código de país + número, sin +, sin espacios
   Ejemplo Colombia: 573001112233
--------------------------------------------- */
const WHATSAPP_NUMBER = '573152125327';

document.addEventListener('DOMContentLoaded', () => {

  const money = n => '$' + Math.round(n).toLocaleString('es-CO');
  const slugify = str => str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const parsePrice = str => {
    const digits = (str || '').replace(/[^\d]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  };

  function buildOrderMessage(items){
    const lines = items.map(i =>
      `• ${i.qty}x ${i.name}${i.variant ? ' (' + i.variant + ')' : ''} — ${money(i.price * i.qty)}`
    );
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    return ['¡Hola! Quiero hacer este pedido:', '', ...lines, '', `Total: ${money(total)}`].join('\n');
  }
  function sendToWhatsApp(message){
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  }

  let cart = [];

  /* ---------------------------------------------
     0) BOTÓN FLOTANTE DE WHATSAPP — va primero,
     sin depender de nada más en la página.
  --------------------------------------------- */
  try {
    if (!document.getElementById('wa-float-btn')) {
      const waBtn = document.createElement('a');
      waBtn.id = 'wa-float-btn';
      waBtn.className = 'wa-float';
      waBtn.target = '_blank';
      waBtn.rel = 'noopener';
      waBtn.setAttribute('aria-label', 'Escríbenos por WhatsApp');
      waBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('¡Hola! Tengo una pregunta sobre acero.press')}`;
      waBtn.innerHTML = `
        <span class="wa-float-pulse" aria-hidden="true"></span>
        <svg viewBox="0 0 24 24" fill="#fff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12.004 2C6.477 2 2 6.477 2 12c0 1.85.505 3.63 1.46 5.19L2 22l4.94-1.446A9.94 9.94 0 0 0 12.004 22C17.53 22 22 17.523 22 12S17.53 2 12.004 2zm0 18.09a8.05 8.05 0 0 1-4.408-1.32l-.316-.196-3.13.916.923-3.086-.207-.317A8.05 8.05 0 0 1 3.91 12c0-4.472 3.62-8.09 8.093-8.09 4.47 0 8.09 3.618 8.09 8.09 0 4.47-3.62 8.09-8.09 8.09z"/>
        </svg>`;
      document.body.appendChild(waBtn);
      console.log('[cart.js] Botón flotante de WhatsApp inyectado ✅');
    }
  } catch (err) { console.error('[cart.js] Error en botón flotante WA:', err); }

  /* ---------------------------------------------
     1) DRAWER DEL CARRITO — se inyecta si no existe
  --------------------------------------------- */
  try {
    if (!document.getElementById('cart-drawer')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div id="cart-overlay" class="cart-overlay"></div>
        <aside id="cart-drawer" class="cart-drawer" aria-hidden="true">
          <div class="cart-drawer-header">
            <h2>Tu carrito</h2>
            <button id="cart-close" class="cart-close-btn" aria-label="Cerrar carrito">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div id="cart-items" class="cart-items"><p class="cart-empty">Tu carrito está vacío</p></div>
          <div class="cart-drawer-footer">
            <p class="cart-subtotal-note">Envío e impuestos calculados en el pago</p>
            <div class="cart-subtotal-row"><span>Subtotal</span><span id="cart-subtotal">$0</span></div>
            <button id="btn-checkout" class="btn-checkout">Finalizar compra</button>
            <button id="btn-continue" class="btn-continue">Seguir comprando</button>
          </div>
        </aside>`;
      document.body.appendChild(wrap);
      console.log('[cart.js] Drawer del carrito inyectado ✅');
    }
  } catch (err) { console.error('[cart.js] Error creando el drawer:', err); }

  const cartOverlay    = document.getElementById('cart-overlay');
  const cartDrawer     = document.getElementById('cart-drawer');
  const cartItemsEl    = document.getElementById('cart-items');
  const cartSubtotalEl = document.getElementById('cart-subtotal');
  let cartCountEl = document.getElementById('cart-count');

  function renderCart(){
    if (!cartItemsEl || !cartSubtotalEl) return;
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    if (cartCountEl){
      if (totalQty > 0){
        cartCountEl.style.display = 'flex';
        cartCountEl.textContent = totalQty;
        cartCountEl.classList.remove('pulse'); void cartCountEl.offsetWidth; cartCountEl.classList.add('pulse');
      } else { cartCountEl.style.display = 'none'; }
    }
    cartItemsEl.innerHTML = cart.length === 0
      ? '<p class="cart-empty">Tu carrito está vacío</p>'
      : cart.map(item => `
        <div class="cart-item" data-id="${item.id}">
          <div class="cart-item-thumb"><img src="${item.image}" alt="${item.name}"></div>
          <div class="cart-item-body">
            <div class="cart-item-top">
              <div><div class="cart-item-name">${item.name}</div><div class="cart-item-variant">${item.variant}</div></div>
              <button class="cart-item-remove" data-action="remove" data-id="${item.id}">Eliminar</button>
            </div>
            <div class="cart-item-bottom">
              <div class="cart-item-qty">
                <button data-action="minus" data-id="${item.id}">−</button>
                <span>${item.qty}</span>
                <button data-action="plus" data-id="${item.id}">+</button>
              </div>
              <div class="cart-item-price">${money(item.price * item.qty)}</div>
            </div>
          </div>
        </div>`).join('');
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    cartSubtotalEl.textContent = money(subtotal);
  }

  /* ---------------------------------------------
     2) ABRIR/CERRAR CARRITO + ícono del navbar
  --------------------------------------------- */
  try {
    function openCart(){
      cartDrawer.classList.add('open'); cartOverlay.classList.add('open');
      cartDrawer.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden';
    }
    function closeCart(){
      cartDrawer.classList.remove('open'); cartOverlay.classList.remove('open');
      cartDrawer.setAttribute('aria-hidden','true'); document.body.style.overflow = '';
    }

    const cartLink = document.querySelector('a[href="#cart"].icon-link, [data-cart-toggle]');
    if (cartLink) {
      cartLink.setAttribute('data-cart-toggle', '');
      cartLink.addEventListener('click', (e) => { e.preventDefault(); openCart(); });
      if (!cartCountEl) {
        cartCountEl = document.createElement('span');
        cartCountEl.id = 'cart-count';
        cartCountEl.className = 'cart-count-badge';
        cartLink.appendChild(cartCountEl);
      }
    } else {
      console.warn('[cart.js] No encontré el ícono del carrito (a[href="#cart"].icon-link) — revisa tu navbar.');
    }

    document.getElementById('cart-close')?.addEventListener('click', closeCart);
    document.getElementById('btn-continue')?.addEventListener('click', closeCart);
    cartOverlay?.addEventListener('click', closeCart);

    cartItemsEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const item = cart.find(i => i.id === id);
      if (!item) return;
      if (btn.dataset.action === 'plus')  item.qty += 1;
      if (btn.dataset.action === 'minus') item.qty = Math.max(1, item.qty - 1);
      if (btn.dataset.action === 'remove') cart = cart.filter(i => i.id !== id);
      renderCart();
    });
  } catch (err) { console.error('[cart.js] Error enganchando el ícono del carrito:', err); }

  /* ---------------------------------------------
     3) CHECKOUT → WhatsApp
  --------------------------------------------- */
  try {
    const checkoutBtn = document.getElementById('btn-checkout');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) { alert('Tu carrito está vacío.'); return; }
        sendToWhatsApp(buildOrderMessage(cart));
      });
      console.log('[cart.js] Botón "Finalizar compra" conectado a WhatsApp ✅');
    } else {
      console.warn('[cart.js] No encontré #btn-checkout.');
    }
  } catch (err) { console.error('[cart.js] Error conectando checkout:', err); }

  /* ---------------------------------------------
     4) "Buy with Shop" → WhatsApp (compra rápida de 1 producto)
  --------------------------------------------- */
  try {
    const shopBtns = document.querySelectorAll('.btn-buy-shop');
    console.log(`[cart.js] Encontrados ${shopBtns.length} botones .btn-buy-shop`);
    shopBtns.forEach(shopBtn => {
      shopBtn.addEventListener('click', () => {
        const section = shopBtn.closest('.product-container');
        const info = section?.querySelector('.product-info');
        if (!info) { console.warn('[cart.js] btn-buy-shop sin .product-info cerca.'); return; }
        const name    = info.querySelector('.product-title')?.textContent.trim() || 'Producto';
        const price   = parsePrice(info.querySelector('.product-price')?.textContent);
        const variant = info.querySelector('.size-btn.active')?.textContent.trim() || '';
        const qty     = parseInt(section.querySelector('.qty-number')?.textContent || '1');
        sendToWhatsApp(buildOrderMessage([{ name, price, variant, qty }]));
      });
    });
  } catch (err) { console.error('[cart.js] Error conectando btn-buy-shop:', err); }

  /* ---------------------------------------------
     5) PRODUCTOS: tamaño, cantidad, galería, add to cart
     (cada .product-container se procesa por separado;
     si uno falla, los demás siguen funcionando)
  --------------------------------------------- */
  document.querySelectorAll('.product-container').forEach(section => {
    try {
      const info = section.querySelector('.product-info');
      if (!info) return;

      const sizeButtons = info.querySelectorAll('.size-btn');
      sizeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          sizeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      const qtyEl = section.querySelector('.qty-number');
      const qtyButtons = section.querySelectorAll('.qty-btn');
      if (qtyEl && qtyButtons.length >= 2) {
        qtyButtons[0].addEventListener('click', () => { let q = parseInt(qtyEl.textContent); if (q > 1) qtyEl.textContent = q - 1; });
        qtyButtons[1].addEventListener('click', () => { let q = parseInt(qtyEl.textContent); qtyEl.textContent = q + 1; });
      }

      const gallery = section.querySelector('.product-gallery');
      if (gallery) {
        let variants = [];
        try { variants = JSON.parse(gallery.dataset.variants || '[]'); } catch(e) {}
        const imgEl   = gallery.querySelector('.image-wrapper img');
        const dots    = gallery.querySelectorAll('.dot');
        const prevBtn = gallery.querySelector('.nav-btn.prev');
        const nextBtn = gallery.querySelector('.nav-btn.next');
        let current = 0;
        function applyVariant(i){
          if (variants.length === 0) return;
          current = (i + variants.length) % variants.length;
          const v = variants[current];
          if (imgEl) { imgEl.src = v.image; imgEl.alt = v.name; }
          const titleEl = info.querySelector('.product-title');
          const priceEl = info.querySelector('.product-price');
          if (titleEl) titleEl.textContent = v.name;
          if (priceEl) priceEl.textContent = v.price.toLocaleString('es-CO');
          dots.forEach((d,idx) => d.classList.toggle('active', idx === current));
        }
        prevBtn?.addEventListener('click', () => applyVariant(current - 1));
        nextBtn?.addEventListener('click', () => applyVariant(current + 1));
        dots.forEach((dot, i) => dot.addEventListener('click', () => applyVariant(i)));
      }

      const addBtn = section.querySelector('.btn-add-cart');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const name    = info.querySelector('.product-title')?.textContent.trim() || 'Producto';
          const price   = parsePrice(info.querySelector('.product-price')?.textContent);
          const variant = info.querySelector('.size-btn.active')?.textContent.trim() || '';
          const qty     = parseInt(qtyEl?.textContent || '1');
          const image   = section.querySelector('.image-wrapper img')?.src || '';
          const id      = slugify(name) + (variant ? '-' + slugify(variant) : '');
          const existing = cart.find(i => i.id === id);
          if (existing) existing.qty += qty; else cart.push({ id, name, price, variant, qty, image });
          renderCart();
          const original = addBtn.innerHTML;
          addBtn.classList.add('added'); addBtn.innerHTML = 'Added ✓';
          setTimeout(() => { addBtn.classList.remove('added'); addBtn.innerHTML = original; }, 1000);
        });
      }
    } catch (err) { console.error('[cart.js] Error en un .product-container:', err); }
  });

  /* ---------------------------------------------
     6) CARRUSEL DE RECETAS
  --------------------------------------------- */
  try {
    document.querySelectorAll('.recipe-carousel-wrap').forEach(wrap => {
      const track = wrap.querySelector('.recipe-blog');
      const prev  = wrap.querySelector('.recipe-arrow.prev');
      const next  = wrap.querySelector('.recipe-arrow.next');
      if (!track) return;
      const scrollAmount = () => (track.querySelector('.recipe-card')?.offsetWidth || 300) + 20;
      prev?.addEventListener('click', () => track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
      next?.addEventListener('click', () => track.scrollBy({ left:  scrollAmount(), behavior: 'smooth' }));
    });
  } catch (err) { console.error('[cart.js] Error en carrusel de recetas:', err); }

  /* ---------------------------------------------
     7) FILTRO DE RECETAS POR AÑO
  --------------------------------------------- */
  
  /* ---------------------------------------------
     8) ODÓMETRO: barra de segmentos
  --------------------------------------------- */
  try {
    document.querySelectorAll('.seg-bar').forEach(bar => {
      if (bar.children.length > 0) return;
      const badge = document.querySelector('.cota-badge');
      const pct = badge ? parseFloat(badge.textContent) : 0;
      const TOTAL_SEGMENTS = 20;
      const filledCount = Math.round((pct / 100) * TOTAL_SEGMENTS);
      for (let i = 0; i < TOTAL_SEGMENTS; i++) {
        const seg = document.createElement('div');
        seg.className = 'seg' + (i < filledCount ? ' filled' : '');
        bar.appendChild(seg);
      }
    });
  } catch (err) { console.error('[cart.js] Error en odómetro:', err); }

  /* ---------------------------------------------
     9) Accesibilidad en botones "Ver receta completa"
  --------------------------------------------- */
  try {
    document.querySelectorAll('.recipe-toggle').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => btn.setAttribute('aria-expanded', 'true'));
    });
  } catch (err) { console.error('[cart.js] Error en recipe-toggle:', err); }

  console.log('[cart.js] Inicialización completa.');
});
