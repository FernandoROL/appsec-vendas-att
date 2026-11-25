export interface SaleInput {
  product: string;
  customer: string;
  quantity: number;
  unitPriceCents: number;
  soldOn: string;
}

export class InputError extends Error {}

export function validateSale(value: unknown): SaleInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InputError('Envie os dados da venda em JSON.');
  }

  const fields = value as Record<string, unknown>;
  const product = typeof fields.product === 'string' ? fields.product.trim() : '';
  const customer = typeof fields.customer === 'string' ? fields.customer.trim() : '';
  if (!product || product.length > 120 || !customer || customer.length > 120) {
    throw new InputError('Informe produto e cliente com até 120 caracteres.');
  }

  const quantity = fields.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    throw new InputError('A quantidade deve ser um inteiro de 1 a 9999.');
  }

  const unitPriceCents = fields.unitPriceCents;
  if (typeof unitPriceCents !== 'number' || !Number.isInteger(unitPriceCents) ||
      unitPriceCents < 1 || unitPriceCents > 99999999) {
    throw new InputError('O preço unitário deve estar entre R$ 0,01 e R$ 999.999,99.');
  }

  const soldOn = fields.soldOn;
  if (typeof soldOn !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(soldOn)) {
    throw new InputError('Informe uma data de venda válida.');
  }
  const date = new Date(soldOn + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== soldOn) {
    throw new InputError('Informe uma data de venda válida.');
  }

  return { product, customer, quantity, unitPriceCents, soldOn };
}

export function parseSaleId(value: string): number {
  const id = Number(value);
  if (!/^[1-9]\d{0,9}$/.test(value) || id > 4294967295) {
    throw new InputError('Identificador de venda inválido.');
  }
  return id;
}
