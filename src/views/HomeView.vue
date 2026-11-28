<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TextButton from '@/components/ui/TextButton.vue'
import HomeHero from '@/components/home/HomeHero.vue'
import HomeRow from '@/components/home/HomeRow.vue'
import { notify } from '@/composables/useFeedback'
import { continueListening, readHistory } from '@/features/home/playHistory'
import { useHomeFloors } from '@/features/home/useHomeFloors'
import { useQueueStore } from '@/stores/queue'
import { useSignStore } from '@/stores/sign'
import { computed } from 'vue'

/**
 * 首页：只做渲染与布局。
 * 楼层数据、推荐规则、请求参数都在 features/home/useHomeFloors 里（本次不改数据层）；
 * 这里把「继续听」从楼层里摘出来单独渲染成 Hero（首屏焦点），其余楼层交给 HomeRow。
 */
const { rows, busy, error, playRow, reshuffle, refresh } = useHomeFloors()
const queue = useQueueStore()
const sign = useSignStore()

const heroRow = computed(() => {
  const match = rows.value.find((row) => row.key === 'continue')
  return match ? match : null
})
const floorRows = computed(() => rows.value.filter((row) => row.key !== 'continue'))
const randomRow = computed(() => {
  const match = rows.value.find((row) => row.key === 'random')
  return match ? match : null
})

/** Hero 的进度：本地记录里的 position（楼层刷新时会跟着重算） */
const heroPosition = computed(() => {
  const row = heroRow.value
  const userId = sign.user?.id
  if (!row || userId === undefined) return undefined
  const list = continueListening(readHistory(userId), 1)
  return list.length > 0 ? list[0].position : undefined
})

function playHero() {
  if (heroRow.value) playRow(heroRow.value)
}

function enqueueHero() {
  const row = heroRow.value
  if (!row || row.songs.length === 0) return
  queue.append([row.songs[0]])
  notify('已加入队列：' + row.songs[0].name)
}

function playRandom() {
  if (randomRow.value) playRow(randomRow.value)
}
</script>

<template>
  <header class="home-head">
    <div>
      <h1>首页</h1>
      <p class="home-sub">根据你的播放记录与曲库推荐</p>
    </div>
    <TextButton :disabled="busy" @click="refresh">刷新</TextButton>
  </header>
  <p v-if="error" class="error-text">{{ error }}</p>
  <HomeHero
    :position="heroPosition"
    :random-songs="randomRow ? randomRow.songs : []"
    :songs="heroRow ? heroRow.songs : []"
    @enqueue="enqueueHero"
    @play="playHero"
    @random="playRandom"
  />
  <HomeRow
    v-for="row in floorRows"
    :key="row.key"
    :row="row"
    @play="playRow(row)"
    @play-item="(index) => playRow(row, index)"
    @reshuffle="reshuffle"
  />
  <EmptyState v-if="rows.length === 0 && !busy" panel symbol="♫" title="还没有可以推荐的曲目">
    先在曲库听几首，这里会按你的本机播放记录生成「继续听」和「猜你喜欢」。
    <template #actions>
      <Button to="/songs" variant="primary">去看看歌曲</Button>
    </template>
  </EmptyState>
</template>

<style scoped>
@layer components {
  .home-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: 28px;
  }
  .home-head h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;
  }
  .home-sub {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--font-sm);
  }
}
</style>
