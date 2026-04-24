import { app, shell, BrowserWindow, ipcMain, desktopCapturer, dialog } from 'electron'
import { copyFile, mkdir, readFile, rm, stat } from 'fs/promises'
import { basename, join, resolve, sep } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { checkAndRequestPermissions } from './permission'
import Store from 'electron-store'
import { Engine } from '../core/engine'
import { LocalHooks } from '../core/local-hooks'
import { AIClient } from '../core/ai-client'
import { RPADevice } from '../core/rpa-device'
const StoreClass = typeof Store === 'function' ? Store : ((Store as any).default as typeof Store)
const settingsStore = new StoreClass({
  name: 'settings',
  defaults: {
    apiKey: '',
    model: '',
    baseURL: '',
    systemPrompt: '',
    /** 系统提示词：当前在用的模板 id（内置或用户模板的 id），空字符串表示未从模板选用 */
    activePromptTemplateId: '',
    locale: 'zh',
    appType: 'weixin',
    promptUserTemplates: [] as { id: string; name: string; content: string }[],
    knowledgeTextItems: [] as { id: string; title: string; content: string }[],
    knowledgeFiles: [] as { id: string; name: string; localPath: string; size: number }[],
    knowledgeImages: [] as { id: string; name: string; localPath: string }[],
    modelPresets: [] as {
      id: string
      provider: string
      label: string
      model: string
      baseURL: string
      apiKey: string
      /** 与「系统提示词」页绑定，按模型分别保存 */
      systemPrompt?: string
      activePromptTemplateId?: string
    }[],
    activeModelPresetId: '',
    /** 用户设置 — 偏好 */
    sendShortcut: 'mod_enter' as 'enter' | 'mod_enter',
    streamingInput: true,
    autoPause: false,
    /** 界面：浅色 / 深色 / 跟随系统 */
    uiTheme: 'dark' as 'light' | 'dark' | 'system'
  }
})

const MAX_KNOWLEDGE_FILE_BYTES = 5 * 1024 * 1024
const MAX_KNOWLEDGE_FILES = 3
const MAX_KNOWLEDGE_IMAGES = 3

function knowledgeDirs() {
  const root = app.getPath('userData')
  return { files: join(root, 'knowledge', 'files'), images: join(root, 'knowledge', 'images') }
}

function isUnderDir(base: string, target: string): boolean {
  const b = resolve(base) + sep
  const t = resolve(target)
  return t === resolve(base) || t.startsWith(b)
}

function safeUnlinkUserFile(absPath: string): boolean {
  const root = app.getPath('userData')
  if (!isUnderDir(root, absPath)) return false
  void rm(absPath, { force: true })
  return true
}

let engine: Engine | null = null
let localHooks: LocalHooks | null = null

