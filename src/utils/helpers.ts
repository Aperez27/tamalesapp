export const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const genId = (prefix = 'id') => `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

export const statusLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  en_camino: 'En Camino',
  fallido: 'Fallido',
};

export const payStatusLabel: Record<string, string> = {
  pagado: 'Pagado',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
  fiado: 'Fiado',
};

export const methodLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  tarjeta: 'Tarjeta',
  fiado: 'Fiado',
};

export const statusColor: Record<string, string> = {
  pendiente: 'badge-warning',
  en_preparacion: 'badge-info',
  listo: 'badge-success',
  entregado: 'badge-gray',
  cancelado: 'badge-danger',
  en_camino: 'badge-info',
  fallido: 'badge-danger',
  pagado: 'badge-success',
  parcial: 'badge-warning',
  fiado: 'badge-danger',
};
