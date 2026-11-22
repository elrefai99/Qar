<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useScheduleStore } from '../stores/store'
import { useProjectsStore } from '../stores/projects'
import { useAuthStore } from '../stores/auth'
import { formatDate } from '../utils/dateUtils'
import { PROJECT_COLORS } from '../firebase/projects'

const store = useScheduleStore()
const projectsStore = useProjectsStore()
const authStore = useAuthStore()

// ── Board columns ──────────────────────────────────────────────────────────
const columns = [
  { id: 'spec-needed', title: 'Spec Needed', colorDot: 'bg-orange-400' },
  { id: 'todo',        title: 'ToDo',         colorDot: 'bg-blue-400'   },
  { id: 'in-progress', title: 'In Progress',  colorDot: 'bg-[#4ade80]'  },
  { id: 'blocked',     title: 'Blocked',      colorDot: 'bg-red-400'    },
  { id: 'in-review',   title: 'In Review',    colorDot: 'bg-purple-400' },
  { id: 'done',        title: 'Done',         colorDot: 'bg-[#4a6b58]'  }
]

// ── Selected project tasks ─────────────────────────────────────────────────
const projectTasks = computed(() => {
  if (!projectsStore.selectedProjectId) return []
  return store.getTasksForProject(projectsStore.selectedProjectId)
})

const getTasksForColumn = (columnId: string) => {
  const tasks = projectTasks.value
  if (columnId === 'todo') {
    return tasks.filter((t: any) => !t.boardStatus || t.boardStatus === 'todo')
  }
  return tasks.filter((t: any) => t.boardStatus === columnId)
}

// ── New project form ───────────────────────────────────────────────────────
const showNewProject = ref(false)
const newProjectName = ref('')
const newProjectColor = ref(PROJECT_COLORS[0])

const submitNewProject = async () => {
  const name = newProjectName.value.trim()
  if (!name) return
  await projectsStore.addProject(name, newProjectColor.value)
  newProjectName.value = ''
  newProjectColor.value = PROJECT_COLORS[0]
  showNewProject.value = false
}

const cancelNewProject = () => {
  showNewProject.value = false
  newProjectName.value = ''
}

// ── Inline add task ────────────────────────────────────────────────────────
const inlineAddColumn = ref<string | null>(null)
const inlineAddText = ref('')

const openInlineAdd = (colId: string) => { inlineAddColumn.value = colId; inlineAddText.value = '' }
const cancelInlineAdd = () => { inlineAddColumn.value = null; inlineAddText.value = '' }

const submitInlineAdd = () => {
  const title = inlineAddText.value.trim()
  if (!title || !projectsStore.selectedProjectId) { cancelInlineAdd(); return }
  const dateKey = formatDate(new Date())
  store.addTask(dateKey, {
    title,
    time: '',
    endTime: '',
    description: '',
    completed: false,
    boardStatus: inlineAddColumn.value ?? 'todo',
    durationDays: 1,
    startDate: dateKey,
    meetingType: 'none',
    meetingUrl: '',
    guestEmails: [],
    projectId: projectsStore.selectedProjectId
  })
  inlineAddText.value = ''
  inlineAddColumn.value = null
}

// ── Task detail modal ──────────────────────────────────────────────────────
const selectedTask = ref<any>(null)
const newCommentText = ref('')

const openTaskDetail = (task: any) => {
  selectedTask.value = task
  newCommentText.value = ''
}
const closeTaskDetail = () => {
  selectedTask.value = null
  newCommentText.value = ''
}

const submitComment = (task: any) => {
  const text = newCommentText.value.trim()
  if (!text) return
  store.addComment(task.date || task.startDate, task.id, text)
  newCommentText.value = ''
}

const moveTask = (task: any, newStatus: string) => {
  store.updateBoardStatus(task.date || task.startDate, task.id, newStatus)
  if (selectedTask.value?.id === task.id) {
    selectedTask.value = { ...task, boardStatus: newStatus }
  }
}

const deleteTask = (task: any) => {
  closeTaskDetail()
  store.deleteTask(task.date || task.startDate, task.id)
}

const toggleTaskComplete = (task: any) => {
  store.toggleTaskComplete(task.date || task.startDate, task.id)
}

// ── Drag & drop ───────────────────────────────────────────────────────────
const draggedTaskId = ref<string | null>(null)
const draggedOverColumn = ref<string | null>(null)

