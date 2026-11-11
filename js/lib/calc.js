// Petite calculatrice sûre (sans eval) : + − × ÷, parenthèses, virgule ou point, pourcentage.
// « 12,50 + 8 × 3 » → 36.5 ; « 80 - 15% » → 68. Renvoie null si le calcul est incomplet.
export function calc(input) {
  const s = String(input ?? '')
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/[x×]/gi, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–]/g, '-');
  if (!s) return null;
  let i = 0;
  const peek = () => s[i];
  const num = () => {
    const m = /^\d+\.?\d*|^\.\d+/.exec(s.slice(i));
    if (!m) throw 0;
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const factor = () => {
    if (peek() === '-') return i++, -factor();
    if (peek() === '+') return i++, factor();
    let v;
    if (peek() === '(') {
      i++;
      v = expr();
      if (peek() === ')') i++;
    } else v = num();
    return v;
  };
  const term = () => {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = s[i++];
      const r = factor();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = () => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      let r = term();
      // « 80 - 15% » : pourcentage de ce qui précède
      if (peek() === '%') (i++, (r = (v * r) / 100));
      v = op === '+' ? v + r : v - r;
    }
    if (peek() === '%' && i === s.length - 1) (i++, (v = v / 100));
    return v;
  };
  try {
    const v = expr();
    if (i !== s.length || !Number.isFinite(v)) return null;
    return Math.round(v * 1e6) / 1e6;
  } catch {
    return null;
  }
}

// Le texte contient-il un calcul (et pas juste un nombre) ?
export const isCalc = (t) => /\d\s*[-+x×*/÷:%−]\s*[\d(]|%\s*$/.test(String(t || ''));
