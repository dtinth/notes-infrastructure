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
    <div class="dialog" role="dialog" aria-label="Publish plan">
      <header>
        <h2>Publish plan</h2>
        <button aria-label="Close" @click="$emit('close')">×</button>
      </header>
      <p v-if="!items.length" class="empty">Everything is published as it is in the vault.</p>
      <ul v-else>
        <li v-for="item in items" :key="item.id">
          <span :class="['op', `op-${item.op}`]">{{ planSymbol(item) }}</span>
          <code>{{ item.id }}</code>
          <span class="what">{{ describe(item) }}</span>
          <button :disabled="applying" @click="$emit('apply', [item.id])">Apply</button>
        </li>
      </ul>
      <footer>
        <button class="primary" :disabled="applying || !items.length" @click="$emit('apply')">
          {{ applying ? 'Applying…' : `Apply all ${items.length}` }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: #0009; display: grid; place-items: center; z-index: 10; }
.dialog { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; width: min(560px, calc(100vw - 32px)); max-height: 80vh; display: flex; flex-direction: column; }
header, footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; }
footer { justify-content: flex-end; border-top: 1px solid var(--line); }
h2 { margin: 0; font-size: 16px; }
ul { list-style: none; margin: 0; padding: 0 16px; overflow-y: auto; }
li { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line); }
li code { flex: 1; font-size: 13px; }
.what { color: var(--mute); font-size: 12px; }
.empty { color: var(--mute); padding: 0 16px 12px; }
</style>
