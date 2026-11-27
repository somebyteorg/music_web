<script lang="ts" setup>
import EmptyState from '@/components/ui/EmptyState.vue'
import Tag from '@/components/ui/Tag.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import Pagination from '@/components/Pagination.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import { bytes, date, displayName } from '@/utils/format'
import { actions, historyCategoryOptions } from '@/features/community/activity'
import { useCommunity } from '@/features/community/useCommunity'

const {
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
} = useCommunity()
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
  <Card
    as="form"
    class="history-filters"
    v-if="section === 'history'"
    @submit.prevent="searchHistory"
  >
    <label>
      操作分类
      <BaseSelect
        v-model="historyFilters.category"
        :options="historyCategoryOptions"
        :searchable="false"
        label="操作分类"
      />
    </label>
    <label>
      成员名字
      <input v-model="historyFilters.user" maxlength="100" placeholder="化名或用户名" />
    </label>
    <label>从哪一天<input v-model="historyFilters.from" type="date" /></label>
    <label
      >到哪一天<input v-model="historyFilters.to" :min="historyFilters.from" type="date"
    /></label>
    <Button variant="primary" :aria-busy="busy" :disabled="busy">
      {{ busy ? '正在查找…' : '找找记录' }}
    </Button>
    <Button
      variant="secondary"
      v-if="scopedHistory"
      :disabled="busy"
      type="button"
      @click="showAllHistory"
    >
      查看全部记录
    </Button>
  </Card>
  <div v-else-if="section === 'members'" class="filter-bar">
    <form class="search-inline" @submit.prevent="searchMembers">
      <input
        v-model="q"
        aria-label="搜索成员"
        maxlength="100"
        placeholder="搜索用户名或昵称"
      /><Button variant="secondary">搜索</Button>
    </form>
    <span class="filter-count">共 {{ total }} 条</span
    ><TextButton :disabled="busy" @click="load">刷新</TextButton>
  </div>
  <div v-if="error" class="notice error">
    {{ error }} <TextButton @click="load">重试</TextButton>
  </div>
  <div v-if="busy && !loaded" class="skeleton list-skeleton"></div>
  <template v-else
    ><Card class="history-list" v-if="section === 'history' && history.length">
      <article v-for="log in history" :key="log.id">
        <span class="avatar small">{{ displayName(log.user).slice(0, 1) }}</span>
        <div class="history-body">
          <p>
            <strong>{{ displayName(log.user) }}</strong>
            <span class="muted">{{ actions[log.action] || '更新了' }}</span>
            <RouterLink
              v-if="
                ['songs', 'albums', 'artists', 'playlists'].includes(log.entity_type) &&
                log.action !== 'deleted' &&
                log.action !== 'merged'
              "
              :to="`/${log.entity_type}/${log.entity_id}`"
              >{{ log.title }}</RouterLink><strong v-else>{{ log.title }}</strong>
          </p>
          <p v-if="log.reason" class="history-reason">{{ log.reason }}</p>
          <span class="hint">{{ date(log.created_at) }}</span>
        </div>
        <TextButton
          @click="
            () => {
              inspect = log
              dialog = true
            }
          "
        >
          查看变更
        </TextButton>
      </article>
    </Card>
    <Card class="member-list" v-if="section === 'members' && members.length">
      <article v-for="(member, index) in members" :key="member.id">
        <span :class="['ranking', { top: page === 1 && index < 3 }]">{{
          (page - 1) * 30 + index + 1
        }}</span><img v-if="member.avatar" :src="member.avatar" alt="" class="avatar" /><span
          v-else
          class="avatar"
          >{{ displayName(member).slice(0, 1) }}</span
        >
        <div class="member-name">
          <strong>{{ displayName(member) }}</strong>
          <BaseSelect
            v-if="canChangeRole(member)"
            :disabled="acting || busy"
            :label="`修改 ${displayName(member)} 的角色`"
            :model-value="member.role"
            :options="roleOptions"
            :searchable="false"
            class="member-role"
            @update:model-value="changeRole(member, $event)"
          />
          <Tag variant="default" class="member-role" v-else>{{ roleLabel(member.role) }}</Tag>
        </div>
        <div class="member-contribution">
          <strong>{{ bytes(member.size_upload) }}</strong><span class="hint">累计上传</span>
        </div>
      </article>
    </Card>
    <div v-if="section === 'inbox' && messages.length" class="message-list">
      <Card
        v-for="message in messages"
        :key="message.id"
        as="article"
        :class="['message', { unread: !message.read_at }]"
      >
        <span class="message-icon">✉</span>
        <div>
          <h3>{{ message.title }}</h3>
          <p>{{ message.body }}</p>
          <span class="hint">{{ date(message.created_at) }}</span><RouterLink
            v-if="message.link?.startsWith('/')"
            :to="message.link"
            class="text-link"
            @click="read(message.id)"
            >查看详情 ↗</RouterLink
          >
        </div>
        <TextButton v-if="!message.read_at" :disabled="acting" @click="read(message.id)">
          标为已读
        </TextButton>
      </Card>
    </div>
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
      @change="page = $event" /></template
  ><BaseDialog v-model="dialog" :busy="acting" title="变更记录"
    ><div v-if="inspect" class="form-stack">
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
    <template #footer
      ><Button variant="secondary" :disabled="acting" @click="dialog = false">关闭</Button
      ><Button
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
      </Button></template
    ></BaseDialog
  >
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
.history-filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 14px;
  padding: 16px;
}
.history-filters > label {
  width: 180px;
  font-size: 12px;
  color: var(--text-muted);
}
.history-list > article,
.member-list > article {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}
.history-list > article:last-child,
.member-list > article:last-child {
  border: 0;
}
.history-body {
  min-width: 0;
  flex: 1;
}
.history-body > p {
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.history-body > p .muted {
  font-size: 12px;
  margin-inline: 4px;
}
.history-body > p > a {
  color: var(--brand);
}
.history-reason {
  margin-top: 5px;
  color: var(--text-muted);
  font-size: 12px !important;
}
.history-body .hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
}
.history-list .text-button {
  white-space: nowrap;
}
.member-list > article {
  align-items: center;
}
.ranking {
  width: 22px;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}
