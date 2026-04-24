/** 构建引擎启动/更新使用的配置（含知识库拼接与模型预设解析） */

const DEFAULT_MODEL = 'doubao-seed-2-0-lite-260215'

export interface EngineUserConfig {
  apiKey: string
  model?: string
  baseURL?: string
  systemPrompt?: string
  appType: 'weixin' | 'wework'
}

export async function buildEngineConfig(): Promise<EngineUserConfig> {
  const s = (await window.electron?.invoke('settings:getAll')) as Record<string, any> | undefined
  if (!s) {
    return { apiKey: '', appType: 'weixin', model: DEFAULT_MODEL }
  }

  const kb = (await window.electron?.invoke('knowledge:aggregateText')) as string

  const presets = (s.modelPresets || []) as Array<{
    id: string
    apiKey?: string
    model?: string
    baseURL?: string
    systemPrompt?: string
  }>
  const aid = s.activeModelPresetId as string | undefined
  const pr = aid ? presets.find((p) => p.id === aid) : undefined
  /** 有模型预设时：系统提示词主体以该预设为准，未单独设置时回退全局 `systemPrompt` */
  const base = pr
    ? String(pr.systemPrompt ?? (s.systemPrompt as string) ?? '')
    : (s.systemPrompt as string) || ''
  const systemPrompt =
    [base, kb ? `## 知识库（仅供模型参考）\n\n${kb}` : ''].filter(Boolean).join('\n\n') || undefined

  if (pr) {
    return {
      apiKey: pr.apiKey || '',
      model: pr.model || DEFAULT_MODEL,
      baseURL: pr.baseURL || undefined,
      systemPrompt,
      appType: (s.appType as 'weixin' | 'wework') || 'weixin'
    }
  }

  return {
    apiKey: (s.apiKey as string) || '',
    model: (s.model as string) || DEFAULT_MODEL,
    baseURL: (s.baseURL as string) || undefined,
    systemPrompt,
    appType: (s.appType as 'weixin' | 'wework') || 'weixin'
  }
}

export async function pushEngineConfigIfRunning(): Promise<void> {
  const cfg = await buildEngineConfig()
  await window.electron?.invoke('engine:updateConfig', {
    apiKey: cfg.apiKey || undefined,
    model: cfg.model,
    baseURL: cfg.baseURL,
    systemPrompt: cfg.systemPrompt,
    appType: cfg.appType
  })
}
