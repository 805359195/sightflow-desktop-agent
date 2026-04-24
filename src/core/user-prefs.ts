// 与设置页「用户设置」存储一致（electron-store，主进程内读取）
import Store from 'electron-store'

const StoreClass = typeof Store === 'function' ? Store : ((Store as any).default as typeof Store)
const store = new StoreClass({ name: 'settings' })

export type SendShortcutMode = 'enter' | 'mod_enter'

/** 与电脑微信中「按 Enter 发送 / 按 Ctrl+Enter 发送」需保持一致 */
export function getSendShortcutFromStore(): SendShortcutMode {
  const v = store.get('sendShortcut') as SendShortcutMode | undefined
  return v === 'enter' || v === 'mod_enter' ? v : 'mod_enter'
}