.ranking.top {
  color: var(--warning);
}
.member-name {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.member-name strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.member-role {
  align-self: flex-start;
}
.member-role :deep(.select-trigger) {
  width: auto;
  min-height: 0;
  gap: 4px;
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.6;
}
.member-role :deep(.select-trigger:hover:not(:disabled)) {
  background: var(--brand-veil);
}
.member-contribution {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 90px;
  text-align: right;
}
.member-contribution strong {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.member-contribution .hint {
  font-size: 11px;
}
.message-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
}
.message.unread {
  background: var(--surface-hover);
  border-color: var(--brand-line);
}
.message-icon {
  font-size: 22px;
  color: var(--brand);
}
.message > div {
  min-width: 0;
  flex: 1;
}
.message h3 {
  font-size: 14px;
}
.message p {
  margin: 6px 0;
  color: var(--text-muted);
  font-size: 13px;
  white-space: pre-line;
}
.message .hint {
  font-size: 11px;
}
.message .text-link {
  margin-left: 12px;
}
.message .text-button {
  white-space: nowrap;
}
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
  background: var(--danger-soft);
  color: var(--danger-ink);
}
.history-diff .after {
  background: var(--success-soft);
  color: var(--success-ink);
}
@media (max-width: 680px) {
  .history-filters {
    gap: 9px;
    padding: 10px;
  }
  .history-filters > label {
    flex: 1 1 130px;
  }
  .history-list > article,
  .member-list > article {
    padding: 11px 10px;
    gap: 8px;
    flex-wrap: wrap;
  }
  .history-list .text-button {
    margin-left: 36px;
  }
  .history-body {
    flex-basis: calc(100% - 40px);
  }
  .member-contribution {
    min-width: 74px;
  }
  .ranking {
    width: 16px;
  }
  .message {
    padding: 12px;
    gap: 10px;
    flex-wrap: wrap;
  }
  .message .text-button {
    margin-left: 32px;
  }
}
</style>
