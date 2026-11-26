import { computed, ref, type Ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { isUploadDone, type UploadTask } from '@/features/uploads/model'

export function useUploadGroups(tasks: Ref<UploadTask[]>) {
  const groupBy = useStorage<'folder' | 'album'>('music-upload-grouping', 'folder')
  const collapsed = ref<Record<string, boolean>>({})
  const groups = computed(() => {
    const map = new Map<
      string,
      { key: string; name: string; subtitle: string; tasks: UploadTask[] }
    >()
    for (const task of tasks.value) {
      const slash = task.relativePath.lastIndexOf('/')
      const folder = slash >= 0 ? task.relativePath.slice(0, slash) : ''
      const name =
        groupBy.value === 'album' ? task.metadata.album || '未识别专辑' : folder || '单独选择的文件'
      const subtitle =
        groupBy.value === 'album'
          ? [task.metadata.albumArtist, task.metadata.year, task.metadata.catalogNumber]
              .filter(Boolean)
              .join(' · ')
          : ''
      const key = `${groupBy.value}:${name}:${subtitle}`
      if (!map.has(key)) map.set(key, { key, name, subtitle, tasks: [] })
      map.get(key)!.tasks.push(task)
    }
    return [...map.values()].map((group) => {
      const total = group.tasks.reduce((sum, task) => sum + task.size, 0)
      const sent = group.tasks.reduce(
        (sum, task) => sum + (task.size * task.transfer.progress) / 100,
        0,
      )
      return {
        ...group,
        total,
        progress: total ? Math.round((sent / total) * 100) : 0,
        done: group.tasks.filter(isUploadDone).length,
        ready: group.tasks.filter(
          (task) => task.kind === 'audio' && task.state === 'ready' && task.transfer.file,
        ),
      }
    })
  })
  function toggle(key: string) {
    collapsed.value[key] = !collapsed.value[key]
  }
  return { groupBy, groups, collapsed, toggle }
}
