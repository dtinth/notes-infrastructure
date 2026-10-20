<script setup lang="ts">
import { computed, ref } from 'vue'
import { planSymbol, type NoteSummary, type PlanItem } from '../api'

const props = defineProps<{
  notes: NoteSummary[]
  plan: Map<string, PlanItem>
  selected?: string
}>()
defineEmits<{ select: [id: string]; create: [] }>()

const query = ref('')
const filtered = computed(() => {
  const q = query.value.toLowerCase()
  return props.notes.filter(
    (note) => !q || note.id.toLowerCase().includes(q) || note.title.toLowerCase().includes(q),
  )
})
</script>

<template>
  <aside class="list">
    <div class="search">
      <input v-model="query" placeholder="Search notes" aria-label="Search notes" />
      <button title="New note" aria-label="New note" @click="$emit('create')">+</button>
    </div>
    <div class="count">{{ filtered.length }} of {{ notes.length }} notes</div>
    <ul>
      <li
        v-for="note in filtered"
        :key="note.id"
        :class="{ selected: note.id === selected, private: !note.public }"
        @click="$emit('select', note.id)"
      >
        <span v-if="plan.get(note.id)" :class="['op', `op-${plan.get(note.id)!.op}`]">{{
          planSymbol(plan.get(note.id)!)
        }}</span>
        <span v-else class="op"></span>
        <span class="text">
          <span class="title">{{ note.title || note.id }}</span>
          <code class="id">{{ note.id }}</code>
        </span>
        <span v-if="!note.public" class="badge">private</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.list { display: flex; flex-direction: column; min-height: 0; background: var(--panel); border-right: 1px solid var(--line); }
.search { display: flex; gap: 6px; padding: 10px; }
.count { color: var(--mute); font-size: 12px; padding: 0 12px 6px; }
ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
li { display: flex; align-items: center; gap: 6px; padding: 7px 10px; cursor: pointer; border-left: 3px solid transparent; }
li:hover { background: var(--panel-2); }
li.selected { background: var(--panel-2); border-left-color: var(--accent); }
li.private .title { color: var(--mute); }
.text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.title, .id { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.id { color: var(--mute); font-size: 11px; }
.badge { font-size: 11px; color: var(--mute); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
</style>
