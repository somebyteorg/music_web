<script lang="ts" setup>
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
    <button v-if="section === 'inbox'" :disabled="acting" class="button secondary" @click="read()">
      全部标为已读
    </button>
  </div>
  <form v-if="section === 'history'" class="panel history-filters" @submit.prevent="searchHistory">
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
    <button :aria-busy="busy" :disabled="busy" class="button primary">
      {{ busy ? '正在查找…' : '找找记录' }}
    </button>
    <button
      v-if="scopedHistory"
      :disabled="busy"
      class="button secondary"
      type="button"
      @click="showAllHistory"
    >
      查看全部记录
    </button>
  </form>
  <div v-else-if="section === 'members'" class="filter-bar">
    <form class="search-inline" @submit.prevent="searchMembers">
      <input
        v-model="q"
        aria-label="搜索成员"
        maxlength="100"
        placeholder="搜索用户名或昵称"
      /><button class="button secondary">搜索</button>
    </form>
    <span class="filter-count">共 {{ total }} 条</span
    ><button :disabled="busy" class="text-button" @click="load">刷新</button>
  </div>
  <div v-if="error" class="notice error">
    {{ error }} <button class="text-button" @click="load">重试</button>
  </div>
  <div v-if="busy && !loaded" class="skeleton list-skeleton"></div>
  <template v-else
    ><div v-if="section === 'history' && history.length" class="panel history-list">
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
        <button
          class="text-button"
          @click="
            () => {
              inspect = log
              dialog = true
            }
          "
        >
          查看变更
        </button>
      </article>
    </div>
    <div v-if="section === 'members' && members.length" class="panel member-list">
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
          <span v-else class="badge quiet member-role">{{ roleLabel(member.role) }}</span>
        </div>
        <div class="member-contribution">
          <strong>{{ bytes(member.size_upload) }}</strong><span class="hint">累计上传</span>
        </div>
      </article>
    </div>
    <div v-if="section === 'inbox' && messages.length" class="message-list">
      <article
        v-for="message in messages"
        :key="message.id"
        :class="['panel message', { unread: !message.read_at }]"
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
        <button
          v-if="!message.read_at"
          :disabled="acting"
          class="text-button"
          @click="read(message.id)"
        >
          标为已读
        </button>
      </article>
    </div>
    <div v-if="!total && !error" class="empty panel">
      <span class="empty-symbol">{{ section === 'inbox' ? '✉' : '✧' }}</span>
      <h2>{{ emptyStates[section].title }}</h2>
      <p>{{ emptyStates[section].description }}</p>
    </div>
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
      ><button :disabled="acting" class="button secondary" @click="dialog = false">关闭</button
      ><button
        v-if="
          inspect?.before &&
          ['songs', 'albums', 'artists', 'files'].includes(inspect.entity_type) &&
          (inspect.user_id === sign.user?.id || sign.canModerate)
        "
        :disabled="acting"
        class="button primary"
        @click="restore"
      >
        {{ acting ? '正在恢复…' : '恢复修改前的版本' }}
      </button></template
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
      <button :disabled="acting" class="button secondary" @click="roleDialog = false">取消</button>
      <button :disabled="acting" class="button primary" @click="confirmRoleChange">
        {{ acting ? '正在修改…' : '确认修改' }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.history-filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-16);
  margin-bottom: 14px;
  padding: var(--space-16);
}
.history-filters > label {
  width: 180px;
  font-size: var(--font-sm);
  color: var(--muted);
}
.history-list > article,
.member-list > article {
  display: flex;
  align-items: flex-start;
  gap: var(--space-12);
  padding: var(--space-12) var(--space-16);
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
  font-size: var(--font-base);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.history-body > p .muted {
  font-size: var(--font-sm);
  margin-inline: var(--space-4);
}
.history-body > p > a {
  color: var(--purple);
}
.history-reason {
  margin-top: 5px;
  color: var(--muted);
  font-size: var(--font-sm) !important;
}
.history-body .hint {
  display: block;
  margin-top: 4px;
  font-size: var(--font-xs);
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
  color: var(--muted);
  font-size: var(--font-sm);
  text-align: center;
}
.ranking.top {
  color: #956323;
}
.member-name {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
}
.member-name strong {
  font-size: var(--font-base);
  overflow-wrap: anywhere;
}
.member-role {
  align-self: flex-start;
}
.member-role :deep(.select-trigger) {
  width: auto;
  min-height: 0;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-8);
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--lilac);
  color: var(--purple-dark);
  font-size: var(--font-xs);
  font-weight: 500;
  line-height: 1.6;
}
.member-role :deep(.select-trigger:hover:not(:disabled)) {
  background: #e5d9f7;
}
.member-contribution {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 90px;
  text-align: right;
}
.member-contribution strong {
  font-size: var(--font-base);
  font-variant-numeric: tabular-nums;
}
.member-contribution .hint {
  font-size: var(--font-xs);
}
.message-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
.message {
  display: flex;
  align-items: flex-start;
  gap: var(--space-12);
  padding: var(--space-16);
}
.message.unread {
  background: #fcfaff;
  border-color: #cdbce9;
}
.message-icon {
  font-size: 22px;
  color: var(--purple);
}
.message > div {
  min-width: 0;
  flex: 1;
}
.message h3 {
  font-size: var(--font-md);
}
.message p {
  margin: var(--space-8) 0;
  color: var(--muted);
  font-size: var(--font-base);
  white-space: pre-line;
}
.message .hint {
  font-size: var(--font-xs);
}
.message .text-link {
  margin-left: 12px;
}
.message .text-button {
  white-space: nowrap;
}
.history-diff {
  padding: var(--space-12);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}
.history-diff > strong {
  font-size: var(--font-base);
}
.history-diff p {
  padding: var(--space-8);
  margin-top: 6px;
  border-radius: var(--radius-xs);
  font-size: var(--font-sm);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.history-diff .before {
  background: #fff0f1;
  color: #9a3544;
}
.history-diff .after {
  background: #edf7ef;
  color: #286840;
}
@media (max-width: 640px) {
  .history-filters {
    gap: var(--space-8);
    padding: var(--space-12);
  }
  .history-filters > label {
    flex: 1 1 130px;
  }
  .history-list > article,
  .member-list > article {
    padding: var(--space-12) var(--space-12);
    gap: var(--space-8);
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
    padding: var(--space-12);
    gap: var(--space-12);
    flex-wrap: wrap;
  }
  .message .text-button {
    margin-left: 32px;
  }
}
</style>
