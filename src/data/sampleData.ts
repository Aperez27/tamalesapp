import type { Product } from '../types';

// Solo los productos base — sin clientes ni pedidos de muestra
export const initialProducts: Product[] = [
  { id: 'p1', name: 'Tamal de Cerdo',    category: 'tamal',    price: 4500,  cost: 2200, description: 'Tamal tradicional con cerdo y papa', active: true, emoji: '🌽' },
  { id: 'p2', name: 'Tamal de Pollo',    category: 'tamal',    price: 4000,  cost: 1900, description: 'Tamal de masa con pollo desmenuzado', active: true, emoji: '🌽' },
  { id: 'p3', name: 'Tamal de Pipián',   category: 'tamal',    price: 5000,  cost: 2500, description: 'Tamal especial de pipián',            active: true, emoji: '🌽' },
  { id: 'p4', name: 'Tamal Vegetariano', category: 'tamal',    price: 3800,  cost: 1800, description: 'Tamal sin carne con verduras',         active: true, emoji: '🌿' },
  { id: 'p5', name: 'Tamal de Costilla', category: 'tamal',    price: 5500,  cost: 2800, description: 'Tamal con costilla de cerdo',          active: true, emoji: '🌽' },
  { id: 'p6', name: 'Tamal Especial',    category: 'tamal',    price: 6000,  cost: 3000, description: 'Tamal con cerdo y pollo mixto',        active: true, emoji: '⭐' },
  { id: 'p7', name: 'Docena Cerdo',      category: 'tamal',    price: 50000, cost: 25000, description: 'Docena de tamales de cerdo',         active: true, emoji: '📦' },
  { id: 'p8', name: 'Docena Pollo',      category: 'tamal',    price: 45000, cost: 22000, description: 'Docena de tamales de pollo',         active: true, emoji: '📦' },
  { id: 'p9', name: 'Chocolate Caliente',category: 'bebida',   price: 2000,  cost: 600,  description: 'Taza de chocolate caliente',           active: true, emoji: '☕' },
  { id: 'p10',name: 'Agua Panela',       category: 'bebida',   price: 1500,  cost: 400,  description: 'Agua panela con limón',                active: true, emoji: '🍵' },
  { id: 'p11',name: 'Café',              category: 'bebida',   price: 1500,  cost: 350,  description: 'Tinto o café con leche',               active: true, emoji: '☕' },
  { id: 'p12',name: 'Arepa',             category: 'adicional',price: 1500,  cost: 500,  description: 'Arepa de maíz',                        active: true, emoji: '🫓' },
];

export const initialCustomers  = [] as const;
export const initialOrders     = [] as const;
export const initialPayments   = [] as const;
export const initialDeliveries = [] as const;
