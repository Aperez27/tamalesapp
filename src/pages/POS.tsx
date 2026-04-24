import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, genId } from '../utils/helpers';
import { api } from '../api/client';
import type { Order, OrderItem, PaymentMethod, Delivery } from '../types';
import { Plus, Minus, Trash2, Check, User, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { BARRIOS_BARRANCABERMEJA } from '../data/barrios';

export default function POS() {
  const { state, dispatch } = useApp();
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount] = useState('');
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [success, setSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState('');

  const products = state.products.filter(p => p.active);
  const tamales = products.filter(p => p.category === 'tamal');
  const bebidas = products.filter(p => p.category === 'bebida');
  const adicionales = products.filter(p => p.category === 'adicional');

  const filteredCustomers = useMemo(() =>
    state.customers.filter(c =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
    ).slice(0, 8),
    [state.customers, customerSearch]
  );

  const selectedCustomer = state.customers.find(c => c.id === selectedCustomerId);
  const disc = parseFloat(discount) || 0;
  const total = cart.reduce((s, it) => s + it.subtotal, 0);
  const finalTotal = Math.max(0, total - disc);
  const paid = parseFloat(amountPaid) || 0;
  const balance = finalTotal - paid;
  const change = paid > finalTotal ? paid - finalTotal : 0;

  function addToCart(productId: string) {
    const prod = state.products.find(p => p.id === productId)!;
    setCart(prev => {
      const existing = prev.find(it => it.productId === productId);
      if (existing) {
        return prev.map(it => it.productId === productId
          ? { ...it, quantity: it.quantity + 1, subtotal: (it.quantity + 1) * it.unitPrice }
          : it
        );
      }
      return [...prev, { productId: prod.id, productName: prod.name, quantity: 1, unitPrice: prod.price, subtotal: prod.price }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart(prev => prev
      .map(it => it.productId === productId
        ? { ...it, quantity: it.quantity + delta, subtotal: (it.quantity + delta) * it.unitPrice }
        : it
      )
      .filter(it => it.quantity > 0)
    );
  }

  function selectCustomer(id: string) {
    setSelectedCustomerId(id);
    const c = state.customers.find(c => c.id === id);
    if (c) {
      setCustomerSearch(c.name);
      setDeliveryAddress(c.address);
      setDeliveryNeighborhood(c.neighborhood ?? '');
    }
    setShowCustomerList(false);
  }

  async function handleSubmit() {
    if (cart.length === 0) return;
    const now = useCustomDate && customDate
      ? format(new Date(customDate), "yyyy-MM-dd'T'HH:mm:ss")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
    const oid = genId('o');
    const payStatus = paid >= finalTotal ? 'pagado' : paid === 0 ? (paymentMethod === 'fiado' ? 'fiado' : 'pendiente') : 'parcial';

    const order: Order = {
      id: oid,
      customerId: selectedCustomerId || 'walk-in',
      customerName: selectedCustomer?.name || 'Cliente General',
      items: cart,
      total,
      discount: disc,
      finalTotal,
      status: 'pendiente',
      paymentStatus: payStatus,
      paymentMethod,
      amountPaid: paid,
      balance: Math.max(0, balance),
      createdAt: now,
      updatedAt: now,
      isDelivery,
      deliveryAddress: isDelivery ? deliveryAddress : undefined,
      notes,
    };

    try {
      await api.createOrder(order);
      dispatch({ type: 'ADD_ORDER', payload: order });
      if (paid > 0) {
        const payment = {
          id: genId('pay'), customerId: selectedCustomerId || 'walk-in',
          customerName: order.customerName, orderId: oid, amount: paid,
          method: paymentMethod, date: now,
        };
        await api.createPayment(payment);
        dispatch({ type: 'ADD_PAYMENT', payload: payment });
      }
      if (isDelivery) {
        const scheduledDate = deliveryDate
          ? format(new Date(deliveryDate), "yyyy-MM-dd'T'HH:mm:ss")
          : now;
        const delivery: Delivery = {
          id: genId('del'),
          orderId: oid,
          customerName: order.customerName,
          address: deliveryAddress,
          neighborhood: deliveryNeighborhood,
          items: cart,
          status: 'pendiente',
          scheduledDate,
          phone: selectedCustomer?.phone ?? '',
          notes,
        };
        await api.createDelivery(delivery);
        dispatch({ type: 'ADD_DELIVERY', payload: delivery });
      }
    } catch (e) {
      alert('Error guardando el pedido: ' + (e as Error).message);
      return;
    }

    setLastOrderId(oid);
    setSuccess(true);
    setCart([]);
    setDiscount('');
    setAmountPaid('');
    setNotes('');
    setDeliveryDate('');
    setDeliveryNeighborhood('');
    setUseCustomDate(false);
    setCustomDate('');
    setTimeout(() => setSuccess(false), 4000);
  }

  const ProductButton = ({ p }: { p: typeof products[0] }) => (
    <button onClick={() => addToCart(p.id)}
      className="card text-left hover:shadow-md hover:border-orange-200 transition-all active:scale-95 p-3">
      <div className="text-2xl mb-1">{p.emoji}</div>
      <p className="text-xs font-semibold text-gray-700 leading-tight">{p.name}</p>
      <p className="text-sm font-bold text-orange-600 mt-1">{fmt(p.price)}</p>
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Products panel */}
      <div className="flex-1 space-y-4 overflow-y-auto">
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
            <Check className="text-green-600" size={18} />
            <span className="text-green-700 font-medium text-sm">¡Pedido #{lastOrderId.slice(-6)} registrado exitosamente!</span>
          </div>
        )}

        <Section title="🌽 Tamales">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {tamales.map(p => <ProductButton key={p.id} p={p} />)}
          </div>
        </Section>
        <Section title="☕ Bebidas">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {bebidas.map(p => <ProductButton key={p.id} p={p} />)}
          </div>
        </Section>
        <Section title="🫓 Adicionales">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {adicionales.map(p => <ProductButton key={p.id} p={p} />)}
          </div>
        </Section>
      </div>

      {/* Cart panel */}
      <div className="w-full lg:w-80 xl:w-96 card flex flex-col gap-3 lg:h-[calc(100vh-8rem)] overflow-y-auto">
        <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
          <ShoppingIcon /> Carrito de Venta
        </h3>

        {/* Customer selector */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <User size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Cliente</span>
          </div>
          <div className="relative">
            <input
              className="input-field pr-8"
              placeholder="Buscar cliente o 'Cliente General'..."
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setShowCustomerList(true); setSelectedCustomerId(''); }}
              onFocus={() => setShowCustomerList(true)}
            />
            {customerSearch && (
              <button className="absolute right-2 top-2" onClick={() => { setCustomerSearch(''); setSelectedCustomerId(''); }}>
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>
          {showCustomerList && filteredCustomers.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
              {filteredCustomers.map(c => (
                <button key={c.id} onClick={() => selectCustomer(c.id)}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone}</p>
                  </div>
                  {c.balance < 0 && <span className="text-xs text-red-500">Debe {fmt(Math.abs(c.balance))}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Selecciona productos...</p>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{item.productName}</p>
                  <p className="text-xs text-gray-500">{fmt(item.unitPrice)} c/u</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.productId, -1)} className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50">
                    <Minus size={10} />
                  </button>
                  <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.productId, 1)} className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-green-50">
                    <Plus size={10} />
                  </button>
                </div>
                <span className="text-sm font-semibold text-orange-600 w-16 text-right">{fmt(item.subtotal)}</span>
                <button onClick={() => setCart(c => c.filter(i => i.productId !== item.productId))}>
                  <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">{fmt(total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Descuento</span>
            <input
              type="number"
              className="input-field h-7 text-xs py-1 w-24 ml-auto text-right"
              placeholder="0"
              value={discount}
              onChange={e => setDiscount(e.target.value)}
            />
          </div>
          <div className="flex justify-between text-base font-bold text-orange-700 bg-orange-50 rounded-lg p-2">
            <span>Total</span>
            <span>{fmt(finalTotal)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="space-y-2">
          <select className="input-field" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
            <option value="efectivo">💵 Efectivo</option>
            <option value="nequi">📱 Nequi</option>
            <option value="daviplata">📱 Daviplata</option>
            <option value="transferencia">🏦 Transferencia</option>
            <option value="tarjeta">💳 Tarjeta</option>
            <option value="fiado">📝 Fiado</option>
          </select>
          <input
            type="number"
            className="input-field"
            placeholder="Monto recibido..."
            value={amountPaid}
            onChange={e => setAmountPaid(e.target.value)}
          />
          {paid > 0 && paid < finalTotal && (
            <p className="text-xs text-red-500">Saldo pendiente: {fmt(balance)}</p>
          )}
          {change > 0 && (
            <p className="text-xs text-green-600 font-semibold">Cambio: {fmt(change)}</p>
          )}
        </div>

        {/* Delivery toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDelivery(v => !v)}
            className={`w-10 h-5 rounded-full transition-colors ${isDelivery ? 'bg-orange-500' : 'bg-gray-200'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${isDelivery ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-sm text-gray-600">Domicilio</span>
        </div>

        {isDelivery && (
          <div className="space-y-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-700">📦 Datos del domicilio</p>
            <input
              className="input-field text-xs"
              placeholder="Dirección de entrega..."
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
            />
            <input
              className="input-field text-xs"
              list="barrios-pos"
              placeholder="Barrio..."
              value={deliveryNeighborhood}
              onChange={e => setDeliveryNeighborhood(e.target.value)}
            />
            <datalist id="barrios-pos">
              {BARRIOS_BARRANCABERMEJA.map(b => <option key={b} value={b} />)}
            </datalist>
            <div>
              <label className="text-xs text-blue-600 block mb-1">Fecha y hora de entrega</label>
              <input
                type="datetime-local"
                className="input-field text-xs"
                value={deliveryDate}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                onChange={e => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Fecha retroactiva */}
        <div className="border border-dashed border-gray-200 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-gray-400" />
            <span className="text-xs text-gray-500 flex-1">Registro con fecha pasada</span>
            <button
              onClick={() => setUseCustomDate(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${useCustomDate ? 'bg-orange-500' : 'bg-gray-200'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${useCustomDate ? 'translate-x-4' : ''}`} />
            </button>
          </div>
          {useCustomDate && (
            <input
              type="datetime-local"
              className="input-field text-xs"
              value={customDate}
              max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              onChange={e => setCustomDate(e.target.value)}
            />
          )}
        </div>

        <textarea
          className="input-field text-xs resize-none h-12"
          placeholder="Notas del pedido..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          disabled={cart.length === 0}
          className="btn-primary w-full text-center text-base py-3 flex items-center justify-center gap-2"
        >
          <Check size={18} /> Confirmar Pedido {cart.length > 0 && `(${fmt(finalTotal)})`}
        </button>

        {cart.length > 0 && (
          <button onClick={() => setCart([])} className="btn-secondary w-full text-sm text-center">
            <Trash2 size={14} className="inline mr-1" /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-gray-700 text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ShoppingIcon() {
  return (
    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
