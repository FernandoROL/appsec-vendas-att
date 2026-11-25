import assert from 'node:assert/strict';
import test from 'node:test';
import { InputError, parseSaleId, validateSale } from '../dist/server/sale.js';

const sample = { product: ' Cabo USB ', customer: ' Cliente A ', quantity: 2, unitPriceCents: 2590, soldOn: '2024-02-29' };

test('normaliza texto e mantém valores inteiros em centavos', () => {
  assert.deepEqual(validateSale(sample), { ...sample, product: 'Cabo USB', customer: 'Cliente A' });
});

test('rejeita data inexistente, valor fracionário em centavos e quantidade fora do limite', () => {
  for (const fields of [{ soldOn: '2025-02-29' }, { unitPriceCents: 100.01 }, { quantity: 10000 }]) {
    assert.throws(() => validateSale({ ...sample, ...fields }), InputError);
  }
});

test('valida o intervalo dos identificadores da tabela MySQL', () => {
  assert.equal(parseSaleId('4294967295'), 4294967295);
  for (const id of ['4294967296', '0', '1e2', '-2', ' 1']) {
    assert.throws(() => parseSaleId(id), InputError);
  }
});
