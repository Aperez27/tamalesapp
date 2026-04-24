import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import {
  Eye, EyeOff, Check, AlertCircle, User, Lock, LogOut,
  Users, Plus, Pencil, Trash2, X, KeyRound, ShieldCheck,
  MessageSquare, RotateCcw, Save, Copy
} from 'lucide-react';
import {
  getTemplate, saveTemplate, DEFAULT_TEMPLATE, buildMessage, BUSINESS_NAME
} from '../utils/whatsapp';
import type { Customer } from '../types';

type Role = 'admin' | 'cajero' | 'repartidor' | 'contador';
interface AppUser { id: number; username: string; role: Role }

const ROLE_INFO: Record<Role, { label: string; desc: string; color: string }> = {
  admin:      { label: 'Administrador', desc: 'Acceso total al sistema',          color: 'bg-orange-100 text-orange-700' },
  cajero:     { label: 'Cajero',        desc: 'POS, pedidos, entregas, clientes', color: 'bg-blue-100 text-blue-700' },
  repartidor: { label: 'Repartidor',    desc: 'Solo módulo de entregas',          color: 'bg-green-100 text-green-700' },
  contador:   { label: 'Contador',      desc: 'Cuentas, gastos, reportes',        color: 'bg-purple-100 text-purple-700' },
};

const SAMPLE_CUSTOMER: Customer = {
  id: 'preview',
  name: 'María González',
  phone: '3001234567',
  address: '',
  balance: 0,
  totalPurchases: 0,
  createdAt: new Date().toISOString(),
};

const VARIABLES = [
  { key: '{nombre}',         desc: 'Primer nombre del cliente' },
  { key: '{nombre_completo}',desc: 'Nombre completo del cliente' },
  { key: '{productos}',      desc: 'Lista de tamales activos con precio' },
  { key: '{fecha}',          desc: 'Fecha actual (día, mes)' },
  { key: '{negocio}',        desc: `Nombre del negocio (${BUSINESS_NAME})` },
];

