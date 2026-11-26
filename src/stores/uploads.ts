import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useIntervalFn } from '@vueuse/core'
import { useSignStore } from './sign'
import type { AudioFile } from '@/types/uploads'
import { useUploadPublishing } from '@/features/uploads/useUploadPublishing'
import { applyUploadedFile } from '@/features/uploads/taskMetadata'
import { summarizeUploads } from '@/features/uploads/taskStats'
import {
  ACTIVE_UPLOAD_STATES,
  normalizeUploadConcurrency,
  TRANSMIT_STATES,
  type UploadTask,
} from '@/features/uploads/model'
import { reduceTask, type UploadEvent } from '@/features/uploads/machine'
import { useUploadPersistence } from '@/features/uploads/persistence'
import { createUploadRunner } from '@/features/uploads/transport'
import { createUploadTaskOperations } from '@/features/uploads/operations'
import { createUploadRecovery } from '@/features/uploads/recovery'
import { useUploadPolling } from '@/features/uploads/polling'
import type { UploadOperationsDeps } from '@/features/uploads/operationContext'

export const useUploadsStore = defineStore('uploads', () => {
  const sign = useSignStore()
  const storage = useUploadPersistence()
  const now = ref(Date.now())
  const tasks = computed(() => storage.list(sign.user?.id))
  const { publishing, publish, publishMany } = useUploadPublishing(tasks)
  let pausedPump = 0

  /** 状态机是唯一的状态写入口：纯 reducer 算出新快照，再合并回响应式任务 */
  function apply(task: UploadTask, event: UploadEvent) {
    Object.assign(task, reduceTask(task, event))
  }

  const runner = createUploadRunner({
    userId: () => sign.user?.id,
    chunkSize: () => sign.config?.chunk_size || 0,
    tasks: () => tasks.value,
    file: (id) => storage.files.get(id),
    apply,
    finish: finishWithFile,
    isPublishing: (id) => publishing.has(id),
    idle: () => pump(),
  })
  const operationDeps: UploadOperationsDeps = {
    tasks,
    storage,
    runner,
    publishing,
    config: () => sign.config,
    userId: () => sign.user?.id,
    apply,
    finish: finishWithFile,
    pump,
    publish,
  }
  const taskOperations = createUploadTaskOperations(operationDeps)
  const operations = {
    ...taskOperations,
    ...createUploadRecovery(operationDeps, taskOperations.add),
  }

  function finishWithFile(
    task: UploadTask,
    file: AudioFile,
    reused = false,
    kind: 'processed' | 'reused' = 'processed',
  ) {
    applyUploadedFile(task, file)
    apply(task, kind === 'reused' ? { type: 'reused', reused } : { type: 'processed', reused })
    storage.files.delete(task.id)
    storage.release(task.id)
    runner.transfers.delete(task.id)
  }

  function pump() {
    if (!sign.user || pausedPump) return
    const limit = normalizeUploadConcurrency(storage.concurrency.value)
    for (const task of tasks.value) {
      if (runner.attempts >= limit) break
      if (task.state === 'queued' && storage.files.has(task.id) && !runner.busy(task.id))
        void runner.run(task)
    }
  }

  async function pollTask(task: UploadTask) {
    await runner.poll(task)
  }

  // 轮询退避与页面隐藏暂停都在调度器里，这里只提供单个任务的轮询动作
  const polling = useUploadPolling(() => tasks.value, pollTask)

  const activeCount = computed(
    () => tasks.value.filter((task) => ACTIVE_UPLOAD_STATES.includes(task.state)).length,
  )
  const stats = computed(() => summarizeUploads(tasks.value, runner.transfers, now.value))

  async function pauseAll(scope = tasks.value) {
    pausedPump++
    try {
      await Promise.all(
        scope.filter((task) => TRANSMIT_STATES.includes(task.state)).map(operations.pause),
      )
    } finally {
      pausedPump--
      pump()
    }
  }

  function stop() {
    for (const list of storage.everyone())
      for (const task of list)
        if (TRANSMIT_STATES.includes(task.state)) apply(task, { type: 'paused' })
    runner.stopActive()
  }

  watch(
    () => sign.user?.id,
    (_next, previous) => {
      if (previous) stop()
      if (!sign.user) return
      for (const task of tasks.value)
        if (TRANSMIT_STATES.includes(task.state)) apply(task, { type: 'paused' })
      polling.pollNow()
    },
  )
  watch(storage.concurrency, pump)
  useIntervalFn(() => {
    now.value = Date.now()
  }, 1000)

  return {
    tasks,
    stats,
    concurrency: storage.concurrency,
    activeCount,
    add: operations.add,
    pump,
    pause: operations.pause,
    pauseAll,
    retry: operations.retry,
    restart: operations.restart,
    retryAll: operations.retryAll,
    remove: operations.remove,
    forgetFile: operations.forgetFile,
    localCover: storage.localCover,
    stop,
    duplicateFile: operations.duplicateFile,
    useDuplicate: operations.useDuplicate,
    skip: operations.skip,
    adopt: operations.adopt,
    publish,
    publishMany,
    cover: operations.cover,
  }
})
