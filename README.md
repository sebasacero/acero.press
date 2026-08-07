
# ── ACEROPRESS · Field Notebook & Specialty Coffee Bar

> **AeroPress-first specialty coffee ecosystem, championship recipe archive, and curated coffee shop based in Bogotá, Colombia.**

`acero.press` es una plataforma digital y cuaderno de campo enfocado en la extracción manual con **AeroPress**, divulgación de recetas del **World AeroPress Championship (WAC)**, y e-commerce de microlotes de especialidad (Bourbon Rosado, Ají Amarillo) y equipos.

---

## ── Visión General

El proyecto combina un sitio web minimalista/técnico con las siguientes verticales:

1. **Café de Especialidad & Bar:** Menú de extracciones, perfil de tueste y experiencia presencial en Bogotá (2,600 msnm).
2. **WAC Recipe Archive:** Registro documentado de recetas de competidores mundiales con parámetros exactos (ratio, dosis, temperatura, molienda, bypass).
3. **E-Commerce & Gear:** Venta en línea de café de especialidad exótico en grano/molido y accesorios oficiales AeroPress.

---

## ── Arquitectura del Proyecto

```text
aceropress/
├── css/
│   ├── cafe.css         # Estilos base, tipografía y maquetación técnica
│   └── cart.css         # Estilos para el carrito de compras y checkout
├── images/
│   ├── favicon.png      # Icono del sitio
│   └── og-image.jpg     # Previsualización para Open Graph y redes sociales
├── index.html           # Landing page principal
└── README.md            # Documentación del proyecto

── Stack Tecnológico & Tipografía

    HTML5 & CSS3 Pure: Maquetación ligéra y de alta velocidad sin frameworks pesados.

    SEO & JSON-LD: Estructura schema.org enriquecida (CafeOrCoffeeShop, OnlineStore, Blog, FAQPage).

    Analytics: Integración con Google Analytics 4 (gtag.js).

    Fuentes Primarias:

        Space Grotesk (Titulares / Display)

        JetBrains Mono (Parámetros técnicos, recetas y métricas)

        Archivo (Cuerpo de texto y lectura)

        Permanent Marker (Anotaciones / Cuaderno de campo)

── Estructura de Datos (Schema.org)

El sitio utiliza datos estructurados en formato JSON-LD para maximizar el posicionamiento semántico en buscadores y motores de IA:

    LocalBusiness / CafeOrCoffeeShop: Ubicación y geolocalización en Bogotá.

    OnlineStore: Venta de variedades exóticas (Bourbon Rosado, Ají Amarillo) y cafeteras.

    Blog: Índice de recetas de campeonatos.
