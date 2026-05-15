import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, RotateCcw, ShieldCheck, X } from 'lucide-react';

import { getAiConfig, resetAiConfig, updateAiConfig } from '@/shared/api/aiConfig';

const PROVIDERS = [
  { key: 'ollama', label: 'Ollama', hint: 'Default local model. No API key required.' },
  { key: 'openai', label: 'OpenAI', hint: 'Uses an OpenAI API key.' },
  { key: 'openai_compatible', label: 'OpenAI compatible', hint: 'Works with providers exposing an OpenAI-compatible endpoint.' },
];

function providerNeedsKey(provider) {
  return provider === 'openai' || provider === 'openai_compatible';
}

function defaultModelForProvider(provider) {
  if (provider === 'ollama') return 'llama3.2:3b';
  return 'gpt-4o-mini';
}

function defaultBaseUrlForProvider(provider) {
  if (provider === 'ollama') return 'http://127.0.0.1:11434';
  if (provider === 'openai') return 'https://api.openai.com/v1';
  return 'https://api.openai.com/v1';
}

export default function AiSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({
    provider: 'ollama',
    model: 'llama3.2:3b',
    baseUrl: 'http://127.0.0.1:11434',
    apiKey: '',
    temperature: 0,
    maxTokens: 1000,
    timeoutSeconds: 120,
  });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const activeProvider = useMemo(
    () => PROVIDERS.find((item) => item.key === form.provider) || PROVIDERS[0],
    [form.provider],
  );

  async function loadConfig() {
    setIsLoading(true);
    setError(null);
    try {
      const nextConfig = await getAiConfig();
      setConfig(nextConfig);
      setForm({
        provider: nextConfig.provider || 'ollama',
        model: nextConfig.model || defaultModelForProvider(nextConfig.provider),
        baseUrl: nextConfig.base_url || defaultBaseUrlForProvider(nextConfig.provider),
        apiKey: '',
        temperature: nextConfig.temperature ?? 0,
        maxTokens: nextConfig.max_tokens ?? 1000,
        timeoutSeconds: nextConfig.timeout_seconds ?? 120,
      });
    } catch (nextError) {
      setError(nextError.message || 'Unable to load AI configuration.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setMessage(null);
    setError(null);
  }

  function handleProviderChange(provider) {
    setForm((current) => ({
      ...current,
      provider,
      model: current.model || defaultModelForProvider(provider),
      baseUrl: current.baseUrl || defaultBaseUrlForProvider(provider),
      apiKey: '',
    }));
    setMessage(null);
    setError(null);
  }

  async function handleSave(event) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        provider: form.provider,
        model: form.model,
        base_url: form.baseUrl || null,
        api_key: form.apiKey || null,
        temperature: Number(form.temperature),
        max_tokens: Number(form.maxTokens),
        timeout_seconds: Number(form.timeoutSeconds),
      };

      const nextConfig = await updateAiConfig(payload);
      setConfig(nextConfig);
      setForm((current) => ({ ...current, apiKey: '' }));
      setMessage('AI configuration saved on the backend. The API key was not returned to the frontend.');
    } catch (nextError) {
      setError(nextError.message || 'Unable to save AI configuration.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const nextConfig = await resetAiConfig();
      setConfig(nextConfig);
      setForm({
        provider: nextConfig.provider || 'ollama',
        model: nextConfig.model || 'llama3.2:3b',
        baseUrl: nextConfig.base_url || 'http://127.0.0.1:11434',
        apiKey: '',
        temperature: nextConfig.temperature ?? 0,
        maxTokens: nextConfig.max_tokens ?? 1000,
        timeoutSeconds: nextConfig.timeout_seconds ?? 120,
      });
      setMessage('AI configuration reset to backend defaults.');
    } catch (nextError) {
      setError(nextError.message || 'Unable to reset AI configuration.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-semibold text-ockham-navy shadow-[0_10px_20px_rgba(10,73,194,0.08)] transition hover:bg-white"
      >
        <KeyRound className="h-3.5 w-3.5" />
        AI
        {config?.provider ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {config.provider.replace('_', ' ')}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-50 w-[420px] rounded-[28px] border border-white/70 bg-white/95 p-4 text-left shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ockham-cyan">AI Runtime</p>
              <h3 className="mt-1 font-heading text-xl font-extrabold tracking-[-0.04em] text-foreground">
                Model provider
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                API keys are accepted by the backend and never returned in this panel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {PROVIDERS.map((provider) => (
                  <button
                    type="button"
                    key={provider.key}
                    onClick={() => handleProviderChange(provider.key)}
                    className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${form.provider === provider.key ? 'bg-white text-ockham-navy shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs leading-relaxed text-blue-800">
                {activeProvider.hint}
              </div>

              <label className="block text-xs font-semibold text-slate-600">
                Model
                <input
                  value={form.model}
                  onChange={(event) => updateField('model', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-ockham-cyan"
                  placeholder={defaultModelForProvider(form.provider)}
                />
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Base URL
                <input
                  value={form.baseUrl}
                  onChange={(event) => updateField('baseUrl', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-ockham-cyan"
                  placeholder={defaultBaseUrlForProvider(form.provider)}
                />
              </label>

              {providerNeedsKey(form.provider) ? (
                <label className="block text-xs font-semibold text-slate-600">
                  API key
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(event) => updateField('apiKey', event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-ockham-cyan"
                    placeholder={config?.has_custom_api_key ? 'Existing key stored in backend memory' : 'Paste your API key'}
                    autoComplete="off"
                  />
                </label>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Temp.
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={form.temperature}
                    onChange={(event) => updateField('temperature', event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-ockham-cyan"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Max tokens
                  <input
                    type="number"
                    min="1"
                    value={form.maxTokens}
                    onChange={(event) => updateField('maxTokens', event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-ockham-cyan"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Timeout
                  <input
                    type="number"
                    min="1"
                    value={form.timeoutSeconds}
                    onChange={(event) => updateField('timeoutSeconds', event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-ockham-cyan"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Secret handling
                </div>
                <p className="mt-1 leading-relaxed">
                  The backend only returns <span className="font-semibold">has_custom_api_key</span>. It never returns the key value.
                </p>
              </div>

              {message ? (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4" />
                  <span>{message}</span>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to default
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-full gradient-primary px-4 py-2 text-xs font-bold text-white shadow-[0_12px_24px_rgba(10,73,194,0.16)] transition disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save provider
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
