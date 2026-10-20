<script setup lang="ts">
import { planSymbol, type PlanItem } from '../api'

defineProps<{ items: PlanItem[]; applying: boolean }>()
defineEmits<{ apply: [ids?: string[]]; close: [] }>()

const describe = (item: PlanItem) =>
  item.op === 'delete'
    ? item.reason === 'missing' ? 'unpublish (file gone)' : 'unpublish'
    : { create: 'publish', update: 'update', recompile: 'recompile' }[item.op]
</script>

<template>
  <div class="backdrop" @click.self="$emit('close')">
    <div class="dialog card" role="dialog" aria-label="Publish plan">
      <header>
        <h2>Publish plan</h2>
        <button aria-label="Close" @click="$emit('close')">×</button>
      </header>
      <p v-if="!items.length" class="empty">Everything is published as it is in the vault.</p>
      <ul v-else>
        <li v-for="item in items" :key="item.id">
          <span :class="['op', `op-${item.op}`]">{{ planSymbol(item) }}</span>
          <code class="id">{{ item.id }}</code>
          <span class="what">{{ describe(item) }}</span>
          <button :disabled="applying" @click="$emit('apply', [item.id])">Apply</button>
        </li>
      </ul>
      <footer>
        <button class="accent" :disabled="applying || !items.length" @click="$emit('apply')">
          {{ applying ? 'Applying…' : `Apply all ${items.length}` }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: #000a; display: grid; place-items: center; z-index: 10; padding: 16px; }
.dialog { width: min(560px, 100%); max-height: 80vh; display: flex; flex-direction: column; }
header, footer { display: flex; align-items: center; justify-content: space-between; padding: .8rem 1rem; }
footer { justify-content: flex-end; border-top: 1px solid var(--border-weak); }
h2 { margin: 0; font-size: 1.1rem; color: var(--accent-pink); font-weight: 700; text-shadow: 2px 2px #00000040; }
ul { list-style: none; margin: 0; padding: 0 1rem; overflow-y: auto; }
li { display: flex; align-items: center; gap: .6rem; padding: .45rem 0; border-bottom: 1px solid var(--border-weak); }
li .id { margin-right: auto; }
.what { color: var(--fg-muted); font-size: .8rem; }
.empty { color: var(--fg-muted); padding: 0 1rem .8rem; margin: 0; }
</style>