/** 主界面：窄条控制台（与设置页大窗口分离） */
const WIN_CONTROL = { width: 420, height: 700, minWidth: 360, minHeight: 500 }
/** 设置中心：横向大窗口 */
const WIN_SETTINGS = { width: 1000, height: 720, minWidth: 640, minHeight: 520 }

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: WIN_CONTROL.width,
    height: WIN_CONTROL.height,
    minWidth: WIN_CONTROL.minWidth,
    minHeight: WIN_CONTROL.minHeight,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#0a0b10',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // 检查和请求 macOS 需要的权限
  await checkAndRequestPermissions()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // ── Settings 持久化 ──
  ipcMain.handle('settings:getAll', async () => {
    return settingsStore.store
  })

  ipcMain.handle('settings:get', async (_event, key: string) => {
    return settingsStore.get(key)
  })

  ipcMain.handle('settings:set', async (_event, data: Record<string, any>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue
      settingsStore.set(key, value)
    }
    return { success: true }
  })

  // ── 主窗口：控制台窄窗 vs 设置页宽窗 ──
  ipcMain.handle('win:setViewLayout', async (_e, mode: 'control' | 'settings') => {
    const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!w || w.isDestroyed()) return
    const o = mode === 'settings' ? WIN_SETTINGS : WIN_CONTROL
    w.setMinimumSize(o.minWidth, o.minHeight)
    w.setSize(o.width, o.height, true)
  })

  // ── 知识库：导入文件/图片、聚合文本（供 system prompt 拼接）─
  ipcMain.handle('knowledge:importFile', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Text', extensions: ['txt', 'md', 'json', 'csv', 'log'] },
        { name: 'All', extensions: ['*'] }
      ]
    })
    if (canceled || !filePaths[0]) return null
    const src = filePaths[0]
    const st = await stat(src)
    if (st.size > MAX_KNOWLEDGE_FILE_BYTES) {
      return { error: `文件超过 ${MAX_KNOWLEDGE_FILE_BYTES / 1024 / 1024}MB 上限` }
    }
    const cur = (settingsStore.get('knowledgeFiles') as any[]) || []
    if (cur.length >= MAX_KNOWLEDGE_FILES) {
      return { error: `最多只能导入 ${MAX_KNOWLEDGE_FILES} 个文件` }
    }
    const { files: dir } = knowledgeDirs()
    await mkdir(dir, { recursive: true })
    const name = basename(src)
    const dest = join(dir, `${Date.now()}_${name}`)
    await copyFile(src, dest)
    return {
      id: `kf_${Date.now()}`,
      name,
      localPath: dest,
      size: st.size
    }
  })

  ipcMain.handle('knowledge:importImage', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: 'All', extensions: ['*'] }
      ]
    })
    if (canceled || !filePaths[0]) return null
    const src = filePaths[0]
    const st = await stat(src)
    if (st.size > MAX_KNOWLEDGE_FILE_BYTES) {
      return { error: `图片超过 ${MAX_KNOWLEDGE_FILE_BYTES / 1024 / 1024}MB 上限` }
    }
    const cur = (settingsStore.get('knowledgeImages') as any[]) || []
    if (cur.length >= MAX_KNOWLEDGE_IMAGES) {
      return { error: `最多只能导入 ${MAX_KNOWLEDGE_IMAGES} 张图片` }
    }
    const { images: dir } = knowledgeDirs()
    await mkdir(dir, { recursive: true })
    const name = basename(src)
    const dest = join(dir, `${Date.now()}_${name}`)
    await copyFile(src, dest)
    return { id: `ki_${Date.now()}`, name, localPath: dest }
  })

  ipcMain.handle('knowledge:unlink', async (_event, absPath: string) => {
    if (!absPath || typeof absPath !== 'string') return { success: false }
    return { success: safeUnlinkUserFile(absPath) }
  })

  ipcMain.handle('knowledge:aggregateText', async () => {
    const items = (settingsStore.get('knowledgeTextItems') as any[]) || []
    const files = (settingsStore.get('knowledgeFiles') as any[]) || []
    const blocks: string[] = []
    for (const it of items) {
      if (it?.title && it?.content) {
        blocks.push(`### ${it.title}\n${it.content}`)
      }
    }
    for (const f of files) {
      if (!f?.localPath) continue
      try {
        const buf = await readFile(f.localPath, 'utf-8')
        blocks.push(`### ${f.name || 'file'}\n${buf}`)
      } catch (e) {
        console.warn('[knowledge] skip file', f.localPath, e)
      }
    }
    return blocks.join('\n\n')
  })

  // ── Engine 操控 ──
  ipcMain.handle('engine:start', async (_event, config) => {
    if (engine?.isRunning()) return { success: false, error: '引擎已在运行中' }
    try {
      localHooks = new LocalHooks({
        ai: {
          apiKey: config.apiKey,
          model: config.model,
          baseURL: config.baseURL,
          systemPrompt: config.systemPrompt
        }
      })
      const device = new RPADevice()
      device.setAppType(config.appType || 'weixin')
      device.setAIConfig({
        apiKey: config.apiKey,
        model: config.model,
        baseURL: config.baseURL,
        systemPrompt: config.systemPrompt
      })
      const mainWindow = BrowserWindow.getAllWindows()[0]
      engine = new Engine(localHooks, device, (type, content) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('engine:log', { type, content })
        }
      })
      
      engine.start().catch((err: any) => {
        console.error('[Main] Engine loop error:', err)
      })
      
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('engine:stop', async () => {
    if (!engine?.isRunning()) return { success: false, error: '引擎未运行' }
    engine.stop()
    return { success: true }
  })

  ipcMain.handle('engine:status', async () => {
    return { running: engine?.isRunning() ?? false }
  })

  ipcMain.handle('engine:updateConfig', async (_event, config: Record<string, unknown>) => {
    if (localHooks) {
      localHooks.updateAIConfig(config as any)
      const dev = engine ? ((engine as any).device as { setAIConfig?: (c: unknown) => void }) : null
      if (
        dev?.setAIConfig &&
        (config.apiKey != null ||
          config.model != null ||
          config.baseURL != null ||
          config.systemPrompt != null)
      ) {
        dev.setAIConfig({
          apiKey: config.apiKey as string | undefined,
          model: config.model as string | undefined,
          baseURL: config.baseURL as string | undefined,
          systemPrompt: config.systemPrompt as string | undefined
        })
      }
      if (engine && config.appType) {
        ;(engine as any).device?.setAppType(config.appType)
      }
      return { success: true }
    }
    return { success: false, error: '引擎未初始化' }
  })

  ipcMain.handle('engine:testConnection', async (_event, config) => {
    const client = new AIClient(config)
    return client.testConnection()
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('capture-screen', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      })
      if (sources && sources.length > 0) {
        return sources[0].thumbnail.toDataURL()
      }
      return null
    } catch (error) {
      console.error('Screen capture failed:', error)
      return null
    }
  })

  // ── 测试入口：VLM 并行 vs 串行 ──
  ipcMain.handle('test:vlm-parallel', async () => {
    const apiKey = settingsStore.get('apiKey') as string
    if (!apiKey) return { error: '请先在设置中填写 API Key' }
    const { runVlmParallelTest } = await import('../core/rpa/tests/test-vlm-parallel')
    return await runVlmParallelTest(apiKey, 'weixin')
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
