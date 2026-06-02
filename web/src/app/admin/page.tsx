'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Loja, Atendente, AgenteConfig, InstanciaWhatsApp } from '@/types';
import {
  Store,
  Users,
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
  ArrowLeft,
} from 'lucide-react';

type Tab = 'lojas' | 'atendentes' | 'agente' | 'fluxo' | 'whatsapp';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085';

export default function AdminPage() {
  const { token, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('lojas');

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-industrial-medium">
        <p className="text-sm font-semibold">Acesso restrito a administradores.</p>
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
    <div className="flex h-full flex-col overflow-hidden">
      {/* Admin Header with PROMINENT Back Button */}
      <div className="flex-none p-5 bg-industrial-white border-b border-industrial-pale shadow-industrial-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/conversations"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-industrial-yellow text-industrial-dark font-semibold text-sm shadow-industrial-sm hover:shadow-industrial-md hover:brightness-105 active:scale-[0.98] transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Conversas
          </Link>
          <div>
            <h1 className="text-xl font-bold text-industrial-black">Administração</h1>
            <p className="text-[12px] text-industrial-medium mt-0.5">Gerencie lojas, atendentes e configurações</p>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex-none bg-industrial-white border-b border-industrial-pale">
        <div className="flex overflow-x-auto px-5 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`admin-tab px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-200 ${
                activeTab === t.id
                  ? 'border-industrial-yellow text-industrial-black'
                  : 'border-transparent text-industrial-medium hover:text-industrial-gray'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Admin Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-5">
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
    <div className="tab-content max-w-4xl">
      {/* Form Card */}
      <div className="p-6 rounded-2xl bg-industrial-white border border-industrial-pale shadow-industrial-sm mb-5">
        <h3 className="text-[15px] font-semibold text-industrial-black mb-4">{editing ? 'Editar Loja' : 'Nova Loja'}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            className="px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200"
          />
          <select
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as Loja['tipo'] }))}
            className="px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200"
          >
            <option value="vendas">Vendas</option>
            <option value="locacao">Locação</option>
            <option value="manutencao">Manutenção</option>
          </select>
          <input
            placeholder="Endereço"
            value={form.endereco}
            onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
            className="px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200"
          />
          <input
            placeholder="Telefone"
            value={form.telefone}
            onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
            className="px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-industrial-yellow text-industrial-dark text-sm font-semibold shadow-industrial-sm hover:shadow-industrial-md hover:brightness-105 active:scale-[0.98] transition-all duration-200"
          >
            <Save className="h-4 w-4" />
            Salvar
          </button>
          {editing && (
            <button
              onClick={() => { setEditing(null); setForm({ nome: '', tipo: 'vendas', endereco: '', telefone: '' }); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-industrial-gray hover:bg-industrial-surface transition-all duration-200"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && lojas.length === 0 && (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-industrial-yellow" />
          </div>
        )}
        {lojas.map((l) => (
          <div key={l.id} className="p-5 rounded-2xl bg-industrial-white border border-industrial-pale shadow-industrial-sm hover:shadow-industrial-md transition-all duration-200 hover:scale-[1.01]">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-industrial-surface flex items-center justify-center">
                <Store className="w-5 h-5 text-industrial-gray" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-industrial-green-pale text-industrial-green border border-industrial-green/20">Ativa</span>
            </div>
            <h3 className="text-[15px] font-semibold text-industrial-black mb-1">{l.nome}</h3>
            <p className="text-[12px] text-industrial-medium capitalize mb-2">{l.tipo}</p>
            <div className="space-y-1.5 text-[12px] text-industrial-gray">
              <p className="flex items-start gap-1.5">
                <svg className="w-3.5 h-3.5 text-industrial-light mt-0.5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {l.endereco}
              </p>
              <p className="flex items-center gap-1.5 font-mono">
                <svg className="w-3.5 h-3.5 text-industrial-light flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                {l.telefone}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-industrial-pale/60 flex gap-2">
              <button
                onClick={() => { setEditing(l); setForm({ nome: l.nome, tipo: l.tipo, endereco: l.endereco || '', telefone: l.telefone || '' }); }}
                className="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium bg-industrial-surface text-industrial-gray hover:bg-industrial-pale transition-all duration-200 active:scale-[0.98]"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(l.id)}
                className="px-3 py-2 rounded-lg text-[12px] font-medium bg-industrial-red-pale text-industrial-red border border-industrial-red/15 hover:bg-red-50 transition-all duration-200 active:scale-[0.98]"
              >
                Desativar
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
    <div className="tab-content max-w-4xl">
      {/* Form */}
      <div className="p-6 rounded-2xl bg-industrial-white border border-industrial-pale shadow-industrial-sm mb-5">
        <h3 className="text-[15px] font-semibold text-industrial-black mb-4">{editing ? 'Editar Atendente' : 'Novo Atendente'}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            className="px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200"
          />
          <label className="flex items-center gap-2 text-sm text-industrial-gray px-1">
            <input
              type="checkbox"
              checked={form.role === 'admin'}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.checked ? 'admin' : 'atendente' }))}
              className="w-4 h-4 accent-industrial-yellow"
            />
            Administrador
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-industrial-yellow text-industrial-dark text-sm font-semibold shadow-industrial-sm hover:shadow-industrial-md hover:brightness-105 active:scale-[0.98] transition-all duration-200"
          >
            <Save className="h-4 w-4" />
            Salvar
          </button>
          {editing && (
            <button
              onClick={() => { setEditing(null); setForm({ nome: '', email: '', role: 'atendente' }); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-industrial-gray hover:bg-industrial-surface transition-all duration-200"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading && atendentes.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-industrial-yellow" />
          </div>
        )}
        {atendentes.map((at) => (
          <div key={at.id} className="p-5 rounded-2xl bg-industrial-white border border-industrial-pale shadow-industrial-sm hover:shadow-industrial-md transition-all duration-200">
            <div className="flex items-start gap-4">
              <div className={`w-11 h-11 rounded-full ${at.role === 'admin' ? 'bg-industrial-yellow' : 'bg-industrial-blue'} flex items-center justify-center flex-none`}>
                <span className={`text-[13px] font-bold ${at.role === 'admin' ? 'text-industrial-dark' : 'text-white'}`}>
                  {at.nome.split(' ').map((n) => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-[15px] font-semibold text-industrial-black">{at.nome}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${at.role === 'admin' ? 'bg-industrial-yellow-pale text-industrial-yellow-dark border border-industrial-yellow/20' : 'bg-industrial-blue-pale text-industrial-blue border border-industrial-blue/20'}`}>
                    {at.role === 'admin' ? 'Admin' : 'Atendente'}
                  </span>
                </div>
                <p className="text-[13px] text-industrial-medium font-mono mb-2">{at.email}</p>
                <div className="flex flex-wrap gap-1.5">
                  {lojas.map((l) => {
                    const active = (alocacoes[at.id] || []).includes(l.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => toggleAlocacao(at.id, l.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200 ${
                          active
                            ? 'bg-industrial-yellow-pale text-industrial-yellow-dark border border-industrial-yellow/20'
                            : 'bg-industrial-surface text-industrial-gray border border-industrial-pale hover:bg-industrial-pale'
                        }`}
                      >
                        {l.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => { setEditing(at); setForm({ nome: at.nome, email: at.email, role: at.role }); }}
                className="p-2 rounded-lg hover:bg-industrial-surface transition-all duration-200 active:scale-95 flex-none"
              >
                <Edit3 className="w-4 h-4 text-industrial-medium" />
              </button>
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
    <div className="tab-content max-w-3xl">
      <h2 className="text-lg font-bold text-industrial-black mb-5">Agente IA</h2>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-industrial-yellow mb-4" />}
      <div className="p-6 rounded-2xl bg-industrial-white border border-industrial-pale shadow-industrial-sm space-y-5">
        <div>
          <label className="block text-[13px] font-medium text-industrial-gray mb-1.5">Nome do Agente</label>
          <input
            type="text"
            value={config.nome}
            onChange={(e) => setConfig((c) => ({ ...c, nome: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-industrial-gray mb-1.5">Prompt do Sistema</label>
          <textarea
            value={config.prompt_sistema}
            onChange={(e) => setConfig((c) => ({ ...c, prompt_sistema: e.target.value }))}
            rows={6}
            className="w-full px-4 py-3 rounded-xl bg-industrial-surface border border-industrial-pale text-sm leading-relaxed focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200 resize-none"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-industrial-gray mb-1.5">Modelo</label>
            <select
              value={config.modelo}
              onChange={(e) => setConfig((c) => ({ ...c, modelo: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200"
            >
              <option>gpt-4o-mini</option>
              <option>gpt-4o</option>
              <option>gpt-4-turbo</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-industrial-gray mb-1.5">Temperatura</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={config.temperatura}
                onChange={(e) => setConfig((c) => ({ ...c, temperatura: parseFloat(e.target.value) }))}
                className="flex-1 accent-industrial-yellow"
              />
              <span className="text-sm font-mono text-industrial-gray w-10 text-right">{config.temperatura}</span>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-industrial-gray mb-1.5">Tools</label>
          <div className="flex gap-2">
            <input
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTool(); }}
              placeholder="Nome da tool"
              className="flex-1 px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200"
            />
            <button
              onClick={addTool}
              className="px-3 py-2.5 rounded-xl bg-industrial-surface text-industrial-gray hover:bg-industrial-pale transition-all duration-200 active:scale-95"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {config.tools.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-industrial-yellow-pale px-2.5 py-1 text-xs font-medium text-industrial-yellow-dark border border-industrial-yellow/20"
              >
                {t}
                <button onClick={() => removeTool(i)} className="text-industrial-yellow-dark/60 hover:text-industrial-yellow-dark transition">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="pt-3 border-t border-industrial-pale">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-industrial-yellow text-industrial-dark text-sm font-semibold shadow-industrial-sm hover:shadow-industrial-md hover:brightness-105 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Fluxo ---------- */
function FluxoPanel() {
  return (
    <div className="tab-content max-w-3xl">
      <h2 className="text-lg font-bold text-industrial-black mb-2">Fluxo de Atendimento</h2>
      <p className="text-[13px] text-industrial-medium mb-5">Diagrama visual do fluxo atual do agente IA</p>
      <div className="p-8 rounded-2xl bg-industrial-white border border-industrial-pale shadow-industrial-sm">
        <svg viewBox="0 0 600 320" className="w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="200" y="20" width="200" height="56" rx="12" fill="#FFF8E1" stroke="#F5C518" strokeWidth="1.5"/>
          <text x="300" y="45" textAnchor="middle" fill="#C29A10" fontSize="13" fontWeight="600" fontFamily="Inter">Agente Principal</text>
          <text x="300" y="62" textAnchor="middle" fill="#8A8A8A" fontSize="10" fontFamily="Inter">Ana IA — gpt-4o-mini</text>

          <line x1="300" y1="76" x2="300" y2="120" stroke="#E8E8E8" strokeWidth="1.5" markerEnd="url(#arrow)"/>
          <polygon points="300,120 340,150 300,180 260,150" fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.5"/>
          <text x="300" y="153" textAnchor="middle" fill="#2563EB" fontSize="10" fontWeight="500" fontFamily="Inter">Rotear</text>

          <line x1="260" y1="150" x2="130" y2="220" stroke="#E8E8E8" strokeWidth="1.5" markerEnd="url(#arrow)"/>
          <line x1="300" y1="180" x2="300" y2="220" stroke="#E8E8E8" strokeWidth="1.5" markerEnd="url(#arrow)"/>
          <line x1="340" y1="150" x2="470" y2="220" stroke="#E8E8E8" strokeWidth="1.5" markerEnd="url(#arrow)"/>

          <rect x="30" y="220" width="200" height="50" rx="10" fill="#F0FDF4" stroke="#16A34A" strokeWidth="1.5"/>
          <text x="130" y="242" textAnchor="middle" fill="#16A34A" fontSize="11" fontWeight="600" fontFamily="Inter">Catálogo</text>
          <text x="130" y="258" textAnchor="middle" fill="#8A8A8A" fontSize="9" fontFamily="Inter">Produtos e disponibilidade</text>

          <rect x="200" y="220" width="200" height="50" rx="10" fill="#FFF7ED" stroke="#EA580C" strokeWidth="1.5"/>
          <text x="300" y="242" textAnchor="middle" fill="#EA580C" fontSize="11" fontWeight="600" fontFamily="Inter">Preços</text>
          <text x="300" y="258" textAnchor="middle" fill="#8A8A8A" fontSize="9" fontFamily="Inter">Tabelas e descontos</text>

          <rect x="370" y="220" width="200" height="50" rx="10" fill="#FEF2F2" stroke="#DC2626" strokeWidth="1.5"/>
          <text x="470" y="242" textAnchor="middle" fill="#DC2626" fontSize="11" fontWeight="600" fontFamily="Inter">Estoque</text>
          <text x="470" y="258" textAnchor="middle" fill="#8A8A8A" fontSize="9" fontFamily="Inter">Disponibilidade por loja</text>

          <line x1="300" y1="270" x2="300" y2="300" stroke="#E8E8E8" strokeWidth="1.5" markerEnd="url(#arrow)"/>
          <rect x="200" y="300" width="200" height="16" rx="4" fill="#F5F5F5" stroke="#E8E8E8" strokeWidth="1"/>
          <text x="300" y="312" textAnchor="middle" fill="#8A8A8A" fontSize="9" fontFamily="Inter">Fallback → Atendente humano</text>

          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#E8E8E8"/>
            </marker>
          </defs>
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
    <div className="tab-content max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-industrial-black">Instâncias WhatsApp</h2>
        <button
          onClick={fetchInstances}
          className="p-2 rounded-lg hover:bg-industrial-surface transition-all duration-200 active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 text-industrial-medium ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="space-y-3">
        {instances.map((inst) => (
          <div key={inst.id} className="p-5 rounded-2xl bg-industrial-white border border-industrial-pale shadow-industrial-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${inst.status === 'conectada' ? 'bg-green-50' : inst.status === 'conectando' ? 'bg-orange-50' : 'bg-red-50'}`}>
                  {inst.status === 'conectada' ? (
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                    </svg>
                  ) : inst.status === 'conectando' ? (
                    <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-industrial-black">{inst.nome}</h3>
                  <p className="text-[12px] text-industrial-medium font-mono">{inst.numero}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
                  inst.status === 'conectada'
                    ? 'bg-industrial-green-pale text-industrial-green border-industrial-green/20'
                    : inst.status === 'conectando'
                    ? 'bg-industrial-orange-pale text-industrial-orange border-industrial-orange/20'
                    : 'bg-industrial-red-pale text-industrial-red border-industrial-red/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${
                    inst.status === 'conectada' ? 'bg-industrial-green' : inst.status === 'conectando' ? 'bg-industrial-orange' : 'bg-industrial-red'
                  }`} />
                  {inst.status === 'conectada' ? 'Conectada' : inst.status === 'conectando' ? 'Conectando' : 'Desconectada'}
                </span>
                {inst.status !== 'conectada' && (
                  <button
                    onClick={() => handleReconnect(inst.id)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-industrial-surface text-industrial-gray hover:bg-industrial-pale transition-all duration-200 active:scale-[0.98]"
                  >
                    Reconectar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {instances.length === 0 && !loading && (
          <div className="text-sm text-industrial-light">Nenhuma instância configurada.</div>
        )}
      </div>
    </div>
  );
}