const handleDragStart = (e: DragEvent, taskId: string) => {
  draggedTaskId.value = taskId
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

const handleColumnDragOver = (e: DragEvent, colId: string) => {
  e.preventDefault()
  draggedOverColumn.value = colId
}

const handleColumnDragLeave = () => { draggedOverColumn.value = null }

const handleColumnDrop = (e: DragEvent, colId: string) => {
  e.preventDefault()
  const taskId = draggedTaskId.value
  if (!taskId) return
  const task = projectTasks.value.find((t: any) => t.id === taskId)
  if (task && task.boardStatus !== colId) {
    store.updateBoardStatus(task.date || task.startDate, taskId, colId)
  }
  draggedTaskId.value = null
  draggedOverColumn.value = null
}

const handleDragEnd = () => {
  draggedTaskId.value = null
  draggedOverColumn.value = null
}

// ── Delete project confirm ─────────────────────────────────────────────────
const confirmDeleteProjectId = ref<string | null>(null)

const handleDeleteProject = async (projectId: string) => {
  await projectsStore.deleteProject(projectId)
  confirmDeleteProjectId.value = null
}

const descLines = (desc: string): string[] =>
  desc ? desc.split('\n').map(l => l.trim()).filter(l => l.length > 0) : []

const columnLabel = (status: string) => columns.find(c => c.id === status)?.title ?? 'ToDo'

onMounted(async () => {
  if (!store.synced) await store.loadUserTasks()
  if (!projectsStore.synced) await projectsStore.loadUserProjects()
})
</script>

<template>
  <div class="flex gap-0 min-h-[calc(100vh-140px)]">

    <!-- ══ LEFT SIDEBAR — Project list ══════════════════════════════════════ -->
    <div class="w-56 flex-shrink-0 border-r border-[#1a2820] bg-[#070c09] flex flex-col px-3 pt-4 pb-6 gap-1">
      <div class="flex items-center justify-between mb-3 px-1">
        <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Projects</span>
        <button @click="showNewProject = true"
          class="w-6 h-6 flex items-center justify-center rounded-lg bg-[#132218] border border-[#1f3228] text-[#4ade80] hover:bg-[#1a3020] active:scale-90 transition-all">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <!-- New project form -->
      <div v-if="showNewProject" class="mb-2 p-2.5 bg-[#0d1410] border border-[#1f3228] rounded-xl flex flex-col gap-2">
        <input v-model="newProjectName" type="text" placeholder="Project name"
          @keydown.enter="submitNewProject" @keydown.escape="cancelNewProject"
          autofocus
          class="w-full px-2.5 py-2 bg-[#0a0f0b] border border-[#1f3228] text-[#c8ddd5] rounded-lg text-xs outline-none focus:border-[#4ade80]/50 placeholder-[#2d4035]" />
        <!-- Color picker -->
        <div class="flex gap-1.5 flex-wrap">
          <button v-for="color in PROJECT_COLORS" :key="color"
            @click="newProjectColor = color"
            :style="{ background: color }"
            :class="['w-5 h-5 rounded-full transition-all active:scale-90',
              newProjectColor === color ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-[#0a0f0b]' : 'opacity-60 hover:opacity-100']" />
        </div>
        <div class="flex gap-1.5">
          <button @click="submitNewProject"
            class="flex-1 py-1.5 rounded-lg bg-[#4ade80] text-[#070c09] text-[10px] font-bold hover:bg-[#22c55e] active:scale-95 transition-all">
            Create
          </button>
          <button @click="cancelNewProject"
            class="px-2.5 py-1.5 rounded-lg bg-[#0a0f0b] border border-[#1f3228] text-[#4a6b58] text-[10px] hover:border-[#2a4035] transition-all">
            Cancel
          </button>
        </div>
      </div>

      <!-- Project list -->
      <div class="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
        <div v-if="projectsStore.projects.length === 0 && !showNewProject"
          class="text-center py-8 text-[10px] text-[#2d4035]">
          No projects yet.<br>Click + to create one.
        </div>

        <button v-for="project in projectsStore.projects" :key="project.id"
          @click="projectsStore.selectProject(project.id)"
          :class="['w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-left transition-all group relative',
            projectsStore.selectedProjectId === project.id
              ? 'bg-[#0d1a11] border border-[#1f3228]'
              : 'hover:bg-[#0d1410] border border-transparent']">
          <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: project.color }" />
          <span :class="['text-xs font-medium flex-1 truncate',
            projectsStore.selectedProjectId === project.id ? 'text-[#c8ddd5]' : 'text-[#6b9b7e]']">
            {{ project.name }}
          </span>
          <!-- task count badge -->
          <span class="text-[9px] text-[#3d5a4a] font-mono flex-shrink-0">
            {{ store.getTasksForProject(project.id).length }}
          </span>
          <!-- delete button (on hover) -->
          <button
            @click.stop="confirmDeleteProjectId = confirmDeleteProjectId === project.id ? null : project.id"
            class="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-[#2d4035] hover:text-red-400 transition-all flex-shrink-0">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </button>
      </div>

      <!-- Delete confirm -->
      <div v-if="confirmDeleteProjectId" class="mt-2 p-2.5 bg-red-950/30 border border-red-800/40 rounded-xl text-[10px]">
        <p class="text-red-300 mb-2">Delete "{{ projectsStore.getProjectById(confirmDeleteProjectId)?.name }}"? Tasks keep their data.</p>
        <div class="flex gap-1.5">
          <button @click="handleDeleteProject(confirmDeleteProjectId)"
            class="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all font-bold">
            Delete
          </button>
          <button @click="confirmDeleteProjectId = null"
            class="px-2.5 py-1.5 rounded-lg bg-[#0a0f0b] border border-[#1f3228] text-[#4a6b58] hover:border-[#2a4035] transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- ══ MAIN — Kanban board ═══════════════════════════════════════════════ -->
    <div class="flex-1 flex flex-col min-w-0 px-4 pt-4 pb-6 overflow-hidden">

      <!-- Empty state -->
      <template v-if="!projectsStore.selectedProjectId">
        <div class="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-[#0d1410] border border-[#1a2820] flex items-center justify-center">
            <svg class="w-7 h-7 text-[#2d4035]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7a2 2 0 012-2h3l2 3h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-[#4a6b58]">Select a project</p>
            <p class="text-xs text-[#2d4035] mt-1">Choose one from the sidebar or create a new project</p>
          </div>
          <button @click="showNewProject = true"
            class="px-4 py-2 rounded-xl bg-[#4ade80]/10 border border-[#4ade80]/25 text-[#4ade80] text-xs font-bold hover:bg-[#4ade80]/15 transition-all">
            + New Project
          </button>
        </div>
      </template>

      <template v-else>
        <!-- Header -->
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-3 h-3 rounded-full" :style="{ background: projectsStore.selectedProject?.color }" />
            <h2 class="text-base font-bold text-[#c8ddd5]">{{ projectsStore.selectedProject?.name }}</h2>
            <span class="text-[10px] text-[#3d5a4a] bg-[#0d1410] border border-[#1a2820] px-2 py-0.5 rounded-full font-mono">
              {{ projectTasks.length }} tasks
            </span>
          </div>
        </div>

        <!-- Kanban columns -->
        <div class="flex gap-3 overflow-x-auto flex-1 pb-2" style="min-height:0">
          <div v-for="col in columns" :key="col.id"
            class="flex-shrink-0 w-56 flex flex-col rounded-xl border transition-all"
            :class="draggedOverColumn === col.id
              ? 'bg-[#0d1a11] border-[#2a4035]'
              : 'bg-[#0a0f0b] border-[#1a2820]'"
            @dragover="handleColumnDragOver($event, col.id)"
            @dragleave="handleColumnDragLeave"
            @drop="handleColumnDrop($event, col.id)">

            <!-- Column header -->
            <div class="flex items-center justify-between px-3 py-2.5 border-b border-[#131e17]">
              <div class="flex items-center gap-1.5">
                <div :class="['w-2 h-2 rounded-full', col.colorDot]" />
                <span class="text-[10px] font-bold text-[#6b9b7e] uppercase tracking-widest">{{ col.title }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[9px] text-[#3d5a4a] font-mono">{{ getTasksForColumn(col.id).length }}</span>
                <button @click="openInlineAdd(col.id)"
                  class="w-5 h-5 flex items-center justify-center rounded-md text-[#3d5a4a] hover:text-[#4ade80] hover:bg-[#132218] transition-all">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>

            <!-- Inline add input -->
            <div v-if="inlineAddColumn === col.id" class="px-2 pt-2">
              <input v-model="inlineAddText" type="text" placeholder="Task title..."
                @keydown.enter="submitInlineAdd" @keydown.escape="cancelInlineAdd"
                autofocus
                class="w-full px-2.5 py-2 bg-[#0d1410] border border-[#4ade80]/30 text-[#c8ddd5] rounded-lg text-xs outline-none placeholder-[#2d4035]" />
              <div class="flex gap-1 mt-1.5">
                <button @click="submitInlineAdd"
                  class="flex-1 py-1.5 rounded-lg bg-[#4ade80]/10 border border-[#4ade80]/25 text-[#4ade80] text-[10px] font-bold hover:bg-[#4ade80]/20 transition-all">
                  Add
                </button>
                <button @click="cancelInlineAdd"
                  class="px-2 py-1.5 rounded-lg bg-[#0a0f0b] border border-[#1f3228] text-[#4a6b58] text-[10px] hover:border-[#2a4035] transition-all">
                  ✕
                </button>
              </div>
            </div>

            <!-- Task cards -->
            <div class="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
              <div v-for="task in getTasksForColumn(col.id)" :key="task.id"
                draggable="true"
                @dragstart="handleDragStart($event, task.id)"
                @dragend="handleDragEnd"
                :class="['p-2.5 rounded-xl border cursor-pointer transition-all hover:border-[#2a4035] group',
                  draggedTaskId === task.id ? 'opacity-40 scale-95' : '',
                  task.completed ? 'bg-[#0a0e0b] border-[#131e17]' : 'bg-[#0d1410] border-[#1a2820]']"
                @click="openTaskDetail(task)">

                <!-- Ticket + title -->
                <div class="flex items-start gap-1.5 mb-1">
                  <span v-if="task.ticketNumber" class="text-[8px] text-[#2d4035] font-mono flex-shrink-0 mt-0.5">#{{ task.ticketNumber }}</span>
                  <span :class="['text-xs font-medium leading-snug flex-1', task.completed ? 'line-through text-[#3d5a4a]' : 'text-[#c8ddd5]']">
                    {{ task.title }}
                  </span>
                </div>

                <!-- Date badge -->
                <div class="flex items-center gap-1.5 flex-wrap mt-1">
                  <span class="text-[9px] text-[#3d5a4a] font-mono">{{ task.date || task.startDate }}</span>
                  <span v-if="task.time" class="text-[9px] text-[#2d4035] font-mono">{{ task.time }}</span>
                  <span v-if="task.meetingUrl" class="text-[9px] bg-blue-500/15 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 rounded font-semibold">Meet</span>
                  <span v-if="task.comments?.length" class="text-[9px] text-[#2d4035] flex items-center gap-0.5">
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    {{ task.comments.length }}
                  </span>
                </div>
              </div>

              <!-- Empty placeholder -->
              <div v-if="getTasksForColumn(col.id).length === 0 && inlineAddColumn !== col.id"
                class="text-center py-6 text-[9px] text-[#1f2d25] select-none">
                Drop here
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ══ TASK DETAIL MODAL ════════════════════════════════════════════════ -->
    <div v-if="selectedTask"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="closeTaskDetail">
      <div class="bg-[#0d1a11]/90 backdrop-blur-xl border border-[#1f3228] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

        <!-- Header -->
        <div class="sticky top-0 bg-[#0d1a11]/95 border-b border-[#1f3228] px-5 pt-4 pb-3 flex items-start justify-between rounded-t-2xl z-10">
          <div class="flex-1 min-w-0 pr-3">
            <div class="flex items-center gap-2 mb-1">
              <span v-if="selectedTask.ticketNumber" class="text-[10px] text-[#3d5a4a] font-mono">#{{ selectedTask.ticketNumber }}</span>
              <div :class="['w-2 h-2 rounded-full flex-shrink-0', columns.find(c => c.id === (selectedTask.boardStatus || 'todo'))?.colorDot]" />
              <span class="text-[10px] text-[#4a6b58]">{{ columnLabel(selectedTask.boardStatus || 'todo') }}</span>
            </div>
            <h3 :class="['text-sm font-bold leading-snug', selectedTask.completed ? 'line-through text-[#3d5a4a]' : 'text-[#c8ddd5]']">
              {{ selectedTask.title }}
            </h3>
          </div>
          <button @click="closeTaskDetail"
            class="w-8 h-8 flex items-center justify-center rounded-xl bg-[#132218] border border-[#1f3228] text-[#4a6b58] hover:text-white active:scale-95 transition-all flex-shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 flex flex-col gap-4">

          <!-- Meta -->
          <div class="flex flex-wrap gap-2 text-[10px]">
            <span class="bg-[#0d1410] border border-[#1a2820] text-[#4a6b58] px-2 py-1 rounded-lg font-mono">
              {{ selectedTask.date || selectedTask.startDate }}
            </span>
            <span v-if="selectedTask.time" class="bg-[#0d1410] border border-[#1a2820] text-[#4a6b58] px-2 py-1 rounded-lg font-mono">
              {{ selectedTask.time }}{{ selectedTask.endTime ? ' – ' + selectedTask.endTime : '' }}
            </span>
            <span v-if="selectedTask.meetingUrl" class="bg-blue-500/15 border border-blue-500/25 text-blue-300 px-2 py-1 rounded-lg font-semibold">
              Meeting
            </span>
          </div>

          <!-- Description -->
          <div v-if="selectedTask.description" class="bg-[#0a0f0b] border border-[#131e17] rounded-xl p-3">
            <p class="text-[9px] font-bold text-[#3d5a4a] uppercase tracking-widest mb-2">Description</p>
            <ul class="space-y-1">
              <li v-for="(line, i) in descLines(selectedTask.description)" :key="i"
                class="text-xs text-[#8fb89f] flex items-start gap-1.5">
                <span class="text-[#2d4035] mt-0.5 flex-shrink-0">▸</span>{{ line }}
              </li>
            </ul>
          </div>

          <!-- Move column -->
          <div class="bg-[#0a0f0b] border border-[#131e17] rounded-xl p-3">
            <p class="text-[9px] font-bold text-[#3d5a4a] uppercase tracking-widest mb-2">Move to</p>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="col in columns" :key="col.id"
                @click="moveTask(selectedTask, col.id)"
                :class="['flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
                  (selectedTask.boardStatus || 'todo') === col.id
                    ? 'bg-[#132218] border-[#2a4035] text-[#4ade80]'
                    : 'bg-transparent border-[#1a2820] text-[#4a6b58] hover:border-[#2a4035] hover:text-[#8fb89f]']">
                <div :class="['w-1.5 h-1.5 rounded-full', col.colorDot]" />
                {{ col.title }}
              </button>
            </div>
          </div>

          <!-- Comments -->
          <div class="bg-[#0a0f0b] border border-[#131e17] rounded-xl p-3">
            <p class="text-[9px] font-bold text-[#3d5a4a] uppercase tracking-widest mb-2">
              Comments <span class="text-[#2d4035]">({{ selectedTask.comments?.length || 0 }})</span>
            </p>
            <div v-if="selectedTask.comments?.length" class="space-y-2 mb-3 max-h-40 overflow-y-auto">
              <div v-for="c in selectedTask.comments" :key="c.id" class="text-xs text-[#8fb89f] bg-[#0d1410] border border-[#131e17] rounded-lg px-3 py-2">
                <p class="leading-relaxed">{{ c.text }}</p>
                <p class="text-[9px] text-[#2d4035] mt-1 font-mono">{{ new Date(c.createdAt).toLocaleString() }}</p>
              </div>
            </div>
            <div class="flex gap-2">
              <input v-model="newCommentText" type="text" placeholder="Add a comment..."
                @keydown.enter="submitComment(selectedTask)"
                class="flex-1 px-3 py-2 bg-[#0d1410] border border-[#1f3228] text-[#c8ddd5] rounded-lg text-xs outline-none focus:border-[#4ade80]/40 placeholder-[#2d4035]" />
              <button @click="submitComment(selectedTask)"
                class="px-3 py-2 rounded-lg bg-[#4ade80]/10 border border-[#4ade80]/25 text-[#4ade80] text-[10px] font-bold hover:bg-[#4ade80]/20 active:scale-95 transition-all">
                Post
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button @click="toggleTaskComplete(selectedTask); selectedTask = {...selectedTask, completed: !selectedTask.completed}"
              :class="['flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-[0.98]',
                selectedTask.completed
                  ? 'bg-[#132218] border-[#2a4035] text-[#4a6b58] hover:text-[#4ade80]'
                  : 'bg-[#4ade80]/10 border-[#4ade80]/25 text-[#4ade80] hover:bg-[#4ade80]/20']">
              {{ selectedTask.completed ? '↩ Reopen' : '✓ Mark Done' }}
            </button>
            <button @click="deleteTask(selectedTask)"
              class="px-4 py-2.5 rounded-xl text-xs font-bold border bg-red-950/20 border-red-800/30 text-red-400 hover:bg-red-950/40 active:scale-[0.98] transition-all">
              Delete
            </button>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>
