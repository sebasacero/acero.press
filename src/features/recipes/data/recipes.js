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
    year: 2023, flag: '🇨🇳', name: 'Jiaming Yang',
    dose: '18g', temp: '88°C', position: 'Inverted', water: '90ppm',
    place: { es: '1er lugar · Final Mundial · Melbourne', en: '1st place · World Final · Melbourne', ja: '優勝 · 世界決勝 · メルボルン' },
    coffee: {
      es: "Frank's Coffee Official Comp Beans (Proceso Anatólico/Lavado, notas florales y cítricas).",
      en: "Frank's Coffee Official Comp Beans (Anatolian/washed process, floral and citrus notes).",
      ja: "Frank's Coffee公式競技用豆（アナトリア式／ウォッシュト製法、フローラルで柑橘系のノート）。",
    },
    equipment: [
      { label: 'grind', value: { es: 'Gruesa, tamizando partículas <400 micras.', en: 'Coarse, sifting out particles under 400 microns.', ja: '粗挽き、400ミクロン以下の微粉をふるい分け。' } },
      { label: 'filter', value: { es: '1 filtro de papel oficial AeroPress.', en: '1 official AeroPress paper filter.', ja: 'エアロプレス純正ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '180g de agua suave a 88°C.', en: '180g of soft water at 88°C.', ja: '軟水180g、88°C。' } },
    ],
    steps: {
      es: ['Posición Invertida. Agregar 18g de café molido.', 'Verter 60g de agua para la preinfusión a los 0:00.', 'Agitar durante 15 segundos y dejar floración hasta los 0:40.', 'Verter el agua restante hasta llegar a 180g.', 'Poner filtro, purgar el aire y dar vuelta el AeroPress a 1:10.', 'Presionar suavemente de 1:15 a 1:40. Servir.'],
      en: ['Inverted position. Add 18g of ground coffee.', 'Pour 60g of water for the pre-infusion at 0:00.', 'Stir for 15 seconds and let bloom until 0:40.', 'Pour the remaining water up to 180g total.', 'Attach the filter, purge the air, and flip the AeroPress at 1:10.', 'Press gently from 1:15 to 1:40. Serve.'],
      ja: ['インバーテッドポジション。挽いたコーヒー18gを加える。', '0:00にプレインフュージョン用の湯60gを注ぐ。', '15秒間かき混ぜ、0:40まで蒸らす。', '合計180gになるまで残りの湯を注ぐ。', 'フィルターを付けて空気を抜き、1:10でエアロプレスを反転させる。', '1:15から1:40まで優しくプレスする。注いで完成。'],
    },
  },
  {
    year: 2022, flag: '🇦🇺', name: 'Jaxon Walshaw',
    dose: '18g', temp: '88°C', position: 'Inverted', water: '60ppm',
    place: { es: '1er lugar · Final Mundial · Vancouver', en: '1st place · World Final · Vancouver', ja: '優勝 · 世界決勝 · バンクーバー' },
    coffee: {
      es: 'Café de origen Colombia, lavado doble fermentación. Proporcionado por el tueste oficial WAC.',
      en: 'Colombian origin coffee, double-fermentation washed process. Provided by the official WAC roaster.',
      ja: 'コロンビア産、ダブル発酵のウォッシュト製法。WAC公式ロースターより提供。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda Media.', en: 'Medium grind.', ja: '中挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel enjuagado previamente con agua caliente.', en: '1 paper filter pre-rinsed with hot water.', ja: '熱湯で事前にリンスしたペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '200g a 88°C.', en: '200g at 88°C.', ja: '88°Cの湯200g。' } },
    ],
    steps: {
      es: ['Configurar en modo Invertido. Verter 18g de café.', 'Verter 100g de agua hirviendo/88°C rápidamente.', 'Agitar en círculos 30 veces seguidas.', 'Añadir los 100g de agua restantes a los 0:40 min.', 'Colocar la tapa, purgar el aire y voltear a 1:00 min.', 'Presionar suavemente de 1:00 a 1:30 min. Diluir si se busca mayor claridad.'],
      en: ['Set up in Inverted mode. Add 18g of coffee.', 'Quickly pour 100g of near-boiling/88°C water.', 'Stir in circles 30 times in a row.', 'Add the remaining 100g of water at 0:40.', 'Attach the lid, purge the air, and flip at 1:00.', 'Press gently from 1:00 to 1:30. Dilute for extra clarity if desired.'],
      ja: ['インバーテッドモードにセットする。コーヒー18gを注ぐ。', 'ほぼ沸騰した88°Cの湯100gを素早く注ぐ。', '円を描くように30回かき混ぜる。', '0:40に残りの湯100gを加える。', 'フタを付けて空気を抜き、1:00で反転させる。', '1:00から1:30まで優しくプレスする。クリアさを求める場合は希釈する。'],
    },
  },
  {
    year: 2021, flag: '🇫🇮', name: 'Tuomas Merikanto',
    dose: '18g', temp: '88°C', position: 'Upright', water: '100ppm',
    place: { es: '1er lugar · Final Mundial · Edición Virtual', en: '1st place · World Final · Virtual Edition', ja: '優勝 · 世界決勝 · バーチャル開催' },
    coffee: {
      es: 'Etiopía de especialidad proceso natural, tostado específicamente para la final mundial virtual.',
      en: 'Specialty Ethiopian natural-process coffee, roasted specifically for the virtual world final.',
      ja: 'エチオピア産スペシャルティ、ナチュラル製法。バーチャル世界決勝のために特別に焙煎。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Comandante 24 clics.', en: 'Comandante, 24 clicks.', ja: 'コマンダンテ、24クリック。' } },
      { label: 'filter', value: { es: '1 filtro de papel.', en: '1 paper filter.', ja: 'ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '200g a 88°C.', en: '200g at 88°C.', ja: '88°Cの湯200g。' } },
    ],
    steps: {
      es: ['Posición Tradicional (Upright). Poner café en la cámara.', 'Verter 50g de agua a 88°C y revolver 10 veces para floración.', 'Esperar hasta 0:30 e incorporar 150g adicionales de agua suavemente.', 'Insertar el émbolo levemente para generar vacío y detener el goteo.', 'A los 1:30 min, presionar suavemente durante 30 segundos.'],
      en: ['Upright position. Add coffee to the chamber.', 'Pour 50g of water at 88°C and stir 10 times to bloom.', 'Wait until 0:30 and gently add 150g more water.', 'Insert the plunger slightly to create a vacuum and stop the drip.', 'At 1:30, press gently for 30 seconds.'],
      ja: ['アップライトポジション。チャンバーにコーヒーを入れる。', '88°Cの湯50gを注ぎ、10回かき混ぜて蒸らす。', '0:30まで待ち、残りの湯150gを優しく加える。', 'プランジャーを軽く差し込み真空状態を作って滴下を止める。', '1:30で30秒間優しくプレスする。'],
    },
  },
  {
    year: 2019, flag: '🇳🇱', name: 'Wendelien van Bunnik',
    dose: '30g', temp: '92°C', position: 'Inverted', water: '120ppm',
    place: { es: '1er lugar · Final Mundial · Londres', en: '1st place · World Final · London', ja: '優勝 · 世界決勝 · ロンドン' },
    coffee: {
      es: 'Café de origen privado de la competencia (Café de Finca graduado alto en dulzor y acidez).',
      en: 'Private competition-origin coffee (estate coffee scored high in sweetness and acidity).',
      ja: '大会独自の非公開産地のコーヒー（甘みと酸味が高く評価された農園コーヒー）。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Bastante gruesa (8/10 en escala habitual).', en: 'Quite coarse (8/10 on the usual scale).', ja: 'かなり粗挽き（通常スケールで8/10）。' } },
      { label: 'filter', value: { es: '1 Filtro de papel + Mesh metal (opcional/papel doble).', en: '1 paper filter + metal mesh (optional/double paper).', ja: 'ペーパーフィルター1枚 + メタルメッシュ（任意／ペーパー二重も可）。' } },
      { label: 'water', value: { es: '100g para extracción / 100g para bypass (dilución).', en: '100g for extraction / 100g for bypass (dilution).', ja: '抽出用100g／バイパス（希釈）用100g。' } },
    ],
    steps: {
      es: ['AeroPress en modo Invertido. Añadir 30g de café molido grueso.', 'Verter 100g de agua a 92°C de una sola vez.', 'Revolver intensamente durante 20 segundos.', 'Poner filtro, purgar el aire y dar vuelta a los 0:40 min.', 'Presionar todo el concentrado hasta los 1:00 min.', 'Diluir el concentrado añadiendo 100g a 120g de agua caliente al gusto.'],
      en: ['AeroPress in Inverted mode. Add 30g of coarsely ground coffee.', 'Pour 100g of water at 92°C all at once.', 'Stir vigorously for 20 seconds.', 'Attach the filter, purge the air, and flip at 0:40.', 'Press out all the concentrate by 1:00.', 'Dilute the concentrate by adding 100–120g of hot water to taste.'],
      ja: ['エアロプレスをインバーテッドにセット。粗挽きコーヒー30gを加える。', '92°Cの湯100gを一気に注ぐ。', '20秒間力強くかき混ぜる。', 'フィルターを付けて空気を抜き、0:40で反転させる。', '1:00までに濃縮液をすべてプレスする。', '好みに合わせて熱湯100〜120gを加えて濃縮液を希釈する。'],
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
    year: 2016, flag: '🇵🇱', name: 'Filip Åkerblom',
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
    dose: '20g', temp: '79°C', position: 'Upright', water: '220g Total',
    place: { es: '1er lugar · Final Mundial · Rímini', en: '1st place · World Final · Rimini', ja: '優勝 · 世界決勝 · リミニ' },
    coffee: {
      es: 'Etiopía Suke Quto, proceso lavado. Muy limpio y floral.',
      en: 'Ethiopia Suke Quto, washed process. Very clean and floral.',
      ja: 'エチオピア産スケ・クオト、ウォッシュト製法。非常にクリーンでフローラル。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda media-fina.', en: 'Medium-fine grind.', ja: '中細挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel enjuagado.', en: '1 rinsed paper filter.', ja: 'リンスしたペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '220g a 79°C.', en: '220g at 79°C.', ja: '79°Cの湯220g。' } },
    ],
    steps: {
      es: ['Posición Tradicional (Upright). Poner los 20g de café.', 'Verter 60g de agua a 79°C y realizar turbulencia/agitar 15 segundos.', 'Dejar florecer hasta 0:45 min.', 'Verter los 160g restantes lentamente en espiral hasta llegar a 220g.', 'Presionar suavemente de 1:15 a 1:45 min.'],
      en: ['Upright position. Add the 20g of coffee.', 'Pour 60g of water at 79°C and stir/agitate for 15 seconds.', 'Let bloom until 0:45.', 'Slowly pour the remaining 160g in a spiral up to 220g total.', 'Press gently from 1:15 to 1:45.'],
      ja: ['アップライトポジション。コーヒー20gを入れる。', '79°Cの湯60gを注ぎ、15秒間かき混ぜる。', '0:45まで蒸らす。', '残りの160gを合計220gになるまで螺旋を描くようにゆっくり注ぐ。', '1:15から1:45まで優しくプレスする。'],
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
    dose: '18.5g', temp: '85°C', position: 'Inverted', water: '200g',
    place: { es: '1er lugar · Final Mundial · Viena', en: '1st place · World Final · Vienna', ja: '優勝 · 世界決勝 · ウィーン' },
    coffee: {
      es: 'Kenia de proceso lavado con acidez brillante y notas a cassis.',
      en: 'Washed-process Kenya with bright acidity and blackcurrant notes.',
      ja: '明るい酸味とカシスのノートを持つケニア産ウォッシュト。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Media-gruesa.', en: 'Medium-coarse.', ja: '中粗挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel lavadísimo.', en: '1 thoroughly rinsed paper filter.', ja: 'しっかりリンスしたペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '200g a 85°C.', en: '200g at 85°C.', ja: '85°Cの湯200g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Poner 18.5g de café.', 'Verter 80g de agua a 85°C y remover activamente durante 10s.', 'Verter los 120g restantes de agua a los 0:30s.', 'Colocar la tapa con el filtro, dar la vuelta a 1:00 min.', 'Presionar despacio durante 20s.'],
      en: ['Inverted position. Add 18.5g of coffee.', 'Pour 80g of water at 85°C and stir actively for 10s.', 'Pour the remaining 120g of water at 0:30.', 'Attach the lid with the filter and flip at 1:00.', 'Press slowly for 20s.'],
      ja: ['インバーテッドポジション。コーヒー18.5gを入れる。', '85°Cの湯80gを注ぎ、10秒間しっかりかき混ぜる。', '0:30に残りの湯120gを注ぐ。', 'フィルター付きのフタをして1:00で反転させる。', '20秒かけてゆっくりプレスする。'],
    },
  },
  {
    year: 2011, flag: '🇧🇪', name: 'Jeff Verellen',
    dose: '17g', temp: '80°C', position: 'Inverted', water: '200g',
    place: { es: '1er lugar · Final Mundial · Maastricht', en: '1st place · World Final · Maastricht', ja: '優勝 · 世界決勝 · マーストリヒト' },
    coffee: {
      es: 'Café de origen Kenia. Muy floral, cítrico y elegante.',
      en: 'Kenyan-origin coffee. Very floral, citrusy, and elegant.',
      ja: 'ケニア産のコーヒー。非常にフローラルで柑橘系、エレガント。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda gruesa.', en: 'Coarse grind.', ja: '粗挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel.', en: '1 paper filter.', ja: 'ペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '200g de agua suave a 80°C.', en: '200g of soft water at 80°C.', ja: '軟水80°Cの湯200g。' } },
    ],
    steps: {
      es: ['Posición Invertida. Añadir 17g de café molido.', 'Verter agua a 80°C lentamente saturando todo el lecho.', 'Dejar infusionar por 2:30 minutos sin agitar agresivamente.', 'Dar la vuelta y dejar que baje por peso/presión extremadamente suave.'],
      en: ['Inverted position. Add 17g of ground coffee.', 'Slowly pour water at 80°C, saturating the whole bed.', 'Let it steep for 2:30 minutes without stirring aggressively.', 'Flip and let it drop by weight/extremely gentle pressure.'],
      ja: ['インバーテッドポジション。挽いたコーヒー17gを加える。', '80°Cの湯をゆっくり注ぎ、粉全体を浸す。', '激しくかき混ぜずに2分30秒浸漬させる。', '反転させ、自重または極めて軽い圧力で落とす。'],
    },
  },
  {
    year: 2010, flag: '🇩🇰', name: 'Marie Hagemeister',
    dose: '20g', temp: '80°C', position: 'Upright', water: '200g',
    place: { es: '1er lugar · Final Mundial · Londres', en: '1st place · World Final · London', ja: '優勝 · 世界決勝 · ロンドン' },
    coffee: {
      es: 'Café tostado por Tim Wendelboe (Origen El Salvador / Kenia).',
      en: 'Coffee roasted by Tim Wendelboe (El Salvador / Kenya origin).',
      ja: 'Tim Wendelboeによる焙煎（エルサルバドル／ケニア産）。',
    },
    equipment: [
      { label: 'grind', value: { es: 'Molienda Media.', en: 'Medium grind.', ja: '中挽き。' } },
      { label: 'filter', value: { es: '1 filtro de papel enjuagado.', en: '1 rinsed paper filter.', ja: 'リンスしたペーパーフィルター1枚。' } },
      { label: 'water', value: { es: '200g a 80°C.', en: '200g at 80°C.', ja: '80°Cの湯200g。' } },
    ],
    steps: {
      es: ['Posición Tradicional (Upright). Poner 20g de café.', 'Verter 200g de agua a 80°C de forma rápida.', 'Agitar durante 10-12 segundos con movimientos circulares.', 'Colocar el émbolo para generar vacío y dejar reposar hasta 1:00 min.', 'Presionar constante y suavemente durante 30 segundos.'],
      en: ['Upright position. Add 20g of coffee.', 'Quickly pour 200g of water at 80°C.', 'Stir for 10–12 seconds with circular movements.', 'Insert the plunger to create a vacuum and let it sit until 1:00.', 'Press steadily and gently for 30 seconds.'],
      ja: ['アップライトポジション。コーヒー20gを入れる。', '80°Cの湯200gを素早く注ぐ。', '円を描くように10〜12秒間かき混ぜる。', 'プランジャーを差し込んで真空状態を作り、1:00まで置く。', '30秒間、一定の力で優しくプレスする。'],
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
    year: 2008, flag: '🇳🇴', name: 'Anders Erickson',
    dose: '17g', temp: '93°C', position: 'Upright', water: '220g',
    place: { es: '1er lugar · Final Mundial · Oslo', en: '1st place · World Final · Oslo', ja: '優勝 · 世界決勝 · オスロ' },
    coffee: {
      es: 'Café de origen único tueste nórdico estilo Tim Wendelboe.',
      en: 'Single-origin coffee, Nordic-style roast in the vein of Tim Wendelboe.',
      ja: 'シングルオリジン、Tim Wendelboeスタイルの北欧式焙煎。',
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
