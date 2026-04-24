import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { t } from '../i18n'
import {
  BUILTIN_PROMPT_TEMPLATES,
  KNOWLEDGE_CONTENT_MAX,
  KNOWLEDGE_TITLE_MAX,
  MAX_TEXT_KNOWLEDGE_ITEMS,
  PROMPT_MAX
} from './constants'
import { pushEngineConfigIfRunning } from './buildEngineConfig'
import { applyUiTheme, type UiThemeSetting } from '../theme/applyUiTheme'

import './settings.css'

type MenuId = 'user' | 'prompt' | 'knowledge' | 'models'

function uid() {
  return crypto.randomUUID()
}

/** 应用类型：双卡片二选一（与「用户设置」里快捷键行样式一致） */
function AppTypeRow({
  value,
  onChange
}: {
  value: 'weixin' | 'wework'
  onChange: (v: 'weixin' | 'wework') => void
}) {
  return (
    <div className="settings-pref-block settings-app-type-pref">
      <div className="settings-pref-title">{t('settings.appType')}</div>
      <p className="settings-pref-desc">{t('settings.models.appTypeBlockSub')}</p>
      <div className="settings-option-row">
        <button
          type="button"
          className={`settings-option-card ${value === 'weixin' ? 'is-on' : ''}`}
          onClick={() => onChange('weixin')}
        >
          <span className="settings-option-radio" aria-hidden />
          {t('settings.appType.weixin')}
        </button>
        <button
          type="button"
          className={`settings-option-card ${value === 'wework' ? 'is-on' : ''}`}
          onClick={() => onChange('wework')}
        >
          <span className="settings-option-radio" aria-hidden />
          {t('settings.appType.wework')}
        </button>
      </div>
    </div>
  )
}

/** 根据 Base URL 猜测厂商，用于模型列表分组展示 */
function inferProviderFromBaseUrl(url: string): string {
  const u = (url || '').toLowerCase()
  if (!u.trim()) return 'Custom'
  if (u.includes('openai.com')) return 'OpenAI'
  if (u.includes('anthropic')) return 'Anthropic'
  if (u.includes('volces.com') || u.includes('ark.cn')) return '豆包'
  if (u.includes('deepseek')) return 'DeepSeek'
  if (u.includes('google') || u.includes('generativelanguage')) return 'Google'
  return 'Custom'
}

