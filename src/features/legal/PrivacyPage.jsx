import './privacy.css';

// Política de tratamiento de datos de ACERO.press y Micra (Ley 1581 de 2012).
// La sección «Ubicación» es la que enlaza el permiso de «Salí a vender» en la app
// (#ubicacion). Si cambia lo que se hace con un dato, este texto cambia en el mismo commit.

const UPDATED = '30 de octubre de 2026';

export default function PrivacyPage() {
  return (
    <main className="priv">
      <a className="priv-home" href="/">← ACERO.press</a>
      <h1>Privacidad y tratamiento de datos</h1>
      <p className="priv-meta">Última actualización: {UPDATED}</p>

      <p>ACERO.press (Bogotá, Colombia) trata los datos personales de quienes usan su sitio y la app Micra según la Ley 1581 de 2012 y sus decretos. Aquí está qué datos usamos, para qué y cómo ejercer tus derechos.</p>

      <h2>Qué datos usamos</h2>
      <ul>
        <li><b>Tu cuenta:</b> nombre y correo de Google cuando entras.</li>
        <li><b>Pedidos y apartados:</b> lo que pides, el nombre que dejas y, si lo das, tu WhatsApp.</li>
        <li><b>Si eres barista en Micra:</b> tus precios, tus ventas y fiados, tus salidas a vender y tu ubicación mientras vendes (abajo).</li>
        <li><b>Medición del sitio:</b> solo si aceptas las cookies, cómo llegaste y qué páginas viste.</li>
      </ul>

      <h2 id="ubicacion">Ubicación</h2>
      <p>Micra usa la ubicación de tu celular <b>solo mientras tienes activo «Salí a vender»</b>. Al tocar «Ya volví» deja de usarla. En la app instalada sigue funcionando con la pantalla apagada; en Android lo verás en una notificación mientras esté activa.</p>
      <p>La usamos para:</p>
      <ul>
        <li>mostrarte a los clientes cercanos en el mapa, para que te encuentren y te aparten;</li>
        <li>mejorar Micra y sus funciones;</li>
        <li>hacer análisis estadísticos de las zonas donde se vende café, que se presentan agregados y nunca con tu nombre.</li>
      </ul>
      <p>La ven tú y el equipo de ACERO.press; otros vendedores y los clientes solo ven tu punto aproximado (una cuadra) mientras estás en la calle. Puedes pausarla o retirar este permiso cuando quieras desde la app, y pedir que borremos tus recorridos.</p>
      <p id="zona">Si buscas café en Micra y tocas <b>«Cerca de mí»</b>, tu ubicación se usa en tu celular para ordenar a los baristas. Además, Micra envía <b>solo tu zona aproximada</b> (un cuadro de unos 400 m) y la bebida que buscas, como máximo una vez cada 15 minutos, para que los baristas sepan dónde quieren café. No enviamos tu ubicación exacta ni tu nombre, y la base no guarda el identificador de tu celular (solo una huella que cambia cada día). Los baristas ven solo zonas donde hay dos personas o más, nunca a una persona. Cada señal se borra a la hora. Puedes desactivarlo con «No mostrar mi zona».</p>

      <h2>Tus derechos</h2>
      <p>Puedes conocer, actualizar, rectificar y pedir que se supriman tus datos, y retirar tu autorización. Escríbenos por WhatsApp o a nuestras redes indicando tu nombre y lo que pides; respondemos en los plazos de la ley (10 días hábiles para consultas, 15 para reclamos).</p>

      <h2>Quién más los ve</h2>
      <p>No vendemos tus datos. Los guardan nuestros proveedores de infraestructura (base de datos y hosting) solo para operar el servicio.</p>
    </main>
  );
}
