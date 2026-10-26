// Bitácora de recetas campeonas del World AeroPress Championship (WAC).
// Los campos de texto libre (place, coffee, equipment[].value, steps) están
// traducidos a es/en/ja. dose, temp y water quedan como valores numéricos
// (universales); position usa una key ('Upright'/'Inverted') que se traduce
// vía translations.position en el componente.

const recipes = [
  {
    year: 2025, flag: '🇦🇺', name: 'Némo Pop',
    dose: '18g', temp: '84°C', position: 'Upright', water: '125ppm',
    place: { es: '1er lugar · Final Mundial · Seúl', en: '1st place · World Final · Seoul', ja: '優勝 · 世界決勝 · ソウル' },
    coffee: {
      es: 'Ecuador, Finca La Carolina (productor Fausto Romo), variedad Sidra, proceso lavado, 1.300 msnm. Importado por Cafe Imports y tostado por Stereoscope Coffee.',
      en: 'Ecuador, Finca La Carolina (producer Fausto Romo), Sidra variety, washed process, 1,300 masl. Sourced by Cafe Imports and roasted by Stereoscope Coffee.',
      ja: 'エクアドル、フィンカ・ラ・カロリーナ産（生産者ファウスト・ロモ）、シドラ種、ウォッシュト製法、標高1,300m。Cafe Importsが調達し、Stereoscope Coffeeが焙煎。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Comandante Trailmaster X25 con fresas Tigershark, 31 clics, finos tamizados a 200µm.', en: 'Comandante Trailmaster X25 with Tigershark burrs, 31 clicks, fines sifted at 200µm.', ja: 'コマンダンテ トレイルマスターX25（Tigersharkバー）、31クリック、200µmで微粉をふるい分け。' } },
      { label: 'filter', value: { es: 'Flow Control Cap + 2 filtros de papel.', en: 'Flow Control Cap + 2 paper filters.', ja: 'フローコントロールキャップ + ペーパーフィルター2枚。' } },
      { label: 'water', value: { es: '125ppm (prototipo de Apax Lab), 84°C para extraer / 70g a 50°C para diluir.', en: '125ppm (Apax Lab prototype), 84°C to brew / 70g at 50°C to dilute.', ja: '125ppm（Apax Labの試作品）、抽出84°C／希釈用50°Cの湯70g。' } },
    ],
    steps: {
      es: ['Verter 70g de agua de dilución en la jarra.', 'Moler el café y retirar cascarilla y finos.', 'Colocar el AeroPress sobre la jarra y añadir el café molido.', 'Verter 100g de agua a 84°C humedeciendo todo el café.', 'A los 25s, remover suavemente en patrón Cruz (NSNS-WEWE).', 'A los 50s, presionar suavemente durante ~20 segundos.', 'Servir y disfrutar.'],
      en: ['Pour 70g of dilution water into the carafe.', 'Grind the coffee and remove chaff and fines.', 'Place the AeroPress on the carafe and add the ground coffee.', 'Pour 100g of water at 84°C, wetting all the coffee.', 'At 25s, gently stir in a Cross pattern (NSNS-WEWE).', 'At 50s, press gently for about 20 seconds.', 'Serve and enjoy.'],
      ja: ['カラフェに希釈用の湯70gを注ぐ。', 'コーヒーを挽き、チャフと微粉を取り除く。', 'カラフェの上にエアロプレスを置き、挽いたコーヒーを入れる。', '84°Cの湯100gを注ぎ、コーヒー全体を湿らせる。', '25秒後、クロスパターン（NSNS-WEWE）で優しくかき混ぜる。', '50秒後、約20秒かけて優しくプレスする。', '注いで楽しむ。'],
    },
  },
  {
    year: 2024, flag: '🇷🇴', name: 'George Stanica',
    dose: '18g', temp: '96°C', position: 'Inverted', water: '85–90ppm',
    place: { es: '1er lugar · Final Mundial · Lisboa', en: '1st place · World Final · Lisbon', ja: '優勝 · 世界決勝 · リスボン' },
    coffee: {
      es: 'Etiopía, Guji, estación de lavado Arsosala, variedades nativas (heirloom), proceso lavado, 1.800–1.900 msnm. Importado por Cafe Imports y tostado por Olisipo Coffee.',
      en: 'Ethiopia, Guji, Arsosala washing station, heirloom varieties, washed process, 1,800–1,900 masl. Sourced by Cafe Imports and roasted by Olisipo Coffee.',
      ja: 'エチオピア、グジ、アルソサラ・ウォッシングステーション、エアルーム品種、ウォッシュト製法、標高1,800〜1,900m。Cafe Importsが調達し、Olisipo Coffeeが焙煎。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Comandante C40 Mk4 con Red Clix, 58 clics (870µm).', en: 'Comandante C40 Mk4 with Red Clix, 58 clicks (870µm).', ja: 'コマンダンテC40 Mk4（Red Clix）、58クリック（870µm）。' } },
      { label: 'filter', value: { es: '1 filtro Aesir, enjuagado.', en: '1 Aesir filter, rinsed.', ja: 'Aesirフィルター1枚、リンス済み。' } },
      { label: 'water', value: { es: 'Aquacode rebajada a ~85–90ppm con agua de 0ppm. 96°C para extraer; agua de 0ppm a temperatura ambiente para diluir.', en: 'Aquacode diluted to ~85–90ppm with 0ppm water. 96°C to brew; room-temperature 0ppm water to dilute.', ja: 'Aquacodeを0ppmの水で約85〜90ppmに調整。抽出は96°C、希釈は常温の0ppmの水。' } },
    ],
    steps: {
      es: ['Posición Invertida, con el émbolo cerca de la marca 4. Añadir 18g de café molido.', 'Primer vertido: unos 50g de agua en 5–6 segundos (con Melodrip).', 'Dejar florecer unos 30 segundos.', 'Segundo vertido: otros 50g de agua en 5–6 segundos.', 'Remover suavemente norte-sur-este-oeste durante 10 segundos.', 'A 1:20, colocar la tapa con el filtro enjuagado y sacar el aire con suavidad (≈10 segundos).', 'Girar suavemente, voltear sobre la jarra y a 1:35 empezar a presionar.', 'Presionar suave durante 30–40 segundos hasta obtener ≈76–79g.', 'Diluir con agua caliente hasta 130–135g y luego añadir 20–30g de agua de 0ppm a temperatura ambiente. Servir.'],
      en: ['Inverted position, plunger near the 4 mark. Add 18g of ground coffee.', 'First pour: about 50g of water in 5–6 seconds (with a Melodrip).', 'Let it bloom for about 30 seconds.', 'Second pour: another 50g of water in 5–6 seconds.', 'Stir gently north-south-east-west for 10 seconds.', 'At 1:20, attach the cap with the rinsed filter and gently push out the air (≈10 seconds).', 'Swirl gently, flip onto the server and start pressing at 1:35.', 'Press gently for 30–40 seconds until you have ≈76–79g.', 'Dilute with hot water to 130–135g, then add 20–30g of room-temperature 0ppm water. Serve.'],
      ja: ['インバーテッドポジション、プランジャーは4の目盛り付近。挽いたコーヒー18gを入れる。', '1投目：湯約50gを5〜6秒で注ぐ（Melodrip使用）。', '約30秒蒸らす。', '2投目：さらに湯50gを5〜6秒で注ぐ。', '北・南・東・西の順に10秒間優しくかき混ぜる。', '1:20に、リンスしたフィルター付きのキャップを付け、優しく空気を抜く（約10秒）。', '優しく回してサーバーの上で反転させ、1:35にプレスを始める。', '30〜40秒かけて優しくプレスし、約76〜79gを得る。', '熱湯で130〜135gまで希釈し、常温の0ppmの水20〜30gを加えて提供する。'],
    },
  },
  {
    year: 2023, flag: '🇹🇭', name: 'Tay Wipvasutt',
    dose: '18g', temp: '89°C', position: 'Inverted', water: '81.5% Perfect Coffee Water',
    place: { es: '1er lugar · Final Mundial · Melbourne', en: '1st place · World Final · Melbourne', ja: '優勝 · 世界決勝 · メルボルン' },
    coffee: {
      es: 'Kenia AB lavado de Karindundu, Nyeri, importado por Cafe Imports y tostado por Fieldwork Coffee.',
      en: 'Washed Kenya AB from Karindundu, Nyeri, sourced by Cafe Imports and roasted by Fieldwork Coffee.',
      ja: 'ケニア・カリンドゥンドゥ、ニエリ産AB、ウォッシュト。Cafe Importsが調達し、Fieldwork Coffeeが焙煎。',
    },
    equipment: [
      { label: 'grind', value: { es: '1Zpresso ZP6, 65 clics.', en: '1Zpresso ZP6, 65 clicks.', ja: '1Zpresso ZP6、65クリック。' } },
      { label: 'filter', value: { es: '1 filtro de papel enjuagado.', en: '1 rinsed paper filter.', ja: 'リンスしたペーパーフィルター1枚。' } },
      { label: 'water', value: { es: 'Perfect Coffee Water al 81.5% de fuerza, 89°C.', en: 'Perfect Coffee Water at 81.5% strength, 89°C.', ja: 'Perfect Coffee Waterを81.5%濃度で使用、89°C。' } },
    ],
    steps: {
      es: ['Posición Invertida. Poner 16g de café (de 18g totales) y verter 100g de agua caliente.', 'A los 0:30, remover con un lado de un palillo durante 5 segundos.', 'A los 0:45, añadir los 2g de café restantes.', 'A los 0:55, remover otros 5 segundos.', 'Empujar el émbolo para sacar el aire sobrante y cerrar la tapa.', 'Voltear con cuidado y presionar a 1:35 durante unos 30 segundos (rendimiento ≈75g).', 'Diluir con agua a temperatura ambiente hasta 115g, luego con agua caliente hasta 155g. Servir.'],
      en: ['Inverted position. Put 16g of coffee (of 18g total) into the AeroPress and pour 100g of hot water.', 'At 0:30, stir with one side of a chopstick for 5 seconds.', 'At 0:45, add the remaining 2g of coffee.', 'At 0:55, stir for another 5 seconds.', 'Push the plunger to remove excess air and close the cap.', 'Flip carefully and press at 1:35 for about 30 seconds (yield ≈75g).', 'Bypass with room-temperature water to 115g, then hot water to 155g. Serve.'],
      ja: ['インバーテッドポジション。18gのうち16gをエアロプレスに入れ、湯100gを注ぐ。', '0:30に、菜箸の片側で5秒間かき混ぜる。', '0:45に、残りのコーヒー2gを加える。', '0:55に、さらに5秒間かき混ぜる。', 'プランジャーを押して余分な空気を抜き、フタを閉める。', '慎重に反転させ、1:35で約30秒プレスする（抽出量約75g）。', '常温水で115gまで、さらに熱湯で155gまで希釈して提供する。'],
    },
  },
  {
    year: 2022, flag: '🇦🇺', name: 'Jibbi Little',
    dose: '18g', temp: '90°C', position: 'Inverted', water: 'Perfect Coffee Water',
    place: { es: '1er lugar · Final Mundial · Vancouver', en: '1st place · World Final · Vancouver', ja: '優勝 · 世界決勝 · バンクーバー' },
    coffee: {
      es: 'Colombia, Finca Juan Martín, proceso natural, variedad Bourbon Rojo Rayado. Cafe Imports x Quietly Coffee.',
      en: 'Colombia, Finca Juan Martin, natural process, Striped Red Bourbon variety. Cafe Imports x Quietly Coffee.',
      ja: 'コロンビア、フィンカ・フアン・マルティン産、ナチュラル製法、ストライプ・レッド・ブルボン種。Cafe Imports × Quietly Coffee。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Dos molinos: Timemore muy grueso, luego Kinu en posición 4, tamizando los finos (100–200µm).', en: 'Two grinders: Timemore at a very coarse setting, then Kinu at setting 4, sifting out fines (100–200µm).', ja: '2台のグラインダー使用：Timemoreで極粗挽き後、Kinuを設定4で使用、微粉（100〜200µm）をふるい分け。' } },
      { label: 'filter', value: { es: '1 filtro AeroPress Classic, enjuagado.', en: '1 AeroPress Classic filter, rinsed.', ja: 'エアロプレス純正フィルター1枚、リンス済み。' } },
      { label: 'water', value: { es: 'Perfect Coffee Water, 150g a 90°C.', en: 'Perfect Coffee Water, 150g at 90°C.', ja: 'Perfect Coffee Water、150g、90°C。' } },
    ],
    steps: {
      es: ['Posición Invertida. Verter el café molido en la cámara.', 'Verter 94g de agua y remover suavemente 35 veces.', 'A los 1:20, cerrar la tapa con el filtro y purgar el aire sobrante.', 'A los 1:30, voltear y presionar durante 30 segundos, hasta 1:40–2:10 (rendimiento ≈58-64g de concentrado).', 'Diluir con agua a 90°C hasta llegar a 150g. Servir.'],
      en: ['Inverted position. Pour the ground coffee into the chamber.', 'Pour 94g of water and stir gently 35 times.', 'At 1:20, screw on the filter cap and purge the excess air.', 'At 1:30, flip and press for 30 seconds, until 1:40–2:10 (yield ≈58-64g of concentrate).', 'Dilute with 90°C water up to 150g. Serve.'],
      ja: ['インバーテッドポジション。挽いたコーヒーをチャンバーに入れる。', '湯94gを注ぎ、優しく35回かき混ぜる。', '1:20に、フィルター付きのキャップを閉めて余分な空気を抜く。', '1:30に反転させ、1:40〜2:10まで30秒間プレスする（抽出量約58〜64gの濃縮液）。', '90°Cの湯で150gになるまで希釈して提供する。'],
    },
  },
  {
    year: 2021, flag: '🇫🇮', name: 'Tuomas Merikanto',
    dose: '18g', temp: '80°C', position: 'Inverted', water: 'Third Wave Water · Fórmula 2',
    place: { es: '1er lugar · Final Mundial · Edición Virtual', en: '1st place · World Final · Virtual Edition', ja: '優勝 · 世界決勝 · バーチャル開催' },
    coffee: {
      es: 'Guatemala, Aldea Poj, Sipacapa, Huehuetenango. Productor Pablo Bamaca, variedades Bourbon y Caturra, proceso lavado, 2.261 msnm.',
      en: 'Guatemala, Aldea Poj, Sipacapa, Huehuetenango. Producer Pablo Bamaca, Bourbon and Caturra varieties, washed process, 2,261 masl.',
      ja: 'グアテマラ、ウエウエテナンゴ、シパカパ、アルデア・ポフ産。生産者パブロ・バマカ、ブルボン種とカトゥーラ種、ウォッシュト製法、標高2,261m。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Macap Labo 70D, ajuste 7.0.', en: 'Macap Labo 70D, setting 7.0.', ja: 'Macap Labo 70D、設定7.0。' } },
      { label: 'filter', value: { es: '2 filtros de papel, enjuagados.', en: '2 paper filters, rinsed.', ja: 'ペーパーフィルター2枚、リンス済み。' } },
      { label: 'water', value: { es: 'Third Wave Water, fórmula 2 (100% Espresso), 80°C.', en: 'Third Wave Water, Formula 2 (100% Espresso), 80°C.', ja: 'Third Wave Water、フォーミュラ2（100% エスプレッソ）、80°C。' } },
    ],
    steps: {
      es: ['Posición Invertida. Añadir 18g de café.', 'De 0:00 a 0:10, verter 50g de agua a 80°C.', 'De 0:10 a 0:15, remover muy suavemente 3 veces.', 'De 0:15 a 0:30, verter agua hasta llegar a 200g.', 'A los 0:50, remover suavemente 3 veces más y dejar infusionar.', 'A 1:00, purgar el aire, colocar la tapa con el filtro y dejar hasta 1:40.', 'A 1:40, voltear y presionar de inmediato hasta 2:00.', 'De 2:00 a 2:30, agitar para enfriar y servir.'],
      en: ['Inverted position. Add 18g of coffee.', 'From 0:00 to 0:10, pour 50g of water at 80°C.', 'From 0:10 to 0:15, stir very gently 3 times.', 'From 0:15 to 0:30, pour water up to 200g total.', 'At 0:50, stir gently 3 more times and let it brew.', 'At 1:00, purge the air, attach the filter cap, and let it sit until 1:40.', 'At 1:40, flip and press right away until 2:00.', 'From 2:00 to 2:30, swirl to cool and serve.'],
      ja: ['インバーテッドポジション。コーヒー18gを加える。', '0:00〜0:10に、80°Cの湯50gを注ぐ。', '0:10〜0:15に、とても優しく3回かき混ぜる。', '0:15〜0:30に、合計200gになるまで湯を注ぐ。', '0:50に、さらに優しく3回かき混ぜて浸漬させる。', '1:00に空気を抜き、フィルター付きのフタをして1:40まで待つ。', '1:40にすぐ反転させ、2:00までプレスする。', '2:00〜2:30に、揺らして冷まして提供する。'],
    },
  },
  {
    year: 2019, flag: '🇳🇱', name: 'Wendelien van Bunnik',
    dose: '30g', temp: '92°C', position: 'Inverted', water: '30ppm',
    place: { es: '1er lugar · Final Mundial · Londres', en: '1st place · World Final · London', ja: '優勝 · 世界決勝 · ロンドン' },
    coffee: {
      es: 'El Salvador, Finca Buena Vista. Tostado por Ozone Coffee Roasters e importado por Cafe Imports; se reveló a los competidores tres horas antes de la final.',
      en: 'El Salvador, Finca Buena Vista. Roasted by Ozone Coffee Roasters and sourced by Cafe Imports; revealed to competitors three hours before the final.',
      ja: 'エルサルバドル、フィンカ・ブエナビスタ産。Ozone Coffee Roastersが焙煎し、Cafe Importsが調達。決勝の3時間前に競技者へ公開された。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Mahlkönig EK43S, ajuste 7/10 (bastante gruesa).', en: 'Mahlkönig EK43S, setting 7/10 (quite coarse).', ja: 'Mahlkönig EK43S、設定7/10（かなり粗挽き）。' } },
      { label: 'filter', value: { es: '1 filtro Aesir, enjuagado.', en: '1 Aesir filter, rinsed.', ja: 'Aesirフィルター1枚、リンス済み。' } },
      { label: 'water', value: { es: 'Agua Spa Blauw (30ppm), 92°C.', en: 'Spa Blauw water (30ppm), 92°C.', ja: 'Spa Blauwの水（30ppm）、92°C。' } },
    ],
    steps: {
      es: ['Posición Invertida. Verter 100g de agua sobre el café en 10 segundos.', 'Remover con firmeza 20 veces, en unos 10 segundos.', 'Colocar la tapa con el filtro enjuagado y purgar el aire suavemente.', 'A los 0:40, voltear y presionar hasta extraer todo el café (≈60g de extracto).', 'Añadir 100g de agua al extracto.', 'Probar y seguir añadiendo agua hasta la fuerza deseada (≈120g de dilución en total).', 'Enfriar removiendo/decantando hasta ≈60°C. Servir.'],
      en: ['Inverted position. Pour 100g of water on the coffee over 10 seconds.', 'Stir firmly 20 times, over about 10 seconds.', 'Attach the lid with the rinsed filter and gently press out excess air.', 'At 0:40, flip and press out all the coffee (≈60g of extract).', 'Add 100g of water to the extract.', 'Taste and keep adding water until the desired strength (≈120g of dilution total).', 'Cool by stirring/decanting to ≈60°C. Serve.'],
      ja: ['インバーテッドポジション。コーヒーに湯100gを10秒かけて注ぐ。', '約10秒でしっかり20回かき混ぜる。', 'リンスしたフィルター付きのフタをして、優しく空気を抜く。', '0:40に反転させ、コーヒーをすべて抽出する（抽出液約60g）。', '抽出液に湯100gを加える。', '味見をしながら好みの濃さになるまで水を加える（合計希釈量約120g）。', 'かき混ぜたりデカンタしたりして約60°Cまで冷まし、提供する。'],
    },
  },
  {
    year: 2018, flag: '🇺🇸', name: 'Carolina Ibarra Garay',
    dose: '34.9g', temp: '85°C', position: 'Inverted', water: 'Brita',
    place: { es: '1er lugar · Final Mundial · Sídney', en: '1st place · World Final · Sydney', ja: '優勝 · 世界決勝 · シドニー' },
    coffee: {
      es: 'Kenia Mugaya AA, Kirinyaga. Tostado por Single O e importado por Cafe Imports.',
      en: 'Kenya Mugaya AA, Kirinyaga. Roasted by Single O and sourced by Cafe Imports.',
      ja: 'ケニア、キリニャガ産ムガヤAA。Single Oが焙煎し、Cafe Importsが調達。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Mahlkönig EK43S, ajuste 8/10.', en: 'Mahlkönig EK43S, setting 8/10.', ja: 'Mahlkönig EK43S、設定8/10。' } },
      { label: 'filter', value: { es: '1 filtro de papel, enjuagado con agua caliente.', en: '1 paper filter, rinsed with hot water.', ja: 'ペーパーフィルター1枚、熱湯でリンス。' } },
      { label: 'water', value: { es: '200g de agua filtrada (Brita) a 85°C: 100g para extraer y 100g para diluir.', en: '200g of filtered water (Brita) at 85°C: 100g to brew and 100g to dilute.', ja: '浄水（Brita）200g、85°C：抽出用100g、希釈用100g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Añadir 34.9g de café molido.', 'Verter 100g de agua a 85°C durante 30 segundos.', 'Remover con palillos de madera, con energía pero con cuidado, durante 30 segundos.', 'Poner la tapa con el filtro, voltear y presionar durante 30 segundos sobre una jarra de vidrio sin precalentar.', 'Diluir con 60g de agua a 85°C y 40g de agua a temperatura ambiente. Servir.'],
      en: ['Inverted position. Add 34.9g of ground coffee.', 'Pour 100g of water at 85°C over 30 seconds.', 'Stir vigorously but carefully with wooden chopsticks for 30 seconds.', 'Attach the cap with the filter, flip and press for 30 seconds into a glass server that is not preheated.', 'Dilute with 60g of water at 85°C and 40g of room-temperature water. Serve.'],
      ja: ['インバーテッドポジション。挽いたコーヒー34.9gを入れる。', '85°Cの湯100gを30秒かけて注ぐ。', '木の箸で、力強くかつ慎重に30秒間かき混ぜる。', 'フィルター付きのキャップを付けて反転させ、温めていないガラスのサーバーに30秒かけてプレスする。', '85°Cの湯60gと常温の水40gで希釈して提供する。'],
    },
  },
  {
    year: 2017, flag: '🇬🇧', name: 'Paulina Miczka',
    dose: '35g', temp: '84°C', position: 'Inverted', water: '370g',
    place: { es: '1er lugar · Final Mundial · Seúl', en: '1st place · World Final · Seoul', ja: '優勝 · 世界決勝 · ソウル' },
    coffee: {
      es: 'Kenia Kamwangi AA, tostado en Seúl por Fritz Coffee Company e importado por Cafe Imports. Paulina es polaca y compitió por Inglaterra.',
      en: 'Kenya Kamwangi AA, roasted in Seoul by Fritz Coffee Company and sourced by Cafe Imports. Paulina is Polish and competed for England.',
      ja: 'ケニア産カムワンギAA。ソウルのFritz Coffee Companyが焙煎し、Cafe Importsが調達。パウリナはポーランド出身で、イングランド代表として出場。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Gruesa, 8/10 (el WAC no indica el molino).', en: 'Coarse, 8/10 (the WAC does not name the grinder).', ja: '粗挽き、8/10（グラインダーは非公表）。' } },
      { label: 'filter', value: { es: '1 filtro de papel, prehumedecido.', en: '1 paper filter, pre-wet.', ja: 'ペーパーフィルター1枚、事前に湿らせる。' } },
      { label: 'water', value: { es: '370g a 84°C: 150g para extraer y 160–200g para diluir.', en: '370g at 84°C: 150g to brew and 160–200g to dilute.', ja: '84°Cの湯370g：抽出用150g、希釈用160〜200g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Poner 35g de café molido.', 'De 0:00 a 0:15, verter 150g de agua a 84°C.', 'De 0:15 a 0:35, remover sin parar.', 'A los 0:35, poner la tapa con el filtro prehumedecido.', 'A 1:05, voltear y empezar a presionar; parar a 1:35 (≈90 ml de concentrado).', 'Diluir con 160–200g de agua caliente. Servir.'],
      en: ['Inverted position. Add 35g of ground coffee.', 'From 0:00 to 0:15, pour 150g of water at 84°C.', 'From 0:15 to 0:35, keep stirring.', 'At 0:35, attach the cap with the pre-wet filter.', 'At 1:05, flip and start pressing; stop at 1:35 (≈90 ml of concentrate).', 'Dilute with 160–200g of hot water. Serve.'],
      ja: ['インバーテッドポジション。挽いたコーヒー35gを入れる。', '0:00〜0:15に、84°Cの湯150gを注ぐ。', '0:15〜0:35は、かき混ぜ続ける。', '0:35に、湿らせたフィルター付きのキャップを付ける。', '1:05に反転させてプレスを始め、1:35で止める（濃縮液約90ml）。', '熱湯160〜200gで希釈して提供する。'],
    },
  },
  {
    year: 2016, flag: '🇵🇱', name: 'Filip Kucharczyk',
    dose: '35g', temp: '81°C', position: 'Inverted', water: '250–270g',
    place: { es: '1er lugar · Final Mundial · Dublín', en: '1st place · World Final · Dublin', ja: '優勝 · 世界決勝 · ダブリン' },
    coffee: {
      es: 'Café oficial de la final de Dublín; el WAC no publicó su origen.',
      en: 'Official coffee of the Dublin final; the WAC did not publish its origin.',
      ja: 'ダブリン決勝の公式コーヒー。産地はWACから公表されていない。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Gruesa.', en: 'Coarse.', ja: '粗挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel, enjuagado.', en: '1 paper filter, rinsed.', ja: 'ペーパーフィルター1枚、リンス済み。' } },
      { label: 'water', value: { es: '150g a 81°C para extraer + 100–120g para diluir.', en: '150g at 81°C to brew + 100–120g to dilute.', ja: '抽出用81°Cの湯150g + 希釈用100〜120g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Añadir 35g de café molido grueso e iniciar el cronómetro.', 'Verter 150g de agua a 81°C durante 15 segundos.', 'Remover hasta que el cronómetro marque 0:30.', 'Poner la tapa con el filtro y esperar hasta 1:00.', 'Voltear, girar suavemente y presionar.', 'Diluir con 100–120g de agua, al gusto. Servir.'],
      en: ['Inverted position. Add 35g of coarsely ground coffee and start the timer.', 'Pour 150g of water at 81°C over 15 seconds.', 'Stir until the timer reads 0:30.', 'Attach the cap with the filter and wait until 1:00.', 'Flip, give it a swirl and press.', 'Dilute with 100–120g of water, to taste. Serve.'],
      ja: ['インバーテッドポジション。粗挽きコーヒー35gを入れ、タイマーをスタートする。', '81°Cの湯150gを15秒かけて注ぐ。', 'タイマーが0:30になるまでかき混ぜる。', 'フィルター付きのキャップを付け、1:00まで待つ。', '反転させ、軽く回してからプレスする。', '好みで湯100〜120gを加えて希釈し、提供する。'],
    },
  },
  {
    year: 2015, flag: '🇸🇰', name: 'Lukas Zahradnik',
    dose: '20g', temp: '79°C', position: 'Inverted', water: '230g',
    place: { es: '1er lugar · Final Mundial · Seattle', en: '1st place · World Final · Seattle', ja: '優勝 · 世界決勝 · シアトル' },
    coffee: {
      es: 'Café oficial de la final de Seattle; el WAC no publicó su origen.',
      en: 'Official coffee of the Seattle final; the WAC did not publish its origin.',
      ja: 'シアトル決勝の公式コーヒー。産地はWACから公表されていない。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Mahlkönig EK43, ajuste 7.3.', en: 'Mahlkönig EK43, setting 7.3.', ja: 'Mahlkönig EK43、設定7.3。' } },
      { label: 'filter', value: { es: '1 filtro de papel.', en: '1 paper filter.', ja: 'ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '230g a 79°C.', en: '230g at 79°C.', ja: '79°Cの湯230g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Poner los 20g de café.', 'Añadir 60g de agua a 79°C y mover el AeroPress con turbulencia durante 15 segundos.', 'Dejar florecer 30 segundos.', 'Verter el resto del agua hasta 230g en 10 segundos.', 'Presionar durante 45 segundos. Tiempo total: 1:35.'],
      en: ['Inverted position. Add the 20g of coffee.', 'Add 60g of water at 79°C and give it a turbulent wiggle for 15 seconds.', 'Let bloom for 30 seconds.', 'Pour the rest of the water up to 230g over 10 seconds.', 'Press for 45 seconds. Total time: 1:35.'],
      ja: ['インバーテッドポジション。コーヒー20gを入れる。', '79°Cの湯60gを加え、15秒間エアロプレスを勢いよく揺らす。', '30秒間蒸らす。', '残りの湯を10秒かけて合計230gになるまで注ぐ。', '45秒間プレスする。合計時間1:35。'],
    },
  },
  {
    year: 2014, flag: '🇯🇵', name: 'Shuichi Sasaki',
    dose: '16.5g', temp: '78°C', position: 'Upright', water: '250g',
    place: { es: '1er lugar · Final Mundial · Rímini', en: '1st place · World Final · Rimini', ja: '優勝 · 世界決勝 · リミニ' },
    coffee: {
      es: 'Café oficial de la final de Rímini; el WAC no publicó su origen.',
      en: 'Official coffee of the Rimini final; the WAC did not publish its origin.',
      ja: 'リミニ決勝の公式コーヒー。産地はWACから公表されていない。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Mahlkönig EK43, ajuste 9.5 (gruesa).', en: 'Mahlkönig EK43, setting 9.5 (coarse).', ja: 'Mahlkönig EK43、設定9.5（粗挽き）。' } },
      { label: 'filter', value: { es: '1 filtro de papel, enjuagado con agua tibia.', en: '1 paper filter, rinsed with warm water.', ja: 'ペーパーフィルター1枚、ぬるま湯でリンス。' } },
      { label: 'water', value: { es: '250g de agua mineral suave a 78°C.', en: '250g of soft mineral water at 78°C.', ja: '軟水のミネラルウォーター250g、78°C。' } },
    ],
    steps: {
      es: ['Posición normal (Upright). Enjuagar el filtro con agua tibia y añadir 16.5g de café.', 'Verter 40g de agua a 78°C.', 'Dejar florecer 25 segundos.', 'Remover cinco veces.', 'Verter 210g de agua y remover una vez.', 'Presionar muy despacio durante 75 segundos.', 'Dejar ≈45g de lodo en el AeroPress sin presionar. Tiempo total: 1:40.'],
      en: ['Upright position. Rinse the filter with warm water and add 16.5g of coffee.', 'Pour 40g of water at 78°C.', 'Let it bloom for 25 seconds.', 'Stir five times.', 'Pour 210g of water and stir once.', 'Press very slowly for 75 seconds.', 'Leave ≈45g of slurry in the AeroPress without pressing it. Total time: 1:40.'],
      ja: ['アップライトポジション。フィルターをぬるま湯でリンスし、コーヒー16.5gを入れる。', '78°Cの湯40gを注ぐ。', '25秒間蒸らす。', '5回かき混ぜる。', '湯210gを注ぎ、1回かき混ぜる。', '75秒かけてとてもゆっくりプレスする。', '約45gのスラリーはプレスせずにエアロプレスに残す。合計時間1:40。'],
    },
  },
  {
    year: 2013, flag: '🇧🇪', name: 'Jeff Verellen',
    dose: '17g', temp: '83°C', position: 'Upright', water: '270g',
    place: { es: '1er lugar · Final Mundial · Melbourne', en: '1st place · World Final · Melbourne', ja: '優勝 · 世界決勝 · メルボルン' },
    coffee: {
      es: 'Café oficial de la final de Melbourne; el WAC no publicó su origen. Tampoco indica la posición: dejar ≈50g en la cámara apunta a la normal, como en su receta de 2011.',
      en: 'Official coffee of the Melbourne final; the WAC did not publish its origin. It does not give the position either: leaving ≈50g in the chamber points to upright, as in his 2011 recipe.',
      ja: 'メルボルン決勝の公式コーヒー。産地は非公表。ポジションも記載がないが、チャンバーに約50gを残す手順から、2011年のレシピと同じアップライトと推定。',
    },
    equipment: [
      { label: 'grind', value: { es: 'El WAC no la publicó.', en: 'Not published by the WAC.', ja: 'WACは非公表。' } },
      { label: 'filter', value: { es: 'Filtro de papel (el WAC no da detalles).', en: 'Paper filter (no details from the WAC).', ja: 'ペーパーフィルター（詳細は非公表）。' } },
      { label: 'water', value: { es: 'Agua suave (Spa) de pH alto: 50g a 83–84°C para florecer y 220g a 79°C (270g en total).', en: 'Soft, high-pH water (Spa): 50g at 83–84°C to bloom and 220g at 79°C (270g total).', ja: '高pHの軟水（Spa）：蒸らし用83〜84°Cの湯50g、79°Cの湯220g（合計270g）。' } },
    ],
    steps: {
      es: ['Posición normal (Upright). Añadir 17g de café.', 'Verter 50g de agua a 83–84°C y dejar florecer 40 segundos.', 'Verter 220g de agua a 79°C, hasta 270g en total.', 'Presionar despacio durante 30 segundos.', 'Dejar ≈50g de agua y café en la cámara sin presionar. Servir.'],
      en: ['Upright position. Add 17g of coffee.', 'Pour 50g of water at 83–84°C and let it bloom for 40 seconds.', 'Pour 220g of water at 79°C, up to 270g total.', 'Press slowly for 30 seconds.', 'Leave ≈50g of water and coffee in the chamber without pressing. Serve.'],
      ja: ['アップライトポジション。コーヒー17gを入れる。', '83〜84°Cの湯50gを注ぎ、40秒間蒸らす。', '79°Cの湯220gを注ぎ、合計270gにする。', '30秒かけてゆっくりプレスする。', '約50gの湯とコーヒーはプレスせずにチャンバーに残し、提供する。'],
    },
  },
  {
    year: 2012, flag: '🇧🇪', name: 'Charlene de Buysere',
    dose: '18.3g', temp: '85°C', position: 'Upright', water: '250g',
    place: { es: '1er lugar · Final Mundial · Portland', en: '1st place · World Final · Portland', ja: '優勝 · 世界決勝 · ポートランド' },
    coffee: {
      es: 'Etiopía Sidamo lavado, tostado en Portland por Heart Coffee Roasters.',
      en: 'Washed Ethiopia Sidamo, roasted in Portland by Heart Coffee Roasters.',
      ja: 'エチオピア・シダモ産ウォッシュト。ポートランドのHeart Coffee Roastersが焙煎。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Gruesa.', en: 'Coarse.', ja: '粗挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel, bien enjuagado.', en: '1 paper filter, thoroughly rinsed.', ja: 'ペーパーフィルター1枚、しっかりリンス。' } },
      { label: 'water', value: { es: '250g a 85°C.', en: '250g at 85°C.', ja: '85°Cの湯250g。' } },
    ],
    steps: {
      es: ['Posición normal (Upright). Colocar el filtro bien enjuagado y los 18.3g de café molido grueso.', 'Verter unos 40g de agua a 85°C para la floración (≈30s).', 'Verter el resto del agua hasta 250g y presionar sin llegar al fondo.', 'Servir.'],
      en: ['Upright position. Place the thoroughly rinsed filter and add 18.3g of coarsely ground coffee.', 'Pour about 40g of water at 85°C for the bloom (≈30s).', 'Pour the rest of the water up to 250g and press without going all the way down.', 'Serve.'],
      ja: ['アップライトポジション。しっかりリンスしたフィルターをセットし、粗挽きコーヒー18.3gを入れる。', '85°Cの湯約40gを注いで蒸らす（約30秒）。', '合計250gになるまで残りの湯を注ぎ、最後まで押し切らずにプレスする。', '提供する。'],
    },
  },
  {
    year: 2011, flag: '🇧🇪', name: 'Jeff Verellen',
    dose: '17g', temp: '80°C', position: 'Upright', water: '270g',
    place: { es: '1er lugar · Final Mundial · Milán', en: '1st place · World Final · Milan', ja: '優勝 · 世界決勝 · ミラノ' },
    coffee: {
      es: 'Un café de Kenia a elección de cada competidor: esa fue la regla de la final de Milán.',
      en: 'A Kenyan coffee of each competitor\'s choice: that was the rule of the Milan final.',
      ja: '各競技者が選んだケニア産コーヒー。それがミラノ決勝のルールだった。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Gruesa, un poco más gruesa que para filtro de papel.', en: 'Coarse, slightly coarser than for a paper filter.', ja: '粗挽き、ペーパーフィルター用よりやや粗め。' } },
      { label: 'filter', value: { es: '1 filtro de papel, enjuagado con agua caliente.', en: '1 paper filter, rinsed with hot water.', ja: 'ペーパーフィルター1枚、熱湯でリンス。' } },
      { label: 'water', value: { es: '270g de agua suave o filtrada a 80°C.', en: '270g of soft or filtered water at 80°C.', ja: '軟水または浄水80°Cの湯270g。' } },
    ],
    steps: {
      es: ['Posición normal (Upright). Ajustar el filtro enjuagado en el AeroPress, de preferencia precalentado.', 'Verter unos 40g de agua a 80°C directo sobre el café recién molido para humedecerlo.', 'Tras ≈30s, verter muy lentamente el resto del agua hasta 270g, mojando de nuevo todo el café.', 'Dejar en infusión por goteo alrededor de 1 minuto.', 'Ayudar el paso del resto del agua con el émbolo, muy suavemente, y descartar los ≈50g que quedan.'],
      en: ['Upright position. Fit the rinsed filter onto the AeroPress, preferably preheated.', 'Pour about 40g of water at 80°C directly onto the freshly ground coffee to wet it.', 'After ≈30s, very slowly pour the rest of the water up to 270g, re-wetting all the grounds.', 'Let it steep and drip for about 1 minute.', 'Help the rest of the water through with the plunger, very gently, and discard the last ≈50g.'],
      ja: ['アップライトポジション。リンスしたフィルターを、できれば温めたエアロプレスに取り付ける。', '挽きたてのコーヒーに80°Cの湯約40gを直接注いで湿らせる。', '約30秒後、粉全体を再び湿らせるように、残りの湯を270gになるまでとてもゆっくり注ぐ。', '約1分間、浸漬・滴下させる。', 'プランジャーでとても優しく残りを押し出し、最後の約50gは捨てる。'],
    },
  },
  {
    year: 2010, flag: '🇩🇰', name: 'Marie Hagemeister',
    dose: '20g', temp: '80°C', position: 'Inverted', water: '≈250g',
    place: { es: '1er lugar · Final Mundial · Londres', en: '1st place · World Final · London', ja: '優勝 · 世界決勝 · ロンドン' },
    coffee: {
      es: 'Café oficial de la final de Londres; el WAC no publicó su origen.',
      en: 'Official coffee of the London final; the WAC did not publish its origin.',
      ja: 'ロンドン決勝の公式コーヒー。産地はWACから公表されていない。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Un poco más fina que para filtro.', en: 'Slightly finer than filter grind.', ja: 'ペーパーフィルター用よりやや細かめ。' } },
      { label: 'filter', value: { es: '1 filtro de papel, enjuagado con agua caliente.', en: '1 paper filter, rinsed with hot water.', ja: 'ペーパーフィルター1枚、熱湯でリンス。' } },
      { label: 'water', value: { es: 'A 80°C, casi hasta el borde de la cámara (el WAC no da el peso; ≈250g).', en: 'At 80°C, almost to the top of the chamber (the WAC gives no weight; ≈250g).', ja: '80°C、チャンバーのほぼ上端まで（重量は非公表、約250g）。' } },
    ],
    steps: {
      es: ['Posición Invertida. Enjuagar el filtro con agua caliente.', 'Poner los 20g de café molido y verter el agua a 80°C casi hasta el tope.', 'Remover durante 10-12 segundos.', 'Calentar la taza y luego presionar lentamente el café hacia ella, deteniéndose justo antes de escuchar el aire.', 'Servir.'],
      en: ['Inverted position. Rinse the filter with hot water.', 'Add the 20g of ground coffee and pour the 80°C water almost to the top.', 'Stir for 10–12 seconds.', 'Heat the cup, then slowly press the coffee into it, stopping just before you hear the air.', 'Serve.'],
      ja: ['インバーテッドポジション。フィルターを熱湯でリンスする。', '挽いたコーヒー20gを入れ、80°Cの湯をほぼ上端まで注ぐ。', '10〜12秒間かき混ぜる。', 'カップを温めてから、空気の音が聞こえる直前まで、ゆっくりコーヒーをプレスする。', '提供する。'],
    },
  },
  {
    year: 2009, flag: '🇵🇱', name: 'Lukasz Jura',
    dose: '19.5g', temp: '75°C', position: 'Inverted', water: '200g',
    place: { es: '1er lugar · Final Mundial · Oslo', en: '1st place · World Final · Oslo', ja: '優勝 · 世界決勝 · オスロ' },
    coffee: {
      es: 'Café oficial de la final de Oslo; el WAC no publicó su origen.',
      en: 'Official coffee of the Oslo final; the WAC did not publish its origin.',
      ja: 'オスロ決勝の公式コーヒー。産地はWACから公表されていない。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Un poco más gruesa que para filtro.', en: 'Slightly coarser than filter grind.', ja: 'ペーパーフィルター用よりやや粗め。' } },
      { label: 'filter', value: { es: '1 filtro de papel, remojado.', en: '1 paper filter, soaked.', ja: 'ペーパーフィルター1枚、湯に浸す。' } },
      { label: 'water', value: { es: '200 ml a 75°C.', en: '200 ml at 75°C.', ja: '75°Cの湯200ml。' } },
    ],
    steps: {
      es: ['Posición Invertida. Añadir 19.5–20g de café molido y los 200 ml de agua a 75°C.', 'Remover 4 veces.', 'Hacia los 10 segundos, poner la tapa con el filtro remojado y voltear (contacto total ≈15 segundos).', 'Presionar y servir.'],
      en: ['Inverted position. Add 19.5–20g of ground coffee and the 200 ml of water at 75°C.', 'Stir 4 times.', 'At around 10 seconds, attach the cap with the soaked filter and flip (total contact time ≈15 seconds).', 'Press and serve.'],
      ja: ['インバーテッドポジション。挽いたコーヒー19.5〜20gと75°Cの湯200mlを入れる。', '4回かき混ぜる。', '約10秒で、湯に浸したフィルター付きのキャップを付けて反転させる（接触時間は合計約15秒）。', 'プレスして提供する。'],
    },
  },
  {
    year: 2008, flag: '🇳🇴', name: 'Anders Valde',
    dose: '17g', temp: '93°C', position: 'Upright', water: '220g',
    place: { es: '1er lugar · Final Mundial · Oslo', en: '1st place · World Final · Oslo', ja: '優勝 · 世界決勝 · オスロ' },
    coffee: {
      es: 'El WAC nunca publicó la receta de esta primera edición (tres competidores en Oslo). Estos parámetros son una aproximación de Acero.press, no la receta ganadora.',
      en: 'The WAC never published the recipe from this first edition (three competitors in Oslo). These parameters are an Acero.press approximation, not the winning recipe.',
      ja: 'WACはこの第1回大会（オスロ、出場者3名）のレシピを公表していません。これらの数値はAcero.pressによる近似値で、優勝レシピではありません。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda Media.', en: 'Medium grind.', ja: '中挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel.', en: '1 paper filter.', ja: 'ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '220g de agua caliente a 93°C.', en: '220g of hot water at 93°C.', ja: '93°Cの熱湯220g。' } },
    ],
    steps: {
      es: ['Posición normal (Upright). Colocar 17g de café.', 'Verter 220g de agua a 93°C hasta llenar la cámara.', 'Revolver con firmeza durante 10 segundos.', 'Poner el émbolo en la parte superior y presionar uniformemente durante 30s.'],
      en: ['Upright position. Add 17g of coffee.', 'Pour 220g of water at 93°C, filling the chamber.', 'Stir firmly for 10 seconds.', 'Place the plunger on top and press evenly for 30s.'],
      ja: ['アップライトポジション。コーヒー17gを入れる。', '93°Cの湯220gをチャンバーいっぱいに注ぐ。', '10秒間しっかりかき混ぜる。', 'プランジャーを上に乗せ、30秒間均等にプレスする。'],
    },
  },
];

export default recipes;
