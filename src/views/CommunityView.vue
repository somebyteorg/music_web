<script lang="ts" setup>
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import Pagination from '@/components/Pagination.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import { provide } from 'vue'
import { date, displayName } from '@/utils/format'
import { actions } from '@/features/community/activity'
import { useCommunity } from '@/features/community/useCommunity'
import HistoryList from './community/HistoryList.vue'
import MembersList from './community/MembersList.vue'
import InboxList from './community/InboxList.vue'
import { communityContextKey } from './community/communityContext'

/**
 * 社区页：只做栏目切换与加载。
 * 三个栏目（操作记录 / 成员 / 消息）各自成组件，共享的加载占位、错误提示、空态、分页和
 * 两个常驻对话框留在本视图；控制器由 useCommunity 创建后 provide 给子组件。
 */
const community = useCommunity()
const { sign, section, acting, page, pageSize, loaded, total, busy, error, titles, emptyStates } =
  community
const { inspect, dialog, roleDialog, roleChange, changes, load, restore, read, roleLabel } =
  community
const { confirmRoleChange } = community
provide(communityContextKey, { community })
</script>

<template>
  <div class="page-heading">
    <div class="heading-title">
      <h1>{{ titles[section] }}</h1>
      <span class="muted">{{ total }} 条</span>
    </div>
    <Button variant="secondary" v-if="section === 'inbox'" :disabled="acting" @click="read()">
      全部标为已读
    </Button>
  </div>
  <HistoryList v-if="section === 'history'" />
  <MembersList v-else-if="section === 'members'" />
  <InboxList v-else />
  <div v-if="error" class="notice error">
    {{ error }} <TextButton @click="load">重试</TextButton>
  </div>
  <div v-if="busy && !loaded" class="skeleton list-skeleton"></div>
  <template v-else>
    <EmptyState
      v-if="!total && !error"
      panel
      :symbol="section === 'inbox' ? '✉' : '✧'"
      :title="emptyStates[section].title"
    >
      {{ emptyStates[section].description }}
    </EmptyState>
    <Pagination
      :busy="busy"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @change="page = $event"
    />
  </template>
  <BaseDialog v-model="dialog" :busy="acting" title="变更记录">
    <div v-if="inspect" class="form-stack">
      <h3>{{ inspect.title }}</h3>
      <p class="muted">
        {{ displayName(inspect.user) }} · {{ actions[inspect.action] || '更新' }} ·
        {{ date(inspect.created_at) }}
      </p>
      <p v-if="inspect.reason" class="notice">{{ inspect.reason }}</p>
      <div v-for="change in changes" :key="change.label" class="history-diff">
        <strong>{{ change.label }}</strong>
        <p class="before">{{ change.before }}</p>
        <p class="after">{{ change.after }}</p>
      </div>
      <p v-if="!changes.length" class="hint">这次操作更新了资源或关联关系。</p>
      <p v-if="inspect.action === 'merged'" class="hint">
        合并后的资料或音频如有修改，将无法自动恢复，请手动调整。
      </p>
      <p
        v-if="
          inspect.before && ['songs', 'albums', 'artists', 'files'].includes(inspect.entity_type)
        "
        class="hint"
      >
        只能恢复该条目最近一次操作前的版本。
      </p>
    </div>
    <template #footer>
      <Button variant="secondary" :disabled="acting" @click="dialog = false">关闭</Button>
      <Button
        variant="primary"
        v-if="
          inspect?.before &&
          ['songs', 'albums', 'artists', 'files'].includes(inspect.entity_type) &&
          (inspect.user_id === sign.user?.id || sign.canModerate)
        "
        :disabled="acting"
        @click="restore"
      >
        {{ acting ? '正在恢复…' : '恢复修改前的版本' }}
      </Button>
    </template>
  </BaseDialog>
  <BaseDialog v-model="roleDialog" :busy="acting" title="确认修改角色">
    <div v-if="roleChange" class="form-stack">
      <p>
        确认将 <strong>{{ displayName(roleChange.member) }}</strong> 的角色从
        <strong>{{ roleLabel(roleChange.member.role) }}</strong> 修改为
        <strong>{{ roleLabel(roleChange.role) }}</strong>？
      </p>
      <p class="hint">修改后将按新角色授予权限，并写入操作记录。</p>
    </div>
    <template #footer>
      <Button variant="secondary" :disabled="acting" @click="roleDialog = false">取消</Button>
      <Button variant="primary" :disabled="acting" @click="confirmRoleChange">
        {{ acting ? '正在修改…' : '确认修改' }}
      </Button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.history-diff {
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.history-diff > strong {
  font-size: 13px;
}
.history-diff p {
  padding: 8px;
  margin-top: 6px;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.history-diff .before {
  background: var(--danger-diff);
  color: var(--danger-ink);
}
.history-diff .after {
  background: var(--success-diff);
  color: var(--success-ink);
}
</style>
