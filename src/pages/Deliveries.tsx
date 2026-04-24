import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../utils/helpers';
import { api } from '../api/client';
import type { DeliveryStatus } from '../types';
import { MapPin, Phone, CheckCircle, Clock, Truck, Package, Trash2 } from 'lucide-react';

const statusConfig: Record<DeliveryStatus, { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',  color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  en_camino:  { label: 'En Camino',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  entregado:  { label: 'Entregado',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  fallido:    { label: 'Fallido',    color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
};

export default function Deliveries() {
  const { state, dispatch } = useApp();
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState<'todas' | DeliveryStatus>('todas');

  const deliveries = state.deliveries.filter(d => filter === 'todas' || d.status === filter);

  const stats = {
    pendiente: state.deliveries.filter(d => d.status === 'pendiente').length,
    en_camino: state.deliveries.filter(d => d.status === 'en_camino').length,
    entregado: state.deliveries.filter(d => d.status === 'entregado').length,
    fallido:   state.deliveries.filter(d => d.status === 'fallido').length,
  };

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta entrega? Esta acción no se puede deshacer.')) return;
    try {
      await api.deleteDelivery(id);
      dispatch({ type: 'DELETE_DELIVERY', payload: id });
    } catch (e) {
      alert('Error al eliminar: ' + (e as Error).message);
    }
  }

  async function updateStatus(id: string, status: DeliveryStatus) {
    const del = state.deliveries.find(d => d.id === id);
    if (!del) return;
    const updated = { ...del, status, deliveredAt: status === 'entregado' ? new Date().toISOString() : del.deliveredAt };
    await api.updateDelivery(updated);
    dispatch({ type: 'UPDATE_DELIVERY', payload: updated });
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'pendiente', label: 'Pendientes', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { key: 'en_camino', label: 'En Camino',  icon: Truck, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { key: 'entregado', label: 'Entregados', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { key: 'fallido',   label: 'Fallidos',   icon: Package, color: 'text-red-600',   bg: 'bg-red-50' },
        ] as const).map(({ key, label, icon: Icon, color, bg }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`card flex items-center gap-3 transition-all ${filter === key ? 'ring-2 ring-orange-400' : ''}`}>
            <div className={`${bg} p-2 rounded-lg`}><Icon size={20} className={color} /></div>
            <div>
              <p className={`text-xl font-bold ${color}`}>{stats[key]}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['todas', 'pendiente', 'en_camino', 'entregado', 'fallido'].map(f => (
          <button key={f} onClick={() => setFilter(f as typeof filter)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-orange-50'}`}>
            {f === 'todas' ? 'Todas' : f === 'pendiente' ? 'Pendientes' : f === 'en_camino' ? 'En Camino' : f === 'entregado' ? 'Entregadas' : 'Fallidas'}
          </button>
        ))}
      </div>

      {/* Delivery cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {deliveries.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">No hay entregas en esta categoría</div>
        ) : deliveries.map(del => {
          const cfg = statusConfig[del.status];
          return (
            <div key={del.id} className={`card border ${cfg.bg}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{del.customerName}</p>
                  <p className="text-xs text-gray-500">Pedido #{del.orderId.slice(-6)}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg} border ${cfg.bg.replace('50', '200')}`}>
                  {cfg.label}
                </span>
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <MapPin size={12} className="text-gray-400 shrink-0" />
                  <span>{del.address}, {del.neighborhood}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Phone size={12} className="text-gray-400 shrink-0" />
                  <a href={`tel:${del.phone}`} className="hover:text-orange-600">{del.phone}</a>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Clock size={12} className="text-gray-400 shrink-0" />
                  <span>{fmtDate(del.scheduledDate)}</span>
                </div>
              </div>

              <div className="bg-white/70 rounded-lg p-2 mb-3">
                <p className="text-xs font-medium text-gray-600 mb-1">Productos:</p>
                {del.items.map(it => (
                  <p key={it.productId} className="text-xs text-gray-600">{it.quantity}x {it.productName}</p>
                ))}
              </div>

              {del.notes && <p className="text-xs text-gray-500 italic mb-3">"{del.notes}"</p>}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {del.status === 'pendiente' && (
                  <button onClick={() => updateStatus(del.id, 'en_camino')}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                    <Truck size={12} /> Salió
                  </button>
                )}
                {del.status === 'en_camino' && (
                  <button onClick={() => updateStatus(del.id, 'entregado')}
                    className="btn-success text-xs py-1.5 px-3 flex items-center gap-1">
                    <CheckCircle size={12} /> Entregado
                  </button>
                )}
                {(del.status === 'pendiente' || del.status === 'en_camino') && (
                  <button onClick={() => updateStatus(del.id, 'fallido')}
                    className="btn-danger text-xs py-1.5 px-3">
                    Fallida
                  </button>
                )}
                <a href={`https://wa.me/${del.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                  📱 WA
                </a>
                {isAdmin && (
                  <button onClick={() => handleDelete(del.id)}
                    className="p-1.5 hover:bg-red-100 rounded text-red-400 hover:text-red-600 transition-colors" title="Eliminar entrega">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
