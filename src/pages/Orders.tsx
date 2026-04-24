import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, fmtDateTime, payStatusLabel, methodLabel, statusColor, genId } from '../utils/helpers';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Order, OrderStatus, PaymentMethod, Delivery } from '../types';
import { Search, Eye, CreditCard, CheckCircle, X, Pencil, Trash2, Printer, Truck } from 'lucide-react';
import { format } from 'date-fns';

const statusOpts: { value: string; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_preparacion', label: 'En Preparación' },
  { value: 'listo', label: 'Listo' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export default function Orders() {
  const { state, dispatch } = useApp();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payFilter, setPayFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('efectivo');
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  // Create delivery modal
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [deliverySaving, setDeliverySaving] = useState(false);

  const deliveryOrderIds = useMemo(
    () => new Set(state.deliveries.map(d => d.orderId)),
    [state.deliveries]
  );

  function openCreateDelivery(order: Order) {
    const customer = state.customers.find(c => c.id === order.customerId);
    setDeliveryOrder(order);
    setDeliveryAddress(order.deliveryAddress ?? customer?.address ?? '');
    setDeliveryNeighborhood(customer?.neighborhood ?? '');
    setDeliveryDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  }

  async function handleCreateDelivery() {
    if (!deliveryOrder) return;
    const customer = state.customers.find(c => c.id === deliveryOrder.customerId);
    setDeliverySaving(true);
    try {
      const delivery: Delivery = {
        id: genId('del'),
        orderId: deliveryOrder.id,
        customerName: deliveryOrder.customerName,
        address: deliveryAddress,
        neighborhood: deliveryNeighborhood,
        items: deliveryOrder.items,
        status: 'pendiente',
        scheduledDate: deliveryDate
          ? format(new Date(deliveryDate), "yyyy-MM-dd'T'HH:mm:ss")
          : new Date().toISOString(),
        phone: customer?.phone ?? '',
        notes: deliveryOrder.notes,
      };
      await api.createDelivery(delivery);
      dispatch({ type: 'ADD_DELIVERY', payload: delivery });
      setDeliveryOrder(null);
    } catch (e) {
      alert('Error creando entrega: ' + (e as Error).message);
    } finally {
      setDeliverySaving(false);
    }
  }

  // Edit form state
  const [editDate, setEditDate] = useState('');
  const [editMethod, setEditMethod] = useState<PaymentMethod>('efectivo');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<OrderStatus>('pendiente');

  const filtered = useMemo(() => {
    return state.orders.filter(o => {
      const matchSearch = !search || o.customerName.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search);
      const matchStatus = !statusFilter || o.status === statusFilter;
      const matchPay = !payFilter || o.paymentStatus === payFilter;
      return matchSearch && matchStatus && matchPay;
    });
  }, [state.orders, search, statusFilter, payFilter]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  async function updateStatus(order: Order, status: OrderStatus) {
    const updated = { ...order, status, updatedAt: new Date().toISOString() };
    await api.updateOrder(updated);
    dispatch({ type: 'UPDATE_ORDER', payload: updated });
  }

  async function registerPayment() {
    if (!selectedOrder || !payAmount) return;
    const amount = parseFloat(payAmount);
    const payment = {
      id: genId('pay'), customerId: selectedOrder.customerId,
      customerName: selectedOrder.customerName, orderId: selectedOrder.id,
      amount, method: payMethod, date: new Date().toISOString(),
    };
    await api.createPayment(payment);
    dispatch({ type: 'ADD_PAYMENT', payload: payment });
    setPayAmount('');
    setSelectedOrder(null);
  }

  function openEdit(order: Order) {
    setEditingOrder(order);
    setEditDate(format(new Date(order.createdAt), "yyyy-MM-dd'T'HH:mm"));
    setEditMethod(order.paymentMethod);
    setEditAmountPaid(String(order.amountPaid));
    setEditDiscount(String(order.discount));
    setEditNotes(order.notes ?? '');
    setEditStatus(order.status);
  }

  async function saveEdit() {
    if (!editingOrder) return;
    const disc = parseFloat(editDiscount) || 0;
    const paid = parseFloat(editAmountPaid) || 0;
    const finalTotal = Math.max(0, editingOrder.total - disc);
    const balance = Math.max(0, finalTotal - paid);
    const payStatus = paid >= finalTotal ? 'pagado' as const
      : paid === 0 ? (editMethod === 'fiado' ? 'fiado' as const : 'pendiente' as const)
      : 'parcial' as const;

    const updated: Order = {
      ...editingOrder,
      createdAt: format(new Date(editDate), "yyyy-MM-dd'T'HH:mm:ss"),
      updatedAt: new Date().toISOString(),
      paymentMethod: editMethod,
      amountPaid: paid,
      discount: disc,
      finalTotal,
      balance,
      paymentStatus: payStatus,
      notes: editNotes,
      status: editStatus,
    };

    try {
      await api.updateOrder(updated);
      dispatch({ type: 'UPDATE_ORDER', payload: updated });
      setEditingOrder(null);
    } catch (e) {
      alert('Error al guardar: ' + (e as Error).message);
    }
  }

  function printReceipt(order: Order) {
    const lines = order.items.map(it =>
      `<tr><td>${it.quantity}x ${it.productName}</td><td style="text-align:right">${fmt(it.subtotal)}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo</title>
    <style>
      body{font-family:monospace;font-size:13px;max-width:280px;margin:0 auto;padding:12px}
      h2{text-align:center;margin:0;font-size:16px}
      p{text-align:center;margin:4px 0;font-size:11px;color:#555}
      hr{border:none;border-top:1px dashed #999;margin:8px 0}
      table{width:100%;border-collapse:collapse}
      td{padding:2px 0}
      .total{font-weight:bold;font-size:15px}
      .footer{text-align:center;margin-top:12px;font-size:11px;color:#777}
    </style></head><body>
    <h2>🌽 TamalesApp</h2>
    <p>Pedido #${order.id.slice(-8)}</p>
    <p>${fmtDateTime(order.createdAt)}</p>
    <hr/>
    <p style="text-align:left"><strong>Cliente:</strong> ${order.customerName}</p>
    <hr/>
    <table>${lines}</table>
    <hr/>
    <table>
      ${order.discount > 0 ? `<tr><td>Descuento</td><td style="text-align:right">-${fmt(order.discount)}</td></tr>` : ''}
      <tr class="total"><td>TOTAL</td><td style="text-align:right">${fmt(order.finalTotal)}</td></tr>
      <tr><td>Pagado</td><td style="text-align:right">${fmt(order.amountPaid)}</td></tr>
      ${order.balance > 0 ? `<tr><td><strong>Saldo</strong></td><td style="text-align:right;color:red"><strong>${fmt(order.balance)}</strong></td></tr>` : ''}
    </table>
    <hr/>
    <p>Método: ${methodLabel[order.paymentMethod]}</p>
    ${order.isDelivery ? `<p>🚚 Domicilio: ${order.deliveryAddress || ''}</p>` : ''}
    ${order.notes ? `<p>Nota: ${order.notes}</p>` : ''}
    <div class="footer">¡Gracias por su compra!</div>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
    </body></html>`;
    const w = window.open('', '_blank', 'width=320,height=500');
    if (w) { w.document.write(html); w.document.close(); }
  }

  async function deleteOrder(order: Order) {
    if (!confirm(`¿Eliminar el pedido #${order.id.slice(-8)} de ${order.customerName}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteOrder(order.id);
      dispatch({ type: 'DELETE_ORDER', payload: order.id });
    } catch (e) {
      alert('Error al eliminar: ' + (e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input className="input-field pl-9" placeholder="Buscar por cliente o ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input-field sm:w-44" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="input-field sm:w-40" value={payFilter} onChange={e => { setPayFilter(e.target.value); setPage(1); }}>
            <option value="">Todos los pagos</option>
            <option value="pagado">Pagado</option>
            <option value="parcial">Parcial</option>
            <option value="fiado">Fiado</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-2">{filtered.length} pedidos encontrados</p>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">ID / Fecha</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium hidden md:table-cell">Productos</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Total</th>
              <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">Estado</th>
              <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium hidden sm:table-cell">Pago</th>
              <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginated.map(order => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-gray-500">#{order.id.slice(-8)}</p>
                  <p className="text-xs text-gray-400">{fmtDateTime(order.createdAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 text-xs">{order.customerName}</p>
                  {order.isDelivery && <span className="text-xs text-blue-500">🚚 Domicilio</span>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <p className="text-xs text-gray-600 truncate max-w-xs">
                    {order.items.map(it => `${it.quantity}x ${it.productName}`).join(', ')}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-semibold text-gray-800">{fmt(order.finalTotal)}</p>
                  {order.balance > 0 && <p className="text-xs text-red-500">Debe: {fmt(order.balance)}</p>}
                </td>
                <td className="px-4 py-3 text-center">
                  <select
                    value={order.status}
                    onChange={e => updateStatus(order, e.target.value as OrderStatus)}
                    className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer ${
                      order.status === 'entregado' ? 'bg-gray-100 text-gray-600' :
                      order.status === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'en_preparacion' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'listo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {statusOpts.slice(1).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  <span className={statusColor[order.paymentStatus]}>
                    {payStatusLabel[order.paymentStatus]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setSelectedOrder(order)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Ver detalle">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => openEdit(order)} className="p-1.5 hover:bg-blue-50 rounded text-blue-500" title="Editar pedido">
                      <Pencil size={14} />
                    </button>
                    {order.balance > 0 && (
                      <button onClick={() => { setSelectedOrder(order); setPayAmount(String(order.balance)); }}
                        className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Registrar pago">
                        <CreditCard size={14} />
                      </button>
                    )}
                    {order.isDelivery && !deliveryOrderIds.has(order.id) && (
                      <button onClick={() => openCreateDelivery(order)}
                        className="p-1.5 hover:bg-blue-50 rounded text-blue-500" title="Crear entrega">
                        <Truck size={14} />
                      </button>
                    )}
                    {order.status !== 'entregado' && (
                      <button onClick={() => updateStatus(order, 'entregado')}
                        className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Marcar entregado">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => deleteOrder(order)} className="p-1.5 hover:bg-red-50 rounded text-red-400" title="Eliminar pedido">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paginated.length === 0 && (
          <div className="text-center py-12 text-gray-400">No se encontraron pedidos</div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1 px-3 disabled:opacity-50">Anterior</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-xs py-1 px-3 disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* View / Pay modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">Pedido #{selectedOrder.id.slice(-8)}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => printReceipt(selectedOrder)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Imprimir recibo">
                  <Printer size={16} />
                </button>
                <button onClick={() => setSelectedOrder(null)}><X size={20} className="text-gray-400" /></button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500 text-xs">Cliente</p><p className="font-medium">{selectedOrder.customerName}</p></div>
                <div><p className="text-gray-500 text-xs">Fecha</p><p className="font-medium">{fmtDateTime(selectedOrder.createdAt)}</p></div>
                <div><p className="text-gray-500 text-xs">Método</p><p className="font-medium">{methodLabel[selectedOrder.paymentMethod]}</p></div>
                <div><p className="text-gray-500 text-xs">Estado pago</p><span className={statusColor[selectedOrder.paymentStatus]}>{payStatusLabel[selectedOrder.paymentStatus]}</span></div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">PRODUCTOS</p>
                {selectedOrder.items.map(it => (
                  <div key={it.productId} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                    <span>{it.quantity}x {it.productName}</span>
                    <span className="font-medium">{fmt(it.subtotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Descuento</span>
                  <span className="text-green-600">-{fmt(selectedOrder.discount)}</span>
                </div>
                <div className="flex justify-between font-bold text-base py-2">
                  <span>Total</span>
                  <span className="text-orange-600">{fmt(selectedOrder.finalTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pagado</span>
                  <span className="text-green-600">{fmt(selectedOrder.amountPaid)}</span>
                </div>
                {selectedOrder.balance > 0 && (
                  <div className="flex justify-between text-sm font-semibold text-red-600">
                    <span>Saldo pendiente</span>
                    <span>{fmt(selectedOrder.balance)}</span>
                  </div>
                )}
              </div>

              {selectedOrder.balance > 0 && (
                <div className="bg-orange-50 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-semibold text-orange-800">Registrar Pago</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="input-field flex-1"
                      placeholder="Monto"
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                    />
                    <select className="input-field w-36" value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>
                      <option value="efectivo">Efectivo</option>
                      <option value="nequi">Nequi</option>
                      <option value="daviplata">Daviplata</option>
                      <option value="transferencia">Transferencia</option>
                    </select>
                  </div>
                  <button onClick={registerPayment} className="btn-success w-full text-sm">
                    Registrar Pago
                  </button>
                </div>
              )}

              {selectedOrder.notes && (
                <div>
                  <p className="text-xs text-gray-500">Notas: {selectedOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Delivery modal */}
      {deliveryOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Truck size={16} className="text-blue-500" /> Programar Entrega
                </h3>
                <p className="text-xs text-gray-400">Pedido #{deliveryOrder.id.slice(-8)} · {deliveryOrder.customerName}</p>
              </div>
              <button onClick={() => setDeliveryOrder(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Dirección</label>
                <input className="input-field" placeholder="Dirección de entrega..."
                  value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Barrio</label>
                <input className="input-field" placeholder="Barrio..."
                  value={deliveryNeighborhood} onChange={e => setDeliveryNeighborhood(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Fecha y hora de entrega</label>
                <input type="datetime-local" className="input-field"
                  value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                <p className="font-medium mb-1">Productos:</p>
                {deliveryOrder.items.map(it => (
                  <p key={it.productId}>{it.quantity}x {it.productName}</p>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setDeliveryOrder(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button onClick={handleCreateDelivery} disabled={deliverySaving} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1">
                  <Truck size={14} /> {deliverySaving ? 'Creando...' : 'Crear Entrega'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-bold text-gray-800">Editar Pedido</h3>
                <p className="text-xs text-gray-400">#{editingOrder.id.slice(-8)} · {editingOrder.customerName}</p>
              </div>
              <button onClick={() => setEditingOrder(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Fecha del pedido</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Estado</label>
                  <select className="input-field" value={editStatus} onChange={e => setEditStatus(e.target.value as OrderStatus)}>
                    {statusOpts.slice(1).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Método de pago</label>
                  <select className="input-field" value={editMethod} onChange={e => setEditMethod(e.target.value as PaymentMethod)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="nequi">Nequi</option>
                    <option value="daviplata">Daviplata</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="fiado">Fiado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Descuento</label>
                  <input type="number" className="input-field" placeholder="0" value={editDiscount} onChange={e => setEditDiscount(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Monto pagado</label>
                  <input type="number" className="input-field" placeholder="0" value={editAmountPaid} onChange={e => setEditAmountPaid(e.target.value)} />
                </div>
              </div>

              {/* Preview totals */}
              <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{fmt(editingOrder.total)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Descuento</span><span>-{fmt(parseFloat(editDiscount) || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-800 border-t pt-1">
                  <span>Total</span><span>{fmt(Math.max(0, editingOrder.total - (parseFloat(editDiscount) || 0)))}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Pagado</span><span className="text-green-600">{fmt(parseFloat(editAmountPaid) || 0)}</span>
                </div>
                <div className="flex justify-between font-semibold text-red-600">
                  <span>Saldo</span>
                  <span>{fmt(Math.max(0, (editingOrder.total - (parseFloat(editDiscount) || 0)) - (parseFloat(editAmountPaid) || 0)))}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
                <textarea className="input-field text-xs resize-none h-16" placeholder="Notas del pedido..." value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingOrder(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button onClick={saveEdit} className="btn-primary flex-1 text-sm">Guardar Cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
