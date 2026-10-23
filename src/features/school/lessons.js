// Lecciones de la Escuela: de cero a vender tu primera taza con AeroPress.
// Español es la fuente; un idioma que falte cae al español (como translations.js).
// `tool` pone al lado de la lección el cronómetro ('timer') o la cuenta de la taza ('cost').

const es = [
  {
    key: 'meet',
    mins: 3,
    title: 'Conoce tu AeroPress',
    lead: 'Es una cámara donde el café y el agua se mezclan un rato y luego se presionan por un filtro de papel. Por eso la taza sale limpia, poco amarga y casi igual cada vez.',
    points: [
      'Cámara: el tubo grande con números; ahí van el café y el agua.',
      'Émbolo: el tubo con caucho que empuja el café por el filtro.',
      'Tapa y filtro de papel: el filtro retiene el sedimento y los aceites.',
      'Agitador y cuchara: para remover y medir.',
    ],
    tip: 'Enjuaga el filtro de papel con agua caliente antes de servir: quita el sabor a papel y calienta la taza.',
    practice: ['Arma y desarma la AeroPress tres veces sin mirar.', 'Lava cada parte con agua tibia y déjala secar al aire.'],
  },
  {
    key: 'first',
    mins: 5,
    title: 'Tu primera taza',
    lead: 'La receta base de la Escuela: 15 g de café, 230 g de agua a 90 °C y dos minutos. Úsala hasta que te salga igual tres días seguidos.',
    points: [
      'Café: 15 g, molienda media-fina, como sal de mesa.',
      'Agua: 230 g a 90 °C (hierve y espera 30 segundos).',
      'Vierte toda el agua, remueve 10 veces, pon el émbolo para que no gotee.',
      'Al minuto y medio, remueve suave y presiona parejo durante unos 30 segundos.',
      'Para cuando escuches que sisea: ese último aire trae lo amargo.',
    ],
    tip: 'Presiona con el peso del brazo, no con fuerza. Si cuesta mucho, la molienda está muy fina.',
    practice: ['Prepara la receta con el cronómetro «Prepara conmigo».', 'Pruébala tibia: a 50 °C se notan mejor los sabores.'],
    tool: 'timer',
  },
  {
    key: 'measure',
    mins: 4,
    title: 'Medir y moler',
    lead: 'La taza cambia más por la medida y la molienda que por cualquier truco. Con una báscula de cocina y café recién molido ya estás por encima del promedio.',
    points: [
      'Proporción: 1 g de café por cada 15 g de agua (1:15). Más café, taza más intensa.',
      'Pesa café y agua: la cuchara y las líneas de la cámara son aproximadas.',
      'Muele justo antes de preparar; el café molido pierde aroma en días.',
      'Sin molino, pide el café molido «para AeroPress» o «medio-fino».',
      'Guarda el grano en un frasco cerrado, lejos del sol y del calor.',
    ],
    tip: 'Si sirves en la calle, deja dosis de 15 g listas en bolsitas o frascos: sirves más rápido y siempre igual.',
    practice: ['Pesa 15 g tres veces con la cuchara y mira cuánto varía.', 'Prepara la misma receta con dos moliendas y compara.'],
  },
  {
    key: 'taste',
    mins: 4,
    title: 'Ajusta el sabor',
    lead: 'Probar y ajustar es el oficio del barista. Cambia una sola cosa a la vez y anota qué pasó.',
    points: [
      'Amargo o áspero: muele más grueso o presiona 15 segundos antes.',
      'Agrio o aguado: muele más fino o deja 15 segundos más antes de presionar.',
      'Débil: sube a 16 o 17 g de café con la misma agua.',
      'Muy fuerte: agrega un poco de agua caliente a la taza al final.',
      'Agua de botellón o filtrada: el agua de la llave con cloro se nota.',
    ],
    tip: 'Si cambias dos cosas a la vez, no sabrás cuál arregló la taza.',
    practice: ['Haz tres tazas cambiando solo la molienda.', 'Pídele a alguien que las pruebe sin decirle cuál es cuál.'],
  },
  {
    key: 'street',
    mins: 4,
    title: 'Tu barra en la calle',
    lead: 'En la calle cuentan la limpieza y la velocidad: una taza en unos tres minutos, siempre con el mismo sabor.',
    points: [
      'Lávate las manos y usa agua potable para preparar y enjuagar.',
      'Termo que mantenga el agua cerca de 90 °C toda la mañana: pruébalo antes.',
      'Enjuaga la AeroPress entre tazas; el disco de café va a la basura o al compost.',
      'Filtros secos en una bolsa cerrada; vasos con tapa para llevar.',
      'Ordena la barra igual cada día: café, AeroPress, termo, vasos, cobro.',
    ],
    tip: 'Ten a la vista el precio y el QR de pago: la gente decide en segundos.',
    practice: ['Cronometra cuánto tardas de pedido a entrega.', 'Repite hasta bajar de tres minutos sin apurar la presión.'],
  },
  {
    key: 'price',
    mins: 3,
    title: 'Cuánto cobrar',
    lead: 'Antes de poner precio, saca la cuenta de lo que te cuesta cada taza. Con la calculadora sabes cuánto te queda.',
    points: [
      'Costo del café por taza: precio de la libra ÷ 500 × gramos por taza.',
      'Suma vaso, tapa, filtro y azúcar: casi siempre se olvidan.',
      'El precio no es solo el costo: la gente paga por la receta, la atención y la esquina.',
      'Mira a cuánto se vende el tinto cerca: tu taza de especialidad va por encima, no al mismo precio.',
    ],
    tip: 'Si la ganancia por taza te parece poca, revisa los gramos antes que el precio: 2 g menos por taza también cambian la cuenta.',
    practice: ['Pon tus números reales en la calculadora.', 'Calcula cuántas tazas necesitas al día para la meta del mes.'],
    tool: 'cost',
  },
];

