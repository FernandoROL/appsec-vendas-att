import axios from 'axios';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

interface Sale {
  id: number;
  product: string;
  customer: string;
  quantity: number;
  unitPriceCents: number;
  soldOn: string;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents: number) => currency.format(cents / 100);
const formatDate = (date: string) => date.split('-').reverse().join('/');

function today(): string {
  const local = new Date();
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${local.getFullYear()}-${month}-${day}`;
}

function newSale() {
  return { product: '', customer: '', quantity: '1', price: '', soldOn: today() };
}

function priceInCents(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Informe o preço unitário com até duas casas decimais.');
  }
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

async function request(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? 'Não foi possível concluir a operação.');
  }
  return response;
}

function App() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [form, setForm] = useState(newSale);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [searchLabel, setSearchLabel] = useState('');

  async function loadSales() {
    setLoading(true);
    setListError('');
    try {
      const response = await request('/api/sales');
      setSales(await response.json());
    } catch {
      setListError('Não foi possível carregar as vendas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSales(); }, []);

  async function searchSales(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setSearchLabel('');
      await loadSales();
      return;
    }
    setLoading(true);
    setListError('');
    try {
      const { data } = await axios.get<Sale[]>('/api/sales/search', { params: { q: query } });
      setSales(data);
      setSearchLabel(`Resultados para <strong>${query}</strong>`);
    } catch {
      setListError('Não foi possível buscar as vendas.');
    } finally {
      setLoading(false);
    }
  }

  function setField(name: keyof ReturnType<typeof newSale>, value: string) {
    setForm(current => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setEditing(null);
    setForm(newSale());
    setError('');
  }

  function editSale(sale: Sale) {
    setEditing(sale.id);
    setForm({
      product: sale.product,
      customer: sale.customer,
      quantity: String(sale.quantity),
      price: (sale.unitPriceCents / 100).toFixed(2).replace('.', ','),
      soldOn: sale.soldOn
    });
    setError('');
    setNotice('');
    document.getElementById('sale-product')?.focus();
  }

  async function saveSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = {
        product: form.product,
        customer: form.customer,
        quantity: Number(form.quantity),
        unitPriceCents: priceInCents(form.price),
        soldOn: form.soldOn
      };
      await request(editing ? `/api/sales/${editing}` : '/api/sales', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setNotice(editing ? 'Venda atualizada.' : 'Venda cadastrada.');
      resetForm();
      await loadSales();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Falha ao salvar a venda.');
    } finally {
      setBusy(false);
    }
  }

  async function removeSale(sale: Sale) {
    if (!window.confirm(`Excluir a venda de "${sale.product}"?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(`/api/sales/${sale.id}`, { method: 'DELETE' });
      if (editing === sale.id) resetForm();
      setNotice('Venda excluída.');
      await loadSales();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Falha ao excluir a venda.');
    } finally {
      setBusy(false);
    }
  }

  const totalCents = sales.reduce((total, sale) => total + sale.quantity * sale.unitPriceCents, 0);

  return (
    <>
      <header className="top"><div className="container"><h1>Controle de vendas</h1></div></header>
      <main className="container">
        <div className="feedback">
          {error && <p className="error" role="alert">{error}</p>}
          {notice && <p className="success" role="status">{notice}</p>}
        </div>
        <div className="layout">
          <section className="panel" aria-labelledby="form-title">
            <h2 id="form-title">{editing ? 'Editar venda' : 'Nova venda'}</h2>
            <form onSubmit={saveSale}>
              <fieldset disabled={busy} aria-label="Dados da venda">
                <label>Produto
                  <input id="sale-product" required maxLength={120} value={form.product}
                    onChange={event => setField('product', event.target.value)} />
                </label>
                <label>Cliente
                  <input required maxLength={120} value={form.customer}
                    onChange={event => setField('customer', event.target.value)} />
                </label>
                <div className="row">
                  <label>Quantidade
                    <input type="number" min="1" max="9999" step="1" required value={form.quantity}
                      onChange={event => setField('quantity', event.target.value)} />
                  </label>
                  <label>Preço unitário (R$)
                    <input inputMode="decimal" required maxLength={9} value={form.price}
                      onChange={event => setField('price', event.target.value)} />
                  </label>
                </div>
                <label>Data da venda
                  <input type="date" min="1000-01-01" max="9999-12-31" required value={form.soldOn}
                    onChange={event => setField('soldOn', event.target.value)} />
                </label>
                <div className="buttons">
                  <button className="primary" type="submit">{editing ? 'Salvar edição' : 'Cadastrar venda'}</button>
                  {editing && <button type="button" onClick={resetForm}>Cancelar</button>}
                </div>
              </fieldset>
            </form>
          </section>
          <section className="panel" aria-labelledby="list-title" aria-busy={loading}>
            <div className="list-head">
              <h2 id="list-title">Vendas cadastradas</h2>
              {!loading && !listError && <span className="total">Total de vendas <strong>{money(totalCents)}</strong></span>}
            </div>
            <form onSubmit={searchSales} role="search">
              <label>Buscar por produto ou cliente
                <input value={query} onChange={event => setQuery(event.target.value)} />
              </label>
              <div className="buttons"><button type="submit">Buscar</button></div>
            </form>
            {searchLabel && <p className="search-label" dangerouslySetInnerHTML={{ __html: searchLabel }} />}
            {loading && <p role="status">Carregando vendas…</p>}
            {!loading && listError && (
              <div><p role="alert">{listError}</p><button type="button" onClick={() => void loadSales()}>Tentar novamente</button></div>
            )}
            {!loading && !listError && (sales.length ? (
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de vendas">
                <table>
                  <thead><tr><th>Produto / cliente</th><th>Data</th><th>Qtd.</th><th>Total</th><th>Ações</th></tr></thead>
                  <tbody>{sales.map(sale => (
                    <tr key={sale.id}>
                      <td><strong>{sale.product}</strong><span className="customer">{sale.customer}</span></td>
                      <td>{formatDate(sale.soldOn)}</td>
                      <td>{sale.quantity}</td>
                      <td className="numeric">{money(sale.quantity * sale.unitPriceCents)}</td>
                      <td><div className="buttons">
                        <a href={`/api/sales/${sale.id}/receipt`}>Recibo</a>
                        <button type="button" disabled={busy} onClick={() => editSale(sale)} aria-label={`Editar venda ${sale.id}`}>Editar</button>
                        <button type="button" disabled={busy} onClick={() => void removeSale(sale)} aria-label={`Excluir venda ${sale.id}`}>Excluir</button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="empty">Nenhuma venda cadastrada.</p>)}
          </section>
        </div>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