export default function Settings() {
  const { username, isAdmin, changePassword, changeUsername, logout } = useAuth();
  const { state } = useApp();
  const [tab, setTab] = useState<'cuenta' | 'usuarios' | 'mensajes'>('cuenta');

  // ── Mi Cuenta ──────────────────────────────────────────────────────────────
  const [newUsername, setNewUsername] = useState(username);
  const [userSaved, setUserSaved] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleSaveUsername() {
    if (!newUsername.trim()) return;
    await changeUsername(newUsername);
    setUserSaved(true);
    setTimeout(() => setUserSaved(false), 2500);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg(null);
    if (newPass.length < 6) { setPassMsg({ type: 'err', text: 'La contraseña debe tener al menos 6 caracteres' }); return; }
    if (newPass !== confirmPass) { setPassMsg({ type: 'err', text: 'Las contraseñas no coinciden' }); return; }
    const ok = await changePassword(currentPass, newPass);
    if (!ok) { setPassMsg({ type: 'err', text: 'La contraseña actual es incorrecta' }); return; }
    setPassMsg({ type: 'ok', text: '¡Contraseña actualizada correctamente!' });
    setCurrentPass(''); setNewPass(''); setConfirmPass('');
    setTimeout(() => setPassMsg(null), 3000);
  }

  // ── Gestión de usuarios ────────────────────────────────────────────────────
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [resetUser, setResetUser] = useState<AppUser | null>(null);

  // Create form
  const [cUsername, setCUsername] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cRole, setCRole] = useState<Role>('cajero');
  const [cError, setCError] = useState('');
  const [cSaving, setCSaving] = useState(false);

  // Edit form
  const [eUsername, setEUsername] = useState('');
  const [eRole, setERole] = useState<Role>('cajero');
  const [eError, setEError] = useState('');
  const [eSaving, setESaving] = useState(false);

  // Reset password form
  const [rPass, setRPass] = useState('');
  const [rError, setRError] = useState('');
  const [rSaving, setRSaving] = useState(false);

  // ── Mensajes WhatsApp ─────────────────────────────────────────────────────
  const [template, setTemplate] = useState(() => getTemplate());
  const [templateSaved, setTemplateSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewText = useMemo(
    () => buildMessage(template, SAMPLE_CUSTOMER, state.products),
    [template, state.products]
  );

  function handleSaveTemplate() {
    saveTemplate(template);
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2500);
  }

  function handleResetTemplate() {
    if (!confirm('¿Restablecer la plantilla predeterminada? Se perderá la plantilla actual.')) return;
    setTemplate(DEFAULT_TEMPLATE);
    saveTemplate(DEFAULT_TEMPLATE);
  }

  function insertVariable(v: string) {
    setTemplate(prev => prev + v);
  }

  async function handleCopyPreview() {
    await navigator.clipboard.writeText(previewText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data as AppUser[]);
    } catch { /* silently fail if not admin */ }
    finally { setUsersLoading(false); }
  }

  useEffect(() => {
    if (isAdmin && tab === 'usuarios') loadUsers();
  }, [isAdmin, tab]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCError('');
    if (!cUsername.trim()) { setCError('El nombre de usuario es requerido'); return; }
    if (cPassword.length < 6) { setCError('La contraseña debe tener al menos 6 caracteres'); return; }
    setCSaving(true);
    try {
      const newUser = await api.createUser({ username: cUsername.trim(), password: cPassword, role: cRole });
      setUsers(prev => [...prev, newUser as AppUser]);
      setShowCreate(false);
      setCUsername(''); setCPassword(''); setCRole('cajero');
    } catch (err) {
      setCError((err as Error).message);
    } finally {
      setCSaving(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEError('');
    if (!eUsername.trim()) { setEError('El nombre de usuario es requerido'); return; }
    setESaving(true);
    try {
      const updated = await api.updateUser({ id: editUser.id, username: eUsername.trim(), role: eRole });
      setUsers(prev => prev.map(u => u.id === editUser.id ? updated as AppUser : u));
      setEditUser(null);
    } catch (err) {
      setEError((err as Error).message);
    } finally {
      setESaving(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    setRError('');
    if (rPass.length < 6) { setRError('Mínimo 6 caracteres'); return; }
    setRSaving(true);
    try {
      await api.resetUserPassword(resetUser.id, rPass);
      setResetUser(null);
      setRPass('');
    } catch (err) {
      setRError((err as Error).message);
    } finally {
      setRSaving(false);
    }
  }

  async function handleDelete(user: AppUser) {
    if (!confirm(`¿Eliminar el usuario "${user.username}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('cuenta')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'cuenta' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <User size={14} className="inline mr-1.5" />Mi Cuenta
        </button>
        <button
          onClick={() => setTab('mensajes')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'mensajes' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <MessageSquare size={14} className="inline mr-1.5" />Mensajes
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab('usuarios')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'usuarios' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users size={14} className="inline mr-1.5" />Usuarios
          </button>
        )}
      </div>

      {/* ── MI CUENTA ────────────────────────────────────────────────────────── */}
      {tab === 'cuenta' && (
        <>
          <div className="card space-y-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <User size={20} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Nombre de Usuario</h3>
                <p className="text-xs text-gray-400">El nombre con el que inicias sesión</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Nombre de usuario"
              />
              <button
                onClick={handleSaveUsername}
                disabled={!newUsername.trim() || newUsername === username}
                className="btn-primary px-4 flex items-center gap-1.5 text-sm"
              >
                {userSaved ? <><Check size={14} /> Guardado</> : 'Guardar'}
              </button>
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Lock size={20} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Cambiar Contraseña</h3>
                <p className="text-xs text-gray-400">Mínimo 6 caracteres</p>
              </div>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Contraseña actual</label>
                <div className="relative">
                  <input type={showCurrent ? 'text' : 'password'} className="input-field pr-10"
                    placeholder="••••••••" value={currentPass} onChange={e => setCurrentPass(e.target.value)} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-2.5 text-gray-400">
                    {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} className="input-field pr-10"
                    placeholder="••••••••" value={newPass} onChange={e => setNewPass(e.target.value)} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-2.5 text-gray-400">
                    {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {newPass && (
                  <div className="mt-1.5 flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                        newPass.length >= i * 3
                          ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-yellow-400' : i <= 3 ? 'bg-blue-400' : 'bg-green-500'
                          : 'bg-gray-100'
                      }`} />
                    ))}
                    <span className="text-xs text-gray-400 ml-1">
                      {newPass.length < 6 ? 'débil' : newPass.length < 9 ? 'regular' : newPass.length < 12 ? 'buena' : 'fuerte'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Confirmar nueva contraseña</label>
                <input type="password"
                  className={`input-field ${confirmPass && confirmPass !== newPass ? 'border-red-300 focus:ring-red-400' : ''}`}
                  placeholder="••••••••" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} autoComplete="new-password" />
                {confirmPass && confirmPass !== newPass && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>
              {passMsg && (
                <div className={`flex items-center gap-2 rounded-xl p-2.5 text-sm ${
                  passMsg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {passMsg.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
                  {passMsg.text}
                </div>
              )}
              <button type="submit" disabled={!currentPass || !newPass || !confirmPass} className="btn-primary w-full text-sm">
                Actualizar Contraseña
              </button>
            </form>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Sesión Activa</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Conectado como <strong>{username}</strong> · La sesión se cierra al cerrar el navegador
                </p>
              </div>
              <button onClick={logout} className="btn-danger text-sm flex items-center gap-1.5">
                <LogOut size={14} /> Salir
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── MENSAJES WHATSAPP ────────────────────────────────────────────────── */}
      {tab === 'mensajes' && (
        <>
          {/* Variable reference */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={16} className="text-green-500" />
              <h3 className="font-semibold text-gray-800 text-sm">Variables disponibles</h3>
              <span className="text-xs text-gray-400">— haz clic para insertar</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map(v => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  title={v.desc}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-mono text-green-700 transition-colors"
                >
                  {v.key}
                  <span className="font-sans text-gray-400 text-[10px] hidden sm:inline">— {v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">Plantilla del mensaje</h3>
              <button
                onClick={handleResetTemplate}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                <RotateCcw size={12} /> Restablecer
              </button>
            </div>
            <textarea
              className="input-field w-full font-mono text-xs leading-relaxed resize-none"
              rows={10}
              value={template}
              onChange={e => setTemplate(e.target.value)}
              placeholder="Escribe el mensaje aquí. Usa las variables de arriba."
              spellCheck={false}
            />
            <button
              onClick={handleSaveTemplate}
              className="btn-primary w-full text-sm flex items-center justify-center gap-2"
            >
              {templateSaved
                ? <><Check size={14} /> ¡Plantilla guardada!</>
                : <><Save size={14} /> Guardar plantilla</>
              }
            </button>
          </div>

          {/* Live preview */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">Vista previa</h3>
                <p className="text-xs text-gray-400">Como lo verá el cliente (cliente de prueba: {SAMPLE_CUSTOMER.name})</p>
              </div>
              <button
                onClick={handleCopyPreview}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2 py-1 transition-colors"
              >
                {copied ? <><Check size={12} className="text-green-500" /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
            {/* WhatsApp bubble */}
            <div className="bg-[#e5ddd5] rounded-xl p-4">
              <div className="bg-white rounded-2xl rounded-tl-sm shadow px-4 py-3 max-w-xs text-xs text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">
                {previewText}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── USUARIOS (admin only) ─────────────────────────────────────────────── */}
      {tab === 'usuarios' && isAdmin && (
        <>
          {/* Role reference */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-orange-500" />
              <h3 className="font-semibold text-gray-800 text-sm">Permisos por Rol</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ROLE_INFO) as [Role, typeof ROLE_INFO[Role]][]).map(([role, info]) => (
                <div key={role} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${info.color}`}>{info.label}</span>
                  <p className="text-xs text-gray-500 leading-tight">{info.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* User list */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Usuarios del Sistema</h3>
              <button onClick={() => { setShowCreate(true); setCUsername(''); setCPassword(''); setCRole('cajero'); setCError(''); }}
                className="btn-primary text-sm flex items-center gap-1.5">
                <Plus size={14} /> Nuevo Usuario
              </button>
            </div>

            {usersLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
            ) : (
              <div className="space-y-2">
                {users.map(user => {
                  const info = ROLE_INFO[user.role] ?? ROLE_INFO.cajero;
                  return (
                    <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                      <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-sm font-bold text-orange-700 flex-shrink-0">
                        {user.username[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{user.username}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>{info.label}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditUser(user); setEUsername(user.username); setERole(user.role); setEError(''); }}
                          className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { setResetUser(user); setRPass(''); setRError(''); }}
                          className="p-1.5 hover:bg-yellow-50 rounded-lg text-yellow-600" title="Restablecer contraseña">
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MODAL: Crear usuario ───────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">Crear Usuario</h3>
              <button onClick={() => setShowCreate(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nombre de usuario</label>
                <input className="input-field" placeholder="usuario123" value={cUsername} onChange={e => setCUsername(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Contraseña</label>
                <input type="password" className="input-field" placeholder="Mín. 6 caracteres" value={cPassword} onChange={e => setCPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Rol</label>
                <select className="input-field" value={cRole} onChange={e => setCRole(e.target.value as Role)}>
                  {(Object.entries(ROLE_INFO) as [Role, typeof ROLE_INFO[Role]][]).map(([r, info]) => (
                    <option key={r} value={r}>{info.label} — {info.desc}</option>
                  ))}
                </select>
              </div>
              {cError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" disabled={cSaving} className="btn-primary flex-1 text-sm">
                  {cSaving ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Editar usuario ─────────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">Editar Usuario</h3>
              <button onClick={() => setEditUser(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nombre de usuario</label>
                <input className="input-field" value={eUsername} onChange={e => setEUsername(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Rol</label>
                <select className="input-field" value={eRole} onChange={e => setERole(e.target.value as Role)}>
                  {(Object.entries(ROLE_INFO) as [Role, typeof ROLE_INFO[Role]][]).map(([r, info]) => (
                    <option key={r} value={r}>{info.label} — {info.desc}</option>
                  ))}
                </select>
              </div>
              {eError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{eError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditUser(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" disabled={eSaving} className="btn-primary flex-1 text-sm">
                  {eSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Restablecer contraseña ─────────────────────────────────────── */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-bold text-gray-800">Restablecer Contraseña</h3>
                <p className="text-xs text-gray-400">Usuario: {resetUser.username}</p>
              </div>
              <button onClick={() => setResetUser(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleResetPassword} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nueva contraseña</label>
                <input type="password" className="input-field" placeholder="Mín. 6 caracteres"
                  value={rPass} onChange={e => setRPass(e.target.value)} autoComplete="new-password" autoFocus />
              </div>
              {rError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{rError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setResetUser(null)} className="btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" disabled={rSaving} className="btn-primary flex-1 text-sm">
                  {rSaving ? 'Guardando...' : 'Restablecer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