export function SettingsView() {
  const [menu, setMenu] = useState<MenuId>('prompt')
  const [data, setData] = useState<Record<string, any> | null>(null)
  const refresh = useCallback(() => {
    const inv = window.electron?.invoke
    if (typeof inv !== 'function') return
    void inv('settings:getAll').then((s) => {
      if (s != null && typeof s === 'object') setData(s as Record<string, any>)
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const nav = useMemo(
    () =>
      [
        { id: 'user' as const, title: t('settings.nav.user'), sub: t('settings.nav.sub.user') },
        { id: 'prompt' as const, title: t('settings.nav.prompt'), sub: t('settings.nav.sub.prompt') },
        { id: 'knowledge' as const, title: t('settings.nav.knowledge'), sub: t('settings.nav.sub.knowledge') },
        { id: 'models' as const, title: t('settings.nav.models'), sub: t('settings.nav.sub.models') }
      ] as const,
    []
  )

  if (!data) {
    return <div className="settings-page-loading">{t('settings.testConnection.testing')}</div>
  }

  return (
    <div className="settings-page slide-up">
      <aside className="settings-sidebar">
        <div className="settings-brand">
          <div className="settings-brand-name">{t('settings.brand')}</div>
          <div className="settings-brand-sub">{t('settings.subtitle')}</div>
        </div>
        <div className="settings-search">
          <input type="search" placeholder={t('settings.nav.search')} readOnly className="settings-search-input" />
        </div>
        <nav className="settings-nav">
          {nav.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`settings-nav-item ${menu === item.id ? 'is-active' : ''}`}
              onClick={() => setMenu(item.id)}
            >
              <span className="settings-nav-title">{item.title}</span>
              <span className="settings-nav-sub">{item.sub}</span>
            </button>
          ))}
        </nav>
        <div className="settings-sidebar-footer">
          <span className="settings-ver">{t('settings.version')}</span>
          <span className="settings-ver-hint">{t('settings.version.hint')}</span>
        </div>
      </aside>
      <div className="settings-main">
        {menu === 'user' && <UserSection data={data} refresh={refresh} />}
        {menu === 'prompt' && <PromptSection data={data} refresh={refresh} />}
        {menu === 'knowledge' && <KnowledgeSection data={data} refresh={refresh} />}
        {menu === 'models' && <ModelsSection data={data} refresh={refresh} />}
      </div>
    </div>
  )
}

function UserSection({ data, refresh }: { data: Record<string, any>; refresh: () => void }) {
  const [sendShortcut, setSendShortcut] = useState<'enter' | 'mod_enter'>(data.sendShortcut || 'mod_enter')
  const [uiTheme, setUiTheme] = useState<UiThemeSetting>(data.uiTheme || 'dark')

  useEffect(() => {
    setSendShortcut(data.sendShortcut || 'mod_enter')
    setUiTheme((data.uiTheme as UiThemeSetting) || 'dark')
  }, [data])

  const applyThemeNow = async (next: UiThemeSetting) => {
    setUiTheme(next)
    applyUiTheme(next)
    await window.electron?.invoke('settings:set', { uiTheme: next })
    refresh()
  }

  const applySendShortcutNow = async (next: 'enter' | 'mod_enter') => {
    setSendShortcut(next)
    await window.electron?.invoke('settings:set', { sendShortcut: next })
    refresh()
  }

  const save = async () => {
    applyUiTheme(uiTheme)
    await window.electron?.invoke('settings:set', { uiTheme })
    refresh()
    showSettingsToast(t('settings.saved'), 'success')
  }

  return (
    <div className="settings-section">
      <header className="settings-section-head">
        <h1 className="settings-h1">{t('settings.nav.user')}</h1>
        <p className="settings-h2">{t('settings.user.sub')}</p>
      </header>

      <div className="settings-card settings-card--prefs">
        <div className="settings-pref-block">
          <div className="settings-pref-title">{t('settings.user.sendShortcut')}</div>
          <p className="settings-pref-desc">{t('settings.user.sendShortcut.hint')}</p>
          <div className="settings-option-row">
            <button
              type="button"
              className={`settings-option-card ${sendShortcut === 'enter' ? 'is-on' : ''}`}
              onClick={() => void applySendShortcutNow('enter')}
            >
              <span className="settings-option-radio" aria-hidden />
              {t('settings.user.sendEnter')}
            </button>
            <button
              type="button"
              className={`settings-option-card ${sendShortcut === 'mod_enter' ? 'is-on' : ''}`}
              onClick={() => void applySendShortcutNow('mod_enter')}
            >
              <span className="settings-option-radio" aria-hidden />
              {t('settings.user.sendModEnter')}
            </button>
          </div>
        </div>

        <div className="settings-pref-block">
          <div className="settings-pref-title">{t('settings.user.theme')}</div>
          <p className="settings-pref-desc">{t('settings.user.theme.hint')}</p>
          <div className="settings-theme-row">
            <button
              type="button"
              className={`settings-theme-tile ${uiTheme === 'light' ? 'is-on' : ''}`}
              onClick={() => void applyThemeNow('light')}
            >
              <div className="settings-theme-swatch settings-theme-swatch--light" />
              <span>{t('settings.user.theme.light')}</span>
            </button>
            <button
              type="button"
              className={`settings-theme-tile ${uiTheme === 'dark' ? 'is-on' : ''}`}
              onClick={() => void applyThemeNow('dark')}
            >
              <div className="settings-theme-swatch settings-theme-swatch--dark" />
              <span>{t('settings.user.theme.dark')}</span>
            </button>
            <button
              type="button"
              className={`settings-theme-tile ${uiTheme === 'system' ? 'is-on' : ''}`}
              onClick={() => void applyThemeNow('system')}
            >
              <div className="settings-theme-swatch settings-theme-swatch--system" />
              <span>{t('settings.user.theme.system')}</span>
            </button>
          </div>
        </div>

        <div className="settings-pref-footer">
          <button type="button" className="btn btn-primary settings-save-wide" onClick={save}>
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApiKeyEyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function modelPresetFormInitial(
  data: Record<string, any>,
  editingPresetId: string | null | undefined
) {
  if (!editingPresetId) {
    return { apiKey: '', baseURL: '', model: '' }
  }
  const preset = (data.modelPresets || []).find((p: { id: string }) => p.id === editingPresetId) as
    | { apiKey?: string; baseURL?: string; model?: string }
    | undefined
  return {
    apiKey: preset?.apiKey ?? '',
    baseURL: preset?.baseURL ?? '',
    model: preset?.model ?? ''
  }
}

/** 原「用户设置」中的连接项，现放在「模型配置」页顶部 */
function ModelsConnectionBlock({
  data,
  refresh,
  onAfterSave,
  editingPresetId
}: {
  data: Record<string, any>
  refresh: () => void
  /** 添加/编辑保存成功后，用于自动返回列表 */
  onAfterSave?: () => void
  /** 有值则预填并保存为更新该条；无则「添加」在列表末追加 */
  editingPresetId?: string | null
}) {
  const appType = (data.appType || 'weixin') as 'weixin' | 'wework'
  const isEdit = !!editingPresetId
  const init = modelPresetFormInitial(data, editingPresetId)
  const [apiKey, setApiKey] = useState(init.apiKey)
  const [baseURL, setBaseURL] = useState(init.baseURL)
  const [model, setModel] = useState(init.model)
  const [testing, setTesting] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const handleSave = async () => {
    const inv = window.electron?.invoke
    if (typeof inv !== 'function') {
      showSettingsToast(t('settings.saveFailed'), 'error')
      return
    }
    const modelTrim = (model || '').trim()
    const baseTrim = (baseURL || '').trim()
    const keyTrim = (apiKey || '').trim()
    if (!keyTrim || !modelTrim) {
      showSettingsToast(t('settings.models.addRequired'), 'error')
      return
    }

    const list = ((data.modelPresets || []) as {
      id: string
      provider: string
      label: string
      model: string
      baseURL: string
      apiKey: string
    }[]).map((p) => ({ ...p }))

    try {
      if (isEdit && editingPresetId) {
        const prov = inferProviderFromBaseUrl(baseTrim)
        const nextPresets = list.map((p) =>
          p.id === editingPresetId
            ? { ...p, provider: prov, label: modelTrim, model: modelTrim, baseURL: baseTrim, apiKey }
            : p
        )
        const activeId = (data.activeModelPresetId as string) || list[0]?.id || ''
        const chosen = nextPresets.find((p) => p.id === activeId) ?? nextPresets[0]
        await inv('settings:set', {
          appType,
          apiKey: chosen?.apiKey ?? keyTrim,
          model: chosen?.model ?? modelTrim,
          baseURL: chosen?.baseURL ?? baseTrim,
          modelPresets: nextPresets,
          activeModelPresetId: activeId || nextPresets[0]?.id
        })
      } else {
        const id = uid()
        const newPreset = {
          id,
          provider: inferProviderFromBaseUrl(baseTrim),
          label: modelTrim,
          model: modelTrim,
          baseURL: baseTrim,
          apiKey,
          systemPrompt: (data.systemPrompt as string) || '',
          activePromptTemplateId: String(data.activePromptTemplateId || '')
        }
        const nextPresets = [...list, newPreset]
        await inv('settings:set', {
          appType,
          apiKey,
          model: modelTrim,
          baseURL: baseTrim,
          modelPresets: nextPresets,
          activeModelPresetId: id
        })
      }
      await pushEngineConfigIfRunning()
      refresh()
      showSettingsToast(t('settings.saved'), 'success')
      onAfterSave?.()
    } catch (e) {
      console.error('settings save', e)
      showSettingsToast(t('settings.saveFailed'), 'error')
    }
  }

  const handleTest = async () => {
    const keyTrim = (apiKey || '').trim()
    if (!keyTrim) {
      showSettingsToast(t('control.start.nokey'), 'error')
      return
    }
    const modelTrim = (model || '').trim()
    const baseTrim = (baseURL || '').trim()
    setTesting(true)
    try {
      const r = await window.electron?.invoke('engine:testConnection', {
        apiKey: keyTrim,
        model: modelTrim || undefined,
        baseURL: baseTrim || undefined
      })
      if (r?.success) showSettingsToast(t('settings.testConnection.success'), 'success')
      else {
        const detail = (r?.error ?? '').trim()
        const fail = t('settings.testConnection.fail')
        showSettingsToast(detail ? `${fail}: ${detail}` : fail, 'error')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const detail = msg.trim()
      const fail = t('settings.testConnection.fail')
      showSettingsToast(detail ? `${fail}: ${detail}` : fail, 'error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="settings-card" style={{ marginBottom: 12 }}>
      <div className="form-group">
        <label className="form-label" htmlFor="settings-conn-api-key">
          {t('settings.apiKey')}
        </label>
        <div className="settings-input-with-toggle">
          <input
            id="settings-conn-api-key"
            className="form-input settings-input-with-toggle__input"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="settings-input-with-toggle__btn"
            onClick={() => setShowApiKey((v) => !v)}
            aria-pressed={showApiKey}
            title={showApiKey ? t('settings.apiKey.maskKey') : t('settings.apiKey.revealKey')}
            aria-label={showApiKey ? t('settings.apiKey.maskKey') : t('settings.apiKey.revealKey')}
          >
            <ApiKeyEyeIcon visible={showApiKey} />
          </button>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">{t('settings.model')}</label>
        <input className="form-input" value={model} onChange={(e) => setModel(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">{t('settings.baseURL')}</label>
        <input className="form-input" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-secondary" type="button" onClick={handleTest} disabled={testing}>
          {testing ? t('settings.testConnection.testing') : t('settings.testConnection')}
        </button>
        <button className="btn btn-primary" type="button" onClick={handleSave} style={{ flex: 1 }}>
          {t('settings.save')}
        </button>
      </div>
    </div>
  )
}

type PromptPreset = {
  id: string
  label?: string
  model?: string
  systemPrompt?: string
  activePromptTemplateId?: string
}

function PromptSection({ data, refresh }: { data: Record<string, any>; refresh: () => void }) {
  const [text, setText] = useState((data.systemPrompt as string) || '')
  const [saveTplOpen, setSaveTplOpen] = useState(false)
  const [saveTplName, setSaveTplName] = useState('')
  const userTpls = (data.promptUserTemplates || []) as { id: string; name: string; content: string }[]

  const presetList = (data.modelPresets || []) as PromptPreset[]
  const activeModelId = String(data.activeModelPresetId || '')
  const activePreset = activeModelId ? presetList.find((p) => p.id === activeModelId) : undefined
  const promptBoundToModel = presetList.length > 0 && !!activeModelId && !!activePreset
  const templateActiveId = promptBoundToModel
    ? String(activePreset?.activePromptTemplateId ?? '')
    : String(data.activePromptTemplateId || '')

  useEffect(() => {
    const pl = (data.modelPresets || []) as PromptPreset[]
    const mid = String(data.activeModelPresetId || '')
    const ap = mid ? pl.find((p) => p.id === mid) : undefined
    const bound = pl.length > 0 && !!mid && !!ap
    if (bound && ap) {
      setText(String(ap.systemPrompt ?? (data.systemPrompt as string) ?? ''))
    } else {
      setText(String((data.systemPrompt as string) || ''))
    }
  }, [data])

  useEffect(() => {
    if (!saveTplOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSaveTplOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveTplOpen])

  const allUserCount = BUILTIN_PROMPT_TEMPLATES.length + userTpls.length

  const findTemplate = (id: string) =>
    BUILTIN_PROMPT_TEMPLATES.find((x) => x.id === id) || userTpls.find((x) => x.id === id)

  const useTemplate = async (id: string, content: string) => {
    const systemPrompt = content.slice(0, PROMPT_MAX)
    setText(systemPrompt)
    const inv = window.electron?.invoke
    if (typeof inv !== 'function') return
    if (promptBoundToModel && activeModelId) {
      const next = presetList.map((p) =>
        p.id === activeModelId ? { ...p, systemPrompt, activePromptTemplateId: id } : p
      )
      await inv('settings:set', { modelPresets: next })
    } else {
      await inv('settings:set', { systemPrompt, activePromptTemplateId: id })
    }
    await pushEngineConfigIfRunning()
    refresh()
    showSettingsToast(t('settings.saved'), 'success')
  }

  const onPromptTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setText(v)
    if (!templateActiveId) return
    const tpl = findTemplate(templateActiveId)
    if (!tpl) return
    const expected = tpl.content.slice(0, PROMPT_MAX)
    if (v !== expected) {
      if (promptBoundToModel && activeModelId) {
        const next = presetList.map((p) =>
          p.id === activeModelId ? { ...p, activePromptTemplateId: '' } : p
        )
        void window.electron?.invoke('settings:set', { modelPresets: next }).then(() => refresh())
      } else {
        void window.electron?.invoke('settings:set', { activePromptTemplateId: '' }).then(() => refresh())
      }
    }
  }

  const saveMain = async () => {
    const systemPrompt = text.slice(0, PROMPT_MAX)
    let nextActive = templateActiveId
    if (nextActive) {
      const tpl = findTemplate(nextActive)
      if (!tpl || tpl.content.slice(0, PROMPT_MAX) !== systemPrompt) nextActive = ''
    }
    const inv = window.electron?.invoke
    if (typeof inv !== 'function') return
    if (promptBoundToModel && activeModelId) {
      const next = presetList.map((p) =>
        p.id === activeModelId
          ? { ...p, systemPrompt, activePromptTemplateId: nextActive }
          : p
      )
      await inv('settings:set', { modelPresets: next })
    } else {
      await inv('settings:set', { systemPrompt, activePromptTemplateId: nextActive })
    }
    await pushEngineConfigIfRunning()
    refresh()
    showSettingsToast(t('settings.saved'), 'success')
  }

  const openSaveTemplateModal = () => {
    setSaveTplName('')
    setSaveTplOpen(true)
  }

  const confirmSaveTemplate = () => {
    const name = saveTplName.trim()
    if (!name) {
      showSettingsToast(t('settings.prompt.nameRequired'), 'error')
      return
    }
    const next = [...userTpls, { id: uid(), name, content: text.slice(0, PROMPT_MAX) }]
    void window.electron?.invoke('settings:set', { promptUserTemplates: next }).then(() => {
      setSaveTplOpen(false)
      refresh()
      showSettingsToast(t('settings.saved'), 'success')
    })
  }

  const removeUserTpl = (id: string) => {
    const next = userTpls.filter((x) => x.id !== id)
    const payload: Record<string, unknown> = { promptUserTemplates: next }
    if (templateActiveId === id) {
      if (promptBoundToModel && activeModelId) {
        payload.modelPresets = presetList.map((p) =>
          p.id === activeModelId ? { ...p, activePromptTemplateId: '' } : p
        )
      } else {
        payload.activePromptTemplateId = ''
      }
    }
    void window.electron?.invoke('settings:set', payload).then(refresh)
  }

  return (
    <>
    <div className="settings-section">
      <header className="settings-section-head">
        <h1 className="settings-h1">{t('settings.prompt.title')}</h1>
        <p className="settings-h2">{t('settings.prompt.sub')}</p>
        <p className="settings-h2" style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
          {promptBoundToModel
            ? t('settings.prompt.boundToModel').replace(
                '{name}',
                (activePreset?.label || activePreset?.model || '—') as string
              )
            : t('settings.prompt.notBound')}
        </p>
      </header>

      <div className="settings-card">
        <div className="settings-card-head">
          <div>
            <div className="settings-card-title">{t('settings.prompt.cardTitle')}</div>
            <div className="settings-card-sub">{t('settings.prompt.cardSub')}</div>
          </div>
          <div className="settings-card-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={openSaveTemplateModal}>
              {t('settings.prompt.saveAsTemplate')}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={saveMain}>
              {t('settings.prompt.apply')}
            </button>
          </div>
        </div>
        <textarea
          className="form-input settings-prompt-ta"
          value={text}
          maxLength={PROMPT_MAX}
          onChange={onPromptTextChange}
          placeholder={t('settings.prompt.placeholder')}
        />
        <div className="settings-prompt-count">
          {t('settings.prompt.max')}: {PROMPT_MAX} {t('settings.prompt.chars')} · {text.length} / {PROMPT_MAX}
        </div>
        <div className="settings-hint-box">
          <span className="settings-hint-ico" aria-hidden>
            ◆
          </span>
          {t('settings.prompt.hint')}
        </div>
      </div>

      <div className="settings-card" style={{ marginTop: 12 }}>
        <div className="settings-card-head">
          <div>
            <div className="settings-card-title">{t('settings.prompt.templates')}</div>
            <div className="settings-card-sub">{t('settings.prompt.templatesSub')}</div>
          </div>
          <span className="settings-count-pill">
            {t('settings.prompt.countTpl').replace('{n}', String(allUserCount))}
          </span>
        </div>

        <div className="settings-tpl-block-title">{t('settings.prompt.builtIn')}</div>
        <ul className="settings-tpl-list">
          {BUILTIN_PROMPT_TEMPLATES.map((tpl) => {
            const isActive = templateActiveId === tpl.id
            return (
              <li key={tpl.id} className={`settings-tpl-row ${isActive ? 'is-active' : ''}`}>
                <div className="settings-tpl-text">{tpl.content}</div>
                <div className="settings-tpl-footer">
                  <div className="settings-tpl-foot-left">
                    {isActive && (
                      <>
                        <span className="settings-tpl-in-use">{t('settings.prompt.currentlyUsing')}</span>
                        <span className="settings-tpl-sep" aria-hidden>
                          ·
                        </span>
                      </>
                    )}
                    <span className="settings-tag">{t('settings.prompt.tagSystemBuiltIn')}</span>
                  </div>
                  <div className="settings-tpl-foot-right">
                    {isActive ? (
                      <button type="button" className="btn btn-sm settings-tpl-btn--current" disabled>
                        {t('settings.prompt.currentlyUsing')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void useTemplate(tpl.id, tpl.content)}
                      >
                        {t('settings.prompt.useInEditor')}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {userTpls.length > 0 && (
          <>
            <div className="settings-tpl-block-title" style={{ marginTop: 16 }}>
              {t('settings.prompt.userTpl')}
            </div>
            <ul className="settings-tpl-list">
              {userTpls.map((tpl) => {
                const isActive = templateActiveId === tpl.id
                return (
                  <li key={tpl.id} className={`settings-tpl-row ${isActive ? 'is-active' : ''}`}>
                    <div>
                      <div className="settings-tpl-name">{tpl.name}</div>
                      <div className="settings-tpl-text settings-tpl-text--short">{tpl.content}</div>
                    </div>
                    <div className="settings-tpl-footer">
                      <div className="settings-tpl-foot-left">
                        {isActive && (
                          <>
                            <span className="settings-tpl-in-use">{t('settings.prompt.currentlyUsing')}</span>
                            <span className="settings-tpl-sep" aria-hidden>
                              ·
                            </span>
                          </>
                        )}
                        <span className="settings-tag">{t('settings.prompt.userTpl')}</span>
                      </div>
                      <div className="settings-tpl-foot-right">
                        {isActive ? (
                          <button type="button" className="btn btn-sm settings-tpl-btn--current" disabled>
                            {t('settings.prompt.currentlyUsing')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => void useTemplate(tpl.id, tpl.content)}
                          >
                            {t('settings.prompt.useInEditor')}
                          </button>
                        )}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeUserTpl(tpl.id)}>
                          ×
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
    {saveTplOpen && (
      <div
        className="settings-modal-backdrop"
        role="presentation"
        onClick={() => setSaveTplOpen(false)}
      >
        <div
          className="settings-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-save-tpl-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div id="settings-save-tpl-title" className="settings-modal-title">
            {t('settings.prompt.saveTemplateTitle')}
          </div>
          <label className="form-label" htmlFor="settings-save-tpl-name">
            {t('settings.prompt.nameForTemplate')}
          </label>
          <input
            id="settings-save-tpl-name"
            className="form-input"
            value={saveTplName}
            onChange={(e) => setSaveTplName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirmSaveTemplate()
              }
            }}
            autoFocus
            maxLength={120}
            placeholder={t('settings.prompt.nameForTemplate')}
          />
          <div className="settings-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setSaveTplOpen(false)}>
              {t('settings.cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmSaveTemplate}>
              {t('settings.confirm')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function KnowledgeSection({ data, refresh }: { data: Record<string, any>; refresh: () => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const items = (data.knowledgeTextItems || []) as { id: string; title: string; content: string }[]
  const files = (data.knowledgeFiles || []) as { id: string; name: string; localPath: string; size: number }[]
  const images = (data.knowledgeImages || []) as { id: string; name: string; localPath: string }[]

  const saveTextItem = async () => {
    if (!title.trim()) {
      showSettingsToast(t('settings.kb.titlePlaceholder'), 'error')
      return
    }
    if (items.length >= MAX_TEXT_KNOWLEDGE_ITEMS) {
      showSettingsToast('最多 3 条', 'error')
      return
    }
    const next = [
      ...items,
      { id: uid(), title: title.slice(0, KNOWLEDGE_TITLE_MAX), content: content.slice(0, KNOWLEDGE_CONTENT_MAX) }
    ]
    await window.electron?.invoke('settings:set', { knowledgeTextItems: next })
    setTitle('')
    setContent('')
    await pushEngineConfigIfRunning()
    refresh()
    showSettingsToast(t('settings.saved'), 'success')
  }

  const removeText = (id: string) => {
    const next = items.filter((x) => x.id !== id)
    void window.electron?.invoke('settings:set', { knowledgeTextItems: next }).then(() => {
      void pushEngineConfigIfRunning()
      refresh()
    })
  }

  const importFile = async () => {
    const r = (await window.electron?.invoke('knowledge:importFile')) as any
    if (!r) return
    if (r.error) {
      showSettingsToast(r.error, 'error')
      return
    }
    if (files.length >= 3) {
      showSettingsToast('已达文件上限', 'error')
      return
    }
    const next = [...files, r]
    await window.electron?.invoke('settings:set', { knowledgeFiles: next })
    await pushEngineConfigIfRunning()
    refresh()
    showSettingsToast(t('settings.saved'), 'success')
  }

  const importImage = async () => {
    const r = (await window.electron?.invoke('knowledge:importImage')) as any
    if (!r) return
    if (r.error) {
      showSettingsToast(r.error, 'error')
      return
    }
    if (images.length >= 3) {
      showSettingsToast('已达图片上限', 'error')
      return
    }
    const next = [...images, r]
    await window.electron?.invoke('settings:set', { knowledgeImages: next })
    refresh()
    showSettingsToast(t('settings.saved'), 'success')
  }

  const removeFile = async (f: { id: string; localPath: string }) => {
    await window.electron?.invoke('knowledge:unlink', f.localPath)
    const next = files.filter((x) => x.id !== f.id)
    await window.electron?.invoke('settings:set', { knowledgeFiles: next })
    await pushEngineConfigIfRunning()
    refresh()
  }

  const removeImage = async (f: { id: string; localPath: string }) => {
    await window.electron?.invoke('knowledge:unlink', f.localPath)
    const next = images.filter((x) => x.id !== f.id)
    await window.electron?.invoke('settings:set', { knowledgeImages: next })
    refresh()
  }

  return (
    <div className="settings-section">
      <header className="settings-section-head">
        <h1 className="settings-h1">{t('settings.kb.title')}</h1>
        <p className="settings-h2">{t('settings.kb.sub')}</p>
      </header>

      <div className="settings-card">
        <div className="settings-card-head">
          <div>
            <div className="settings-card-title">{t('settings.kb.text')}</div>
            <div className="settings-card-sub">{t('settings.kb.textSub')}</div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveTextItem}>
            {t('settings.kb.saveItem')}
          </button>
        </div>
        <div className="form-group">
          <input
            className="form-input"
            value={title}
            maxLength={KNOWLEDGE_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('settings.kb.titlePlaceholder')}
          />
          <div className="settings-prompt-count">
            {title.length} / {KNOWLEDGE_TITLE_MAX}
          </div>
        </div>
        <textarea
          className="form-input settings-prompt-ta"
          value={content}
          maxLength={KNOWLEDGE_CONTENT_MAX}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('settings.kb.contentPlaceholder')}
        />
        <div className="settings-prompt-count">
          {content.length} / {KNOWLEDGE_CONTENT_MAX}
        </div>

        <div className="settings-tpl-block-title">{t('settings.kb.list')}</div>
        {items.length === 0 ? (
          <div className="settings-empty">{t('settings.kb.empty')}</div>
        ) : (
          <ul className="settings-kb-list">
            {items.map((it) => (
              <li key={it.id} className="settings-kb-item">
                <strong>{it.title}</strong>
                <p className="settings-kb-snippet">{it.content}</p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeText(it.id)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="settings-card" style={{ marginTop: 12 }}>
        <div className="settings-card-head">
          <div>
            <div className="settings-card-title">{t('settings.kb.file')}</div>
            <div className="settings-card-sub">{t('settings.kb.fileSub')}</div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={importFile}>
            {t('settings.kb.selectFile')}
          </button>
        </div>
        <p className="settings-muted-block">{t('settings.kb.fileQuota')}</p>
        {files.length === 0 ? (
          <div className="settings-empty">{t('settings.kb.fileEmpty')}</div>
        ) : (
          <ul className="settings-file-list">
            {files.map((f) => (
              <li key={f.id} className="settings-file-row">
                <span>{f.name}</span>
                <span className="settings-muted">{(f.size / 1024).toFixed(1)} KB</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void removeFile(f)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="settings-card" style={{ marginTop: 12 }}>
        <div className="settings-card-head">
          <div>
            <div className="settings-card-title">{t('settings.kb.image')}</div>
            <div className="settings-card-sub">{t('settings.kb.imageSub')}</div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={importImage}>
            {t('settings.kb.importImage')}
          </button>
        </div>
        {images.length === 0 ? (
          <div className="settings-empty">{t('settings.kb.imageEmpty')}</div>
        ) : (
          <ul className="settings-file-list">
            {images.map((f) => (
              <li key={f.id} className="settings-file-row">
                <span>{f.name}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void removeImage(f)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ModelsSection({ data, refresh }: { data: Record<string, any>; refresh: () => void }) {
  type Preset = {
    id: string
    provider: string
    label: string
    model: string
    baseURL: string
    apiKey: string
    systemPrompt?: string
    activePromptTemplateId?: string
  }
  const [presets, setPresets] = useState<Preset[]>(data.modelPresets || [])
  const [activeId, setActiveId] = useState<string>(data.activeModelPresetId || '')
  /** 图1：仅列表；图2：应用与 API */
  const [configOpen, setConfigOpen] = useState(false)
  /** 每次进入「添加/编辑」时递增，用于重挂载表单 */
  const [addFormKey, setAddFormKey] = useState(0)
  /** null = 添加新条；有 id = 编辑该条 */
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  /** 列表行「测试」中，避免重复点击 */
  const [testingPresetId, setTestingPresetId] = useState<string | null>(null)

  useEffect(() => {
    setPresets(data.modelPresets || [])
    setActiveId(data.activeModelPresetId || '')
  }, [data])

  const byProvider = useMemo(() => {
    const m = new Map<string, Preset[]>()
    for (const p of presets) {
      const k = p.provider || 'Other'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return m
  }, [presets])

  const persist = async (next: Preset[], active: string) => {
    const chosen = next.find((p) => p.id === active)
    const patch: Record<string, any> = { modelPresets: next, activeModelPresetId: active }
    if (chosen) {
      patch.apiKey = chosen.apiKey
      patch.model = chosen.model
      patch.baseURL = chosen.baseURL
    }
    await window.electron?.invoke('settings:set', patch)
    await pushEngineConfigIfRunning()
    refresh()
  }

  const setActive = (id: string) => {
    setActiveId(id)
    void persist(presets, id)
    showSettingsToast(t('settings.saved'), 'success')
  }

  const remove = (id: string) => {
    const next = presets.filter((x) => x.id !== id)
    const act = activeId === id ? (next[0]?.id || '') : activeId
    setPresets(next)
    setActiveId(act)
    void persist(next, act)
  }

  const appType = (data.appType || 'weixin') as 'weixin' | 'wework'

  const applyAppType = async (next: 'weixin' | 'wework') => {
    const inv = window.electron?.invoke
    if (typeof inv !== 'function') {
      showSettingsToast(t('settings.saveFailed'), 'error')
      return
    }
    try {
      await inv('settings:set', { appType: next })
      await pushEngineConfigIfRunning()
      refresh()
      showSettingsToast(t('settings.saved'), 'success')
    } catch (e) {
      console.error('appType', e)
      showSettingsToast(t('settings.saveFailed'), 'error')
    }
  }

  const testPresetConnectivity = async (p: Preset) => {
    const inv = window.electron?.invoke
    if (typeof inv !== 'function') {
      showSettingsToast(t('settings.saveFailed'), 'error')
      return
    }
    const keyTrim = (p.apiKey || '').trim()
    if (!keyTrim) {
      showSettingsToast(t('control.start.nokey'), 'error')
      return
    }
    setTestingPresetId(p.id)
    try {
      const r = await inv('engine:testConnection', {
        apiKey: keyTrim,
        model: (p.model || '').trim() || undefined,
        baseURL: (p.baseURL || '').trim() || undefined
      })
      if (r?.success) {
        showSettingsToast(`${p.label || p.model} · ${t('settings.testConnection.success')}`, 'success')
      } else {
        const detail = (r?.error ?? '').trim()
        const fail = t('settings.testConnection.fail')
        showSettingsToast(detail ? `${p.label || p.model} · ${fail}: ${detail}` : `${p.label || p.model} · ${fail}`, 'error')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const detail = msg.trim()
      const fail = t('settings.testConnection.fail')
      showSettingsToast(detail ? `${p.label || p.model} · ${fail}: ${detail}` : `${p.label || p.model} · ${fail}`, 'error')
    } finally {
      setTestingPresetId(null)
    }
  }

  return (
    <div className="settings-section">
      <header className="settings-section-head">
        <h1 className="settings-h1">{t('settings.models.title')}</h1>
        <p className="settings-h2">{t('settings.models.sub')}</p>
      </header>

      {!configOpen && (
        <>
          <div className="settings-card settings-card--app-type-list">
            <AppTypeRow value={appType} onChange={(v) => void applyAppType(v)} />
          </div>
          <div className="settings-card">
            <div className="settings-card-head">
              <div>
                <div className="settings-card-title">{t('settings.models.card')}</div>
                <div className="settings-card-sub">{t('settings.models.cardSub')}</div>
              </div>
              <div className="settings-card-actions" style={{ alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditingPresetId(null)
                    setAddFormKey((k) => k + 1)
                    setConfigOpen(true)
                  }}
                >
                  {t('settings.models.add')}
                </button>
              </div>
            </div>

            {presets.length === 0 ? (
              <div className="settings-empty">{t('settings.models.empty')}</div>
            ) : (
              <div className="settings-model-groups">
                {Array.from(byProvider.entries()).map(([prov, list]) => (
                  <div key={prov} className="settings-model-group">
                    <div className="settings-provider-label">{prov.toUpperCase()}</div>
                    {list.map((p) => (
                      <div
                        key={p.id}
                        className={`settings-model-tile ${p.id === activeId ? 'is-active' : ''}`}
                        onClick={() => setActive(p.id)}
                        onKeyDown={() => {}}
                        role="button"
                        tabIndex={0}
                      >
                        <div>
                          <div className="settings-model-name">{p.label}</div>
                          <div className="settings-model-id">{p.model}</div>
                        </div>
                        <div className="settings-model-actions">
                          {p.id === activeId ? (
                            <span className="settings-pill is-current">{t('settings.models.currentTag')}</span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActive(p.id)
                              }}
                            >
                              {t('settings.models.optional')}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={testingPresetId === p.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void testPresetConnectivity(p)
                            }}
                          >
                            {testingPresetId === p.id ? t('settings.testConnection.testing') : t('settings.models.test')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingPresetId(p.id)
                              setAddFormKey((k) => k + 1)
                              setConfigOpen(true)
                            }}
                          >
                            {t('settings.models.edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              remove(p.id)
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {configOpen && (
        <div className="settings-models-config">
          <button
            type="button"
            className="btn btn-secondary settings-models-back"
            onClick={() => {
              setConfigOpen(false)
              setEditingPresetId(null)
            }}
          >
            {t('settings.models.backToList')}
          </button>
          <ModelsConnectionBlock
            key={`${addFormKey}-${editingPresetId ?? 'add'}`}
            data={data}
            refresh={refresh}
            editingPresetId={editingPresetId}
            onAfterSave={() => {
              setConfigOpen(false)
              setEditingPresetId(null)
            }}
          />
        </div>
      )}
    </div>
  )
}

/* Toast bridge — uses global from App or falls back */
let _settingsToast: ((m: string, type: 'success' | 'error') => void) | null = null
export function registerSettingsToast(fn: (m: string, type: 'success' | 'error') => void) {
  _settingsToast = fn
}
function showSettingsToast(msg: string, type: 'success' | 'error') {
  if (_settingsToast) _settingsToast(msg, type)
  else console.log(msg)
}
