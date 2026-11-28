<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import EntityCover from '@/components/EntityCover.vue'
import type { Entity } from '@/types/catalog'
import { computed } from 'vue'

/**
 * 首页 Hero：继续听（首屏视觉焦点）。
 * 背景不用「封面模糊图」：整张卡是 surface 92% + brand 8% 的底色，左上角一团大半径径向光斑，
 * 干净、也没有全页大模糊的性能负担；封面带投影浮在上面。
 * 右栏「接着上次 → 曲名 → 艺人 → 4px 进度条 + 时间（常驻）→ 继续播放 / 加入队列」。
 * 没有播放历史时同尺寸换成引导卡，用随机楼层的歌「随机播 N 首」。
 */
const props = defineProps<{
  /** 继续听：第 0 首是主角，整层是「继续播放」的队列 */
  songs: Entity[]
  /** 上次听到的位置（秒）；未知时不显示进度条 */
  position?: number
  /** 无历史时引导卡用它的歌随机播 */
  randomSongs: Entity[]
}>()
const emit = defineEmits<{ play: []; enqueue: []; random: [] }>()

const song = computed(() => (props.songs.length > 0 ? props.songs[0] : null))

/** 00:00 形式（进度与总时长都要两位分钟，且长度固定不抖） */
function clock(seconds: number) {
  const value = Math.max(0, Math.round(seconds))
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0')
}

const total = computed(() => {
  const item = song.value
  if (!item || !item.duration) return 0
  return item.duration
})

const position = computed(() => (props.position === undefined ? 0 : props.position))
/** 没有进度时就是 0%（底轨仍然可见），进度条与时间始终在 DOM 里 */
const percent = computed(() =>
  total.value > 0 ? Math.min(100, Math.round((position.value / total.value) * 100)) : 0,
)
const timeLabel = computed(() => clock(position.value) + ' / ' + clock(total.value))

function artistsOf(item: Entity) {
  const artists = item.artists
  if (!artists || artists.length === 0) return '未填写歌手'
  return artists.map((artist) => artist.name).join(' / ')
}
</script>

<template>
  <section aria-label="继续听" class="home-hero">
    <template v-if="song">
      <div class="hero-art">
        <EntityCover class="hero-cover" :item="song" />
      </div>
      <div class="hero-body">
        <p class="hero-kicker">接着上次</p>
        <h2 class="hero-title">{{ song.name }}</h2>
        <p class="hero-artist">{{ artistsOf(song) }}</p>
        <div class="hero-progress">
          <span class="hero-bar">
            <span class="hero-bar-fill" :style="{ width: percent + '%' }"></span>
          </span>
          <span class="hero-time">{{ timeLabel }}</span>
        </div>
        <div class="hero-actions">
          <Button variant="primary" @click="emit('play')">继续播放</Button>
          <Button variant="secondary" @click="emit('enqueue')">加入队列</Button>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="hero-art hero-art--guide">
        <span aria-hidden="true" class="hero-guide-mark">♫</span>
      </div>
      <div class="hero-body">
        <p class="hero-kicker">从随机漫游开始</p>
        <h2 class="hero-title">还没有播放记录</h2>
        <p class="hero-artist">随便听几首，首页就会按你的口味给出「继续听」和「猜你喜欢」。</p>
        <div v-if="randomSongs.length" class="hero-actions">
          <Button variant="primary" @click="emit('random')">
            随机播 {{ randomSongs.length }} 首
          </Button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
@layer components {
  .home-hero {
    position: relative;
    display: grid;
    grid-template-columns: 38fr 62fr;
    gap: var(--space-8);
    align-items: center;
    height: 300px;
    padding: var(--space-6);
    margin-bottom: 44px;
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    /* 底色 + 左上角一团光斑：整卡一片，没有「贴了一张灰纸」的硬边 */
    background:
      radial-gradient(
        600px 300px at 12% 0%,
        color-mix(in srgb, var(--brand) 16%, transparent),
        transparent 70%
      ),
      color-mix(in srgb, var(--surface) 92%, var(--brand) 8%);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }
  .hero-art {
    position: relative;
    display: grid;
    place-items: center;
    height: 100%;
  }
  .hero-cover {
    position: relative;
    width: min(76%, 220px);
    border-radius: 20px;
    box-shadow: 0 24px 60px color-mix(in srgb, var(--ink) 26%, transparent);
  }
  .hero-guide-mark {
    color: var(--brand);
    font-size: 64px;
    line-height: 1;
    opacity: 0.55;
  }
  .hero-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }
  /* 品牌色只出现在「正在进行」这一处标签上 */
  .hero-kicker {
    margin: 0;
    color: var(--brand);
    font-size: var(--font-sm);
    font-weight: 600;
  }
  .hero-title {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.3;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .hero-artist {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
  }
  /* 进度条 + 时间常驻：一段 4px 轨道（无进度时是空的底轨）+ 固定宽度的时间标签 */
  .hero-progress {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    max-width: 420px;
    margin-top: var(--space-2);
  }
  .hero-bar {
    flex: 1;
    height: 4px;
    overflow: hidden;
    border-radius: 2px;
    background: var(--line);
  }
  .hero-bar-fill {
    display: block;
    height: 100%;
    background: var(--brand);
  }
  .hero-time {
    min-width: 92px;
    color: var(--text-muted);
    font-size: var(--font-sm);
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }
  .hero-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  @media (max-width: 899px) {
    .home-hero {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
      height: auto;
      padding: var(--space-4);
      margin-bottom: 32px;
    }
    .hero-art {
      height: auto;
      aspect-ratio: 1;
      border-radius: var(--radius-md);
    }
    .hero-cover {
      width: 100%;
      border-radius: var(--radius-xl);
    }
    .hero-title {
      font-size: 22px;
    }
  }
}
</style>
