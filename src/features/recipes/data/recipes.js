// Bitácora de recetas campeonas del World AeroPress Championship (WAC).
// Los campos de texto libre (place, coffee, equipment[].value, steps) están
// traducidos a es/en/ja. dose, temp y water quedan como valores numéricos
// (universales); position usa una key ('Upright'/'Inverted') que se traduce
// vía translations.position en el componente.

const recipes = [
  {
    year: 2025, flag: '🇦🇺', name: 'Némo Pop',
    dose: '18g', temp: '84°C', position: 'Upright', water: '125ppm',
    place: { es: '1er lugar · Final Mundial · Australia', en: '1st place · World Final · Australia', ja: '優勝 · 世界決勝 · オーストラリア' },
    coffee: {
      es: 'Ecuador, Finca La Carolina, variedad Sidra, proceso lavado, 1.300 msnm. Tostado por Stereoscope Coffee.',
      en: 'Ecuador, Finca La Carolina, Sidra variety, washed process, 1,300 masl. Roasted by Stereoscope Coffee.',
      ja: 'エクアドル、フィンカ・ラ・カロリーナ産、シドラ種、ウォッシュト製法、標高1,300m。Stereoscope Coffeeによる焙煎。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Comandante Trailmaster X25, 31 clics, tamizado a 200µm.', en: 'Comandante Trailmaster X25, 31 clicks, sifted to 200µm.', ja: 'コマンダンテ トレイルマスターX25、31クリック、200µmでふるい分け。' } },
      { label: 'filter', value: { es: 'Flow Control Cap + 2 filtros de papel.', en: 'Flow Control Cap + 2 paper filters.', ja: 'フローコントロールキャップ + ペーパーフィルター2枚。' } },
      { label: 'water', value: { es: '125ppm, 84°C extracción / 50°C dilución.', en: '125ppm, 84°C extraction / 50°C dilution.', ja: '125ppm、抽出84°C／希釈50°C。' } },
    ],
    steps: {
      es: ['Verter 70g de agua de dilución en la jarra.', 'Moler el café y retirar cascarilla y finos.', 'Colocar el AeroPress sobre la jarra y añadir el café molido.', 'Verter 100g de agua a 84°C humedeciendo todo el café.', 'A los 25s, remover suavemente en patrón Cruz (NSNS-WEWE).', 'A los 50s, presionar suavemente durante ~20 segundos.', 'Servir y disfrutar.'],
      en: ['Pour 70g of dilution water into the carafe.', 'Grind the coffee and remove chaff and fines.', 'Place the AeroPress on the carafe and add the ground coffee.', 'Pour 100g of water at 84°C, wetting all the coffee.', 'At 25s, gently stir in a Cross pattern (NSNS-WEWE).', 'At 50s, press gently for about 20 seconds.', 'Serve and enjoy.'],
      ja: ['カラフェに希釈用の湯70gを注ぐ。', 'コーヒーを挽き、チャフと微粉を取り除く。', 'カラフェの上にエアロプレスを置き、挽いたコーヒーを入れる。', '84°Cの湯100gを注ぎ、コーヒー全体を湿らせる。', '25秒後、クロスパターン（NSNS-WEWE）で優しくかき混ぜる。', '50秒後、約20秒かけて優しくプレスする。', '注いで楽しむ。'],
    },
  },
  {
    year: 2024, flag: '🇨🇿', name: 'Vitalii Vyranovskyi',
    dose: '18g', temp: '88°C', position: 'Inverted', water: '80ppm',
    place: { es: '1er lugar · Final Mundial · Lisboa', en: '1st place · World Final · Lisbon', ja: '優勝 · 世界決勝 · リスボン' },
    coffee: {
      es: 'Café oficial de la competencia WAC 2024. Varietal Gesha lavado con fermentación anaeróbica corta.',
      en: 'Official WAC 2024 competition coffee. Washed Gesha variety with short anaerobic fermentation.',
      ja: 'WAC 2024公式競技用コーヒー。ゲイシャ種、ウォッシュト、短時間の嫌気性発酵。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Media-coarse (Gruesa).', en: 'Medium-coarse.', ja: '中粗挽き。' } },
      { label: 'filter', value: { es: '1 Filtro de papel enjuagado.', en: '1 rinsed paper filter.', ja: 'リンスしたペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '200g a 88°C.', en: '200g at 88°C.', ja: '88°Cの湯200g。' } },
    ],
    steps: {
      es: ['Posicionar el AeroPress en modo Invertido.', 'Añadir 18g de café molido.', 'Verter 100g de agua en 10 segundos y agitar vigorosamente durante 15 segundos.', 'Dejar reposar hasta 0:45 y añadir los 100g de agua restantes.', 'Colocar la tapa, purgar el aire sobrante y voltear a 1:15.', 'Presionar suavemente hasta escuchar el silbido a 1:45.'],
      en: ['Set up the AeroPress in Inverted mode.', 'Add 18g of ground coffee.', 'Pour 100g of water over 10 seconds and stir vigorously for 15 seconds.', 'Let sit until 0:45 and add the remaining 100g of water.', 'Attach the lid, purge excess air, and flip at 1:15.', 'Press gently until you hear the hiss at 1:45.'],
      ja: ['エアロプレスをインバーテッド（反転）にセットする。', '挽いたコーヒー18gを加える。', '湯100gを10秒かけて注ぎ、15秒間力強くかき混ぜる。', '0:45まで置き、残りの湯100gを加える。', 'フタを付けて余分な空気を抜き、1:15で反転させる。', '1:45でシューッという音が聞こえるまで優しくプレスする。'],
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
      es: 'Café de origen privado de la competencia (Café de Finca graduado alto en dulzor y acidez).',
      en: 'Private competition-origin coffee (estate coffee scored high in sweetness and acidity).',
      ja: '大会独自の非公開産地のコーヒー（甘みと酸味が高く評価された農園コーヒー）。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Mahlkönig EK43S, ajuste 7/10 (bastante gruesa).', en: 'Mahlkönig EK43S, setting 7/10 (quite coarse).', ja: 'Mahlkönig EK43S、設定7/10（かなり粗挽き）。' } },
      { label: 'filter', value: { es: '1 filtro Aesir, enjuagado.', en: '1 Aesir filter, rinsed.', ja: 'Aesirフィルター1枚、リンス済み。' } },
      { label: 'water', value: { es: 'Agua Spa Blauw (30ppm), 92°C.', en: 'Spa Blauw water (30ppm), 92°C.', ja: 'Spa Blauwの水（30ppm）、92°C。' } },
    ],
    steps: {
      es: ['Posición Invertida. Verter 100g de agua sobre el café en 10 segundos.', 'Remover con firmeza 20 veces.', 'Colocar la tapa con el filtro enjuagado y purgar el aire suavemente.', 'A los 0:40, voltear y presionar hasta extraer todo el café (≈60g de extracto).', 'Añadir 100g de agua al extracto.', 'Probar y seguir añadiendo agua hasta la fuerza deseada (≈120g de dilución en total).', 'Enfriar removiendo/decantando hasta ≈60°C. Servir.'],
      en: ['Inverted position. Pour 100g of water on the coffee over 10 seconds.', 'Stir firmly 20 times.', 'Attach the lid with the rinsed filter and gently press out excess air.', 'At 0:40, flip and press out all the coffee (≈60g of extract).', 'Add 100g of water to the extract.', 'Taste and keep adding water until the desired strength (≈120g of dilution total).', 'Cool by stirring/decanting to ≈60°C. Serve.'],
      ja: ['インバーテッドポジション。コーヒーに湯100gを10秒かけて注ぐ。', 'しっかり20回かき混ぜる。', 'リンスしたフィルター付きのフタをして、優しく空気を抜く。', '0:40に反転させ、コーヒーをすべて抽出する（抽出液約60g）。', '抽出液に湯100gを加える。', '味見をしながら好みの濃さになるまで水を加える（合計希釈量約120g）。', 'かき混ぜたりデカンタしたりして約60°Cまで冷まし、提供する。'],
    },
  },
  {
    year: 2018, flag: '🇺🇸', name: 'Carolina Ibarra Garay',
    dose: '34.9g', temp: '85°C', position: 'Inverted', water: 'Bypass',
    place: { es: '1er lugar · Final Mundial · Sídney', en: '1st place · World Final · Sydney', ja: '優勝 · 世界決勝 · シドニー' },
    coffee: {
      es: 'Kenyano lavado de perfil brillante y notas a frutos rojos tostado para la WAC.',
      en: 'Washed Kenyan coffee with a bright profile and red-berry notes, roasted for the WAC.',
      ja: '明るい酸味とレッドベリーのノートを持つケニア産ウォッシュト、WAC用に焙煎。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Súper gruesa (Mulliner/Comandante 30+ clics).', en: 'Extra coarse (Mulliner/Comandante 30+ clicks).', ja: '超粗挽き（Mulliner／コマンダンテ30クリック以上）。' } },
      { label: 'filter', value: { es: '1 filtro de papel mojado.', en: '1 wetted paper filter.', ja: '湯で湿らせたペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '100g de extracción + 60g a 90g de dilución.', en: '100g for extraction + 60–90g for dilution.', ja: '抽出用100g + 希釈用60〜90g。' } },
    ],
    steps: {
      es: ['AeroPress Invertido. Añadir 34.9g de café molido grueso.', 'Verter 100g de agua a 85°C en 30 segundos.', 'Agitar vigorosamente 30 segundos.', 'Tapar, filtrar aire restante y voltear a 1:00.', 'Presionar fuertemente durante 30 segundos finalizando antes del silbido.', 'Diluir el extracto obtenido agregando entre 60g y 90g de agua a temperatura ambiente/tibia.'],
      en: ['AeroPress Inverted. Add 34.9g of coarsely ground coffee.', 'Pour 100g of water at 85°C over 30 seconds.', 'Stir vigorously for 30 seconds.', 'Cap it, purge the remaining air, and flip at 1:00.', 'Press firmly for 30 seconds, finishing before the hiss.', 'Dilute the resulting extract by adding 60–90g of room-temperature/warm water.'],
      ja: ['エアロプレスをインバーテッドに。粗挽きコーヒー34.9gを加える。', '85°Cの湯100gを30秒かけて注ぐ。', '30秒間力強くかき混ぜる。', 'フタをして残りの空気を抜き、1:00で反転させる。', 'シューッという音の前に終えるよう、30秒間力強くプレスする。', '常温〜ぬるま湯60〜90gを加えて抽出液を希釈する。'],
    },
  },
  {
    year: 2017, flag: '🇬🇧', name: 'Paulina Miczka',
    dose: '35g', temp: '84°C', position: 'Inverted', water: 'Bypass',
    place: { es: '1er lugar · Final Mundial · Seúl', en: '1st place · World Final · Seoul', ja: '優勝 · 世界決勝 · ソウル' },
    coffee: {
      es: 'Geisha de Colombia, proceso lavado. Notas florales sumamente elegantes.',
      en: 'Colombian Geisha, washed process. Extremely elegant floral notes.',
      ja: 'コロンビア産ゲイシャ、ウォッシュト製法。非常にエレガントなフローラルノート。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda gruesa.', en: 'Coarse grind.', ja: '粗挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel.', en: '1 paper filter.', ja: 'ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '150g en extracción + 120g de dilución.', en: '150g for extraction + 120g for dilution.', ja: '抽出用150g + 希釈用120g。' } },
    ],
    steps: {
      es: ['En posición Invertida, poner 35g de café molido.', 'Verter 150g de agua a 84°C a los 0:00 min.', 'Revolver enérgicamente durante 20 segundos.', 'Tapar y girar el AeroPress a los 0:50 min.', 'Presionar despacio durante 30s. Parar cuando escuches aire.', 'Agregar 120g de agua a 84°C al concentrado resultante.'],
      en: ['In Inverted position, add 35g of ground coffee.', 'Pour 150g of water at 84°C at 0:00.', 'Stir vigorously for 20 seconds.', 'Cap and flip the AeroPress at 0:50.', 'Press slowly for 30s. Stop when you hear air.', 'Add 120g of water at 84°C to the resulting concentrate.'],
      ja: ['インバーテッドポジションで、挽いたコーヒー35gを入れる。', '0:00に84°Cの湯150gを注ぐ。', '20秒間力強くかき混ぜる。', 'フタをして0:50でエアロプレスを反転させる。', '30秒かけてゆっくりプレスする。空気の音がしたら止める。', 'できた濃縮液に84°Cの湯120gを加える。'],
    },
  },
  {
    year: 2016, flag: '🇵🇱', name: 'Filip Kucharczyk',
    dose: '35g', temp: '81°C', position: 'Inverted', water: '150ppm',
    place: { es: '1er lugar · Final Mundial · Dublín', en: '1st place · World Final · Dublin', ja: '優勝 · 世界決勝 · ダブリン' },
    coffee: {
      es: 'Kenia lavado, perfil de tostado medio-ligero para resaltar alta acidez malica y cítrica.',
      en: 'Washed Kenya, medium-light roast profile to highlight high malic and citric acidity.',
      ja: 'ケニア産ウォッシュト、リンゴ酸と柑橘系の高い酸味を引き立てる中浅煎り。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Bastante gruesa.', en: 'Quite coarse.', ja: 'かなり粗挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel lavado.', en: '1 rinsed paper filter.', ja: 'リンスしたペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '150g para la extracción.', en: '150g for extraction.', ja: '抽出用の湯150g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Añadir los 35g de café molido grueso.', 'Verter 150g de agua a 81°C en 15 segundos.', 'Remover con espátula suavemente unos 15 segundos.', 'Tapar y esperar hasta llegar a 1:00 min.', 'Voltear y presionar durante 27 segundos exactos. Diluir al gusto.'],
      en: ['Inverted position. Add 35g of coarsely ground coffee.', 'Pour 150g of water at 81°C over 15 seconds.', 'Gently stir with a paddle for about 15 seconds.', 'Cap and wait until 1:00.', 'Flip and press for exactly 27 seconds. Dilute to taste.'],
      ja: ['インバーテッドポジション。粗挽きコーヒー35gを加える。', '81°Cの湯150gを15秒かけて注ぐ。', 'パドルで15秒ほど優しくかき混ぜる。', 'フタをして1:00になるまで待つ。', '反転させ、正確に27秒間プレスする。好みで希釈する。'],
    },
  },
  {
    year: 2015, flag: '🇸🇰', name: 'Lukas Zahradnik',
    dose: '20g', temp: '79°C', position: 'Inverted', water: '230g Total',
    place: { es: '1er lugar · Final Mundial · Rímini', en: '1st place · World Final · Rimini', ja: '優勝 · 世界決勝 · リミニ' },
    coffee: {
      es: 'Etiopía Suke Quto, proceso lavado. Muy limpio y floral.',
      en: 'Ethiopia Suke Quto, washed process. Very clean and floral.',
      ja: 'エチオピア産スケ・クオト、ウォッシュト製法。非常にクリーンでフローラル。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Mahlkönig EK43, ajuste 7.3.', en: 'Mahlkönig EK43, setting 7.3.', ja: 'Mahlkönig EK43、設定7.3。' } },
      { label: 'filter', value: { es: '1 filtro de papel.', en: '1 paper filter.', ja: 'ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '230g a 79°C.', en: '230g at 79°C.', ja: '79°Cの湯230g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Poner los 20g de café.', 'Añadir 60g de agua a 79°C con turbulencia.', 'Dejar florecer 30 segundos.', 'Verter el resto del agua hasta 230g en 10 segundos.', 'Presionar durante 45 segundos.'],
      en: ['Inverted position. Add the 20g of coffee.', 'Add 60g of water at 79°C with turbulence.', 'Let bloom for 30 seconds.', 'Pour the rest of the water up to 230g over 10 seconds.', 'Press for 45 seconds.'],
      ja: ['インバーテッドポジション。コーヒー20gを入れる。', '79°Cの湯60gを勢いよく注ぐ。', '30秒間蒸らす。', '残りの湯を10秒かけて合計230gになるまで注ぐ。', '45秒間プレスする。'],
    },
  },
  {
    year: 2014, flag: '🇯🇵', name: 'Shuichi Sasaki',
    dose: '16.5g', temp: '78°C', position: 'Upright', water: '250g Total',
    place: { es: '1er lugar · Final Mundial · Rímini', en: '1st place · World Final · Rimini', ja: '優勝 · 世界決勝 · リミニ' },
    coffee: {
      es: 'Café oficial WAC 2014 (Granos de origen único lavado).',
      en: 'Official WAC 2014 coffee (single-origin washed beans).',
      ja: 'WAC 2014公式コーヒー（シングルオリジン、ウォッシュト）。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Medio-gruesa.', en: 'Medium-coarse.', ja: '中粗挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel.', en: '1 paper filter.', ja: 'ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '250g de agua mineral suave a baja temperatura (78°C).', en: '250g of soft mineral water at a low temperature (78°C).', ja: '軟水のミネラルウォーター250g、低め温度（78°C）。' } },
    ],
    steps: {
      es: ['Posición Tradicional (Upright).', 'Añadir 16.5g de café y verter 50g de agua a 78°C.', 'Revolver lentamente 5 veces y dejar infusionar.', 'A los 0:40s verter 200g de agua adicionales muy despacio.', 'Presionar suavemente finalizando a los 2:15 min.'],
      en: ['Upright position.', 'Add 16.5g of coffee and pour 50g of water at 78°C.', 'Stir slowly 5 times and let it steep.', 'At 0:40, pour 200g more water very slowly.', 'Press gently, finishing at 2:15.'],
      ja: ['アップライトポジション。', 'コーヒー16.5gを入れ、78°Cの湯50gを注ぐ。', 'ゆっくり5回かき混ぜて浸漬させる。', '0:40に残りの湯200gをとてもゆっくり注ぐ。', '2:15で終わるように優しくプレスする。'],
    },
  },
  {
    year: 2013, flag: '🇧🇪', name: 'Jeff Verellen',
    dose: '17g', temp: '83°C', position: 'Inverted', water: '50g Bypass',
    place: { es: '1er lugar · Final Mundial · Melbourne', en: '1st place · World Final · Melbourne', ja: '優勝 · 世界決勝 · メルボルン' },
    coffee: {
      es: 'Colombia, Huila lavado. Perfil súper dulce y balanceado.',
      en: 'Colombia, washed Huila. Super sweet and balanced profile.',
      ja: 'コロンビア・ウイラ産ウォッシュト。非常に甘くバランスの取れたプロファイル。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Gruesa (Tamizada para eliminar polvo fino).', en: 'Coarse (sifted to remove fine dust).', ja: '粗挽き（微粉を除去するためふるい分け）。' } },
      { label: 'filter', value: { es: 'Filtro de papel humedecido.', en: 'Dampened paper filter.', ja: '湿らせたペーパーフィルター。' } },
      { label: 'water', value: { es: '215g de agua suave.', en: '215g of soft water.', ja: '軟水215g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Añadir 17g de café tamizado.', 'Verter 50g de agua a 83°C sin agitar para humedecer todo.', 'Esperar a 0:40s y agregar 115g de agua extra despacio.', 'Voltear a los 1:40 min y dejar extraer por gravedad o presión ligera.', 'Agregar 50g de agua caliente (bypass) a la taza servida.'],
      en: ['Inverted position. Add 17g of sifted coffee.', 'Pour 50g of water at 83°C without stirring, to wet everything.', 'Wait until 0:40 and slowly add 115g more water.', 'Flip at 1:40 and let it extract by gravity or with light pressure.', 'Add 50g of hot water (bypass) to the served cup.'],
      ja: ['インバーテッドポジション。ふるいにかけたコーヒー17gを加える。', '83°Cの湯50gを、かき混ぜずに全体を湿らせるように注ぐ。', '0:40まで待ち、残りの湯115gをゆっくり加える。', '1:40で反転させ、重力または軽い圧力で抽出させる。', '提供するカップに熱湯50g（バイパス）を加える。'],
    },
  },
  {
    year: 2012, flag: '🇧🇪', name: 'Charlene de Buysere',
    dose: '18.3g', temp: '85°C', position: 'Upright', water: '250g',
    place: { es: '1er lugar · Final Mundial · Viena', en: '1st place · World Final · Vienna', ja: '優勝 · 世界決勝 · ウィーン' },
    coffee: {
      es: 'Kenia de proceso lavado con acidez brillante y notas a cassis.',
      en: 'Washed-process Kenya with bright acidity and blackcurrant notes.',
      ja: '明るい酸味とカシスのノートを持つケニア産ウォッシュト。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Gruesa.', en: 'Coarse.', ja: '粗挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel, bien enjuagado.', en: '1 paper filter, thoroughly rinsed.', ja: 'ペーパーフィルター1枚、しっかりリンス。' } },
      { label: 'water', value: { es: '250g a 85°C.', en: '250g at 85°C.', ja: '85°Cの湯250g。' } },
    ],
    steps: {
      es: ['Posición Tradicional (Upright). Colocar el filtro bien enjuagado y los 18.5g de café molido grueso.', 'Verter unos 40g de agua a 85°C para la floración (≈30s).', 'Verter el resto del agua hasta 250g y presionar sin llegar al fondo.', 'Servir.'],
      en: ['Upright position. Place the thoroughly rinsed filter and add 18.5g of coarsely ground coffee.', 'Pour about 40g of water at 85°C for the bloom (≈30s).', 'Pour the rest of the water up to 250g and press without going all the way down.', 'Serve.'],
      ja: ['アップライトポジション。しっかりリンスしたフィルターをセットし、粗挽きコーヒー18.5gを入れる。', '85°Cの湯約40gを注いで蒸らす（約30秒）。', '合計250gになるまで残りの湯を注ぎ、最後まで押し切らずにプレスする。', '提供する。'],
    },
  },
  {
    year: 2011, flag: '🇧🇪', name: 'Jeff Verellen',
    dose: '17g', temp: '80°C', position: 'Upright', water: '270g',
    place: { es: '1er lugar · Final Mundial · Maastricht', en: '1st place · World Final · Maastricht', ja: '優勝 · 世界決勝 · マーストリヒト' },
    coffee: {
      es: 'Café de origen Kenia. Muy floral, cítrico y elegante.',
      en: 'Kenyan-origin coffee. Very floral, citrusy, and elegant.',
      ja: 'ケニア産のコーヒー。非常にフローラルで柑橘系、エレガント。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda gruesa, ligeramente más fina que un filtro de papel.', en: 'Coarse grind, slightly finer than paper filter.', ja: '粗挽き、ペーパーフィルター用よりやや細かめ。' } },
      { label: 'filter', value: { es: '1 filtro de papel, enjuagado con agua caliente.', en: '1 paper filter, rinsed with hot water.', ja: 'ペーパーフィルター1枚、熱湯でリンス。' } },
      { label: 'water', value: { es: '270g de agua suave o filtrada a 80°C.', en: '270g of soft or filtered water at 80°C.', ja: '軟水または浄水80°Cの湯270g。' } },
    ],
    steps: {
      es: ['Posición Tradicional (Upright). Ajustar el filtro previamente enjuagado en el AeroPress.', 'Verter unos 40g de agua a 80°C directo sobre el café recién molido para humedecerlo.', 'Tras ≈30s, verter muy lentamente el resto del agua hasta 270g, evitando que el café se separe del agua.', 'Dejar en infusión por goteo alrededor de 1 minuto.', 'Ayudar el paso del resto del agua con el émbolo, muy suavemente, dejando ≈50g sin presionar.'],
      en: ['Upright position. Fit the pre-rinsed filter onto the AeroPress.', 'Pour about 40g of water at 80°C directly onto the freshly ground coffee to wet it.', 'After ≈30s, very slowly pour the rest of the water up to 270g, keeping the grounds from separating from the water.', 'Let it steep and drip for about 1 minute.', 'Help the rest of the water through with the plunger, very gently, leaving ≈50g unpressed.'],
      ja: ['アップライトポジション。事前にリンスしたフィルターをエアロプレスに取り付ける。', '挽きたてのコーヒーに80°Cの湯約40gを直接注いで湿らせる。', '約30秒後、粉が湯から分離しないよう、残りの湯を270gになるまでとてもゆっくり注ぐ。', '約1分間、浸漬・滴下させる。', 'プランジャーでとても優しく残りを押し出し、約50gは押し切らずに残す。'],
    },
  },
  {
    year: 2010, flag: '🇩🇰', name: 'Marie Hagemeister',
    dose: '20g', temp: '80°C', position: 'Inverted', water: '200g',
    place: { es: '1er lugar · Final Mundial · Londres', en: '1st place · World Final · London', ja: '優勝 · 世界決勝 · ロンドン' },
    coffee: {
      es: 'Café tostado por Tim Wendelboe (Origen El Salvador / Kenia).',
      en: 'Coffee roasted by Tim Wendelboe (El Salvador / Kenya origin).',
      ja: 'Tim Wendelboeによる焙煎（エルサルバドル／ケニア産）。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda ligeramente más fina que filtro.', en: 'Grind slightly finer than filter grind.', ja: 'ペーパーフィルター用よりやや細かめの挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel, enjuagado con agua caliente.', en: '1 paper filter, rinsed with hot water.', ja: 'ペーパーフィルター1枚、熱湯でリンス。' } },
      { label: 'water', value: { es: '200g a 80°C.', en: '200g at 80°C.', ja: '80°Cの湯200g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Enjuagar el filtro con agua caliente.', 'Poner el café molido y verter los 200g de agua a 80°C casi hasta el tope.', 'Remover durante 10-12 segundos.', 'Calentar la taza y luego presionar lentamente el café hacia ella, deteniéndose justo antes de escuchar el aire.', 'Servir.'],
      en: ['Inverted position. Rinse the filter with hot water.', 'Add the ground coffee and pour the 200g of water at 80°C almost to the top.', 'Stir for 10–12 seconds.', 'Heat the cup, then slowly press the coffee into it, stopping just before you hear the air.', 'Serve.'],
      ja: ['インバーテッドポジション。フィルターを熱湯でリンスする。', '挽いたコーヒーを入れ、80°Cの湯200gをほぼ上端まで注ぐ。', '10〜12秒間かき混ぜる。', 'カップを温めてから、空気の音が聞こえる直前まで、ゆっくりコーヒーをプレスする。', '提供する。'],
    },
  },
  {
    year: 2009, flag: '🇵🇱', name: 'Lukasz Jura',
    dose: '19.5g', temp: '75°C', position: 'Inverted', water: '200g',
    place: { es: '1er lugar · Final Mundial · Oslo', en: '1st place · World Final · Oslo', ja: '優勝 · 世界決勝 · オスロ' },
    coffee: {
      es: 'Kenia de tueste claro especialidad.',
      en: 'Light-roast specialty Kenya.',
      ja: '浅煎りのスペシャルティ・ケニア産。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda Fina-Media.', en: 'Fine-medium grind.', ja: '中細挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel.', en: '1 paper filter.', ja: 'ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '200g a baja temperatura (75°C).', en: '200g at a low temperature (75°C).', ja: '低め温度（75°C）の湯200g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Añadir 19.5g de café molido.', 'Verter los 200g de agua a 75°C en 15 segundos.', 'Remover bien durante 15 segundos.', 'Tapar, purgar aire y dar vuelta a los 0:50s.', 'Presionar suavemente finalizando al llegar a 1:30 min.'],
      en: ['Inverted position. Add 19.5g of ground coffee.', 'Pour the 200g of water at 75°C over 15 seconds.', 'Stir well for 15 seconds.', 'Cap it, purge the air, and flip at 0:50.', 'Press gently, finishing at 1:30.'],
      ja: ['インバーテッドポジション。挽いたコーヒー19.5gを加える。', '75°Cの湯200gを15秒かけて注ぐ。', '15秒間しっかりかき混ぜる。', 'フタをして空気を抜き、0:50で反転させる。', '1:30で終わるように優しくプレスする。'],
    },
  },
  {
    year: 2008, flag: '🇳🇴', name: 'Anders Valde',
    dose: '17g', temp: '93°C', position: 'Upright', water: '220g',
    place: { es: '1er lugar · Final Mundial · Oslo', en: '1st place · World Final · Oslo', ja: '優勝 · 世界決勝 · オスロ' },
    coffee: {
      es: 'El WAC nunca publicó la receta oficial de esta primera edición; estos parámetros son una aproximación referencial al estilo nórdico de la época.',
      en: 'The WAC never published an official recipe for this first edition; these parameters are a reference approximation of the Nordic style of the time.',
      ja: 'WACはこの第1回大会の公式レシピを公表していません。これらの数値は当時の北欧スタイルを参考にした近似値です。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda Media.', en: 'Medium grind.', ja: '中挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel.', en: '1 paper filter.', ja: 'ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '220g de agua caliente a 93°C.', en: '220g of hot water at 93°C.', ja: '93°Cの熱湯220g。' } },
    ],
    steps: {
      es: ['Posición Tradicional (Upright). Colocar 17g de café.', 'Verter 220g de agua a 93°C hasta llenar la cámara.', 'Revolver con firmeza durante 10 segundos.', 'Poner el émbolo en la parte superior y presionar uniformemente durante 30s.'],
      en: ['Upright position. Add 17g of coffee.', 'Pour 220g of water at 93°C, filling the chamber.', 'Stir firmly for 10 seconds.', 'Place the plunger on top and press evenly for 30s.'],
      ja: ['アップライトポジション。コーヒー17gを入れる。', '93°Cの湯220gをチャンバーいっぱいに注ぐ。', '10秒間しっかりかき混ぜる。', 'プランジャーを上に乗せ、30秒間均等にプレスする。'],
    },
  },
];

export default recipes;