import { IconBean } from './icons.jsx';

/** Los cinco granos: para calificar (onPick) o solo para ver (sin onPick). */
export default function Beans({ value = 0, onPick, size = 'big', label = 'Califica' }) {
  return (
    <span className={`mapp-beans is-${size}`} role={onPick ? 'radiogroup' : undefined} aria-label={onPick ? label : `${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (onPick
        ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'grano' : 'granos'}`} className={n <= value ? 'on' : ''} onClick={() => onPick(n)}><IconBean filled={n <= value} /></button>
        : <i key={n} className={n <= Math.round(value) ? 'on' : ''} aria-hidden="true"><IconBean filled={n <= Math.round(value)} /></i>))}
    </span>
  );
}
