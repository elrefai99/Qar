<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useScheduleStore } from '../stores/store'
import { formatDate, getCurrentTimeString, getMinutesFromTime } from '../utils/dateUtils'
import { useCalendar } from '../shared/useCalendar'
import { useTaskLogic } from '../shared/useTaskLogic'

const store = useScheduleStore()
const currentTime = ref(new Date())

const today = new Date()
today.setHours(0, 0, 0, 0)
const todayFormatted = computed(() => formatDate(today))

const { selectedDate } = useCalendar()
selectedDate.value = today

const {
  showAddForm, editingTaskId, newTask,
  handleAddTask, handleEditTask, toggleComplete, deleteTaskItem,
  openGoogleCalendarForTask,
  showStartForm, startCalendarMonth, selectedWorkDays, selectedWorkDaysSorted,
  openStartTask, toggleWorkDay, setWorkDayTime, moveStartMonth,
  cancelStartTask, confirmStartTask
} = useTaskLogic(store, selectedDate, todayFormatted, currentTime)

// ── Start modal calendar grid ────────────────────────────────────────────────
const monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const weekDayLabels = ['S','M','T','W','T','F','S']

const startCalendarTitle = computed(() => {
  const d = startCalendarMonth.value
  return `${monthNamesShort[d.getMonth()]} ${d.getFullYear()}`
})

const startCalendarCells = computed(() => {
  const d = startCalendarMonth.value
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ dateKey: string | null; day: number | null }> = []
  for (let i = 0; i < firstDow; i++) cells.push({ dateKey: null, day: null })
  for (let i = 1; i <= daysInMonth; i++) {
    const dateKey = `${year}-${String(month + 1).padStart(2,'0')}-${String(i).padStart(2,'0')}`
    cells.push({ dateKey, day: i })
  }
  return cells
})

const isPastDay = (dateKey: string | null): boolean => {
  if (!dateKey) return false
  return dateKey < todayFormatted.value
}

const fmtWorkDayLabel = (dateKey: string): string => {
  const d = new Date(dateKey + 'T00:00:00')
  return `${weekDayLabels[d.getDay() === 0 ? 0 : d.getDay()]} · ${monthNamesShort[d.getMonth()]} ${d.getDate()}`
}

// ── Task data ────────────────────────────────────────────────────────────────
// Last-3-days dated tasks, newest first
const todayTasks = computed(() => store.getRecentStartedTasks(3))

// Unscheduled (not yet started) tasks
const unscheduledTasks = computed(() => store.unscheduledTasks)

const getTaskStatus = (task: any): string => {
  const dateKey = todayFormatted.value
  const currentMinutes = getMinutesFromTime(getCurrentTimeString(currentTime.value))
  if (task.durationDays && task.durationDays > 1 && task.startDate !== dateKey)
    return task.completed ? 'completed' : 'waiting'
  const startMinutes = task.time ? getMinutesFromTime(task.time) : 0
  const endMinutes = task.endTime ? getMinutesFromTime(task.endTime) : startMinutes + 60
  if (task.completed) return 'completed'
  if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) return 'active'
  if (task.meetingUrl) return 'prioritized'
  return 'waiting'
}

const getTaskProgress = (task: any): number => {
  const currentMinutes = getMinutesFromTime(getCurrentTimeString(currentTime.value))
  const status = getTaskStatus(task)
  if (status === 'completed') return 100
  const startMinutes = task.time ? getMinutesFromTime(task.time) : 0
  const endMinutes = task.endTime ? getMinutesFromTime(task.endTime) : startMinutes + 60
  const total = endMinutes - startMinutes
  if (total <= 0 || status !== 'active') return 0
  return Math.min(Math.max(Math.round(((currentMinutes - startMinutes) / total) * 100), 5), 95)
}

const categorized = computed(() => {
  const active: any[] = [], waiting: any[] = [], prioritized: any[] = [], completed: any[] = []
  todayTasks.value.forEach((task: any) => {
    const s = getTaskStatus(task)
    if (s === 'active') active.push(task)
    else if (s === 'waiting') waiting.push(task)
    else if (s === 'prioritized') prioritized.push(task)
    else completed.push(task)
  })
  return { active, waiting, prioritized, completed }
})

const todoTasks = computed(() => [...categorized.value.prioritized, ...categorized.value.waiting])

const completionRate = computed(() => {
  const total = todayTasks.value.length
  return total === 0 ? 0 : Math.round((categorized.value.completed.length / total) * 100)
})

// ── UI state ─────────────────────────────────────────────────────────────────
const selectedTaskId = ref<string | null>(null)
const showCompleted = ref(false)
const selectedTask = computed(() => {
  const inDated = todayTasks.value.find((t: any) => t.id === selectedTaskId.value)
  if (inDated) return inDated
  return unscheduledTasks.value.find((t: any) => t.id === selectedTaskId.value) || null
})

const selectTask = (taskId: string) => {
  selectedTaskId.value = selectedTaskId.value === taskId ? null : taskId
}
const closePanel = () => { selectedTaskId.value = null }

const openEditFromPanel = (task: any) => {
  handleEditTask(task, task.date || todayFormatted.value)
  closePanel()
}
const deleteFromPanel = (task: any) => {
  if (!confirm('Delete this task?')) return
  deleteTaskItem(task.id, task.date)
  closePanel()
}

// ── Time / greeting ───────────────────────────────────────────────────────────
const greeting = computed(() => {
  const h = currentTime.value.getHours()
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
})

