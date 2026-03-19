import React, { useState, useEffect } from 'react';
import { useAgentStore } from '../store/agentStore';
import { useSettings } from '../hooks/useSettings';
import { Settings, Template, Characteristic } from '../../types/settings';

const PROFILE_FIELDS: [string, string][] = [
  ['fullName', 'Full Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['address', 'Street Address'],
  ['city', 'City'],
  ['state', 'State'],
  ['zip', 'ZIP Code'],
  ['country', 'Country'],
  ['company', 'Company'],
  ['title', 'Job Title'],
];

type TabId = 'config' | 'profile' | string;

export default function SettingsPage() {
  const setView = useAgentStore((s) => s.setView);
  const { settings, saveSettings, loading } = useSettings();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('config');

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const handleSave = async () => {
    await saveSettings(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateField = (field: string, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
  };

  const updateProfile = (field: string, value: string) => {
    setDraft((d) => ({
      ...d,
      userProfile: { ...d.userProfile, [field]: value },
    }));
  };

  // Template text field helpers
  const templateNames = Object.keys(draft.templates || {});

  const updateTemplateField = (templateName: string, key: string, value: string) => {
    setDraft((d) => ({
      ...d,
      templates: {
        ...d.templates,
        [templateName]: { ...d.templates[templateName], [key]: value },
      },
    }));
  };

  const renameTemplateField = (templateName: string, oldKey: string, newKey: string) => {
    if (
      !newKey.trim() ||
      (newKey !== oldKey && draft.templates[templateName]?.[newKey] !== undefined)
    )
      return;
    setDraft((d) => {
      const { [oldKey]: value, ...rest } = d.templates[templateName];
      return {
        ...d,
        templates: { ...d.templates, [templateName]: { ...rest, [newKey]: value } },
      };
    });
  };

  const removeTemplateField = (templateName: string, key: string) => {
    setDraft((d) => {
      const { [key]: _, ...rest } = d.templates[templateName];
      return { ...d, templates: { ...d.templates, [templateName]: rest } };
    });
  };

  const addTemplateField = (templateName: string) => {
    const existing = Object.keys(draft.templates[templateName] || {});
    let name = 'New Field';
    let i = 1;
    while (existing.includes(name)) name = `New Field ${++i}`;
    updateTemplateField(templateName, name, '');
  };

  const addTemplate = () => {
    let name = 'New Template';
    let i = 1;
    while (templateNames.includes(name)) name = `New Template ${++i}`;
    setDraft((d) => ({
      ...d,
      templates: { ...d.templates, [name]: {} },
    }));
    setActiveTab(name);
  };

  const renameTemplate = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName || templateNames.includes(newName)) return;
    setDraft((d) => {
      const { [oldName]: fields, ...restTemplates } = d.templates;
      return {
        ...d,
        templates: { ...restTemplates, [newName]: fields },
      };
    });
    if (activeTab === oldName) setActiveTab(newName);
  };

  const removeTemplate = (name: string) => {
    setDraft((d) => {
      const { [name]: _, ...restTemplates } = d.templates;
      return { ...d, templates: restTemplates };
    });
    if (activeTab === name) setActiveTab('config');
  };

  if (loading) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'config', label: 'Config' },
    { id: 'profile', label: 'Profile' },
    ...templateNames.map((n) => ({ id: n, label: n })),
  ];

  return (
    <div className="flex flex-col h-screen bg-tan-50">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-tan-200">
        <button
          onClick={() => setView('main')}
          className="p-1 rounded-lg hover:bg-tan-100 transition-colors text-tan-700"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-tan-900 font-karla">Settings</h2>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-0 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors font-karla
              ${
                activeTab === tab.id
                  ? 'bg-tan-100 text-tan-900 border border-b-0 border-tan-200'
                  : 'text-tan-500 hover:text-tan-700 hover:bg-tan-100/50'
              }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={addTemplate}
          className="shrink-0 px-2 py-1.5 text-xs text-tan-400 hover:text-tan-700 transition-colors font-karla"
          title="Add template"
        >
          +
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 border-t border-tan-200">
        {activeTab === 'config' && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-tan-700 uppercase tracking-wider font-karla">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(e) => updateField('apiKey', e.target.value)}
                placeholder="sk-ant-..."
                className="w-full rounded-xl border border-tan-200 bg-white px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-tan-400 font-karla"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-tan-700 uppercase tracking-wider font-karla">
                Response Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['casual', 'detailed', 'formal'] as Characteristic[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => updateField('characteristic', c)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium font-karla transition-colors
                      ${
                        draft.characteristic === c
                          ? 'bg-tan-400 text-white'
                          : 'bg-white border border-tan-200 text-tan-600 hover:border-tan-400'
                      }`}
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-tan-400 font-karla">
                {draft.characteristic === 'casual' &&
                  'Short, friendly responses. Gets to the point fast.'}
                {draft.characteristic === 'detailed' &&
                  'Thorough answers with examples and context.'}
                {draft.characteristic === 'formal' &&
                  'Professional tone with structured, polished responses.'}
              </p>
            </div>
          </>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-3">
            {PROFILE_FIELDS.map(([field, label]) => (
              <div key={field} className="space-y-1">
                <label className="text-xs text-tan-600 font-karla">{label}</label>
                <input
                  type="text"
                  value={(draft.userProfile as unknown as Record<string, string>)[field] || ''}
                  onChange={(e) => updateProfile(field, e.target.value)}
                  className="w-full rounded-lg border border-tan-200 bg-white px-3 py-1.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-tan-400 font-karla"
                />
              </div>
            ))}
          </div>
        )}

        {activeTab !== 'config' && activeTab !== 'profile' && draft.templates[activeTab] && (
          <TemplateEditor
            name={activeTab}
            fields={draft.templates[activeTab]}
            onUpdateField={(k, v) => updateTemplateField(activeTab, k, v)}
            onRenameField={(ok, nk) => renameTemplateField(activeTab, ok, nk)}
            onRemoveField={(k) => removeTemplateField(activeTab, k)}
            onAddField={() => addTemplateField(activeTab)}
            onRename={(newName) => renameTemplate(activeTab, newName)}
            onRemove={() => removeTemplate(activeTab)}
          />
        )}
      </div>

      {/* Save button */}
      <div className="px-4 py-3 border-t border-tan-200">
        <button
          onClick={handleSave}
          className="w-full rounded-xl bg-tan-400 hover:bg-tan-500 text-white py-2.5
                     text-sm font-semibold transition-colors font-karla"
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

function TemplateEditor({
  name,
  fields,
  onUpdateField,
  onRenameField,
  onRemoveField,
  onAddField,
  onRename,
  onRemove,
}: {
  name: string;
  fields: Template;
  onUpdateField: (key: string, value: string) => void;
  onRenameField: (oldKey: string, newKey: string) => void;
  onRemoveField: (key: string) => void;
  onAddField: () => void;
  onRename: (newName: string) => void;
  onRemove: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(name);

  return (
    <div className="space-y-4">
      {/* Template name + actions */}
      <div className="flex items-center justify-between">
        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={() => {
              onRename(nameValue);
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRename(nameValue);
                setEditingName(false);
              }
              if (e.key === 'Escape') {
                setNameValue(name);
                setEditingName(false);
              }
            }}
            className="text-xs font-semibold text-tan-700 uppercase tracking-wider font-karla
                       bg-transparent border-b border-tan-400 focus:outline-none px-0"
          />
        ) : (
          <h3
            onClick={() => {
              setNameValue(name);
              setEditingName(true);
            }}
            className="text-xs font-semibold text-tan-700 uppercase tracking-wider font-karla
                       cursor-pointer hover:text-tan-900"
            title="Click to rename"
          >
            {name}
          </h3>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onAddField}
            className="text-xs text-tan-500 hover:text-tan-700 transition-colors font-karla"
          >
            + Field
          </button>
          <button
            onClick={onRemove}
            className="text-xs text-red-400 hover:text-red-600 transition-colors font-karla"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Text fields */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold text-tan-500 uppercase tracking-wider font-karla">
          Fields
        </h4>
        {Object.entries(fields).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                defaultValue={key}
                onBlur={(e) => {
                  const newKey = e.target.value.trim();
                  if (newKey && newKey !== key) onRenameField(key, newKey);
                }}
                className="flex-1 text-xs text-tan-600 font-karla bg-transparent border-b border-transparent
                           focus:border-tan-300 focus:outline-none px-0 py-0.5"
              />
              <button
                onClick={() => onRemoveField(key)}
                className="text-tan-400 hover:text-red-500 transition-colors shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              value={value}
              onChange={(e) => onUpdateField(key, e.target.value)}
              placeholder="Value"
              className="w-full rounded-lg border border-tan-200 bg-white px-3 py-1.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-tan-400 font-karla"
            />
          </div>
        ))}
        {Object.keys(fields).length === 0 && (
          <p className="text-xs text-tan-400 font-karla italic">No fields yet.</p>
        )}
      </div>
    </div>
  );
}
