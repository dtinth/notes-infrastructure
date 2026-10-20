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
          <code class="id plain">{{ note.id }}</code>
        </span>
        <span v-if="!note.public" class="badge">private</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.list { display: flex; flex-direction: column; min-height: 0; background: var(--bg-deep); border-right: 1px solid var(--border-weak); }
.search { display: flex; gap: .4rem; padding: .8rem; }
.count { color: var(--fg-muted); font-size: .75rem; padding: 0 .9rem .4rem; }
ul { list-style: none; margin: 0; padding: 0 0 1rem; overflow-y: auto; flex: 1; }
li { display: flex; align-items: center; gap: .4rem; padding: .35rem .8rem .35rem .5rem; cursor: pointer; border-left: 3px solid transparent; }
li:hover { background: #ffffff08; }
li.selected { border-left-color: var(--accent-lime); background: #ffffff0d; }
li.private .title { color: var(--fg-muted); }
.text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.35; }
.title { font-size: .85rem; }
.title, .id { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.id { color: var(--fg-muted); font-size: .7rem; }
.badge { font-size: .7rem; color: var(--fg-muted); border: 1px solid var(--border-weak); border-radius: var(--radius-sm); padding: 0 .35rem; }
</style>
