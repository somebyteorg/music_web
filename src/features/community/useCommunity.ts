import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { communityApi } from '@/lib/api/community'
import type { Activity, Message } from '@/types/community'
import type { User } from '@/types/session'
import { useSignStore } from '@/stores/sign'
import { notify, useAction } from '@/composables/useFeedback'
import { useLatest } from '@/lib/query'
import { defaultHistoryCategory, fields, formatValue } from './activity'

export function useCommunity() {
  const route = useRoute()
  const router = useRouter()
  const sign = useSignStore()
  const section = computed(() => route.meta.section as 'history' | 'members' | 'inbox')
  const { busy: acting, run } = useAction()
  const page = computed({
    get: () => Math.max(1, Math.trunc(Number(route.query.page)) || 1),
    set: (value: number) => updateQuery({ page: value > 1 ? String(value) : undefined }),
  })
  const pageSize = ref(section.value === 'history' ? 16 : 30)
  const loaded = ref(false)
  const total = ref(0)
  // 三个栏目共用一次「只保留最新一次」的加载：busy / error 由查询层托管
  const request = useLatest()
  const busy = request.busy
  const error = request.error
  const history = ref<Activity[]>([])
  const members = ref<(User & { created_at: string })[]>([])
  const messages = ref<Message[]>([])
  const q = ref('')
  const historyFilters = reactive({ category: defaultHistoryCategory, user: '', from: '', to: '' })
  const scopedHistory = computed(() => Boolean(route.query.entity_type || route.query.entity_id))
  const inspect = ref<Activity>()
  const dialog = ref(false)
  const roleDialog = ref(false)
  const roleChange = ref<{ member: User; role: User['role'] }>()
  const titles = { history: '操作记录', members: '成员', inbox: '消息' }
  const emptyStates = {
    history: { title: '暂无匹配记录', description: '试试其他操作分类、成员名字或日期。' },
    members: { title: '没有找到成员', description: '试试其他用户名或昵称。' },
    inbox: { title: '暂时没有新消息', description: '收到消息后，会显示在这里。' },
  }
  const roleOptions: { value: User['role']; label: string }[] = [
    { value: 'user', label: '用户' },
    { value: 'edit', label: '编辑' },
    { value: 'admin', label: '管理员' },
  ]
  function roleLabel(value: unknown) {
    return roleOptions.find((option) => option.value === value)?.label || formatValue(value)
  }
  function updateQuery(values: Record<string, string | undefined>) {
    void router.push({ query: { ...route.query, ...values } })
  }
  function searchMembers() {
    updateQuery({ q: q.value.trim() || undefined, page: undefined })
  }
  function searchHistory() {
    if (busy.value) return
    if (historyFilters.from && historyFilters.to && historyFilters.to < historyFilters.from) {
      error.value = '结束日期不能早于开始日期。'
      return
    }
    const query = {
      ...route.query,
      category:
        historyFilters.category === defaultHistoryCategory ? undefined : historyFilters.category,
      user: historyFilters.user.trim() || undefined,
      from: historyFilters.from || undefined,
      to: historyFilters.to || undefined,
      page: undefined,
    }
    if (router.resolve({ query }).fullPath === route.fullPath) void load()
    else void router.push({ query })
  }
  function showAllHistory() {
    updateQuery({ entity_type: undefined, entity_id: undefined, page: undefined })
  }
  const changes = computed(() => {
    const log = inspect.value
    if (!log) return []
    return Object.entries(fields)
      .filter(([key]) => JSON.stringify(log.before?.[key]) !== JSON.stringify(log.after?.[key]))
      .map(([key, label]) => ({
        label,
        before: key === 'role' ? roleLabel(log.before?.[key]) : formatValue(log.before?.[key]),
        after: key === 'role' ? roleLabel(log.after?.[key]) : formatValue(log.after?.[key]),
      }))
  })
  async function load() {
    const outcome = await request.run(async (signal) => {
      const params: Record<string, string | number> = { page: page.value }
      if (section.value === 'history') {
        for (const key of ['category', 'user', 'from', 'to'] as const) {
          if (route.query[key]) params[key] = String(route.query[key])
        }
        if (route.query.entity_type) params.entity_type = String(route.query.entity_type)
        if (route.query.entity_id) params.entity_id = String(route.query.entity_id)
        const r = await communityApi.history<Activity>(params, signal)
        if (signal.aborted) return
        history.value = r.items
        total.value = r.total
        pageSize.value = r.page_size
      } else if (section.value === 'members') {
        if (q.value) params.q = q.value
        const r = await communityApi.members<User & { created_at: string }>(params, signal)
        if (signal.aborted) return
        members.value = r.items
        total.value = r.total
        pageSize.value = r.page_size
      } else if (section.value === 'inbox') {
        const r = await communityApi.inbox<Message>(params, signal)
        if (signal.aborted) return
        messages.value = r.items
        total.value = r.total
        pageSize.value = r.page_size
      }
    })
    // 被更新的一次取代时不写首屏标记（与原来 finally 里的判断一致）
    if (outcome.status !== 'canceled') loaded.value = true
  }
  watch(
    () => route.fullPath,
    () => {
      roleDialog.value = false
      roleChange.value = undefined
      q.value = String(route.query.q || '')
      historyFilters.category = String(route.query.category || defaultHistoryCategory)
      historyFilters.user = String(route.query.user || '')
      historyFilters.from = String(route.query.from || '')
      historyFilters.to = String(route.query.to || '')
      void load()
    },
    { immediate: true },
  )
  async function restore() {
    if (!inspect.value) return
    await run(async () => {
      await communityApi.restoreHistory(inspect.value!.id)
      notify('已恢复到修改前的版本。')
      dialog.value = false
      await load()
    })
  }
  async function read(id?: number) {
    await run(async () => {
      await communityApi.markRead(id)
      window.dispatchEvent(new Event('music-inbox-updated'))
      await load()
    })
  }
  function canChangeRole(user: User) {
    return sign.isAdmin && user.id !== sign.user?.id
  }
  function changeRole(user: User, value: User['role']) {
    if (acting.value || !canChangeRole(user) || user.role === value) return
    roleChange.value = { member: { ...user }, role: value }
    roleDialog.value = true
  }
  async function confirmRoleChange() {
    const change = roleChange.value
    if (!roleDialog.value || !change || !canChangeRole(change.member)) return
    await run(async () => {
      await communityApi.changeRole(change.member.id, change.role)
      roleDialog.value = false
      roleChange.value = undefined
      notify('角色已更新。')
      await load()
    })
  }

  return {
    sign,
    section,
    acting,
    page,
    pageSize,
    loaded,
    total,
    busy,
    error,
    history,
    members,
    messages,
    q,
    historyFilters,
    scopedHistory,
    inspect,
    dialog,
    roleDialog,
    roleChange,
    titles,
    emptyStates,
    roleOptions,
    roleLabel,
    searchMembers,
    searchHistory,
    showAllHistory,
    changes,
    load,
    restore,
    read,
    canChangeRole,
    changeRole,
    confirmRoleChange,
  }
}
