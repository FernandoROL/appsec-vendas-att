import { InputError } from './sale.js';

// Expressões numéricas com precedência usual. "preco" é o único nome aceito.
export function calculate(expression: unknown, price: unknown): number {
  const invalid = () => new InputError('Use números, preco, parênteses e operadores aritméticos.');
  if (typeof expression !== 'string' || expression.length > 120) throw invalid();
  const tokens = expression.match(/\d+(?:\.\d+)?|preco|[^\s]/g) ?? [];
  let position = 0;
  function atom(): number {
    const token = tokens[position++];
    if (token === '-') return -atom();
    if (token === '+') return atom();
    if (token === '(') {
      const result = sum();
      if (tokens[position++] !== ')') throw invalid();
      return result;
    }
    if (token === 'preco' && typeof price === 'number' && Number.isFinite(price)) return price;
    if (!token || !/^\d+(?:\.\d+)?$/.test(token)) throw invalid();
    return Number(token);
  }
  function product(): number {
    let value = atom();
    while (['*', '/'].includes(tokens[position])) {
      const operator = tokens[position++];
      const next = atom();
      value = operator === '*' ? value * next : value / next;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (['+', '-'].includes(tokens[position])) {
      const operator = tokens[position++];
      const next = product();
      value += operator === '+' ? next : -next;
    }
    return value;
  }
  const result = sum();
  if (position !== tokens.length || !Number.isFinite(result)) throw invalid();
  return result;
}
