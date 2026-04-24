import type { Customer, Product } from '../types';
import { fmt } from './helpers';

export const BUSINESS_NAME = 'Tamales Donde Mi Abue';
export const TEMPLATE_KEY  = 'tamales_msg_template_v1';

export const DEFAULT_TEMPLATE =
`Hola {nombre} 🌽, le saluda *${BUSINESS_NAME}*.

Queremos ofrecerle nuestros deliciosos tamales, preparados artesanalmente con mucho amor y los mejores ingredientes.

📋 *Nuestro menú disponible:*
{productos}

📅 Para pedidos: {fecha}

¿Le gustaría realizar su pedido? Con gusto le atendemos. Solo responda este mensaje o escríbanos. 🙏

_${BUSINESS_NAME}_`;

export function getTemplate(): string {
  try {
    return localStorage.getItem(TEMPLATE_KEY) ?? DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function saveTemplate(t: string): void {
  try { localStorage.setItem(TEMPLATE_KEY, t); } catch {}
}

export function buildMessage(template: string, customer: Customer, products: Product[]): string {
  const activos = products.filter(p => p.active && p.category === 'tamal');
  const lista = activos.length > 0
    ? activos.map(p => `• *${p.name}*: ${fmt(p.price)}`).join('\n')
    : '• Tamales artesanales disponibles';

  const fecha = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const nombre = customer.name.split(' ')[0];

  return template
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{nombre_completo\}/g, customer.name)
    .replace(/\{productos\}/g, lista)
    .replace(/\{fecha\}/g, fecha)
    .replace(/\{negocio\}/g, BUSINESS_NAME);
}

export function whatsappUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '');
  const intl = clean.startsWith('57') ? clean : `57${clean.slice(-10)}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}
