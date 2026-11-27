import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUploadsStore } from '@/stores/uploads'
import { notify, useAction } from '@/composables/useFeedback'
import { ACTIVE_UPLOAD_STATES, isUploadDone, TRANSMIT_STATES, type UploadTask } from './model'
import { useUploadGroups } from './useUploadGroups'

export function useUploadQueue() {
  const uploads = useUploadsStore()
  const route = useRoute()
  const router = useRouter()
  const { busy, run } = useAction()
  const taskQuery = ref('')
  const selectedIds = ref<string[]>([])
  const taskFilter = computed({
    get: () => String(route.query.status || 'all'),
    set: (value: string) => {
      void router.replace({
        query: { ...route.query, status: value === 'all' ? undefined : value },
      })
    },
  })
  function inGroup(task: UploadTask, group: string) {
    if (group === 'active') return ACTIVE_UPLOAD_STATES.includes(task.state)
    if (group === 'ready') return task.state === 'ready' && task.kind === 'audio'
    if (group === 'attention')
      return ['failed', 'paused', 'duplicate'].includes(task.state) || !!task.error
    if (group === 'done') return isUploadDone(task)
    return true
  }
  const filters = computed(() =>
    [
      { value: 'all', label: '全部' },
      { value: 'active', label: '进行中' },
      { value: 'ready', label: '待确认' },
      { value: 'attention', label: '需处理' },
      { value: 'done', label: '已完成' },
    ].map((filter) => ({
      ...filter,
      count: uploads.tasks.filter((task) => inGroup(task, filter.value)).length,
    })),
  )
  const visibleTasks = computed(() => {
    const priority = {
      failed: 0,
      duplicate: 1,
      ready: 2,
      paused: 3,
      preparing: 4,
      checking: 4,
      uploading: 5,
      processing: 6,
      publishing: 6,
      queued: 7,
      published: 8,
      skipped: 8,
    }
    const q = taskQuery.value.trim().toLocaleLowerCase()
    return uploads.tasks
      .filter(
        (task) =>
          inGroup(task, taskFilter.value) &&
          (!q ||
            task.name.toLocaleLowerCase().includes(q) ||
            task.relativePath.toLocaleLowerCase().includes(q) ||
            task.metadata.album.toLocaleLowerCase().includes(q) ||
            task.metadata.artist.toLocaleLowerCase().includes(q)),
      )
      .sort(
        (a, b) =>
          (a.kind === 'cover' && a.state === 'ready' ? 6 : priority[a.state]) -
          (b.kind === 'cover' && b.state === 'ready' ? 6 : priority[b.state]),
      )
  })
  const grouping = reactive(useUploadGroups(visibleTasks))
  const chosenTasks = computed(() =>
    uploads.tasks.filter(
      (task) =>
        selectedIds.value.includes(task.id) && task.state === 'ready' && task.kind === 'audio',
    ),
  )
  const canPause = computed(() =>
    uploads.tasks.some((task) => TRANSMIT_STATES.includes(task.state)),
  )
  const canResume = computed(
    () =>
      uploads.tasks.some((task) => ['paused', 'failed'].includes(task.state)) ||
      uploads.stats.failed > 0,
  )
  function toggleSelection(task: UploadTask) {
    const index = selectedIds.value.indexOf(task.id)
    if (index >= 0) selectedIds.value.splice(index, 1)
    else selectedIds.value.push(task.id)
  }
  function selectGroup(tasks: UploadTask[]) {
    const ready = tasks.filter((task) => task.kind === 'audio' && task.state === 'ready')
    const all = ready.every((task) => selectedIds.value.includes(task.id))
    selectedIds.value = all
      ? selectedIds.value.filter((id) => !ready.some((task) => task.id === id))
      : [...new Set([...selectedIds.value, ...ready.map((task) => task.id)])]
  }
  async function resumeAll(onlyFailed = false) {
    await run(async () => {
      const failed = await uploads.retryAll(uploads.tasks, onlyFailed)
      if (failed) notify(`${failed} 个任务暂未恢复，请查看对应任务的错误提示。`, true)
    })
  }
  async function retry(task: UploadTask) {
    await run(() => uploads.retry(task))
  }

  return {
    busy,
    run,
    taskQuery,
    selectedIds,
    taskFilter,
    filters,
    visibleTasks,
    grouping,
    chosenTasks,
    canPause,
    canResume,
    toggleSelection,
    selectGroup,
    resumeAll,
    retry,
  }
}
