import { useState, useEffect } from 'react';
import { AppSettings, LLMProvider } from '../../../types/transcript';

interface Props {
  onClose: () => void;
}

export function SettingsScreen({ onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.api.getSettings().then(setSettings);
  }, []);

  async function handleSave() {
    if (!settings) return;
    await window.api.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) return null;

  const field = (label: string, key: keyof AppSettings, placeholder: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{label}</label>
      <input
        type="password"
        value={settings[key] as string}
        placeholder={placeholder}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
        style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 6,
          padding: '8px 12px',
          color: '#e2e8f0',
          fontSize: 13,
          fontFamily: 'monospace',
          outline: 'none',
        }}
      />
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 12, padding: 28,
        width: 480, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#e2e8f0' }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* LLM provider toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>LLM PROVIDER (for Vocabulary / Slang explanations)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['openai', 'anthropic'] as LLMProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setSettings({ ...settings, llmProvider: p })}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 6,
                  border: `1px solid ${settings.llmProvider === p ? '#6366f1' : '#334155'}`,
                  background: settings.llmProvider === p ? 'rgba(99,102,241,0.2)' : '#0f172a',
                  color: settings.llmProvider === p ? '#818cf8' : '#64748b',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: settings.llmProvider === p ? 700 : 400,
                }}
              >
                {p === 'openai' ? 'OpenAI GPT-4o' : 'Anthropic Claude'}
              </button>
            ))}
          </div>
        </div>

        {field('OPENAI API KEY (GPT-4o + Whisper)', 'openaiApiKey', 'sk-...')}
        {field('ANTHROPIC API KEY (Claude)', 'anthropicApiKey', 'sk-ant-...')}

        <div style={{ background: 'rgba(99,102,241,0.08)', borderRadius: 6, padding: '10px 12px', borderLeft: '2px solid #6366f1' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
            <strong style={{ color: '#818cf8' }}>Whisper</strong> always uses your OpenAI API key.<br />
            <strong style={{ color: '#818cf8' }}>LLM provider</strong> controls which AI explains vocabulary and slang.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #334155', borderRadius: 6, padding: '8px 20px', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{ background: '#6366f1', border: 'none', borderRadius: 6, padding: '8px 24px', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