const currentTimeFormatted = computed(() => {
  const h = String(currentTime.value.getHours()).padStart(2, '0')
  const m = String(currentTime.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

const monthDay = computed(() => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  return `${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}`
})

const descLines = (desc: string): string[] =>
  desc ? desc.split('\n').map(l => l.trim()).filter(l => l.length > 0) : []

// ── Time remaining label ──────────────────────────────────────────────────────
const getTimeLeft = (task: any): string => {
  if (!task.time) return ''
  const now = getMinutesFromTime(getCurrentTimeString(currentTime.value))
  const start = getMinutesFromTime(task.time)
  const end = task.endTime ? getMinutesFromTime(task.endTime) : start + 60
  const status = getTaskStatus(task)
  if (status === 'completed') return 'Done'
  if (status === 'active') {
    const left = end - now
    if (left <= 0) return 'Ending'
    if (left < 60) return `${left}m left`
    return `${Math.floor(left / 60)}h ${left % 60}m left`
  }
  const until = start - now
  if (until < 0) return ''
  if (until < 60) return `in ${until}m`
  return `in ${Math.floor(until / 60)}h`
}

onMounted(async () => {
  if (!store.synced) await store.loadUserTasks()
  setInterval(() => { currentTime.value = new Date() }, 1000)
})
</script>

<template>
  <div class="flex flex-col gap-5">

    <!-- ══ HEADER BAR ══════════════════════════════════════════════════════ -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <!-- Title block -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-[#4ade80]/10 border border-[#4ade80]/20 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-[#4ade80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-white leading-tight">Task List</h1>
          <p class="text-xs text-[#4a6b58] font-mono">{{ monthDay }} · {{ currentTimeFormatted }}</p>
        </div>
      </div>
      <!-- Controls -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-3 py-1.5 rounded-xl bg-[#0d1410] border border-[#1a2820] text-xs text-[#4a6b58] font-semibold flex items-center gap-1.5">
          <svg class="w-3 h-3 text-[#4ade80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Last 3 days
        </span>
        <span v-if="todayTasks.length > 0" class="px-3 py-1.5 rounded-xl bg-[#0d1410] border border-[#1a2820] text-xs text-[#4a6b58] font-semibold">
          {{ completionRate }}% done
        </span>
        <button @click="showAddForm = true"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4ade80] text-[#070c09] text-sm font-bold hover:bg-[#22c55e] active:scale-[0.97] transition-all shadow-md shadow-[#4ade80]/20">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Task
        </button>
      </div>
    </div>

    <!-- ══ STATS CARDS (BuildIQ style) ═════════════════════════════════════ -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <!-- Total -->
      <div class="bg-[#0d1410] border border-[#1a2820] rounded-2xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-[#132218] flex items-center justify-center flex-shrink-0">
          <svg class="w-4.5 h-4.5 text-[#4a6b58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/>
          </svg>
        </div>
        <div>
          <p class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Total</p>
          <p class="text-xl font-black text-[#c8ddd5] leading-tight">{{ todayTasks.length }}</p>
        </div>
      </div>
      <!-- In Progress -->
      <div class="bg-[#0d1410] border border-[#1a2820] rounded-2xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-yellow-400/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-4.5 h-4.5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <p class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Active</p>
          <p class="text-xl font-black text-yellow-400 leading-tight">{{ categorized.active.length }}</p>
        </div>
      </div>
      <!-- Todo -->
      <div class="bg-[#0d1410] border border-[#1a2820] rounded-2xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-blue-400/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-4.5 h-4.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </div>
        <div>
          <p class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Todo</p>
          <p class="text-xl font-black text-blue-400 leading-tight">{{ todoTasks.length }}</p>
        </div>
      </div>
      <!-- Done -->
      <div class="bg-[#0d1410] border border-[#1a2820] rounded-2xl p-4 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-[#4ade80]/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-4.5 h-4.5 text-[#4ade80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <p class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Done</p>
          <p class="text-xl font-black text-[#4ade80] leading-tight">{{ categorized.completed.length }}</p>
        </div>
      </div>
    </div>

    <!-- ══ PROGRESS BAR ════════════════════════════════════════════════════ -->
    <div v-if="todayTasks.length > 0" class="bg-[#0d1410] border border-[#1a2820] rounded-2xl px-5 py-4">
      <div class="flex items-center justify-between mb-2.5">
        <span class="text-xs font-semibold text-[#4a6b58]">{{ greeting }} · Today's Progress</span>
        <span class="text-sm font-bold text-[#4ade80]">{{ completionRate }}%</span>
      </div>
      <div class="h-2 bg-[#132218] rounded-full overflow-hidden">
        <div :style="{ width: completionRate + '%' }"
          class="h-full bg-gradient-to-r from-[#4ade80] to-[#22c55e] rounded-full transition-all duration-700 ease-out" />
      </div>
    </div>

    <!-- ══ UNSCHEDULED SECTION ═════════════════════════════════════════════ -->
    <div v-if="unscheduledTasks.length > 0" class="bg-[#0d1410] border border-[#1a2820] rounded-2xl overflow-hidden">
      <div class="flex items-center gap-2 px-4 py-2.5 bg-[#0a0f0b] border-b border-[#1a2820]">
        <div class="w-2 h-2 rounded-full bg-[#4a6b58]" />
        <span class="text-[10px] font-black text-[#8fb89f] uppercase tracking-widest">Unscheduled</span>
        <span class="ml-1 text-[10px] font-bold text-[#4a6b58] bg-[#132218] px-1.5 py-0.5 rounded-full">{{ unscheduledTasks.length }}</span>
        <span class="ml-auto text-[10px] text-[#3d5a4a]">Tap Start when you begin</span>
      </div>
      <div v-for="task in unscheduledTasks" :key="task.id"
        @click="selectTask(task.id)"
        :class="['flex items-center gap-3 px-4 py-3.5 border-b border-[#131e17] transition-all cursor-pointer group',
          selectedTaskId === task.id ? 'bg-[#132218]/40 border-l-2 border-l-[#4ade80]/40' : 'hover:bg-[#111a14]']">
        <div class="w-1 h-8 rounded-full bg-[#3d5a4a] flex-shrink-0" />
        <div class="w-5 h-5 rounded-full border-2 border-[#2a4035] flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-semibold text-[#c8ddd5] truncate">{{ task.title }}</span>
            <span v-if="task.priority === 'critical'" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 flex-shrink-0">Critical</span>
            <span v-else-if="task.priority === 'low'" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#4ade80]/10 text-[#4ade80]/80 border border-[#4ade80]/20 flex-shrink-0">Low</span>
            <span v-if="task.meetingUrl" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-400/15 text-blue-300 border border-blue-400/20 flex-shrink-0">Meeting</span>
          </div>
        </div>
        <button @click.stop="openStartTask(task.id)"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80] text-xs font-bold hover:bg-[#4ade80]/20 active:scale-95 transition-all flex-shrink-0">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start
        </button>
        <div class="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button @click.stop="openEditFromPanel(task)"
            class="w-7 h-7 rounded-lg bg-[#132218] border border-[#1f3228] flex items-center justify-center text-[#4a6b58] hover:text-[#4ade80] hover:border-[#2a4035] transition-all">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button @click.stop="deleteFromPanel(task)"
            class="w-7 h-7 rounded-lg bg-[#132218] border border-[#1f3228] flex items-center justify-center text-[#4a6b58] hover:text-red-400 hover:border-red-800/40 transition-all">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ══ EMPTY STATE ═════════════════════════════════════════════════════ -->
    <div v-if="todayTasks.length === 0 && unscheduledTasks.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center bg-[#0d1410] border border-dashed border-[#1a2820] rounded-2xl">
      <div class="w-14 h-14 rounded-2xl bg-[#132218] flex items-center justify-center mb-4">
        <svg class="w-7 h-7 text-[#2d4035]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
      </div>
      <p class="text-sm font-semibold text-[#3d5a4a] mb-1">No tasks for today</p>
      <p class="text-xs text-[#2d4035] mb-4">Start adding tasks to plan your day</p>
      <button @click="showAddForm = true"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4ade80]/10 border border-[#4ade80]/25 text-[#4ade80] text-sm font-bold hover:bg-[#4ade80]/15 transition-all">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add First Task
      </button>
    </div>

    <!-- ══ TASK SECTIONS (Mondays style) ══════════════════════════════════ -->
    <div v-if="todayTasks.length > 0" class="bg-[#0d1410] border border-[#1a2820] rounded-2xl overflow-hidden">

      <!-- Column headers (like Mondays top row) -->
      <div class="flex items-center gap-3 px-4 py-2.5 bg-[#0a0f0b] border-b border-[#1a2820]">
        <div class="w-1 flex-shrink-0" />
        <div class="w-5 flex-shrink-0" />
        <div class="flex-1 text-[10px] font-bold text-[#2d4035] uppercase tracking-widest">Task</div>
        <div class="hidden sm:block w-24 text-[10px] font-bold text-[#2d4035] uppercase tracking-widest text-right">Status</div>
        <div class="hidden md:block w-28 text-[10px] font-bold text-[#2d4035] uppercase tracking-widest text-right">Time</div>
        <div class="hidden lg:block w-20 text-[10px] font-bold text-[#2d4035] uppercase tracking-widest text-right">Left</div>
        <div class="w-16 flex-shrink-0" />
      </div>

      <!-- ── IN PROGRESS section ─────────────────────────────────────────── -->
      <template v-if="categorized.active.length > 0">
        <div class="flex items-center gap-2 px-4 py-2 bg-yellow-400/[0.04] border-b border-yellow-400/10">
          <div class="w-2 h-2 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/50 animate-pulse" />
          <span class="text-[10px] font-black text-yellow-400 uppercase tracking-widest">In Progress</span>
          <span class="ml-1 text-[10px] font-bold text-yellow-400/60 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">{{ categorized.active.length }}</span>
        </div>
        <div v-for="task in categorized.active" :key="task.id"
          @click="selectTask(task.id)"
          :class="['flex items-center gap-3 px-4 py-3.5 border-b border-[#131e17] transition-all cursor-pointer group',
            selectedTaskId === task.id ? 'bg-yellow-400/[0.04] border-l-2 border-l-yellow-400/60' : 'hover:bg-[#111a14]']">
          <!-- Color bar -->
          <div class="w-1 h-8 rounded-full bg-yellow-400/70 flex-shrink-0" />
          <!-- Checkbox -->
          <button @click.stop="toggleComplete(task.id, task.date)"
            class="w-5 h-5 rounded-full border-2 border-yellow-400/40 flex items-center justify-center hover:border-yellow-400 transition-colors flex-shrink-0">
          </button>
          <!-- Title & info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-[#c8ddd5] truncate">{{ task.title }}</span>
              <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-yellow-400/15 text-yellow-300 border border-yellow-400/20 flex-shrink-0">Active</span>
              <span v-if="task.priority === 'critical'" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 flex-shrink-0">Critical</span>
              <span v-else-if="task.priority === 'low'" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#4ade80]/10 text-[#4ade80]/80 border border-[#4ade80]/20 flex-shrink-0">Low</span>
              <span v-if="task.meetingUrl" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-400/15 text-blue-300 border border-blue-400/20 flex-shrink-0">Meeting</span>
              <span v-if="task.durationDays > 1" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-400/15 text-purple-300 border border-purple-400/20 flex-shrink-0">Multi-day</span>
            </div>
            <!-- Progress bar (active tasks only) -->
            <div class="flex items-center gap-2 mt-1.5">
              <div class="flex-1 h-1 bg-[#1a2820] rounded-full max-w-32 overflow-hidden">
                <div :style="{ width: getTaskProgress(task) + '%' }"
                  class="h-full bg-yellow-400/80 rounded-full transition-all duration-1000" />
              </div>
              <span class="text-[9px] text-yellow-400/60 font-mono">{{ getTaskProgress(task) }}%</span>
            </div>
          </div>
          <!-- Status badge -->
          <div class="hidden sm:flex w-24 justify-end">
            <span class="text-[10px] font-semibold text-yellow-400/80 bg-yellow-400/10 px-2 py-1 rounded-lg">Now</span>
          </div>
          <!-- Time -->
          <div v-if="task.time" class="hidden md:flex w-28 justify-end">
            <span class="text-[10px] font-mono text-[#4a6b58]">{{ task.time }}{{ task.endTime ? `–${task.endTime}` : '' }}</span>
          </div>
          <!-- Time left -->
          <div class="hidden lg:flex w-20 justify-end">
            <span class="text-[10px] text-yellow-400/70 font-medium">{{ getTimeLeft(task) }}</span>
          </div>
          <!-- Actions -->
          <div class="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-16 justify-end">
            <button @click.stop="openEditFromPanel(task)"
              class="w-7 h-7 rounded-lg bg-[#132218] border border-[#1f3228] flex items-center justify-center text-[#4a6b58] hover:text-[#4ade80] hover:border-[#2a4035] transition-all">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button @click.stop="deleteFromPanel(task)"
              class="w-7 h-7 rounded-lg bg-[#132218] border border-[#1f3228] flex items-center justify-center text-[#4a6b58] hover:text-red-400 hover:border-red-800/40 transition-all">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>
      </template>

      <!-- ── TODO section ────────────────────────────────────────────────── -->
      <template v-if="todoTasks.length > 0">
        <div class="flex items-center gap-2 px-4 py-2 bg-blue-400/[0.03] border-b border-blue-400/10">
          <div class="w-2 h-2 rounded-full bg-blue-400" />
          <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest">Todo</span>
          <span class="ml-1 text-[10px] font-bold text-blue-400/60 bg-blue-400/10 px-1.5 py-0.5 rounded-full">{{ todoTasks.length }}</span>
        </div>
        <div v-for="task in todoTasks" :key="task.id"
          @click="selectTask(task.id)"
          :class="['flex items-center gap-3 px-4 py-3.5 border-b border-[#131e17] transition-all cursor-pointer group',
            selectedTaskId === task.id ? 'bg-blue-400/[0.03] border-l-2 border-l-blue-400/50' : 'hover:bg-[#111a14]']">
          <div class="w-1 h-8 rounded-full bg-blue-400/50 flex-shrink-0" />
          <button @click.stop="toggleComplete(task.id, task.date)"
            class="w-5 h-5 rounded-full border-2 border-[#2a4035] flex items-center justify-center hover:border-blue-400/60 transition-colors flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-[#c8ddd5] truncate">{{ task.title }}</span>
              <span v-if="task.priority === 'critical'" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 flex-shrink-0">Critical</span>
              <span v-else-if="task.priority === 'low'" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#4ade80]/10 text-[#4ade80]/80 border border-[#4ade80]/20 flex-shrink-0">Low</span>
              <span v-if="task.meetingUrl" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-400/15 text-blue-300 border border-blue-400/20 flex-shrink-0">Meeting</span>
              <span v-if="task.durationDays > 1" class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-400/15 text-purple-300 border border-purple-400/20 flex-shrink-0">Multi-day</span>
            </div>
            <div v-if="task.time || task.description" class="mt-0.5">
              <span v-if="task.time" class="text-[10px] font-mono text-[#4a6b58]">{{ task.time }}{{ task.endTime ? ` – ${task.endTime}` : '' }}</span>
            </div>
          </div>
          <div class="hidden sm:flex w-24 justify-end">
            <span class="text-[10px] font-semibold text-blue-400/70 bg-blue-400/10 px-2 py-1 rounded-lg">Up Next</span>
          </div>
          <div v-if="task.time" class="hidden md:flex w-28 justify-end">
            <span class="text-[10px] font-mono text-[#4a6b58]">{{ task.time }}{{ task.endTime ? `–${task.endTime}` : '' }}</span>
          </div>
          <div class="hidden lg:flex w-20 justify-end">
            <span class="text-[10px] text-[#4a6b58] font-medium">{{ getTimeLeft(task) }}</span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-16 justify-end">
            <button @click.stop="openEditFromPanel(task)"
              class="w-7 h-7 rounded-lg bg-[#132218] border border-[#1f3228] flex items-center justify-center text-[#4a6b58] hover:text-[#4ade80] hover:border-[#2a4035] transition-all">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button @click.stop="deleteFromPanel(task)"
              class="w-7 h-7 rounded-lg bg-[#132218] border border-[#1f3228] flex items-center justify-center text-[#4a6b58] hover:text-red-400 hover:border-red-800/40 transition-all">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>
      </template>

      <!-- ── COMPLETED section ───────────────────────────────────────────── -->
      <template v-if="categorized.completed.length > 0">
        <div class="flex items-center gap-2 px-4 py-2 border-b border-[#131e17] cursor-pointer hover:bg-[#111a14] transition-colors"
          @click="showCompleted = !showCompleted">
          <div class="w-2 h-2 rounded-full bg-[#4ade80]" />
          <span class="text-[10px] font-black text-[#4a6b58] uppercase tracking-widest">Completed</span>
          <span class="ml-1 text-[10px] font-bold text-[#3d5a4a] bg-[#132218] px-1.5 py-0.5 rounded-full">{{ categorized.completed.length }}</span>
          <div class="ml-auto flex items-center gap-1 text-[10px] text-[#2d4035]">
            <span>{{ showCompleted ? 'Hide' : 'Show' }}</span>
            <svg class="w-3 h-3 transition-transform" :class="showCompleted ? 'rotate-180' : ''"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <template v-if="showCompleted">
          <div v-for="task in categorized.completed" :key="task.id"
            @click="selectTask(task.id)"
            :class="['flex items-center gap-3 px-4 py-3 border-b border-[#131e17] transition-all cursor-pointer group opacity-60 hover:opacity-80',
              selectedTaskId === task.id ? 'bg-[#4ade80]/[0.02] border-l-2 border-l-[#4ade80]/30' : 'hover:bg-[#0d1410]']">
            <div class="w-1 h-8 rounded-full bg-[#2a4035] flex-shrink-0" />
            <button @click.stop="toggleComplete(task.id, task.date)"
              class="w-5 h-5 rounded-full bg-[#4ade80]/20 border border-[#4ade80]/30 flex items-center justify-center hover:bg-[#4ade80]/30 transition-colors flex-shrink-0">
              <svg class="w-3 h-3 text-[#4ade80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <div class="flex-1 min-w-0">
              <span class="text-sm font-medium text-[#4a6b58] line-through truncate block">{{ task.title }}</span>
              <span v-if="task.time" class="text-[10px] font-mono text-[#2d4035]">{{ task.time }}{{ task.endTime ? ` – ${task.endTime}` : '' }}</span>
            </div>
            <div class="hidden sm:flex w-24 justify-end">
              <span class="text-[10px] font-semibold text-[#4ade80]/60 bg-[#4ade80]/[0.08] px-2 py-1 rounded-lg">Done</span>
            </div>
            <div class="hidden md:flex w-28" />
            <div class="hidden lg:flex w-20" />
            <div class="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-16 justify-end">
              <button @click.stop="toggleComplete(task.id, task.date)"
                class="w-7 h-7 rounded-lg bg-[#132218] border border-[#1f3228] flex items-center justify-center text-[#4a6b58] hover:text-[#4ade80] hover:border-[#2a4035] transition-all">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg>
              </button>
              <button @click.stop="deleteFromPanel(task)"
                class="w-7 h-7 rounded-lg bg-[#132218] border border-[#1f3228] flex items-center justify-center text-[#4a6b58] hover:text-red-400 hover:border-red-800/40 transition-all">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>

  <!-- ══ TASK DETAIL PANEL (BuildIQ-style slide from right) ═══════════════ -->
  <Teleport to="body">
    <div v-if="selectedTask"
      class="fixed inset-0 z-40"
      @click.self="closePanel">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/30 backdrop-blur-[2px]" @click="closePanel" />
      <!-- Panel -->
      <div class="absolute right-0 top-0 bottom-0 w-full sm:w-96 bg-[#0d1a11]/95 backdrop-blur-xl border-l border-[#1f3228] shadow-2xl flex flex-col">

        <!-- Panel header -->
        <div class="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[#1f3228] flex-shrink-0">
          <div class="flex-1 min-w-0 pr-3">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span v-if="getTaskStatus(selectedTask) === 'active'"
                class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-yellow-400/15 text-yellow-300 border border-yellow-400/20">Active Now</span>
              <span v-else-if="getTaskStatus(selectedTask) === 'completed'"
                class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#4ade80]/15 text-[#4ade80] border border-[#4ade80]/20">Completed</span>
              <span v-else
                class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-400/15 text-blue-300 border border-blue-400/20">Upcoming</span>
              <span v-if="selectedTask.priority === 'critical'"
                class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25">Critical</span>
              <span v-else-if="selectedTask.priority === 'medium'"
                class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400/80 border border-amber-500/20">Medium</span>
              <span v-else-if="selectedTask.priority === 'low'"
                class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#4ade80]/10 text-[#4ade80]/80 border border-[#4ade80]/20">Low</span>
              <span v-if="selectedTask.meetingUrl"
                class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/20">Meeting</span>
            </div>
            <h2 class="text-base font-bold text-[#c8ddd5] leading-snug">{{ selectedTask.title }}</h2>
          </div>
          <button @click="closePanel"
            class="w-8 h-8 flex items-center justify-center rounded-xl bg-[#132218] border border-[#1f3228] text-[#4a6b58] hover:text-white hover:border-[#2a4035] transition-all flex-shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Panel body -->
        <div class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          <!-- Time info (BuildIQ left-panel style) -->
          <div class="bg-[#0a0f0b] border border-[#1f3228] rounded-2xl p-4 flex flex-col gap-3">
            <div v-if="selectedTask.time || selectedTask.endTime" class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-[#132218] flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-[#4a6b58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <p class="text-[9px] font-bold text-[#3d5a4a] uppercase tracking-widest mb-0.5">Time</p>
                <p class="text-sm font-bold text-[#c8ddd5] font-mono">
                  {{ selectedTask.time || '—' }}{{ selectedTask.endTime ? ` – ${selectedTask.endTime}` : '' }}
                </p>
              </div>
            </div>
            <div v-if="selectedTask.durationDays > 1" class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-purple-400/10 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <p class="text-[9px] font-bold text-[#3d5a4a] uppercase tracking-widest mb-0.5">Duration</p>
                <p class="text-sm font-bold text-purple-300">{{ selectedTask.durationDays }} days</p>
                <p class="text-[10px] font-mono text-[#4a6b58]">{{ selectedTask.startDate }} → {{ selectedTask.endDate }}</p>
              </div>
            </div>
            <!-- Progress for active tasks -->
            <div v-if="getTaskStatus(selectedTask) === 'active'">
              <div class="flex items-center justify-between mb-1.5">
                <p class="text-[9px] font-bold text-[#3d5a4a] uppercase tracking-widest">Progress</p>
                <span class="text-[10px] font-bold text-yellow-400">{{ getTaskProgress(selectedTask) }}%</span>
              </div>
              <div class="h-2 bg-[#132218] rounded-full overflow-hidden">
                <div :style="{ width: getTaskProgress(selectedTask) + '%' }"
                  class="h-full bg-yellow-400/80 rounded-full transition-all duration-1000" />
              </div>
            </div>
          </div>

          <!-- Description / Notes (BuildIQ task notes style) -->
          <div v-if="selectedTask.description" class="bg-[#0a0f0b] border border-[#1f3228] rounded-2xl p-4">
            <p class="text-[9px] font-bold text-[#3d5a4a] uppercase tracking-widest mb-3">Task Notes</p>
            <ul class="space-y-2">
              <li v-for="(line, i) in descLines(selectedTask.description)" :key="i"
                class="flex items-start gap-2 text-xs text-[#8fb89f]">
                <div class="w-1 h-1 rounded-full bg-[#4ade80] flex-shrink-0 mt-1.5" />
                {{ line }}
              </li>
            </ul>
          </div>

          <!-- Meeting link -->
          <div v-if="selectedTask.meetingUrl" class="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
            <p class="text-[9px] font-bold text-blue-400/70 uppercase tracking-widest mb-2">Meeting Link</p>
            <a :href="selectedTask.meetingUrl" target="_blank" rel="noopener"
              class="flex items-center gap-2 text-xs text-blue-300 hover:text-blue-200 transition-colors font-medium break-all">
              <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              {{ selectedTask.meetingUrl }}
            </a>
            <div v-if="selectedTask.guestEmails?.length" class="mt-2 flex flex-wrap gap-1">
              <span v-for="email in selectedTask.guestEmails" :key="email"
                class="text-[9px] bg-blue-900/40 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded-full font-mono">
                {{ email }}
              </span>
            </div>
          </div>
        </div>

        <!-- Panel footer actions (BuildIQ Clock In / Edit style) -->
        <div class="px-5 py-4 border-t border-[#1f3228] flex flex-col gap-2 flex-shrink-0">
          <div class="flex gap-2">
            <button @click="openEditFromPanel(selectedTask)"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#4ade80] text-[#070c09] text-sm font-bold hover:bg-[#22c55e] active:scale-[0.98] transition-all shadow-md shadow-[#4ade80]/20">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Task
            </button>
            <button @click="toggleComplete(selectedTask.id, selectedTask.date)"
              :class="['flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold active:scale-[0.98] transition-all border',
                selectedTask.completed
                  ? 'bg-[#132218] border-[#2a4035] text-[#4a6b58] hover:border-[#4ade80]/30 hover:text-[#4ade80]'
                  : 'bg-[#4ade80]/10 border-[#4ade80]/25 text-[#4ade80] hover:bg-[#4ade80]/15']">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ selectedTask.completed ? 'Undo' : 'Mark Done' }}
            </button>
          </div>
          <button @click="deleteFromPanel(selectedTask)"
            class="w-full py-2 rounded-xl text-xs font-semibold text-[#3d5a4a] hover:text-red-400 hover:bg-red-950/20 transition-all border border-transparent hover:border-red-900/30">
            Delete Task
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ══ ADD / EDIT TASK MODAL ══════════════════════════════════════════════ -->
  <div v-if="showAddForm"
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
    @click.self="() => { showAddForm = false; editingTaskId = null }">
    <div class="bg-[#0d1a11]/85 backdrop-blur-xl border border-[#1f3228] rounded-2xl shadow-2xl shadow-black/80 w-full max-w-lg max-h-[95vh] overflow-y-auto">
      <!-- Modal header -->
      <div class="sticky top-0 z-10 bg-[#0d1a11]/95 backdrop-blur-sm border-b border-[#1f3228] px-5 pt-4 pb-3.5 flex items-start justify-between rounded-t-2xl">
        <div>
          <h3 class="text-base font-bold text-[#c8ddd5]">{{ editingTaskId ? 'Edit Task' : 'New Task' }}</h3>
          <p class="text-[10px] text-[#3d5a4a] mt-0.5 font-mono">
            {{ editingTaskId ? (newTask.startDate || 'Unscheduled') : 'Unscheduled — start it later' }}
          </p>
        </div>
        <button @click="() => { showAddForm = false; editingTaskId = null }"
          class="w-8 h-8 flex items-center justify-center rounded-xl bg-[#132218] border border-[#1f3228] text-[#4a6b58] hover:text-white hover:border-[#2a4035] active:scale-95 transition-all mt-0.5">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <!-- Modal body -->
      <div class="p-5 flex flex-col gap-3.5">
        <input v-model="newTask.title" type="text" placeholder="Task title *"
          class="w-full p-3.5 bg-[#0a0f0b] border border-[#1f3228] text-[#c8ddd5] rounded-xl text-sm outline-none focus:border-[#4ade80]/50 focus:ring-2 focus:ring-[#4ade80]/10 placeholder-[#2d4035] transition-all font-medium" />

        <!-- Time Range (edit only — created tasks are unscheduled until Start) -->
        <div v-if="editingTaskId && newTask.startDate" class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2 border-b border-[#131e17]">
            <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Time Range</span>
          </div>
          <div class="px-3.5 py-3 flex items-end gap-3">
            <div class="flex-1">
              <div class="text-[9px] text-[#2d4035] mb-1.5 uppercase tracking-widest font-semibold">Start</div>
              <input v-model="newTask.time" type="time"
                class="w-full p-2.5 bg-[#0d1410] border border-[#1f3228] text-[#c8ddd5] rounded-lg text-sm outline-none focus:border-[#4ade80]/40 transition-all" />
            </div>
            <div class="pb-2.5">
              <svg class="w-4 h-4 text-[#2d4035]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
            <div class="flex-1">
              <div class="text-[9px] text-[#2d4035] mb-1.5 uppercase tracking-widest font-semibold">End</div>
              <input v-model="newTask.endTime" type="time"
                class="w-full p-2.5 bg-[#0d1410] border border-[#1f3228] text-[#c8ddd5] rounded-lg text-sm outline-none focus:border-[#4ade80]/40 transition-all" />
            </div>
          </div>
        </div>

        <!-- Priority -->
        <div class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2 border-b border-[#131e17]">
            <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Priority</span>
          </div>
          <div class="px-3.5 py-3 flex gap-2">
            <button type="button" @click="newTask.priority = 'critical'"
              :class="['flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                newTask.priority === 'critical'
                  ? 'bg-red-500/20 border-red-500/50 text-red-400'
                  : 'bg-[#0d1410] border-[#1f3228] text-[#4a6b58] hover:border-red-800/40 hover:text-red-500/70']">
              Critical
            </button>
            <button type="button" @click="newTask.priority = 'medium'"
              :class="['flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                newTask.priority === 'medium'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'bg-[#0d1410] border-[#1f3228] text-[#4a6b58] hover:border-amber-700/40 hover:text-amber-500/70']">
              Medium
            </button>
            <button type="button" @click="newTask.priority = 'low'"
              :class="['flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                newTask.priority === 'low'
                  ? 'bg-[#4ade80]/15 border-[#4ade80]/40 text-[#4ade80]'
                  : 'bg-[#0d1410] border-[#1f3228] text-[#4a6b58] hover:border-[#2a5035]/60 hover:text-[#4ade80]/60']">
              Low
            </button>
          </div>
        </div>

        <!-- Description -->
        <div class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2 border-b border-[#131e17] flex items-center justify-between">
            <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Notes</span>
            <span class="text-[9px] text-[#2d4035]">each line = bullet</span>
          </div>
          <textarea v-model="newTask.description" placeholder="Add notes, each on a new line" rows="3"
            class="w-full p-3.5 bg-transparent text-[#c8ddd5] text-sm resize-none outline-none placeholder-[#2d4035] font-mono leading-relaxed" />
        </div>

        <!-- Meeting -->
        <div class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2 border-b border-[#131e17]">
            <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Meeting</span>
          </div>
          <div class="px-3.5 py-3 flex flex-col gap-2.5">
            <select v-model="newTask.meetingType"
              class="w-full p-2.5 bg-[#0d1410] border border-[#1f3228] text-[#8fb89f] rounded-lg text-sm outline-none focus:border-[#4ade80]/40 transition-all cursor-pointer appearance-none">
              <option value="none">No meeting</option>
              <option value="google">Google Meet</option>
              <option value="teams">Microsoft Teams</option>
              <option value="custom">Other link</option>
            </select>
            <template v-if="newTask.meetingType !== 'none'">
              <input v-model="newTask.meetingUrl" type="url" placeholder="Paste meeting link"
                class="w-full p-2.5 bg-[#0d1410] border border-[#1f3228] text-[#8fb89f] rounded-lg text-xs outline-none focus:border-[#4ade80]/40 placeholder-[#2d4035] transition-all" />
              <div class="flex gap-2">
                <input v-model="newTask.guestEmailsText" type="text" placeholder="Guest emails, comma separated"
                  class="flex-1 p-2.5 bg-[#0d1410] border border-[#1f3228] text-[#8fb89f] rounded-lg text-xs outline-none focus:border-[#4ade80]/40 placeholder-[#2d4035] transition-all" />
                <button type="button" @click="openGoogleCalendarForTask"
                  class="px-3 py-2 rounded-lg bg-[#132218] border border-[#2a4035] text-[#4ade80] text-xs font-semibold hover:bg-[#1a3020] active:scale-95 transition-all whitespace-nowrap">GCal</button>
              </div>
            </template>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2.5 pt-0.5">
          <button @click="handleAddTask"
            class="flex-1 py-3.5 rounded-xl font-bold text-sm bg-[#4ade80] text-[#070c09] hover:bg-[#22c55e] active:scale-[0.98] transition-all shadow-lg shadow-[#4ade80]/20 flex items-center justify-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline v-if="editingTaskId" points="20 6 9 17 4 12"/>
              <template v-else><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></template>
            </svg>
            {{ editingTaskId ? 'Update Task' : 'Add Task' }}
          </button>
          <button @click="() => { showAddForm = false; editingTaskId = null }"
            class="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-[#0a0f0b] border border-[#1f3228] text-[#4a6b58] hover:border-[#2a4035] hover:text-[#8fb89f] active:scale-[0.98] transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ START TASK MODAL — pick work days + per-day hour ════════════════════ -->
  <div v-if="showStartForm"
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
    @click.self="cancelStartTask">
    <div class="bg-[#0d1a11]/85 backdrop-blur-xl border border-[#1f3228] rounded-2xl shadow-2xl shadow-black/80 w-full max-w-md max-h-[95vh] overflow-y-auto">
      <div class="sticky top-0 z-10 bg-[#0d1a11]/95 backdrop-blur-sm border-b border-[#1f3228] px-5 pt-4 pb-3.5 flex items-start justify-between rounded-t-2xl">
        <div>
          <h3 class="text-base font-bold text-[#c8ddd5]">Schedule Task</h3>
          <p class="text-[10px] text-[#3d5a4a] mt-0.5">Pick the days you'll work — set the hour for each</p>
        </div>
        <button @click="cancelStartTask"
          class="w-8 h-8 flex items-center justify-center rounded-xl bg-[#132218] border border-[#1f3228] text-[#4a6b58] hover:text-white hover:border-[#2a4035] active:scale-95 transition-all">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="p-5 flex flex-col gap-3.5">

        <!-- Calendar: choose work days -->
        <div class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2.5 border-b border-[#131e17] flex items-center justify-between">
            <button @click="moveStartMonth(-1)"
              class="w-7 h-7 flex items-center justify-center rounded-lg bg-[#132218] border border-[#1f3228] text-[#4a6b58] hover:text-[#4ade80] hover:border-[#2a4035] active:scale-95 transition-all">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="text-xs font-bold text-[#c8ddd5] tracking-wide">{{ startCalendarTitle }}</span>
            <button @click="moveStartMonth(1)"
              class="w-7 h-7 flex items-center justify-center rounded-lg bg-[#132218] border border-[#1f3228] text-[#4a6b58] hover:text-[#4ade80] hover:border-[#2a4035] active:scale-95 transition-all">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div class="px-3.5 py-3">
            <!-- Weekday labels -->
            <div class="grid grid-cols-7 gap-1 mb-1.5">
              <div v-for="(d, i) in weekDayLabels" :key="i"
                class="text-center text-[9px] font-bold text-[#2d4035] uppercase tracking-wider">{{ d }}</div>
            </div>
            <!-- Day cells -->
            <div class="grid grid-cols-7 gap-1">
              <template v-for="(cell, i) in startCalendarCells" :key="i">
                <div v-if="!cell.day" />
                <button v-else
                  type="button"
                  :disabled="isPastDay(cell.dateKey)"
                  @click="toggleWorkDay(cell.dateKey!)"
                  :class="['aspect-square rounded-lg text-xs font-semibold transition-all flex items-center justify-center',
                    isPastDay(cell.dateKey)
                      ? 'text-[#1f2e25] cursor-not-allowed'
                      : selectedWorkDays[cell.dateKey!]
                        ? 'bg-[#4ade80] text-[#070c09] font-bold shadow-md shadow-[#4ade80]/20'
                        : 'text-[#8fb89f] hover:bg-[#132218] hover:text-[#4ade80]']">
                  {{ cell.day }}
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- Per-day hour pickers -->
        <div v-if="selectedWorkDaysSorted.length > 0" class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2 border-b border-[#131e17] flex items-center justify-between">
            <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Work hour per day</span>
            <span class="text-[10px] font-bold text-[#4a6b58] bg-[#132218] px-1.5 py-0.5 rounded-full">{{ selectedWorkDaysSorted.length }}</span>
          </div>
          <div class="px-3.5 py-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
            <div v-for="item in selectedWorkDaysSorted" :key="item.date"
              class="flex items-center gap-3">
              <span class="flex-1 text-xs font-medium text-[#8fb89f] font-mono">{{ fmtWorkDayLabel(item.date) }}</span>
              <input :value="item.time" @input="setWorkDayTime(item.date, ($event.target as HTMLInputElement).value)" type="time"
                class="w-28 p-2 bg-[#0d1410] border border-[#1f3228] text-[#c8ddd5] rounded-lg text-sm outline-none focus:border-[#4ade80]/40 transition-all" />
              <button @click="toggleWorkDay(item.date)"
                class="w-7 h-7 flex items-center justify-center rounded-lg bg-[#132218] border border-[#1f3228] text-[#4a6b58] hover:text-red-400 hover:border-red-800/40 active:scale-95 transition-all flex-shrink-0">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
        <p v-else class="text-center text-xs text-[#3d5a4a] py-1">Tap a day above to schedule it.</p>

        <div class="flex gap-2.5 pt-0.5">
          <button @click="confirmStartTask" :disabled="selectedWorkDaysSorted.length === 0"
            class="flex-1 py-3 rounded-xl font-bold text-sm bg-[#4ade80] text-[#070c09] hover:bg-[#22c55e] active:scale-[0.98] transition-all shadow-lg shadow-[#4ade80]/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Schedule
          </button>
          <button @click="cancelStartTask"
            class="flex-1 py-3 rounded-xl font-semibold text-sm bg-[#0a0f0b] border border-[#1f3228] text-[#4a6b58] hover:border-[#2a4035] hover:text-[#8fb89f] active:scale-[0.98] transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
