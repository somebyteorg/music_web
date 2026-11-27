<script lang="ts" setup>
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import { date, displayName } from '@/utils/format'
import { actions, historyCategoryOptions } from '@/features/community/activity'
import { useCommunityContext } from './communityContext'

/**
 * 操作记录栏目：筛选表单 + 记录列表。
 * 「查看变更」交给视图里那一份常驻对话框，这里只改控制器上的 inspect / dialog。
 */
const { community } = useCommunityContext()
const { history, historyFilters, scopedHistory, busy, inspect, dialog } = community
const { searchHistory, showAllHistory } = community
</script>

<template>
  <Card as="form" class="history-filters" @submit.prevent="searchHistory">
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
  <Card class="history-list" v-if="history.length">
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
.history-list > article {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}
.history-list > article:last-child {
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
/* 与 .history-body > p 的 13px 区分开：叠一层 .history-reason 加权，不靠提权 */
.history-body > p.history-reason {
  margin-top: 5px;
  color: var(--text-muted);
  font-size: 12px;
}
.history-body .hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
}
.history-list .text-button {
  white-space: nowrap;
}
@media (max-width: 680px) {
  .history-filters {
    gap: 9px;
    padding: 10px;
  }
  .history-filters > label {
    flex: 1 1 130px;
  }
  .history-list > article {
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
}
</style>
