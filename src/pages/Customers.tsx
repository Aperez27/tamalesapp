import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate, genId } from '../utils/helpers';
import { buildMessage, getTemplate, whatsappUrl } from '../utils/whatsapp';
import { api } from '../api/client';
import type { Customer } from '../types';
import { BARRIOS_BARRANCABERMEJA } from '../data/barrios';
import {
  Search, Plus, X, Edit2, Phone, MapPin, TrendingUp,
  MessageCircle, CheckSquare, Square, Send, Copy, Check,
  ChevronRight, Users, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const emptyCustomer = (): Omit<Customer, 'id' | 'balance' | 'totalPurchases' | 'createdAt'> => ({
  name: '', phone: '', address: '', neighborhood: '', email: '', notes: '',
});

// ─── WhatsApp offer preview ───────────────────────────────────────────────────
function OfferPreviewModal({
  customer, onClose, onSend, products,
}: {
  customer: Customer;
  onClose: () => void;
  onSend: () => void;
  products: ReturnType<typeof useApp>['state']['products'];
}) {
  const msg = buildMessage(getTemplate(), customer, products);
  const [copied, setCopied] = useState(false);

  function copyMsg() {
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-bold text-gray-800">Vista Previa del Mensaje</h3>
            <p className="text-xs text-gray-400 mt-0.5">Para: {customer.name} · {customer.phone}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {/* Message bubble */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5]">
          <div className="bg-[#dcf8c6] rounded-2xl rounded-tl-none px-4 py-3 shadow-sm max-w-xs ml-auto">
            <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{msg}</pre>
            <p className="text-right text-[10px] text-gray-400 mt-1">Enviado desde la app</p>
          </div>
        </div>

        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            <button onClick={copyMsg}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                copied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}>
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar mensaje</>}
            </button>
            <button onClick={() => { onSend(); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-green-500 text-white hover:bg-green-600 transition-colors">
              <MessageCircle size={14} /> Abrir WhatsApp
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">El mensaje se abrirá listo para enviar en WhatsApp</p>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk send queue modal ────────────────────────────────────────────────────
function BulkQueueModal({
  customers, onClose, products,
}: {
  customers: Customer[];
  onClose: () => void;
  products: ReturnType<typeof useApp>['state']['products'];
}) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);

  function sendCurrent() {
    const c = customers[current];
    if (!c) return;
    const msg = buildMessage(getTemplate(), c, products);
    window.open(whatsappUrl(c.phone, msg), '_blank');
    setSent(prev => new Set([...prev, c.id]));
    if (current < customers.length - 1) {
      setTimeout(() => setCurrent(i => i + 1), 800);
    }
  }

  function sendOne(c: Customer) {
    const msg = buildMessage(getTemplate(), c, products);
    window.open(whatsappUrl(c.phone, msg), '_blank');
    setSent(prev => new Set([...prev, c.id]));
  }

  const allSent = sent.size === customers.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-bold text-gray-800">Envío Masivo de Ofertas</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {sent.size} de {customers.length} mensajes abiertos
            </p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${(sent.size / customers.length) * 100}%` }}
          />
        </div>

        {/* Customer list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {customers.map((c, i) => {
            const isSent = sent.has(c.id);
            const isCurrent = i === current && !allSent;
            return (
              <div key={c.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isCurrent ? 'bg-green-50' : isSent ? 'bg-gray-50' : ''
                }`}>
                {/* Status icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isSent ? 'bg-green-100 text-green-600' : isCurrent ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isSent ? '✓' : i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm truncate ${isSent ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {c.name}
                  </p>
                  <p className="text-xs text-gray-400">{c.phone}</p>
                </div>

                <button
                  onClick={() => sendOne(c)}
                  disabled={isSent}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    isSent
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}>
                  <MessageCircle size={12} />
                  {isSent ? 'Enviado' : 'Abrir'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          {allSent ? (
            <div className="text-center py-2">
              <p className="text-green-600 font-semibold text-sm">✅ ¡Todos los mensajes fueron abiertos!</p>
              <p className="text-gray-400 text-xs mt-1">Recuerda enviar cada mensaje en WhatsApp</p>
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={sendCurrent}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                <MessageCircle size={16} />
                Abrir WhatsApp para {customers[current]?.name?.split(' ')[0]}
                <ChevronRight size={16} />
              </button>
              <p className="text-xs text-gray-400 text-center">
                Parada {current + 1} de {customers.length} · Haz clic y luego envía el mensaje
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Customers() {
  const { state, dispatch } = useApp();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | 'deben' | 'frecuentes'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // WhatsApp automation state
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);
  const [bulkQueueOpen, setBulkQueueOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = state.customers;
    if (search) list = list.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    );
    if (filter === 'deben')     list = list.filter(c => c.balance < 0);
    if (filter === 'frecuentes') list = list.filter(c => c.totalPurchases > 200000);
    return list.sort((a, b) => a.balance - b.balance);
  }, [state.customers, search, filter]);

  const customerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return state.orders.filter(o => o.customerId === selectedCustomer.id).slice(0, 10);
  }, [selectedCustomer, state.orders]);

  const selectedCustomers = useMemo(() =>
    state.customers.filter(c => selectedIds.has(c.id)),
    [state.customers, selectedIds]
  );

  // ── CRUD ───────────────────────────────────────────────────────────────────
  function openCreate() { setEditCustomer(null); setForm(emptyCustomer()); setShowModal(true); }
  function openEdit(c: Customer) {
    setEditCustomer(c);
    setForm({ name: c.name, phone: c.phone, address: c.address, neighborhood: c.neighborhood || '', email: c.email || '', notes: c.notes || '' });
    setShowModal(true);
  }

  async function handleDeleteCustomer(c: Customer) {
    if (!confirm(`¿Eliminar al cliente "${c.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteCustomer(c.id);
      dispatch({ type: 'DELETE_CUSTOMER', payload: c.id });
    } catch (e) {
      alert('Error al eliminar: ' + (e as Error).message);
    }
  }

  async function handleSave() {
    if (!form.name || !form.phone) return;
    if (editCustomer) {
      const updated = { ...editCustomer, ...form };
      await api.updateCustomer(updated);
      dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });
    } else {
      const newC = { id: genId('c'), ...form, balance: 0, totalPurchases: 0, createdAt: new Date().toISOString().split('T')[0] };
      await api.createCustomer(newC);
      dispatch({ type: 'ADD_CUSTOMER', payload: newC });
    }
    setShowModal(false);
  }

  // ── Multi-select ───────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  }

  function sendOffer(c: Customer) {
    const msg = buildMessage(getTemplate(), c, state.products);
    window.open(whatsappUrl(c.phone, msg), '_blank');
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar cliente..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['todos', 'deben', 'frecuentes'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                filter === f ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>
              {f === 'todos' ? 'Todos' : f === 'deben' ? '💸 Deben' : '⭐ Frecuentes'}
            </button>
          ))}

          {/* Multi-select toggle */}
          <button onClick={() => { setMultiSelect(v => !v); setSelectedIds(new Set()); }}
            title="Selección múltiple para envío masivo"
            className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              multiSelect ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}>
            <Users size={13} /> {multiSelect ? 'Cancelar selección' : 'Selección múltiple'}
          </button>

          <button onClick={openCreate} className="btn-primary flex items-center gap-1 text-sm">
            <Plus size={16} /> Nuevo
          </button>
        </div>
      </div>

      {/* ── Selection action bar ────────────────────────────────────────────── */}
      {multiSelect && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={toggleAll}
            className="flex items-center gap-1.5 text-sm text-green-700 font-medium hover:text-green-900">
            {selectedIds.size === filtered.length
              ? <><CheckSquare size={16} /> Deseleccionar todos</>
              : <><Square size={16} /> Seleccionar todos ({filtered.length})</>}
          </button>
          <span className="text-green-600 text-sm font-semibold">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          {selectedIds.size > 0 && (
            <button onClick={() => setBulkQueueOpen(true)}
              className="ml-auto flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              <Send size={14} /> Enviar oferta a {selectedIds.size} cliente{selectedIds.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400">{filtered.length} clientes</p>

      {/* ── Customer grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => {
          const isSelected = selectedIds.has(c.id);
          return (
            <div key={c.id}
              onClick={() => multiSelect ? toggleSelect(c.id) : setSelectedCustomer(c)}
              className={`card cursor-pointer hover:shadow-md transition-all relative ${
                isSelected ? 'border-green-400 bg-green-50' : 'hover:border-orange-200'
              }`}>

              {/* Multi-select checkbox */}
              {multiSelect && (
                <div className="absolute top-3 right-3">
                  {isSelected
                    ? <CheckSquare size={18} className="text-green-600" />
                    : <Square size={18} className="text-gray-300" />}
                </div>
              )}

              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${c.balance < 0 ? 'bg-red-500' : 'bg-orange-500'}`}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone}</p>
                  </div>
                </div>
                {!multiSelect && (
                  <div className="flex gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); setPreviewCustomer(c); }}
                      title="Enviar oferta por WhatsApp"
                      className="p-1.5 hover:bg-green-50 rounded-lg text-green-500 transition-colors">
                      <Send size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(c); }}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400">
                      <Edit2 size={14} />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteCustomer(c); }}
                        className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <MapPin size={10} />
                <span className="truncate">{c.neighborhood || c.address}</span>
              </div>

              <div className="flex justify-between mt-3 pt-2 border-t border-gray-50">
                <div className="text-xs">
                  <p className="text-gray-400">Total compras</p>
                  <p className="font-semibold text-gray-700">{fmt(c.totalPurchases)}</p>
                </div>
                <div className="text-xs text-right">
                  <p className="text-gray-400">Saldo</p>
                  <p className={`font-bold ${c.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {c.balance < 0 ? `-${fmt(Math.abs(c.balance))}` : fmt(c.balance)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail modal ───────────────────────────────────────────────────── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {selectedCustomer.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{selectedCustomer.name}</h3>
                  <p className="text-xs text-gray-500">Cliente desde {fmtDate(selectedCustomer.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Total Compras" value={fmt(selectedCustomer.totalPurchases)} color="text-orange-600" />
                <StatBox
                  label={selectedCustomer.balance < 0 ? 'Debe' : 'A Favor'}
                  value={fmt(Math.abs(selectedCustomer.balance))}
                  color={selectedCustomer.balance < 0 ? 'text-red-600' : 'text-green-600'}
                />
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={14} className="text-gray-400" />
                  <a href={`tel:${selectedCustomer.phone}`} className="hover:text-orange-600">{selectedCustomer.phone}</a>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={14} className="text-gray-400" />
                  <span>{selectedCustomer.address}{selectedCustomer.neighborhood && `, ${selectedCustomer.neighborhood}`}</span>
                </div>
              </div>

              {selectedCustomer.notes && (
                <div className="bg-orange-50 rounded-lg p-2 text-xs text-gray-600">
                  <strong>Nota:</strong> {selectedCustomer.notes}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                  <TrendingUp size={12} /> ÚLTIMOS PEDIDOS
                </p>
                {customerOrders.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin pedidos registrados</p>
                ) : customerOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('es-CO')}</p>
                      <p className="text-xs text-gray-600 truncate max-w-xs">
                        {o.items.map(i => `${i.quantity}x ${i.productName.replace('Tamal de ', '').replace('Tamal ', '')}`).join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{fmt(o.finalTotal)}</p>
                      {o.balance > 0 && <p className="text-xs text-red-500">Debe {fmt(o.balance)}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { openEdit(selectedCustomer); setSelectedCustomer(null); }}
                  className="btn-secondary text-sm">Editar Cliente</button>
                <a href={`https://wa.me/${selectedCustomer.phone.replace(/\D/g, '')}`}
                  target="_blank" rel="noreferrer"
                  className="btn-success text-sm text-center">📱 WhatsApp</a>
              </div>
              <button
                onClick={() => { setPreviewCustomer(selectedCustomer); setSelectedCustomer(null); }}
                className="w-full bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                <Send size={15} /> Enviar Oferta de Tamales por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">{editCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { key: 'name',    label: 'Nombre *',   placeholder: 'Nombre completo' },
                { key: 'phone',   label: 'Teléfono *', placeholder: '300 123 4567' },
                { key: 'address', label: 'Dirección',  placeholder: 'Cra 5 # 12-34' },
                { key: 'email',   label: 'Email',      placeholder: 'correo@email.com' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
                  <input className="input-field" placeholder={f.placeholder}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Barrio</label>
                <input className="input-field" list="barrios-customers"
                  placeholder="Selecciona o escribe el barrio..."
                  value={form.neighborhood}
                  onChange={e => setForm(prev => ({ ...prev, neighborhood: e.target.value }))} />
                <datalist id="barrios-customers">
                  {BARRIOS_BARRANCABERMEJA.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <textarea className="input-field resize-none h-16 text-xs" placeholder="Preferencias, observaciones..."
                  value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSave} className="btn-primary flex-1">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WhatsApp offer preview (single) ────────────────────────────────── */}
      {previewCustomer && (
        <OfferPreviewModal
          customer={previewCustomer}
          products={state.products}
          onClose={() => setPreviewCustomer(null)}
          onSend={() => sendOffer(previewCustomer)}
        />
      )}

      {/* ── Bulk queue modal ────────────────────────────────────────────────── */}
      {bulkQueueOpen && (
        <BulkQueueModal
          customers={selectedCustomers}
          products={state.products}
          onClose={() => { setBulkQueueOpen(false); setSelectedIds(new Set()); setMultiSelect(false); }}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-base font-bold ${color}`}>{value}</p>
    </div>
  );
}
