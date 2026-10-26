// Foto y fuentes de cada campeón del WAC, por año de la receta.
// Las fotos son del sitio oficial del World AeroPress Championship: se enlazan
// desde su CDN (no se copian al repo) y siempre van con crédito y enlace a la
// fuente. Videos: el oficial de la final cuando existe; si no, uno donde el
// campeón prepara su receta o, al menos, la receta ganadora en video (con su
// canal). Revisados uno por uno el 26 oct 2026; los años sin video no tienen.
// Revisado contra worldaeropresschampionship.com el 26 oct 2026.

const CDN = 'https://cdn.shopify.com/s/files/1/1485/9084/files/';
const WAC = 'https://worldaeropresschampionship.com/pages/';
export const WAC_RECIPES_URL = `${WAC}recipes`;

const champions = {
  2025: { photo: `${CDN}Screen_Shot_2025-12-09_at_2.56.41_PM.png?v=1765340658`, credit: 'WAC', final: `${WAC}2025-world-aeropress-championship`, video: 'https://www.youtube.com/watch?v=G1e1FfR162c', videoKind: 'final', videoBy: 'World AeroPress Championship' },
  2024: { photo: `${CDN}wacphotos_machanda_finalist-5_480x480.jpg?v=1728326263`, credit: 'Matthew Machanda / WAC', final: `${WAC}2024-world-aeropress-championship-recap` },
  2023: { photo: `${CDN}5K8A3823_600x600.jpg?v=1702170496`, credit: 'WAC', final: `${WAC}wac23`, video: 'https://www.youtube.com/watch?v=r3H-WufTHmc', videoKind: 'final', videoBy: 'World AeroPress Championship' },
  2022: { photo: `${CDN}jibbi_7bb8f070-b645-4867-a149-5da40fa0ac67_600x600.jpg?v=1672800300`, credit: 'WAC', final: `${WAC}2022-world-final`, video: 'https://www.youtube.com/watch?v=x3G0Ia5nOuU', videoKind: 'final', videoBy: 'World AeroPress Championship' },
  2021: { photo: `${CDN}tuomas_480x480.jpg?v=1653869380`, credit: 'WAC', final: `${WAC}2021-world-final`, video: 'https://www.youtube.com/watch?v=nS7ofQQYwcQ', videoKind: 'final', videoBy: 'World AeroPress Championship' },
  2019: { photo: `${CDN}Wendelien_480x480.jpg?v=1653870712`, credit: 'WAC', final: `${WAC}2019-world-final`, video: 'https://www.youtube.com/watch?v=u928bWvxrZ8', videoKind: 'final', videoBy: 'World AeroPress Championship' },
  2018: { photo: `${CDN}1st_Place_Carolina_Ibarra_Garay_USA_-_Photo_by_Abi_Varney_600x600.jpg?v=1654841339`, credit: 'Abi Varney / WAC', final: `${WAC}2018-world-final`, video: 'https://www.youtube.com/watch?v=RCmwsCme1i4', videoKind: 'recipe', videoBy: 'Coffee Lovers TV' },
  2017: { photo: `${CDN}Paulina_600x600.png?v=1654842420`, credit: 'WAC', final: `${WAC}2017-world-final`, video: 'https://www.youtube.com/watch?v=NVcgSBJFhgM', videoKind: 'recipe', videoBy: 'European Coffee Trip' },
  2016: { photo: `${CDN}wac2016-Filip-1-500x500_500x_2e18e80e-76b0-476b-a958-763116eb418f_600x600.webp?v=1654845282`, credit: 'WAC', final: `${WAC}2016-world-final`, video: 'https://www.youtube.com/watch?v=t2LtasGyS3I', videoKind: 'final', videoBy: 'European Coffee Trip' },
  2015: { photo: `${CDN}image-asset_600x600.jpg?v=1654842877`, credit: 'WAC', final: `${WAC}2015-world-final`, video: 'https://www.youtube.com/watch?v=m3wKJ0-WkDA', videoKind: 'champion', videoBy: 'European Coffee Trip' },
  2014: { photo: `${CDN}d75_600x600.jpg?v=1654843223`, credit: 'WAC', final: `${WAC}2014-world-final`, video: 'https://vimeo.com/115890941', videoKind: 'champion', videoBy: 'Good Coffee' },
  2013: { photo: `${CDN}wac2013-Jeff-500x500_500x_ccdf3fd3-e9a3-491d-a506-b9292342acbd_600x600.jpg?v=1654845631`, credit: 'WAC', final: `${WAC}2013-world-final` },
  2012: { photo: `${CDN}wac2012-Charlene-500x500_500x_51c9c15b-485f-440b-a4a6-e4ba5fd491ac_600x600.jpg?v=1654845835`, credit: 'WAC', final: `${WAC}2012-world-final` },
  2011: { photo: `${CDN}wac2011-Jeff-500x500_500x_b69e49b3-6de5-49b4-b231-200fed0ee9fe_600x600.jpg?v=1654846037`, credit: 'WAC', final: `${WAC}2011-world-final` },
  2010: { photo: `${CDN}wac2010-Marie-500x500_500x_22a6645a-eba5-4575-b208-e40cb2aa40c7_600x600.jpg?v=1654846215`, credit: 'WAC', final: `${WAC}2010-world-final` },
  2009: { photo: `${CDN}wac2009-Lukasz-500x500_500x_1ef8417e-542d-413c-8258-8a16cc58f472_600x600.jpg?v=1654846475`, credit: 'WAC', final: `${WAC}2009-world-final` },
  2008: { photo: `${CDN}wac2008-Anders-500x500_500x_bd151528-cafd-461d-8ddb-01092dc2dd6b_600x600.jpg?v=1654846676`, credit: 'WAC', final: `${WAC}2008-world-final` },
};

/** Foto, crédito y enlaces del campeón de un año; null si no hay. */
export function championOf(year) {
  return champions[year] ?? null;
}

/** URL para incrustar el video (YouTube sin cookies hasta dar play, o Vimeo); null si no se reconoce. */
export function embedOf(url) {
  const yt = /^https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})$/.exec(url ?? '');
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vm = /^https:\/\/vimeo\.com\/(\d+)$/.exec(url ?? '');
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&dnt=1`;
  return null;
}

export default champions;
