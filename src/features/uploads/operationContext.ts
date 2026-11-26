import type { ComputedRef } from 'vue'
import type { ContributionConfig } from '@/types/session'
import type { AudioFile, PublishData } from '@/types/uploads'
import type { UploadTask } from './model'
import type { UploadEvent } from './machine'
import type { UploadRunner } from './transport'
import type { UploadPersistence } from './persistence'

export interface UploadOperationsDeps {
  tasks: ComputedRef<UploadTask[]>
  storage: UploadPersistence
  runner: UploadRunner
  publishing: Set<string>
  config(): ContributionConfig | null
  userId(): number | undefined
  apply(task: UploadTask, event: UploadEvent): void
  finish(task: UploadTask, file: AudioFile, reused?: boolean, kind?: 'processed' | 'reused'): void
  pump(): void
  publish(task: UploadTask, data: PublishData): Promise<unknown>
}

export function operationError(error: unknown, fallback = '暂时无法恢复任务，请重试。') {
  return error instanceof Error ? error.message : fallback
}
