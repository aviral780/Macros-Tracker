"use client";

import { useState } from "react";
import { api, useData } from "@/lib/client";
import type { AIProvider } from "@/lib/types";
import { Icon } from "./Icon";
import { NotificationSettings } from "./NotificationSettings";
import { useToast } from "./Toast";

type ProviderInfo = { label: string; needsKey: boolean; keyUrl?: string; fallbackModel: string; note: string; baseUrl: string };
type Resp = { provider: AIProvider; model: string; insightModel: string; baseUrl: string; keyHint: string; keyFromEnv: boolean; providers: Record<AIProvider, ProviderInfo> };

export function SettingsView({ lanUrls }: { lanUrls: string[] }) {
  const { data, reload } = useData<Resp>("/api/settings/ai");
  if (!data) return <div className="panel h-96 animate-pulse" />;
  return <SettingsForm data={data} reload={reload} lanUrls={lanUrls} />;
}

function SettingsForm({ data, reload, lanUrls }: { data: Resp; reload: () => Promise<void>; lanUrls: string[] }) {
  const toast = useToast();
  const [provider, setProvider] = useState<AIProvider>(data.provider);
  const [key, setKey] = useState("");
  const [model, setModel] = useState(data.model);
  const [insightModel, setInsightModel] = useState(data.insightModel);
  const [baseUrl, setBaseUrl] = useState(data.baseUrl);
  const [models, setModels] = useState<string[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<{ state: "idle" | "running" | "ok" | "error"; text: string }>({ state: "idle", text: "" });

  const info = data.providers[provider];
  const sameProvider = provider === data.provider;
  const hasKey = !!key || (sameProvider && !!data.keyHint);

  const detect = async () => {
    setDetecting(true);
    try {
      const r = await api<{ models: string[] }>("/api/settings/ai/models", { method: "POST", body: { provider, apiKey: key || undefined, baseUrl } });
      setModels(r.models);
      if (r.models.length === 0) toast("No suitable vision models found for this provider", { tone: "error" });
      else if (!model || !r.models.includes(model)) setModel(r.models[0]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't list models", { tone: "error" });
    } finally {
      setDetecting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/settings/ai", { method: "PUT", body: { provider, apiKey: key || undefined, model, insightModel, baseUrl } });
      setKey("");
      toast("Saved AI settings");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTest({ state: "running", text: "" });
    try {
      const r = await api<{ items: { name: string; calories: number; protein_g: number }[]; model: string }>("/api/analyze", {
        method: "POST",
        body: { text: "1 medium banana and a 200 g cup of plain Greek yogurt" },
      });
      setTest({
        state: "ok",
        text: `${r.model} answered: ${r.items.map((i) => `${i.name} ${Math.round(i.calories)} kcal`).join(", ")}`,
      });
    } catch (e) {
      setTest({ state: "error", text: e instanceof Error ? e.message : "Test failed" });
    }
  };

  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <header className="mb-5">
        <p className="eyebrow">App</p>
        <h1 className="condensed text-[34px] font-black leading-tight">Settings</h1>
      </header>

      <section className="panel p-5">
        <h2 className="semi-condensed text-[20px] font-bold">Food recognition</h2>
        <p className="mt-1 text-[14px] text-ink-2">Choose which AI model reads your food photos and descriptions.</p>

        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Provider</legend>
          {(Object.keys(data.providers) as AIProvider[]).map((id) => {
            const p = data.providers[id];
            const selected = provider === id;
            return (
              <label
                key={id}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors ${selected ? "border-ink bg-panel-2" : "border-line hover:border-line-strong"}`}
              >
                <input
                  type="radio"
                  name="provider"
                  className="mt-1 h-4 w-4 accent-[var(--ink)]"
                  checked={selected}
                  onChange={() => {
                    setProvider(id);
                    setModels(null);
                    setModel(id === data.provider ? data.model : "");
                    setInsightModel(id === data.provider ? data.insightModel : "");
                    setBaseUrl(id === data.provider ? data.baseUrl : "");
                    setTest({ state: "idle", text: "" });
                  }}
                />
                <span>
                  <span className="block text-[15px] font-semibold">{p.label}</span>
                  <span className="block text-[13px] leading-snug text-ink-2">{p.note}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {info.needsKey && (
          <label className="mt-5 block">
            <span className="field-label">API key</span>
            <input
              className="field font-mono text-[14px]"
              type="password"
              autoComplete="off"
              placeholder={sameProvider && data.keyHint ? `Saved ${data.keyHint}${data.keyFromEnv ? " (from .env.local)" : ""}` : "Paste your key"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            {info.keyUrl && (
              <a href={info.keyUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-2">
                {provider === "gemini" || provider === "groq" ? "Get a free key" : "Get a key"}
                <Icon name="right" size={13} />
              </a>
            )}
          </label>
        )}

        {provider === "ollama" && (
          <div className="mt-5 rounded-xl bg-panel-2 p-3.5 text-[13px] leading-relaxed text-ink-2">
            Install Ollama from ollama.com, then run <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-ink">ollama pull qwen2.5vl:7b</code> (about 6 GB).
            Smaller Macs can use <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-ink">gemma3:4b</code>.
          </div>
        )}

        <div className="mt-5">
          <span className="field-label">Model</span>
          <div className="flex gap-2">
            {models ? (
              <select className="field" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
                {models.map((m, i) => (
                  <option key={m} value={m}>
                    {m}
                    {i === 0 ? " (recommended)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input className="field font-mono text-[14px]" value={model} placeholder="Automatic — picks the best available" onChange={(e) => setModel(e.target.value)} aria-label="Model" />
            )}
            <button className="btn btn-ghost shrink-0" onClick={detect} disabled={detecting || (info.needsKey && !hasKey)}>
              {detecting ? "Detecting…" : "Detect models"}
            </button>
          </div>
          <p className="mt-1.5 text-[13px] text-muted">Reads your food photos, so accuracy matters most here. Leave empty to pick automatically.</p>
        </div>

        <div className="mt-5">
          <span className="field-label">Insights model</span>
          {models ? (
            <select
              className="field"
              value={insightModel}
              onChange={(e) => setInsightModel(e.target.value)}
              aria-label="Insights model"
            >
              <option value="">Automatic — biggest free allowance</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="field font-mono text-[14px]"
              value={insightModel}
              placeholder="Automatic — biggest free allowance"
              onChange={(e) => setInsightModel(e.target.value)}
              aria-label="Insights model"
            />
          )}
          <p className="mt-1.5 text-[13px] text-muted">
            Runs the Coach page, food notes and exercise notes. Free-tier request caps are per model, so keeping insights
            on a lighter model stops them eating your photo quota.
          </p>
        </div>

        {provider === "ollama" && (
          <label className="mt-4 block">
            <span className="field-label">Server address</span>
            <input className="field font-mono text-[14px]" value={baseUrl} placeholder={info.baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </label>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn btn-ghost" onClick={runTest} disabled={test.state === "running" || !sameProvider}>
            {test.state === "running" ? "Testing…" : "Test connection"}
          </button>
          {!sameProvider && <span className="self-center text-[13px] text-muted">Save to test the new provider.</span>}
        </div>
        {test.state === "ok" || test.state === "error" ? (
          <p role="status" className={`mt-3 flex items-start gap-2 text-[14px] ${test.state === "error" ? "text-critical" : ""}`}>
            <Icon name={test.state === "ok" ? "check" : "alert"} size={17} className="mt-0.5 shrink-0" />
            {test.text}
          </p>
        ) : null}
      </section>

      <NotificationSettings />

      <section className="panel mt-5 p-5">
        <h2 className="semi-condensed text-[20px] font-bold">Use on your phone</h2>
        {lanUrls.length > 0 ? (
          <>
            <p className="mt-1 text-[14px] text-ink-2">With your phone on the same Wi-Fi, open:</p>
            <ul className="mt-2 grid gap-1">
              {lanUrls.map((u) => (
                <li key={u}>
                  <code className="rounded-lg bg-panel-2 px-2.5 py-1.5 font-mono text-[15px] font-semibold">{u}</code>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Then use Share → Add to Home Screen for an app icon. Anyone on this Wi-Fi network can open the app. There&apos;s no login, so only run it on networks
              you trust.
            </p>
          </>
        ) : (
          <p className="mt-1 text-[14px] text-ink-2">This Mac isn&apos;t on a network right now.</p>
        )}
      </section>

      <section className="panel mt-5 p-5">
        <h2 className="semi-condensed text-[20px] font-bold">Your data</h2>
        <p className="mt-1 text-[14px] text-ink-2">
          Everything is stored on this Mac in the project&apos;s <code className="font-mono">data/</code> folder: the database and your food photos. Copy that folder
          to back it up.
        </p>
      </section>
    </div>
  );
}
