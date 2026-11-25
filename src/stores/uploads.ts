import { computed, markRaw, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useIntervalFn, useStorage } from '@vueuse/core'
import type { Upload } from 'tus-js-client'
import { report } from '@/composables/useFeedback'
import api from '@/utils/ky'
import { createUuid } from '@/utils/uuid'
import { prepareUpload } from '@/utils/uploadPreparation'
import { prepareArtwork } from '@/utils/albumArtwork'
import { useSignStore } from './sign'
import type { AudioFile } from '@/types/uploads'
import type { Person } from '@/types/catalog'
import { useUploadPublishing } from '@/features/uploads/useUploadPublishing'
import { applyTaskMetadata, applyUploadedFile } from '@/features/uploads/taskMetadata'
import { summarizeUploads, type UploadTransfer } from '@/features/uploads/taskStats'

import {
  ACTIVE_UPLOAD_STATES,
  isUploadDone,
  normalizeUploadConcurrency,
  TRANSMIT_STATES,
  type UploadTask,
} from '@/features/uploads/model'

interface SessionResponse {
  session: { status: string; error?: string | null; expires_at?: string; tus_id?: string | null }
  file: AudioFile | null
}

const STORAGE_KEY = 'music-upload-tasks-v1'
/** 已完成任务只保留最近这么多条，避免无限膨胀 */
const KEEP_DONE = 200
/** 进度事件很密集：合并写入，而不是每个 progress 都全量序列化 */
const PERSIST_DELAY = 800

type SavedTasks = Record<string, UploadTask[]>

