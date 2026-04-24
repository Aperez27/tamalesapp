import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { fmt, genId } from '../utils/helpers';
import type { Supplier, SupplierCategory } from '../types';
import {
  Plus, X, Edit2, Trash2, Phone, Mail, MapPin,
  Search, ShoppingBag, Building2, Package,
} from 'lucide-react';

const CATEGORIES: { value: SupplierCategory; label: string; color: string; icon: string }[] = [
  { value: 'ingredientes', label: 'Ingredientes',   color: 'bg-green-100 text-green-700 border-green-200',   icon: '🌽' },
  { value: 'empaques',     label: 'Empaques',       color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: '📦' },
  { value: 'equipos',      label: 'Equipos',        color: 'bg-purple-100 text-purple-700 border-purple-200', icon: '⚙️' },
  { value: 'servicios',    label: 'Servicios',      color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🔧' },
  { value: 'otros',        label: 'Otros',          color: 'bg-gray-100 text-gray-700 border-gray-200',     icon: '📋' },
];

const catMap = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

function emptyForm(): Omit<Supplier, 'id' | 'createdAt' | 'totalPurchases'> {
  return { name: '', category: 'ingredientes', contact: '', phone: '', email: '', address: '', nit: '', notes: '' };
}

export default function Suppliers() {
  const { state, dispatch } = useApp();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<SupplierCategory | 'todas'>('todas');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    let list = state.suppliers;
    if (search) list = list.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contact.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search)
    );
    if (filterCat !== 'todas') list = list.filter(s => s.category === filterCat);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [state.suppliers, search, filterCat]);

  // Stats
  const totalPurchases = state.suppliers.reduce((s, x) => s + x.totalPurchases, 0);
  const activeCount = state.suppliers.length;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, category: s.category, contact: s.contact, phone: s.phone, email: s.email ?? '', address: s.address ?? '', nit: s.nit ?? '', notes: s.notes ?? '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = { ...editing, ...form };
        await api.updateSupplier(updated);
        dispatch({ type: 'UPDATE_SUPPLIER', payload: updated });
      } else {
        const newS: Supplier = { id: genId('sup'), ...form, createdAt: new Date().toISOString(), totalPurchases: 0 };
        await api.createSupplier(newS);
        dispatch({ type: 'ADD_SUPPLIER', payload: newS });
      }
      setShowModal(false);
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Supplier) {
    if (!confirm(`¿Eliminar al proveedor "${s.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteSupplier(s.id);
      dispatch({ type: 'DELETE_SUPPLIER', payload: s.id });
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  }

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Proveedores" value={String(activeCount)} icon={<Building2 size={20} className="text-orange-500" />} />
        <StatCard label="Total Compras" value={fmt(totalPurchases)} icon={<ShoppingBag size={20} className="text-blue-500" />} />
        <StatCard label="Ingredientes" value={String(state.suppliers.filter(s => s.category === 'ingredientes').length)} icon={<span className="text-xl">🌽</span>} />
        <StatCard label="Empaques" value={String(state.suppliers.filter(s => s.category === 'empaques').length)} icon={<Package size={20} className="text-purple-500" />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select className="input-field text-sm w-auto" value={filterCat} onChange={e => setFilterCat(e.target.value as any)}>
            <option value="todas">Todas las categorías</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
          {isAdmin && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-sm whitespace-nowrap">
              <Plus size={16} /> Nuevo Proveedor
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400">{filtered.length} proveedor{filtered.length !== 1 ? 'es' : ''}</p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No hay proveedores registrados</p>
          {isAdmin && <p className="text-sm mt-1">Haz clic en "Nuevo Proveedor" para agregar uno</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => {
            const cat = catMap[s.category];
            return (
              <div key={s.id} className="card hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-11 h-11 bg-orange-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {cat?.icon ?? '📋'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 leading-tight">{s.name}</p>
                      {s.nit && <p className="text-[11px] text-gray-400">NIT: {s.nit}</p>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(s)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cat?.color}`}>
                  {cat?.label}
                </span>

                <div className="mt-3 space-y-1.5">
                  {s.contact && (
                    <p className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span className="text-gray-400 font-medium w-14 shrink-0">Contacto</span>
                      {s.contact}
                    </p>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="text-xs text-blue-600 flex items-center gap-1.5 hover:underline">
                      <Phone size={11} className="text-gray-400 shrink-0" /> {s.phone}
                    </a>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="text-xs text-blue-600 flex items-center gap-1.5 hover:underline truncate">
                      <Mail size={11} className="text-gray-400 shrink-0" /> {s.email}
                    </a>
                  )}
                  {s.address && (
                    <p className="text-xs text-gray-500 flex items-start gap-1.5">
                      <MapPin size={11} className="text-gray-400 mt-0.5 shrink-0" /> {s.address}
                    </p>
                  )}
                </div>

                {s.totalPurchases > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
                    <span className="text-xs text-gray-400">Total comprado</span>
                    <span className="text-sm font-bold text-orange-600">{fmt(s.totalPurchases)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">{editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="Nombre *" value={form.name} onChange={v => set('name', v)} placeholder="Nombre del proveedor" />
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Categoría *</label>
                <select className="input-field" value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <Field label="Persona de contacto" value={form.contact} onChange={v => set('contact', v)} placeholder="Nombre del vendedor o contacto" />
              <Field label="Teléfono" value={form.phone} onChange={v => set('phone', v)} placeholder="300 000 0000" />
              <Field label="Email" value={form.email ?? ''} onChange={v => set('email', v)} placeholder="proveedor@email.com" />
              <Field label="Dirección" value={form.address ?? ''} onChange={v => set('address', v)} placeholder="Dirección del proveedor" />
              <Field label="NIT / Cédula" value={form.nit ?? ''} onChange={v => set('nit', v)} placeholder="900.123.456-7" />
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <textarea className="input-field resize-none h-16 text-sm" placeholder="Condiciones de pago, observaciones..."
                  value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary flex-1">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-3">
      <div className="bg-gray-50 p-2 rounded-lg">{icon}</div>
      <div>
        <p className="text-lg font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input className="input-field text-sm" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
