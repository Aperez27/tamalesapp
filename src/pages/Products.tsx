import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { fmt, genId } from '../utils/helpers';
import { api } from '../api/client';
import type { Product, ProductCategory } from '../types';
import { Plus, X, Edit2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

const emptyProduct = (): Omit<Product, 'id'> => ({
  name: '', category: 'tamal', price: 0, cost: 0, description: '', active: true, emoji: '🌽',
});

export default function Products() {
  const { state, dispatch } = useApp();
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct());

  const categories: { key: ProductCategory; label: string; emoji: string }[] = [
    { key: 'tamal', label: 'Tamales', emoji: '🌽' },
    { key: 'bebida', label: 'Bebidas', emoji: '☕' },
    { key: 'adicional', label: 'Adicionales', emoji: '🫓' },
  ];

  function openCreate() { setEditProduct(null); setForm(emptyProduct()); setShowModal(true); }
  function openEdit(p: Product) { setEditProduct(p); setForm({ name: p.name, category: p.category, price: p.price, cost: p.cost, description: p.description, active: p.active, emoji: p.emoji }); setShowModal(true); }
  async function toggleActive(p: Product) {
    const updated = { ...p, active: !p.active };
    await api.updateProduct(updated);
    dispatch({ type: 'UPDATE_PRODUCT', payload: updated });
  }

  async function handleDelete(p: Product) {
    if (!confirm(`¿Eliminar el producto "${p.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteProduct(p.id);
      dispatch({ type: 'DELETE_PRODUCT', payload: p.id });
    } catch (e) {
      alert('Error al eliminar: ' + (e as Error).message);
    }
  }

  async function handleSave() {
    if (!form.name) return;
    if (editProduct) {
      const updated = { ...editProduct, ...form };
      await api.updateProduct(updated);
      dispatch({ type: 'UPDATE_PRODUCT', payload: updated });
    } else {
      const newP = { id: genId('p'), ...form };
      await api.createProduct(newP);
      dispatch({ type: 'ADD_PRODUCT', payload: newP });
    }
    setShowModal(false);
  }

  const margin = (p: Product) => p.price > 0 ? ((p.price - p.cost) / p.price * 100).toFixed(0) : '0';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{state.products.length} productos registrados</p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Nuevo Producto
        </button>
      </div>

      {categories.map(cat => {
        const prods = state.products.filter(p => p.category === cat.key);
        return (
          <div key={cat.key} className="card">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">{cat.emoji} {cat.label}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {prods.map(p => (
                <div key={p.id} className={`border rounded-xl p-3 ${p.active ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{p.emoji}</span>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1 hover:bg-gray-100 rounded">
                        <Edit2 size={13} className="text-gray-400" />
                      </button>
                      <button onClick={() => toggleActive(p)} className="p-1 hover:bg-gray-100 rounded">
                        {p.active ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} className="text-gray-400" />}
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(p)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-gray-50 text-center">
                    <div>
                      <p className="text-xs text-gray-400">Precio</p>
                      <p className="text-sm font-bold text-orange-600">{fmt(p.price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Costo</p>
                      <p className="text-sm font-medium text-gray-600">{fmt(p.cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Margen</p>
                      <p className={`text-sm font-bold ${parseInt(margin(p)) > 40 ? 'text-green-600' : 'text-red-500'}`}>{margin(p)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold">{editProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Emoji</label>
                  <input className="input-field text-center text-xl" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Categoría</label>
                  <select className="input-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ProductCategory }))}>
                    <option value="tamal">Tamal</option>
                    <option value="bebida">Bebida</option>
                    <option value="adicional">Adicional</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nombre *</label>
                <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Descripción</label>
                <input className="input-field" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Precio de venta</label>
                  <input type="number" className="input-field" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Costo</label>
                  <input type="number" className="input-field" value={form.cost || ''} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              {form.price > 0 && form.cost > 0 && (
                <div className="bg-green-50 rounded-lg p-2 text-xs text-center text-green-700 font-medium">
                  Margen: {((form.price - form.cost) / form.price * 100).toFixed(1)}% · Ganancia: {fmt(form.price - form.cost)} por unidad
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSave} className="btn-primary flex-1">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