function readSaved(): SavedTasks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as SavedTasks) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export const useUploadsStore = defineStore('uploads', () => {
  const sign = useSignStore()
  const saved = ref<SavedTasks>(readSaved())
  const concurrency = useStorage('music-upload-concurrency', 8)
  concurrency.value = normalizeUploadConcurrency(concurrency.value)
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  let persistBlocked = false
  let persistWarned = false

  function snapshot(): SavedTasks {
    const out: SavedTasks = {}
    for (const [userId, list] of Object.entries(saved.value)) {
      const done = list.filter(isUploadDone)
      const dropped = new Set(
        done.slice(0, Math.max(0, done.length - KEEP_DONE)).map((task) => task.id),
      )
      out[userId] = list.filter((task) => !dropped.has(task.id))
    }
    return out
  }

  function persistNow() {
    if (persistBlocked) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()))
    } catch (error) {
      // 配额/隐私模式：停止写入并明确告知，避免"看起来存了、其实没存"
      persistBlocked = true
      if (!persistWarned) {
        persistWarned = true
        report(new Error('本地存储空间不足，上传队列将不再自动保存，刷新后可能需要重新添加文件。'))
      }
      console.error('[uploads] 持久化失败', error)
    }
  }

  watch(
    saved,
    () => {
      clearTimeout(persistTimer)
      persistTimer = setTimeout(persistNow, PERSIST_DELAY)
    },
    { deep: true },
  )

  const localFiles = new Map<string, File>()
  const localArtwork = reactive(new Map<string, string>())
  const active = new Map<string, Upload>()
  const attempts = new Map<string, symbol>()
  const controllers = new Map<string, AbortController>()
  const polling = new Set<string>()
  const cancelWait = new Map<string, () => void>()
  const transfers = reactive(new Map<string, UploadTransfer>())
  const now = ref(Date.now())
  let pausedPump = 0
  const tasks = computed(() => saved.value[String(sign.user?.id)] || [])
  const { publishing, publish, publishMany } = useUploadPublishing(tasks)
  const activeCount = computed(
    () => tasks.value.filter((task) => ACTIVE_UPLOAD_STATES.includes(task.state)).length,
  )
  const stats = computed(() => summarizeUploads(tasks.value, transfers, now.value))
  watch(
    () => sign.user?.id,
    (_next, previous) => {
      if (previous) stop()
      if (!sign.user) return
      for (const task of tasks.value)
        if (TRANSMIT_STATES.includes(task.state)) task.state = 'paused'
      void poll()
    },
  )
  function saveTask(task: UploadTask): UploadTask {
    const key = String(sign.user!.id)
    if (!saved.value[key]) saved.value[key] = []
    saved.value[key].push(task)
    return tasks.value.find((entry) => entry.id === task.id)!
  }
  function finishWithFile(task: UploadTask, file: AudioFile, reused = false) {
    applyUploadedFile(task, file, reused)
    localFiles.delete(task.id)
    releaseArtwork(task.id)
    transfers.delete(task.id)
  }
  async function add(files: FileList | File[], options: { kind?: 'cover'; song?: Person } = {}) {
    const config = sign.config
    if (!config || !sign.user) throw new Error('请先登录再上传。')
    let skipped = 0
    const batchId = createUuid()
    for (const source of Array.from(files)) {
      let file = source
      const extension = file.name.split('.').pop()?.toLowerCase() || ''
      const kind =
        options.kind ||
        (config.audio_extensions.includes(extension)
          ? 'audio'
          : config.cover_extensions.includes(extension)
            ? 'cover'
            : null)
      if (
        !kind ||
        (options.song && kind !== 'audio') ||
        file.size === 0 ||
        (kind === 'audio' && file.size > config.max_file_size)
      ) {
        skipped++
        continue
      }
      if (kind === 'cover' && file.size > config.max_cover_size) {
        pump()
        try {
          file = await prepareArtwork(file, config.max_cover_size)
        } catch {
          skipped++
          continue
        }
        if (file.size > config.max_cover_size) {
          skipped++
          continue
        }
      }
      const fingerprint = [
        source.webkitRelativePath || source.name,
        source.size,
        source.lastModified,
      ].join(':')
      let task = tasks.value.find(
        (entry) =>
          entry.fingerprint === fingerprint &&
          entry.targetSongId === options.song?.id &&
          !isUploadDone(entry),
      )
      if (task) {
        localFiles.set(task.id, markRaw(file))
        if (task.kind === 'cover' && !localArtwork.has(task.id))
          localArtwork.set(task.id, URL.createObjectURL(file))
        if (task.state === 'paused') task.state = 'queued'
        continue
      }
      task = saveTask({
        id: createUuid(),
        fingerprint,
        name: file.name,
        size: file.size,
        relativePath: file.webkitRelativePath || file.name,
        batchId,
        kind,
        state: 'queued',
        progress: 0,
        error: '',
        targetSongId: options.song?.id,
        targetSongName: options.song?.name,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: '',
        album: '',
        version: '',
        track: 1,
        disc: 1,
      })
      localFiles.set(task.id, markRaw(file))
      if (kind === 'cover') localArtwork.set(task.id, URL.createObjectURL(file))
    }
    pump()
    return skipped
  }
  function pump() {
    if (!sign.user || pausedPump) return
    const limit = normalizeUploadConcurrency(concurrency.value)
    for (const task of tasks.value) {
      if (attempts.size >= limit) break
      if (task.state === 'queued' && localFiles.has(task.id) && !attempts.has(task.id))
        void start(task)
    }
  }
  async function start(task: UploadTask) {
    const file = localFiles.get(task.id)
    if (!file || !sign.user) return
    const userId = sign.user.id
    const attempt = Symbol()
    const controller = new AbortController()
    attempts.set(task.id, attempt)
    controllers.set(task.id, controller)
    task.error = ''
    const assertActive = () => {
      if (controller.signal.aborted || task.state === 'paused' || sign.user?.id !== userId)
        throw new DOMException('上传已暂停。', 'AbortError')
    }
    try {
      if (task.sessionId) {
        const response = await api
          .get(`uploads/${task.sessionId}`, { signal: controller.signal })
          .json<SessionResponse>()
        assertActive()
        if (['processing', 'publishing', 'complete'].includes(response.session.status)) {
          task.state = response.session.status === 'publishing' ? 'publishing' : 'processing'
          await pollTask(task)
          return
        }
        if (response.session.status === 'failed') {
          task.state = 'failed'
          task.errorStage = 'processing'
          task.error = response.session.error || '文件处理失败，请重新解析。'
          return
        }
        if (response.session.status === 'uploading' && !task.uploadUrl && response.session.tus_id)
          task.uploadUrl = `${task.endpoint!.replace(/\/$/, '')}/${response.session.tus_id.split('/').map(encodeURIComponent).join('/')}`
      }
      if (!task.sha256 || (!task.sessionId && task.kind === 'audio' && !task.preparedLyrics)) {
        task.state = 'preparing'
        task.errorStage = 'preparation'
        const prepared = await prepareUpload(
          file,
          task.kind === 'audio',
          controller.signal,
          (metadata) => {
            if (!controller.signal.aborted) applyTaskMetadata(task, metadata)
          },
          (progress) => {
            if (!controller.signal.aborted) task.preparationProgress = progress
          },
        )
        assertActive()
        task.sha256 = prepared.sha256
        task.preparedLyrics = prepared.metadata.preparedLyrics || []
      }
      if (!task.sessionId) {
        task.state = 'checking'
        task.errorStage = 'preparation'
        const existing = await api
          .post('uploads/check', {
            signal: controller.signal,
            json: {
              sha256: task.sha256,
              prepared_lyrics: task.preparedLyrics,
              kind: task.kind,
              file_size: task.size,
              context: task.batchId
                ? { batch_id: task.batchId, relative_path: task.relativePath }
                : undefined,
            },
          })
          .json<{ file: AudioFile | null }>()
        assertActive()
        const index = tasks.value.findIndex((entry) => entry.id === task.id)
        const source = tasks.value
          .slice(0, index)
          .find(
            (entry) =>
              entry.sha256 === task.sha256 &&
              entry.kind === task.kind &&
              !entry.file &&
              ACTIVE_UPLOAD_STATES.includes(entry.state),
          )
        if (existing.file || source) {
          task.duplicateFile = existing.file || undefined
          task.duplicateOf = source?.id
          task.state = 'duplicate'
          task.errorStage = undefined
          if (task.kind === 'cover' && existing.file) finishWithFile(task, existing.file, true)
          return
        }
        const response = await api
          .post('uploads', {
            signal: controller.signal,
            json: {
              kind: task.kind,
              file_name: task.name,
              file_size: task.size,
              song_id: task.targetSongId,
              prepared_lyrics: task.preparedLyrics,
              sha256: task.sha256,
              context: task.batchId
                ? { batch_id: task.batchId, relative_path: task.relativePath }
                : undefined,
            },
          })
          .json<{ session: { id: string }; token: string; endpoint: string }>()
        assertActive()
        task.sessionId = response.session.id
        delete task.preparedLyrics
        task.token = response.token
        task.endpoint = response.endpoint
      }
      assertActive()
      task.state = 'uploading'
      task.errorStage = 'transfer'
      const { Upload: TusUpload } = await import('tus-js-client')
      await new Promise<void>((resolve, reject) => {
        cancelWait.set(task.id, () => reject(new DOMException('上传已暂停。', 'AbortError')))
        const upload = new TusUpload(file, {
          endpoint: task.endpoint,
          uploadUrl: task.uploadUrl,
          chunkSize: sign.config!.chunk_size,
          retryDelays: [0, 1000, 3000, 5000, 10000],
          removeFingerprintOnSuccess: true,
          fingerprint: async () => `music:${userId}:${task.sessionId}:${task.fingerprint}`,
          metadata: { session_id: task.sessionId!, token: task.token! },
          onUploadUrlAvailable: () => {
            task.uploadUrl = upload.url || undefined
          },
          onProgress: (sent, total) => {
            const time = Date.now()
            const previous = transfers.get(task.id)
            const delta = previous ? time - previous.at : 0
            const rate =
              previous && delta > 0 ? (Math.max(0, sent - previous.sent) * 1000) / delta : 0
            transfers.set(task.id, {
              sent,
              at: time,
              speed: previous ? previous.speed * 0.65 + rate * 0.35 : 0,
            })
            const progress = Math.round((sent / total) * 100)
            if (progress !== task.progress) task.progress = progress
          },
          onError: reject,
          onSuccess: () => resolve(),
        })
        active.set(task.id, upload)
        upload.start()
      })
      assertActive()
      task.state = 'processing'
      task.errorStage = 'processing'
      task.progress = 100
      await pollTask(task)
    } catch (error) {
      if (task.state !== 'paused' && sign.user?.id === userId) {
        task.state = 'failed'
        task.error = error instanceof Error ? error.message : '上传未能完成，请重试。'
      }
    } finally {
      if (attempts.get(task.id) === attempt) {
        attempts.delete(task.id)
        active.delete(task.id)
        controllers.delete(task.id)
        cancelWait.delete(task.id)
        transfers.delete(task.id)
      }
      pump()
    }
  }
  async function pollTask(task: UploadTask) {
    if (!task.sessionId || polling.has(task.id) || publishing.has(task.id) || !sign.user) return
    const userId = sign.user.id
    polling.add(task.id)
    try {
      const response = await api.get(`uploads/${task.sessionId}`).json<SessionResponse>()
      if (sign.user?.id !== userId) return
      if (response.session.status === 'complete' && response.file)
        finishWithFile(task, response.file)
      else if (response.session.status === 'failed') {
        const stage = task.state === 'publishing' ? 'publishing' : 'processing'
        task.state = 'failed'
        task.errorStage = stage
        task.error = response.session.error || '文件处理未完成，可以重试。'
      } else if (response.session.status === 'publishing') {
        task.state = 'publishing'
        task.errorStage = 'publishing'
      }
    } catch (error) {
      task.error = error instanceof Error ? error.message : '获取处理状态失败，请重试。'
    } finally {
      polling.delete(task.id)
    }
  }
  const POLL_TICK = 3000
  const POLL_MAX_BACKOFF = 30000
  /** 每轮最多查这么多任务，任务多时轮转，避免一次打出几十个请求 */
  const POLL_BATCH = 12
  let pollBackoff = POLL_TICK
  let pollNotBefore = 0
  const lastPolled = new Map<string, number>()

  function pendingTasks() {
    return tasks.value.filter((task) => ['processing', 'publishing'].includes(task.state))
  }

  async function poll() {
    const pending = pendingTasks()
    if (!pending.length) return
    const batch = [...pending]
      .sort((a, b) => (lastPolled.get(a.id) ?? 0) - (lastPolled.get(b.id) ?? 0))
      .slice(0, POLL_BATCH)
    for (const task of batch) lastPolled.set(task.id, Date.now())
    await Promise.all(batch.map(pollTask))
  }

  function resetPolling() {
    pollBackoff = POLL_TICK
    pollNotBefore = 0
  }

  useIntervalFn(() => {
    // 后台标签页不轮询；退避期未到也跳过
    if (typeof document !== 'undefined' && document.hidden) return
    if (Date.now() < pollNotBefore) return
    void poll().finally(() => {
      pollBackoff = Math.min(Math.round(pollBackoff * 1.4), POLL_MAX_BACKOFF)
      pollNotBefore = Date.now() + pollBackoff
    })
  }, POLL_TICK)
  // 有新任务开始处理时立刻恢复高频轮询
  watch(
    () => pendingTasks().length,
    (count, previous) => {
      if (count > (previous ?? 0)) resetPolling()
    },
  )
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) resetPolling()
    })
  }
  useIntervalFn(() => {
    now.value = Date.now()
  }, 1000)
  async function pause(task: UploadTask) {
    if (!TRANSMIT_STATES.includes(task.state)) return
    task.state = 'paused'
    controllers.get(task.id)?.abort()
    cancelWait.get(task.id)?.()
    await active.get(task.id)?.abort()
  }
  async function pauseAll(scope = tasks.value) {
    pausedPump++
    try {
      await Promise.all(scope.filter((task) => TRANSMIT_STATES.includes(task.state)).map(pause))
    } finally {
      pausedPump--
      pump()
    }
  }
  async function resumeTask(task: UploadTask) {
    task.error = ''
    if (task.file && task.pendingPublish && task.errorStage === 'publishing') {
      await publish(task, task.pendingPublish)
      return
    }
    if (task.sessionId) {
      const response = await api.get(`uploads/${task.sessionId}`).json<SessionResponse>()
      if (['processing', 'publishing', 'complete'].includes(response.session.status)) {
        task.state = response.session.status === 'publishing' ? 'publishing' : 'processing'
        await pollTask(task)
        return
      }
      if (response.session.status === 'failed') {
        await api.post(`uploads/${task.sessionId}/retry`)
        task.state = 'processing'
        return
      }
      if (new Date(response.session.expires_at || '').getTime() < Date.now()) {
        task.sessionId = undefined
        task.token = undefined
        task.uploadUrl = undefined
        task.endpoint = undefined
        task.progress = 0
      }
    }
    if (!localFiles.has(task.id)) {
      task.state = 'paused'
      task.error = '重新选择原文件或原文件夹后，即可继续上传。'
      return
    }
    task.state = 'queued'
    pump()
  }
  async function retry(task: UploadTask) {
    try {
      await resumeTask(task)
    } catch (error) {
      if (!['ready', 'processing', 'publishing'].includes(task.state)) task.state = 'failed'
      task.error = error instanceof Error ? error.message : '暂时无法恢复任务，请重试。'
      throw error
    }
  }
  function restart(task: UploadTask) {
    if (!['failed', 'paused'].includes(task.state)) return
    task.sessionId = undefined
    task.token = undefined
    task.uploadUrl = undefined
    task.endpoint = undefined
    task.sha256 = undefined
    task.preparationProgress = 0
    task.progress = 0
    task.errorStage = undefined
    task.error = ''
    task.state = localFiles.has(task.id) ? 'queued' : 'paused'
    if (task.state === 'paused') task.error = '请重新选择原文件或文件夹，开始重新上传。'
    pump()
  }
  async function retryAll(scope = tasks.value, onlyFailed = false) {
    const results = await Promise.allSettled(
      scope
        .filter(
          (task) =>
            task.state === 'failed' ||
            (task.state === 'ready' && task.errorStage === 'publishing' && !!task.error) ||
            (!onlyFailed && task.state === 'paused'),
        )
        .map(retry),
    )
    return results.filter((result) => result.status === 'rejected').length
  }
  function duplicateFile(task: UploadTask) {
    return task.duplicateFile || tasks.value.find((entry) => entry.id === task.duplicateOf)?.file
  }
  async function useDuplicate(task: UploadTask) {
    let file = duplicateFile(task)
    if (!file) throw new Error('相同文件仍在处理中，请稍后再试。')
    if (
      task.batchId &&
      task.sha256 &&
      !file.upload_context?.some(
        (context) =>
          context.batch_id === task.batchId && context.relative_path === task.relativePath,
      )
    ) {
      const result = await api
        .post('uploads/check', {
          json: {
            sha256: task.sha256,
            kind: task.kind,
            file_size: task.size,
            context: { batch_id: task.batchId, relative_path: task.relativePath },
          },
        })
        .json<{ file: AudioFile | null }>()
      if (!result.file) throw new Error('已有文件已被删除，请重新上传。')
      file = result.file
    }
    if (task.targetSongId && file.song_id && file.song_id !== task.targetSongId)
      throw new Error('相同文件已关联其他歌曲，请到原歌曲页面移动音频。')
    if (task.targetSongId && !file.song_id) {
      task.state = 'publishing'
      publishing.add(task.id)
      try {
        const result = await api
          .post(`files/${file.id}/publish`, { json: { song_id: task.targetSongId } })
          .json<{ file: AudioFile }>()
        finishWithFile(task, { ...result.file, preview: file.preview }, true)
      } catch (error) {
        task.state = 'duplicate'
        throw error
      } finally {
        publishing.delete(task.id)
      }
    } else finishWithFile(task, file, true)
  }
  function skip(task: UploadTask) {
    if (task.state !== 'duplicate') return
    task.state = 'skipped'
    task.error = ''
    localFiles.delete(task.id)
    releaseArtwork(task.id)
    task.duplicateFile = undefined
  }
  function adopt(file: AudioFile): UploadTask {
    const existing = tasks.value.find((task) => task.file?.id === file.id)
    if (existing) {
      if (!file.song_id) finishWithFile(existing, file, existing.reused)
      existing.file = { ...file, metadata: null }
      return existing
    }
    const task = saveTask({
      id: createUuid(),
      fingerprint: '',
      name: file.file_name,
      size: file.file_size,
      relativePath: file.upload_context?.at(-1)?.relative_path || file.file_name,
      batchId: file.upload_context?.at(-1)?.batch_id,
      kind: file.kind,
      state: 'ready',
      progress: 100,
      error: '',
      title: file.file_name.replace(/\.[^.]+$/, ''),
      artist: '',
      album: '',
      version: '',
      track: 1,
      disc: 1,
    })
    finishWithFile(task, file)
    return task
  }
  async function remove(task: UploadTask) {
    if (['processing', 'publishing'].includes(task.state)) return
    if (TRANSMIT_STATES.includes(task.state)) await pause(task)
    const list = saved.value[String(sign.user?.id)]
    const index = list?.findIndex((entry) => entry.id === task.id) ?? -1
    if (list && index >= 0) list.splice(index, 1)
    for (const dependent of tasks.value.filter(
      (entry) => entry.state === 'duplicate' && entry.duplicateOf === task.id,
    )) {
      dependent.duplicateOf = undefined
      if (task.file) dependent.duplicateFile = task.file
      else {
        dependent.state = localFiles.has(dependent.id) ? 'queued' : 'paused'
        dependent.error = dependent.state === 'paused' ? '请重新选择原文件，继续校验和上传。' : ''
      }
    }
    localFiles.delete(task.id)
    releaseArtwork(task.id)
    transfers.delete(task.id)
    pump()
  }
  async function forgetFile(id: string) {
    for (const task of [...tasks.value]) {
      if (task.file?.id === id) await remove(task)
      else if (task.duplicateFile?.id === id) task.duplicateFile = undefined
    }
  }
  function releaseArtwork(id: string) {
    const url = localArtwork.get(id)
    if (url) URL.revokeObjectURL(url)
    localArtwork.delete(id)
  }
  function localCover(task: UploadTask) {
    return localArtwork.get(task.id) || ''
  }
  function stop() {
    for (const list of Object.values(saved.value))
      for (const task of list) if (TRANSMIT_STATES.includes(task.state)) task.state = 'paused'
    for (const controller of controllers.values()) controller.abort()
    for (const cancel of cancelWait.values()) cancel()
    for (const upload of active.values()) void upload.abort()
    transfers.clear()
  }
  async function cover(file: File): Promise<AudioFile> {
    const fingerprint = [file.webkitRelativePath || file.name, file.size, file.lastModified].join(
      ':',
    )
    await add([file], { kind: 'cover' })
    const task = [...tasks.value]
      .reverse()
      .find((entry) => entry.kind === 'cover' && entry.fingerprint === fingerprint)
    if (!task) throw new Error('封面超出大小上限或格式不支持。')
    if (task.state === 'failed') await retry(task)
    if (task.file) return task.file
    return new Promise((resolve, reject) => {
      let reusing = false
      const timer = setInterval(() => {
        if (task.state === 'duplicate' && duplicateFile(task) && !reusing) {
          reusing = true
          void useDuplicate(task).catch((error) => {
            clearInterval(timer)
            reject(error)
          })
        }
        if (task.file) {
          clearInterval(timer)
          resolve(task.file)
        } else if (
          task.state === 'failed' ||
          task.state === 'paused' ||
          task.state === 'skipped' ||
          !tasks.value.some((entry) => entry.id === task.id) ||
          !sign.user ||
          (task.duplicateOf &&
            tasks.value.find((entry) => entry.id === task.duplicateOf)?.state === 'failed')
        ) {
          clearInterval(timer)
          reject(new Error(task.error || '封面没有上传完成。'))
        }
      }, 500)
    })
  }
  watch(concurrency, pump)
  return {
    tasks,
    stats,
    concurrency,
    activeCount,
    add,
    pump,
    pause,
    pauseAll,
    retry,
    restart,
    retryAll,
    remove,
    forgetFile,
    localCover,
    stop,
    duplicateFile,
    useDuplicate,
    skip,
    adopt,
    publish,
    publishMany,
    cover,
  }
})
