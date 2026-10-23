import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { SheetFrame } from '../esspresale/parts.jsx';
import { lessonsFor } from './lessons.js';
import { resumeIndex, totalMinutes, lessonHash } from './school.js';
import { readSeen } from './progress.js';
import './school.css';

// La Escuela en la portada: una franja con el temario a la vista y el botón que
// lleva a /escuela (la lección en curso, si ya empezó). El curso vive en su página.
const num = (i) => String(i + 1).padStart(2, '0');

export default function SchoolTeaser() {
  const { t, lang } = useLanguage();
  const lessons = lessonsFor(lang);
  const [seen] = useState(() => readSeen());
  const done = lessons.filter((l) => seen.includes(l.key)).length;
  const resume = resumeIndex(lessons, seen);
  const titleLines = t('school.titleLines');
  const cta = done === 0
    ? { label: t('school.start'), href: `/escuela${lessonHash(0)}` }
    : resume === -1
      ? { label: t('school.review'), href: `/escuela${lessonHash(0)}` }
      : { label: t('school.resume').replace('{n}', resume + 1), href: `/escuela${lessonHash(resume)}` };

  return (
    <section className="school school-teaser" id="escuela" aria-labelledby="st-title">
      <div className="school-sheet">
        <SheetFrame />
        <div className="school-in st-in">
          <div className="st-copy">
            <div className="essp-tag">{t('school.tag')} <span className="essp-new">{t('school.badge')}</span></div>
            <h2 className="essp-title school-title" id="st-title">
              {titleLines[0]}{' '}<br />{titleLines[1]}
              <span className="essp-script">{t('school.script')}</span>
            </h2>
            <div className="essp-loc">{t('school.loc')}</div>
            <p className="essp-lede school-lede">{t('school.lede')}</p>
            {/* Un solo botón: cada lección del temario ya es un enlace */}
            <a className="essp-btn st-cta" href={cta.href}>{cta.label} →</a>
          </div>
          <nav className="st-outline" aria-label={t('school.outline')}>
            <div className="st-outline-head">
              <span>{t('school.outline')}</span>
              <span>{done > 0 ? t('school.progress').replace('{n}', done).replace('{total}', lessons.length) : t('school.total').replace('{min}', totalMinutes(lessons))}</span>
            </div>
            <ol>
              {lessons.map((l, i) => (
                <li key={l.key} className={seen.includes(l.key) ? 'is-seen' : undefined}>
                  <a href={`/escuela${lessonHash(i)}`}>
                    <span className="school-num">{num(i)}</span>
                    <b>{l.title}</b>
                    <small>{seen.includes(l.key) ? '✓' : `${l.mins} ${t('school.min')}`}</small>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </section>
  );
}
