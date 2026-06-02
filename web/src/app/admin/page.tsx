'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loja, Atendente, AgenteConfig, InstanciaWhatsApp } from '@/types';
import {
  Store,
  Users,
  UserCog,
  Bot,
  Workflow,
  Smartphone,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

type Tab = 'lojas' | 'atendentes' | 'agente' | 'fluxo' | 'whatsapp';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085';

export default function AdminPage() {
  const { token, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('lojas');

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Acesso restrito a administradores.
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'lojas', label: 'Lojas', icon: <Store className="h-4 w-4" /> },
    { id: 'atendentes', label: 'Atendentes', icon: <Users className="h-4 w-4" /> },
    { id: 'agente', label: 'Agente IA', icon: <Bot className="h-4 w-4" /> },
    { id: 'fluxo', label: 'Fluxo', icon: <Workflow className="h-4 w-4" /> },
    { id: 'whatsapp', label: 'WhatsApp', icon: <Smartphone className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      <div className="flex gap-1 overflow-x-auto border-b border-industrial-pale/60 bg-white/80 px-3 py-2 backdrop-blur-sm md:px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 ${
              activeTab === t.id
                ? 'bg-industrial-black text-white shadow-industrial'
                : 'text-industrial-medium hover:bg-industrial-surface hover:text-industrial-dark'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {activeTab === 'lojas' && <LojasPanel token={token} />}
        {activeTab === 'atendentes' && <AtendentesPanel token={token} />}
        {activeTab === 'agente' && <AgentePanel token={token} />}
        {activeTab === 'fluxo' && <FluxoPanel />}
        {activeTab === 'whatsapp' && <WhatsAppPanel token={token} />}
      </div>
    </div>
  );
}

/* ---------- Lojas ---------- */
function LojasPanel({ token }: { token: string | null }) {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Loja | null>(null);
  const [form, setForm] = useState({ nome: '', tipo: 'vendas' as Loja['tipo'], endereco: '', telefone: '' });

  const fetchLojas = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/lojas`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setLojas(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLojas();
  }, [fetchLojas]);

  const handleSave = async () => {
    if (!token || !form.nome.trim()) return;
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `${API_BASE}/api/lojas/${editing.id}` : `${API_BASE}/api/lojas`;
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ nome: '', tipo: 'vendas', endereco: '', telefone: '' });
        setEditing(null);
        fetchLojas();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm('Excluir loja?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/lojas/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) fetchLojas();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">{editing ? 'Editar Loja' : 'Nova Loja'}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
          />
          <select
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as Loja['tipo'] }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
          >
            <option value="vendas">Vendas</option>
            <option value="locacao">Locação</option>
            <option value="manutencao">Manutenção</option>
          </select>
          <input
            placeholder="Endereço"
            value={form.endereco}
            onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
          />
          <input
            placeholder="Telefone"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            Salvar
          </button>
          {editing && (
            <button
              onClick={() => { setEditing(null); setForm({ nome: '', tipo: 'vendas', endereco: '', telefone: '' }); }}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {loading && lojas.length === 0 && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
        {lojas.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
            <div>
              <div className="text-sm font-medium text-gray-900">{l.nome}</div>
              <div className="text-xs text-gray-500">{l.tipo} — {l.telefone}</div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { setEditing(l); setForm({ nome: l.nome, tipo: l.tipo, endereco: l.endereco || '', telefone: l.telefone || '' }); }}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(l.id)}
                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Atendentes ---------- */
function AtendentesPanel({ token }: { token: string | null }) {
  const [atendentes, setAtendentes] = useState<Atendente[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Atendente | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', role: 'atendente' as 'admin' | 'atendente' });
  const [alocacoes, setAlocacoes] = useState<Record<string, string[]>>({});

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [aRes, lRes] = await Promise.all([
        fetch(`${API_BASE}/api/atendentes`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${API_BASE}/api/lojas`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ]);
      if (aRes.ok) {
        const data: Atendente[] = await aRes.json();
        setAtendentes(data);
        const alc: Record<string, string[]> = {};
        data.forEach((at) => {
          if (at.lojas) alc[at.id] = at.lojas.map((l) => l.loja_id);
        });
        setAlocacoes(alc);
      }
      if (lRes.ok) setLojas(await lRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!token || !form.nome.trim() || !form.email.trim()) return;
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `${API_BASE}/api/atendentes/${editing.id}` : `${API_BASE}/api/atendentes`;
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ nome: '', email: '', role: 'atendente' });
        setEditing(null);
        fetchData();
      }
    } catch {
      // ignore
    }
  };

  const toggleAlocacao = async (atendenteId: string, lojaId: string) => {
    if (!token) return;
    const current = alocacoes[atendenteId] || [];
    const action = current.includes(lojaId) ? 'remover' : 'adicionar';
    try {
      const res = await fetch(`${API_BASE}/api/atendentes/${atendenteId}/lojas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ loja_id: lojaId, action }),
      });
      if (res.ok) {
        setAlocacoes((prev) => {
          const next = { ...prev };
          const list = next[atendenteId] ? [...next[atendenteId]] : [];
          if (action === 'adicionar') list.push(lojaId);
          else next[atendenteId] = list.filter((id) => id !== lojaId);
          next[atendenteId] = list;
          return next;
        });
        fetchData();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">{editing ? 'Editar Atendente' : 'Novo Atendente'}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.role === 'admin'}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.checked ? 'admin' : 'atendente' }))}
            />
            Administrador
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            Salvar
          </button>
          {editing && (
            <button
              onClick={() => { setEditing(null); setForm({ nome: '', email: '', role: 'atendente' }); }}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {loading && atendentes.length === 0 && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
        {atendentes.map((at) => (
          <div key={at.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">{at.nome}</div>
                <div className="text-xs text-gray-500">{at.email} {at.role === 'admin' && '• Admin'}</div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditing(at); setForm({ nome: at.nome, email: at.email, role: at.role }); }}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-gray-600">Alocações:</div>
              <div className="flex flex-wrap gap-2">
                {lojas.map((l) => {
                  const active = (alocacoes[at.id] || []).includes(l.id);
                  return (
                    <button
                      key={l.id}
                      onClick={() => toggleAlocacao(at.id, l.id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        active
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {l.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Agente ---------- */
function AgentePanel({ token }: { token: string | null }) {
  const [config, setConfig] = useState<AgenteConfig>({
    nome: 'Principal',
    prompt_sistema: '',
    modelo: 'gpt-4o-mini',
    temperatura: 0.7,
    tools: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toolInput, setToolInput] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_BASE}/api/admin/agent-config`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setConfig(data);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/admin/agent-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(config),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const addTool = () => {
    if (!toolInput.trim()) return;
    setConfig((c) => ({ ...c, tools: [...c.tools, toolInput.trim()] }));
    setToolInput('');
  };

  const removeTool = (idx: number) => {
    setConfig((c) => ({ ...c, tools: c.tools.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-4">
      {loading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nome do Agente</label>
          <input
            value={config.nome}
            onChange={(e) => setConfig((c) => ({ ...c, nome: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Prompt do Sistema</label>
          <textarea
            value={config.prompt_sistema}
            onChange={(e) => setConfig((c) => ({ ...c, prompt_sistema: e.target.value }))}
            rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Modelo</label>
            <select
              value={config.modelo}
              onChange={(e) => setConfig((c) => ({ ...c, modelo: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            >
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Temperatura ({config.temperatura})</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={config.temperatura}
              onChange={(e) => setConfig((c) => ({ ...c, temperatura: parseFloat(e.target.value) }))}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tools</label>
          <div className="flex gap-2">
            <input
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTool(); }}
              placeholder="Nome da tool"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={addTool}
              className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {config.tools.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {t}
                <button onClick={() => removeTool(i)} className="text-blue-400 hover:text-blue-600"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configuração
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Fluxo ---------- */
function FluxoPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Visualização simplificada dos agentes e delegações.</p>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <svg viewBox="0 0 600 300" className="w-full">
          {/* Principal */}
          <rect x="240" y="20" width="120" height="50" rx="8" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
          <text x="300" y="50" textAnchor="middle" fontSize="12" fill="#1e3a8a">Agente Principal</text>

          {/* Lines */}
          <line x1="300" y1="70" x2="120" y2="130" stroke="#9ca3af" strokeWidth="2" />
          <line x1="300" y1="70" x2="300" y2="130" stroke="#9ca3af" strokeWidth="2" />
          <line x1="300" y1="70" x2="480" y2="130" stroke="#9ca3af" strokeWidth="2" />

          {/* Support agents */}
          <rect x="60" y="130" width="120" height="50" rx="8" fill="#f3e8ff" stroke="#9333ea" strokeWidth="2" />
          <text x="120" y="160" textAnchor="middle" fontSize="12" fill="#581c87">Catálogo</text>

          <rect x="240" y="130" width="120" height="50" rx="8" fill="#f3e8ff" stroke="#9333ea" strokeWidth="2" />
          <text x="300" y="160" textAnchor="middle" fontSize="12" fill="#581c87">Preços</text>

          <rect x="420" y="130" width="120" height="50" rx="8" fill="#f3e8ff" stroke="#9333ea" strokeWidth="2" />
          <text x="480" y="160" textAnchor="middle" fontSize="12" fill="#581c87">Estoque</text>

          {/* Arrows */}
          <polygon points="115,125 120,130 125,125" fill="#9ca3af" />
          <polygon points="295,125 300,130 305,125" fill="#9ca3af" />
          <polygon points="475,125 480,130 485,125" fill="#9ca3af" />
        </svg>
      </div>
    </div>
  );
}

/* ---------- WhatsApp ---------- */
function WhatsAppPanel({ token }: { token: string | null }) {
  const [instances, setInstances] = useState<InstanciaWhatsApp[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInstances = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp-status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setInstances(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const handleReconnect = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/admin/whatsapp-status/${id}/reconnect`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      fetchInstances();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Instâncias WhatsApp</h3>
        <button
          onClick={fetchInstances}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-2">
        {instances.map((inst) => (
          <div key={inst.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              {inst.status === 'conectada' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : inst.status === 'conectando' ? (
                <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <div className="text-sm font-medium text-gray-900">{inst.nome}</div>
                <div className="text-xs text-gray-500">{inst.numero} — {inst.status}</div>
              </div>
            </div>
            {inst.status !== 'conectada' && (
              <button
                onClick={() => handleReconnect(inst.id)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Reconectar
              </button>
            )}
          </div>
        ))}
        {instances.length === 0 && !loading && (
          <div className="text-sm text-gray-400">Nenhuma instância configurada.</div>
        )}
      </div>
    </div>
  );
}