const en = [
  {
    key: 'meet', mins: 3, title: 'Meet your AeroPress',
    lead: 'A chamber where coffee and water steep for a while and are then pressed through a paper filter. That is why the cup comes out clean, low in bitterness and nearly the same every time.',
    points: [
      'Chamber: the big tube with numbers; coffee and water go here.',
      'Plunger: the tube with the rubber seal that pushes the coffee through the filter.',
      'Cap and paper filter: the filter holds back sediment and oils.',
      'Paddle and scoop: to stir and measure.',
    ],
    tip: 'Rinse the paper filter with hot water before brewing: it removes the paper taste and warms the cup.',
    practice: ['Put the AeroPress together and apart three times without looking.', 'Wash each part in warm water and let it air-dry.'],
  },
  {
    key: 'first', mins: 5, title: 'Your first cup',
    lead: 'The School base recipe: 15 g of coffee, 230 g of water at 90 °C and two minutes. Use it until it tastes the same three days in a row.',
    points: [
      'Coffee: 15 g, medium-fine grind, like table salt.',
      'Water: 230 g at 90 °C (boil and wait 30 seconds).',
      'Pour all the water, stir 10 times, insert the plunger so it does not drip.',
      'At a minute and a half, stir gently and press evenly for about 30 seconds.',
      'Stop when you hear a hiss: that last air carries the bitterness.',
    ],
    tip: 'Press with the weight of your arm, not force. If it is hard, the grind is too fine.',
    practice: ['Brew the recipe with the “Brew with me” timer.', 'Taste it warm: at 50 °C flavors show better.'],
    tool: 'timer',
  },
  {
    key: 'measure', mins: 4, title: 'Measure and grind',
    lead: 'The cup changes more with dose and grind than with any trick. A kitchen scale and freshly ground coffee already put you above average.',
    points: [
      'Ratio: 1 g of coffee for every 15 g of water (1:15). More coffee, a more intense cup.',
      'Weigh coffee and water: the scoop and the chamber marks are approximate.',
      'Grind right before brewing; ground coffee loses aroma within days.',
      'No grinder? Ask for coffee ground "for AeroPress" or "medium-fine".',
      'Keep beans in a closed jar, away from sun and heat.',
    ],
    tip: 'Selling on the street? Keep 15 g doses ready in bags or jars: you serve faster and always the same.',
    practice: ['Weigh 15 g three times with the scoop and see how much it varies.', 'Brew the same recipe with two grinds and compare.'],
  },
  {
    key: 'taste', mins: 4, title: 'Dial in the taste',
    lead: 'Tasting and adjusting is the barista’s craft. Change one thing at a time and write down what happened.',
    points: [
      'Bitter or harsh: grind coarser or press 15 seconds earlier.',
      'Sour or watery: grind finer or wait 15 seconds more before pressing.',
      'Weak: go up to 16 or 17 g of coffee with the same water.',
      'Too strong: add a little hot water to the cup at the end.',
      'Use bottled or filtered water: chlorinated tap water shows.',
    ],
    tip: 'Change two things at once and you will not know which one fixed the cup.',
    practice: ['Make three cups changing only the grind.', 'Ask someone to taste them blind.'],
  },
  {
    key: 'street', mins: 4, title: 'Your street bar',
    lead: 'On the street, cleanliness and speed count: a cup in about three minutes, always tasting the same.',
    points: [
      'Wash your hands and use drinking water to brew and rinse.',
      'A flask that keeps water near 90 °C all morning: test it first.',
      'Rinse the AeroPress between cups; the coffee puck goes to the bin or compost.',
      'Dry filters in a closed bag; lidded cups to go.',
      'Set up the bar the same way every day: coffee, AeroPress, flask, cups, payment.',
    ],
    tip: 'Keep the price and the payment QR in sight: people decide in seconds.',
    practice: ['Time how long you take from order to hand-off.', 'Repeat until you are under three minutes without rushing the press.'],
  },
  {
    key: 'price', mins: 3, title: 'What to charge',
    lead: 'Before setting a price, work out what each cup costs you. The calculator shows what you keep.',
    points: [
      'Coffee cost per cup: price per libra (500 g) ÷ 500 × grams per cup.',
      'Add cup, lid, filter and sugar: they are almost always forgotten.',
      'Price is not only cost: people pay for the recipe, the service and the corner.',
      'Check what tinto sells for nearby: your specialty cup goes above it, not at the same price.',
    ],
    tip: 'If the profit per cup looks small, check the grams before the price: 2 g less per cup also changes the math.',
    practice: ['Put your real numbers in the calculator.', 'Work out how many cups a day you need for the monthly goal.'],
    tool: 'cost',
  },
];

const ja = [
  {
    key: 'meet', mins: 3, title: 'エアロプレスを知る',
    lead: 'コーヒーとお湯をしばらく浸し、ペーパーフィルターに押し通す器具です。だからカップはクリアで苦味が少なく、毎回ほぼ同じ味になります。',
    points: ['チャンバー：数字のついた大きな筒。コーヒーとお湯を入れます。', 'プランジャー：ゴムのついた筒。コーヒーをフィルターに押し通します。', 'キャップとペーパーフィルター：微粉と油分を止めます。', 'パドルとスクープ：混ぜる・量るための道具。'],
    tip: '淹れる前にペーパーフィルターをお湯ですすぎましょう。紙の味が消え、カップも温まります。',
    practice: ['見ないで3回組み立てて分解する。', '各パーツをぬるま湯で洗い、自然乾燥させる。'],
  },
  {
    key: 'first', mins: 5, title: '最初の一杯',
    lead: 'スクールの基本レシピ：コーヒー15 g、90 °Cのお湯230 g、2分。3日続けて同じ味になるまで使いましょう。',
    points: ['コーヒー：15 g、中細挽き（食卓塩くらい）。', 'お湯：90 °Cで230 g（沸騰後30秒待つ）。', 'お湯を全部注ぎ、10回混ぜ、プランジャーを差して液だれを防ぐ。', '1分30秒でやさしく混ぜ、約30秒かけて均一に押す。', 'シューという音がしたら止める。最後の空気が苦味を運びます。'],
    tip: '力ではなく腕の重さで押す。重すぎるなら挽き目が細かすぎます。',
    practice: ['「一緒に淹れる」タイマーでレシピを淹れる。', '少し冷めてから味わう。50 °Cくらいで味がよく分かります。'],
    tool: 'timer',
  },
  {
    key: 'measure', mins: 4, title: '量る・挽く',
    lead: 'カップの味を変えるのは小技より分量と挽き目です。キッチンスケールと挽きたての豆があれば、それだけで平均以上。',
    points: ['比率：お湯15 gにコーヒー1 g（1:15）。豆を増やすと濃くなる。', 'コーヒーとお湯は量る。スクープや目盛りは目安です。', '淹れる直前に挽く。挽いた粉は数日で香りが落ちます。', 'ミルがなければ「エアロプレス用」「中細挽き」で頼む。', '豆は密閉びんに入れ、日光と熱を避けて保存。'],
    tip: '路上で売るなら15 gずつ小分けにしておくと、速く、いつも同じに出せます。',
    practice: ['スクープで15 gを3回量り、ばらつきを見る。', '同じレシピを2つの挽き目で淹れ比べる。'],
  },
  {
    key: 'taste', mins: 4, title: '味を調整する',
    lead: '味見して直すのがバリスタの仕事。一度に変えるのは一つだけ、結果をメモしましょう。',
    points: ['苦い・えぐい：粗く挽くか、15秒早く押す。', '酸っぱい・薄い：細かく挽くか、押す前に15秒長く待つ。', '弱い：お湯はそのままで豆を16〜17 gに。', '濃すぎる：最後にカップへお湯を少し足す。', 'ボトル水か浄水を。塩素の多い水道水は味に出ます。'],
    tip: '2つ同時に変えると、どちらが効いたか分かりません。',
    practice: ['挽き目だけを変えて3杯淹れる。', '誰かに目隠しで飲み比べてもらう。'],
  },
  {
    key: 'street', mins: 4, title: '路上のバー',
    lead: '路上では清潔さとスピードが大切。約3分で一杯、いつも同じ味で。',
    points: ['手を洗い、抽出とすすぎには飲用水を。', '朝のあいだ90 °C近くを保つ水筒を。事前に試す。', '一杯ごとにエアロプレスをすすぐ。コーヒーかすはごみか堆肥へ。', 'フィルターは密閉袋で乾燥保管。持ち帰り用はふた付きカップ。', '毎日同じ配置に：豆、エアロプレス、水筒、カップ、会計。'],
    tip: '価格と支払いQRを見える所に。お客さんは数秒で決めます。',
    practice: ['注文から手渡しまでの時間を計る。', '押す工程を急がずに3分を切るまで繰り返す。'],
  },
  {
    key: 'price', mins: 3, title: 'いくらで売るか',
    lead: '値段を決める前に、一杯の原価を計算しましょう。計算機で手元に残る額が分かります。',
    points: ['一杯の豆代：リブラ（500 g）の価格 ÷ 500 × 一杯のグラム数。', 'カップ、ふた、フィルター、砂糖も足す。忘れがちです。', '値段は原価だけではない。レシピ、接客、場所にもお金が払われます。', '近くのティントの値段を見る。スペシャルティの一杯はそれより上に。'],
    tip: '一杯の利益が少なく見えたら、値段より先にグラム数を見直す。1杯2 g減らすだけでも計算は変わります。',
    practice: ['自分の実際の数字を計算機に入れる。', '月の目標に一日何杯必要か計算する。'],
    tool: 'cost',
  },
];

export const LESSONS = { es, en, ja };

/** Las lecciones del idioma activo, o las de español si falta. */
export const lessonsFor = (lang) => LESSONS[lang] ?? LESSONS.es;
