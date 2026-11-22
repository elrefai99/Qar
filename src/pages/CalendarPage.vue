<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useScheduleStore } from '../stores/store'
import { useProjectsStore } from '../stores/projects'
import { formatDate, formatHour, isDateDisabled, weekDays } from '../utils/dateUtils'
import { getHourSlotHeight, getTaskPosition } from '../utils/calendarUtils'
import { useCalendar } from '../shared/useCalendar'
import { useTaskLogic } from '../shared/useTaskLogic'

const store = useScheduleStore()
const projectsStore = useProjectsStore()
const currentTime = ref(new Date())

const {
  todayFormatted, selectedDate, calendarView, currentDate,
  weekCalendarDays, displayedCalendarDays, calendarTitle,
  changeMonth, handleDateClick: calendarHandleDateClick, timeSlots
} = useCalendar()

const {
  showAddForm, editingTaskId, newTask, endDatePreview,
  currentTasks, handleAddTask, handleEditTask,
  toggleComplete, deleteTaskItem, openGoogleCalendarForTask,
  checkAndCompletePassedTasks
} = useTaskLogic(store, selectedDate, todayFormatted, currentTime)

// ── Sidebar mini-calendar (independent navigation) ──────────────────────────
const sidebarDate = ref(new Date())
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
const sidebarTitle = computed(() => `${monthNames[sidebarDate.value.getMonth()]} ${sidebarDate.value.getFullYear()}`)
const sidebarDays = computed(() => {
  const year = sidebarDate.value.getFullYear()
  const month = sidebarDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: (Date | null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i))
  return days
})
const changeSidebarMonth = (d: number) => {
  sidebarDate.value = new Date(sidebarDate.value.getFullYear(), sidebarDate.value.getMonth() + d, 1)
}
const selectSidebarDate = (date: Date) => {
  calendarHandleDateClick(date)
  showAddForm.value = false
  // Sync the main calendar view month
  currentDate.value = new Date(date)
}

// ── Go to today ──────────────────────────────────────────────────────────────
const goToToday = () => {
  const today = new Date()
  calendarHandleDateClick(today)
  currentDate.value = new Date(today)
  sidebarDate.value = new Date(today)
}

// ── Current time indicator ───────────────────────────────────────────────────
const getCurrentTimePosition = () => {
  const hour = currentTime.value.getHours()
  const minute = currentTime.value.getMinutes()
  const startHour = 6
  if (hour < startHour || hour > 23) return null
  const h = getHourSlotHeight()
  return { top: ((hour - startHour) * h) + (minute * (h / 60)), display: true }
}

// ── Task helpers ─────────────────────────────────────────────────────────────
const getAllTasksForDay = (date: Date) => {
  return store.getTasksSpanningDate(formatDate(date)).sort((a: any, b: any) =>
    (a.time || '99:99').localeCompare(b.time || '99:99'))
}

const getMultiDayLabel = (task: any, dateKey: string): string => {
  if (!task.durationDays || task.durationDays <= 1) return ''
  const start = new Date(task.startDate + 'T00:00:00')
  const cur = new Date(dateKey + 'T00:00:00')
  const diff = Math.round((cur.getTime() - start.getTime()) / 86400000) + 1
  return `Day ${diff}/${task.durationDays}`
}

const getTaskCountForDate = (date: Date) => store.getTasksSpanningDate(formatDate(date)).length

// ── Current time display ─────────────────────────────────────────────────────
const currentTimeLabel = computed(() => {
  const h = currentTime.value.getHours()
  const m = String(currentTime.value.getMinutes()).padStart(2, '0')
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${period}`
})

onMounted(async () => {
  if (!store.synced) await store.loadUserTasks()
  if (!projectsStore.synced) await projectsStore.loadUserProjects()
  setInterval(() => { currentTime.value = new Date(); checkAndCompletePassedTasks() }, 1000)
})
</script>

<template>
  <!-- Outer 2-column layout: sidebar + main -->
  <div class="flex gap-0 min-h-[calc(100vh-140px)]">

    <!-- ══ LEFT SIDEBAR ════════════════════════════════════════════════════ -->
    <div class="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-[#1a2820] bg-[#070c09] px-4 pt-2 pb-6 gap-5">

      <!-- Mini calendar -->
      <div>
        <!-- Month nav -->
        <div class="flex items-center justify-between mb-2">
          <button @click="changeSidebarMonth(-1)"
            class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#132218] text-[#4a6b58] hover:text-[#4ade80] transition-all">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="text-xs font-bold text-[#8fb89f]">{{ sidebarTitle }}</span>
          <button @click="changeSidebarMonth(1)"
            class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#132218] text-[#4a6b58] hover:text-[#4ade80] transition-all">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <!-- Day-of-week headers -->
        <div class="grid grid-cols-7 mb-0.5">
          <div v-for="d in ['S','M','T','W','T','F','S']" :key="d"
            class="text-center text-[9px] font-bold text-[#2d4035] py-1">{{ d }}</div>
        </div>
        <!-- Date grid -->
        <div class="grid grid-cols-7 gap-y-0.5">
          <template v-for="(day, i) in sidebarDays" :key="i">
            <button v-if="day" @click="selectSidebarDate(day)"
              :class="['w-full aspect-square rounded-full text-[10px] font-medium flex items-center justify-center transition-all',
                formatDate(day) === todayFormatted
                  ? 'bg-[#4ade80] text-[#070c09] font-bold shadow-sm shadow-[#4ade80]/30'
                  : selectedDate && formatDate(day) === formatDate(selectedDate)
                    ? 'bg-[#4ade80]/20 text-[#4ade80] ring-1 ring-[#4ade80]/50'
                    : 'text-[#6b9b7e] hover:bg-[#132218] hover:text-[#c8ddd5]']">
              {{ day.getDate() }}
            </button>
            <div v-else class="w-full aspect-square" />
          </template>
        </div>
      </div>

      <!-- Selected day task list -->
      <div v-if="selectedDate">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">
            {{ ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][selectedDate.getDay()] }}, {{ selectedDate.getDate() }}
          </span>
          <span class="text-[10px] font-bold text-[#4ade80] bg-[#4ade80]/10 px-1.5 py-0.5 rounded-full">
            {{ currentTasks.length }}
          </span>
        </div>
        <div class="space-y-1 max-h-52 overflow-y-auto pr-1">
          <div v-for="task in currentTasks" :key="task.id"
            class="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#0d1410] border border-[#1a2820] cursor-pointer hover:border-[#2a4035] transition-all group"
            @click="handleEditTask(task, formatDate(selectedDate!))">
            <div :class="['w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all',
              task.completed ? 'bg-[#4a6b58]' : task.meetingUrl ? 'bg-blue-400' : 'bg-[#4ade80]']" />
            <span :class="['text-[10px] truncate flex-1', task.completed ? 'line-through text-[#3d5a4a]' : 'text-[#a0c8b0]']">{{ task.title }}</span>
            <span v-if="task.time" class="text-[9px] text-[#2d4035] font-mono flex-shrink-0">{{ task.time }}</span>
          </div>
          <div v-if="currentTasks.length === 0" class="text-center py-4 text-[10px] text-[#2d4035]">No tasks</div>
        </div>
        <button v-if="selectedDate && !isDateDisabled(selectedDate)" @click="showAddForm = true"
          class="w-full mt-3 py-2 text-[10px] font-bold text-[#4ade80] bg-[#4ade80]/10 border border-dashed border-[#4ade80]/25 rounded-xl hover:bg-[#4ade80]/15 hover:border-[#4ade80]/40 transition-all flex items-center justify-center gap-1.5">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Task
        </button>
      </div>
    </div>

    <!-- ══ MAIN CALENDAR AREA ════════════════════════════════════════════ -->
    <div class="flex-1 flex flex-col min-w-0 px-4 pt-2 pb-6">

      <!-- ── Google Calendar-style header ─────────────────────────────── -->
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">

        <!-- Left: nav arrows + Today button + title -->
        <div class="flex items-center gap-1.5">
          <button @click="changeMonth(-1)"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#132218] text-[#4a6b58] hover:text-[#c8ddd5] transition-all border border-transparent hover:border-[#1a2820]">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button @click="changeMonth(1)"
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#132218] text-[#4a6b58] hover:text-[#c8ddd5] transition-all border border-transparent hover:border-[#1a2820]">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button @click="goToToday"
            class="px-4 py-1.5 rounded-full text-xs font-semibold border border-[#2a4035] text-[#8fb89f] hover:bg-[#132218] hover:text-[#4ade80] hover:border-[#4ade80]/40 transition-all">
            Today
          </button>
          <h2 class="text-base sm:text-lg font-bold text-[#c8ddd5] ml-2 select-none">{{ calendarTitle }}</h2>
        </div>

        <!-- Right: View selector as segmented pill -->
        <div class="flex items-center gap-1 bg-[#0d1410] border border-[#1a2820] rounded-xl p-1">
          <button v-for="view in (['day','week','month'] as const)" :key="view"
            @click="calendarView = view"
            :class="['px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all',
              calendarView === view
                ? 'bg-[#4ade80] text-[#070c09] shadow-sm'
                : 'text-[#4a6b58] hover:text-[#8fb89f] hover:bg-[#132218]']">
            {{ view }}
          </button>
        </div>
      </div>

      <!-- ── MOBILE WEEK STRIP (shown only below lg, replaces sidebar mini-cal) ── -->
      <div class="lg:hidden mb-3 flex flex-col gap-2">
        <!-- Week navigation strip -->
        <div class="bg-[#0d1410] border border-[#1a2820] rounded-2xl overflow-hidden">
          <div class="flex items-center">
            <div v-for="(day, i) in weekCalendarDays" :key="i"
              @click="day && calendarHandleDateClick(day)"
              class="flex-1 flex flex-col items-center py-2.5 cursor-pointer transition-all active:scale-95 relative"
              :class="day && formatDate(day) === todayFormatted ? 'bg-[#4ade80]/[0.05]' : 'hover:bg-[#111a14]'">
              <span class="text-[9px] font-bold uppercase tracking-wider mb-1"
                :class="day && formatDate(day) === todayFormatted ? 'text-[#4ade80]' : 'text-[#2d4035]'">
                {{ day ? ['Su','Mo','Tu','We','Th','Fr','Sa'][day.getDay()] : '' }}
              </span>
              <span :class="['w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                day && formatDate(day) === todayFormatted
                  ? 'bg-[#4ade80] text-[#070c09]'
                  : day && selectedDate && formatDate(day) === formatDate(selectedDate)
                    ? 'bg-[#4ade80]/20 text-[#4ade80] ring-1 ring-[#4ade80]/40'
                    : 'text-[#8fb89f]']">
                {{ day?.getDate() ?? '' }}
              </span>
              <!-- Task dot indicator -->
              <div v-if="day && getTaskCountForDate(day) > 0"
                class="w-1 h-1 rounded-full bg-[#4ade80] mt-0.5" />
            </div>
          </div>
        </div>
        <!-- Mobile: selected day add button -->
        <div v-if="selectedDate" class="flex items-center justify-between px-1">
          <span class="text-xs font-semibold text-[#4a6b58]">
            {{ ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][selectedDate.getDay()] }}, {{ selectedDate.getDate() }} ·
            <span class="text-[#4ade80]">{{ currentTasks.length }} tasks</span>
          </span>
          <button v-if="!isDateDisabled(selectedDate)" @click="showAddForm = true"
            class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#4ade80] text-[#070c09] text-xs font-bold hover:bg-[#22c55e] active:scale-95 transition-all shadow-sm shadow-[#4ade80]/20">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Task
          </button>
        </div>
      </div>

      <!-- ── MONTH VIEW ────────────────────────────────────────────────── -->
      <template v-if="calendarView === 'month'">
        <div class="bg-[#0d1410] border border-[#1a2820] rounded-2xl overflow-hidden flex-1">
          <!-- Day-of-week header row -->
          <div class="grid grid-cols-7 border-b border-[#1a2820]">
            <div v-for="(day, i) in weekDays" :key="day"
              class="py-2 text-center text-[9px] sm:text-[10px] font-bold text-[#2d4035] uppercase tracking-widest select-none">
              <span class="sm:hidden">{{ day.slice(0,1) }}</span>
              <span class="hidden sm:inline">{{ day }}</span>
            </div>
          </div>
          <!-- Date grid -->
          <div class="grid grid-cols-7">
            <div v-for="(day, index) in displayedCalendarDays" :key="index"
              @click="day && calendarHandleDateClick(day)"
              :class="['min-h-16 sm:min-h-24 md:min-h-28 p-1 sm:p-1.5 border-b border-r border-[#131e17] transition-all cursor-pointer relative group',
                !day ? 'bg-transparent cursor-default' : '',
                day && formatDate(day) === todayFormatted ? 'bg-[#4ade80]/[0.03]' : '',
                day && selectedDate && formatDate(day) === formatDate(selectedDate) ? 'bg-[#4ade80]/[0.05]' : '',
                day && isDateDisabled(day) ? 'bg-[#0a0e0b]' : 'hover:bg-[#111a14]']">
              <template v-if="day">
                <!-- Date number -->
                <div class="flex items-start justify-between mb-1">
                  <span :class="['w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-[10px] sm:text-xs font-bold transition-all',
                    formatDate(day) === todayFormatted
                      ? 'bg-[#4ade80] text-[#070c09] shadow-sm shadow-[#4ade80]/30'
                      : selectedDate && formatDate(day) === formatDate(selectedDate)
                        ? 'bg-[#4ade80]/20 text-[#4ade80] ring-1 ring-[#4ade80]/40'
                        : isDateDisabled(day)
                          ? 'text-[#3d5a4a]'
                          : 'text-[#8fb89f] group-hover:text-[#c8ddd5]']">
                    {{ day.getDate() }}
                  </span>
                </div>
                <!-- Event chips: dots on mobile, pills on sm+ -->
                <div class="sm:space-y-0.5">
                  <!-- Mobile: just colored dots -->
                  <div class="sm:hidden flex gap-0.5 flex-wrap mt-0.5">
                    <div v-for="task in getAllTasksForDay(day).slice(0, 4)" :key="task.id"
                      :class="['w-1.5 h-1.5 rounded-full',
                        task.completed ? 'bg-[#2a4035]' :
                        task.meetingUrl ? 'bg-blue-400' : 'bg-[#4ade80]']" />
                  </div>
                  <!-- Desktop: pill chips -->
                  <div class="hidden sm:block space-y-0.5">
                    <div v-for="task in getAllTasksForDay(day).slice(0, 3)" :key="task.id"
                      :class="['w-full px-1.5 py-0.5 rounded text-[9px] font-medium truncate leading-tight',
                        task.completed ? 'bg-[#1a2820] text-[#3d5a4a] line-through' :
                        task.meetingUrl ? 'bg-blue-500/20 text-blue-300' :
                        'bg-[#4ade80]/15 text-[#6db88a]']">
                      {{ task.time ? task.time + ' ' : '' }}{{ task.title }}
                    </div>
                    <div v-if="getTaskCountForDate(day) > 3" class="text-[9px] text-[#3d5a4a] pl-1.5 font-medium">
                      +{{ getTaskCountForDate(day) - 3 }} more
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- ── WEEK VIEW ─────────────────────────────────────────────────── -->
      <template v-else-if="calendarView === 'week'">
        <div class="bg-[#0d1410] border border-[#1a2820] rounded-2xl overflow-hidden flex flex-col flex-1">
          <!-- Day headers -->
          <div class="flex border-b border-[#1a2820] flex-shrink-0">
            <div class="w-16 flex-shrink-0 border-r border-[#1a2820] bg-[#0a0f0b]" />
            <div class="flex-1 grid grid-cols-7">
              <div v-for="(day, index) in weekCalendarDays" :key="index"
                @click="day && calendarHandleDateClick(day)"
                :class="['py-3 text-center border-r border-[#1a2820] cursor-pointer transition-all hover:bg-[#111a14]',
                  day && formatDate(day) === todayFormatted ? 'bg-[#4ade80]/[0.04]' : '',
                  day && selectedDate && formatDate(day) === formatDate(selectedDate) ? 'border-b-2 border-b-[#4ade80]/50' : '']">
                <template v-if="day">
                  <div class="text-[8px] sm:text-[9px] font-bold text-[#3d5a4a] uppercase tracking-wider mb-1">
                    <span class="sm:hidden">{{ ['Su','Mo','Tu','We','Th','Fr','Sa'][day.getDay()] }}</span>
                    <span class="hidden sm:inline">{{ ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.getDay()] }}</span>
                  </div>
                  <div :class="['w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all',
                    formatDate(day) === todayFormatted
                      ? 'bg-[#4ade80] text-[#070c09] shadow-sm shadow-[#4ade80]/30'
                      : selectedDate && formatDate(day) === formatDate(selectedDate)
                        ? 'bg-[#4ade80]/15 text-[#4ade80]'
                        : 'text-[#c8ddd5]']">
                    {{ day.getDate() }}
                  </div>
                </template>
              </div>
            </div>
          </div>
          <!-- Time grid -->
          <div class="flex flex-1 overflow-y-auto" style="max-height: calc(100vh - 320px); min-height: 300px;">
            <!-- Hour labels -->
            <div class="w-16 flex-shrink-0 border-r border-[#1a2820] bg-[#0a0f0b] relative">
              <div v-for="hour in timeSlots" :key="hour"
                class="h-14 sm:h-16 md:h-20 border-b border-[#131e17]/60 flex items-start justify-end pr-2.5">
                <span class="text-[9px] text-[#2d4035] select-none whitespace-nowrap font-medium leading-none" style="margin-top:-0.45em">
                  {{ formatHour(hour) }}
                </span>
              </div>
            </div>
            <!-- Day columns -->
            <div class="flex-1 grid grid-cols-7">
              <div v-for="(day, dayIndex) in weekCalendarDays" :key="dayIndex"
                class="relative border-r border-[#131e17]"
                :class="day && formatDate(day) === todayFormatted ? 'bg-[#4ade80]/[0.015]' : ''">
                <!-- Hour slots -->
                <div v-for="hour in timeSlots" :key="hour"
                  class="h-14 sm:h-16 md:h-20 border-b border-[#131e17]/60 hover:bg-[#111a14]/40 cursor-pointer transition-colors"
                  @click="day && calendarHandleDateClick(day)" />
                <!-- Current time indicator -->
                <div v-if="day && formatDate(day) === todayFormatted && getCurrentTimePosition()?.display"
                  :style="{ position:'absolute', top:`${getCurrentTimePosition()?.top}px`, left:0, right:0, zIndex:20, pointerEvents:'none' }"
                  class="flex items-center">
                  <div class="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                  <div class="flex-1 h-px bg-red-500/70" />
                </div>
                <!-- Task events -->
                <div v-if="day" v-for="task in getAllTasksForDay(day)" :key="task.id"
                  :style="{
                    position:'absolute',
                    top:`${getTaskPosition(task.time || '09:00', getHourSlotHeight()).top}px`,
                    height:`${Math.max(getTaskPosition(task.time || '09:00', getHourSlotHeight()).height * 0.85, 32)}px`,
                    left:'2px', right:'2px', zIndex:10
                  }"
                  :class="['rounded-lg px-1.5 py-1 text-[9px] font-medium cursor-pointer overflow-hidden border-l-2 transition-all hover:brightness-110 shadow-sm',
                    task.meetingUrl ? 'bg-blue-500/25 border-l-blue-400 text-blue-200' :
                    task.completed ? 'bg-[#1a2820]/60 border-l-[#2a4035] text-[#3d5a4a] opacity-50' :
                    'bg-[#4ade80]/15 border-l-[#4ade80]/70 text-[#a0c8b0]']"
                  @click.stop="day && calendarHandleDateClick(day)">
                  <div class="font-bold truncate leading-tight">{{ task.title }}</div>
                  <div v-if="task.time" class="truncate opacity-80">{{ task.time }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ── DAY VIEW ──────────────────────────────────────────────────── -->
      <template v-else-if="calendarView === 'day'">
        <div v-if="selectedDate" class="bg-[#0d1410] border border-[#1a2820] rounded-2xl overflow-hidden flex flex-col flex-1">
          <!-- Day header -->
          <div class="flex items-center gap-4 px-6 py-4 border-b border-[#1a2820]"
            :class="formatDate(selectedDate) === todayFormatted ? 'bg-[#4ade80]/[0.03]' : ''">
            <div :class="['w-12 h-12 rounded-full flex items-center justify-center text-xl font-black flex-shrink-0',
              formatDate(selectedDate) === todayFormatted
                ? 'bg-[#4ade80] text-[#070c09] shadow-md shadow-[#4ade80]/30'
                : 'bg-[#132218] text-[#c8ddd5]']">
              {{ selectedDate.getDate() }}
            </div>
            <div>
              <div class="text-base font-bold text-[#c8ddd5]">
                {{ ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][selectedDate.getDay()] }}
              </div>
              <div class="text-xs text-[#4a6b58] font-mono">{{ formatDate(selectedDate) }}</div>
            </div>
            <div v-if="formatDate(selectedDate) === todayFormatted" class="ml-auto">
              <span class="text-sm font-bold text-[#4ade80] font-mono">{{ currentTimeLabel }}</span>
            </div>
            <button v-if="!isDateDisabled(selectedDate)" @click="showAddForm = true"
              class="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4ade80]/10 border border-[#4ade80]/25 text-[#4ade80] text-xs font-bold hover:bg-[#4ade80]/20 hover:border-[#4ade80]/40 transition-all">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Task
            </button>
          </div>
          <!-- Time grid -->
          <div class="flex flex-1 overflow-y-auto" style="max-height: calc(100vh - 330px); min-height: 280px;">
            <!-- Hour labels -->
            <div class="w-16 flex-shrink-0 border-r border-[#1a2820] bg-[#0a0f0b]">
              <div v-for="hour in timeSlots" :key="hour"
                class="h-16 md:h-20 border-b border-[#131e17]/60 flex items-start justify-end pr-3">
                <span class="text-[10px] text-[#2d4035] select-none whitespace-nowrap font-medium leading-none" style="margin-top:-0.45em">
                  {{ formatHour(hour) }}
                </span>
              </div>
            </div>
            <!-- Event column -->
            <div class="flex-1 relative" :class="formatDate(selectedDate) === todayFormatted ? 'bg-[#4ade80]/[0.01]' : ''">
              <div v-for="hour in timeSlots" :key="hour"
                class="h-16 md:h-20 border-b border-[#131e17]/60 hover:bg-[#111a14]/30 cursor-pointer transition-colors"
                @click="calendarHandleDateClick(selectedDate)" />
              <!-- Current time indicator -->
              <div v-if="formatDate(selectedDate) === todayFormatted && getCurrentTimePosition()?.display"
                :style="{ position:'absolute', top:`${getCurrentTimePosition()?.top}px`, left:0, right:0, zIndex:20, pointerEvents:'none' }"
                class="flex items-center">
                <div class="w-3 h-3 rounded-full bg-red-500 -ml-1.5 flex-shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.7)]" />
                <div class="flex-1 h-[1.5px] bg-red-500/70" />
              </div>
              <!-- Task events -->
              <div v-for="task in getAllTasksForDay(selectedDate)" :key="task.id"
                :style="{
                  position:'absolute',
                  top:`${getTaskPosition(task.time || '09:00', getHourSlotHeight()).top}px`,
                  height:`${Math.max(getTaskPosition(task.time || '09:00', getHourSlotHeight()).height * 0.9, 60)}px`,
                  left:'12px', right:'12px', zIndex:10
                }"
                :class="['rounded-xl px-4 py-3 text-sm font-medium cursor-pointer overflow-hidden border-l-4 transition-all hover:brightness-110 shadow-lg',
                  task.meetingUrl ? 'bg-blue-500/20 border-l-blue-400 text-blue-100' :
                  task.completed ? 'bg-[#1a2820]/60 border-l-[#2a4035] text-[#3d5a4a] opacity-50' :
                  'bg-[#4ade80]/12 border-l-[#4ade80] text-[#c8ddd5]']"
                @click.stop="handleEditTask(task, formatDate(selectedDate!))">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold text-sm">{{ task.time }} {{ task.endTime ? `– ${task.endTime}` : '' }}</span>
                  <div v-if="task.meetingUrl" class="flex items-center gap-1 text-[10px] text-blue-300 font-semibold">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/></svg>
                    Meet
                  </div>
                </div>
                <div class="font-semibold truncate">{{ task.title }}</div>
                <div v-if="selectedDate && getMultiDayLabel(task, formatDate(selectedDate))"
                  class="inline-block mt-1 text-[10px] bg-[#4ade80]/20 text-[#4ade80] px-1.5 py-0.5 rounded font-bold">
                  {{ getMultiDayLabel(task, formatDate(selectedDate)) }}
                </div>
                <div v-if="task.description" class="text-xs opacity-60 line-clamp-1 mt-0.5">{{ task.description }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="flex items-center justify-center flex-1 text-[#2d4035]">
          <p class="text-sm">Select a date to view</p>
        </div>
      </template>

      <!-- Mobile: selected day tasks (shown below calendar on small screens) -->
      <div v-if="selectedDate" class="lg:hidden mt-4 bg-[#0d1410] border border-[#1a2820] rounded-2xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-[#c8ddd5]">{{ formatDate(selectedDate) }}</h3>
          <div class="flex items-center gap-2">
            <span class="text-xs bg-[#132218] text-[#4a6b58] px-2 py-0.5 rounded-full font-bold">{{ currentTasks.length }} tasks</span>
            <button v-if="!isDateDisabled(selectedDate)" @click="showAddForm = true"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#4ade80]/10 border border-[#4ade80]/25 text-[#4ade80] text-xs font-bold hover:bg-[#4ade80]/15 transition-all">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add
            </button>
          </div>
        </div>
        <div v-if="currentTasks.length === 0" class="text-center py-6 text-[#2d4035] text-sm">No tasks scheduled</div>
        <div v-else class="space-y-2 max-h-64 overflow-y-auto">
          <div v-for="task in currentTasks" :key="task.id"
            class="flex items-center gap-3 bg-[#0a0f0b] border border-[#1a2820] rounded-xl p-3 cursor-pointer hover:border-[#2a4035] transition-all"
            @click="handleEditTask(task, formatDate(selectedDate!))">
            <div :class="['w-1.5 h-1.5 rounded-full flex-shrink-0', task.completed ? 'bg-[#3d5a4a]' : task.meetingUrl ? 'bg-blue-400' : 'bg-[#4ade80]']" />
            <div class="flex-1 min-w-0">
              <p :class="['text-sm font-medium truncate', task.completed ? 'line-through text-[#3d5a4a]' : 'text-[#c8ddd5]']">{{ task.title }}</p>
              <p v-if="task.time" class="text-[10px] text-[#4a6b58] font-mono">{{ task.time }}{{ task.endTime ? ` – ${task.endTime}` : '' }}</p>
            </div>
          </div>
        </div>
        <div v-if="isDateDisabled(selectedDate)" class="mt-3 p-3 bg-amber-950/30 border border-amber-800/30 rounded-xl text-xs text-amber-400">
          Past date — view only.
        </div>
      </div>
    </div>
  </div>

  <!-- ══ ADD / EDIT TASK MODAL ══════════════════════════════════════════════ -->
  <div v-if="showAddForm && selectedDate && !isDateDisabled(selectedDate)"
    class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
    @click.self="() => { showAddForm = false; editingTaskId = null }">
    <div class="bg-[#0d1a11]/85 backdrop-blur-xl border border-[#1f3228] rounded-2xl shadow-2xl shadow-black/80 w-full max-w-lg max-h-[95vh] overflow-y-auto">
      <!-- Modal header -->
      <div class="sticky top-0 z-10 bg-[#0d1a11]/95 backdrop-blur-sm border-b border-[#1f3228] px-5 pt-4 pb-3.5 flex items-start justify-between rounded-t-2xl">
        <div>
          <h3 class="text-base font-bold text-[#c8ddd5]">{{ editingTaskId ? 'Edit Task' : 'New Task' }}</h3>
          <p class="text-[10px] text-[#3d5a4a] mt-0.5 font-mono">{{ formatDate(selectedDate) }}</p>
        </div>
        <button @click="() => { showAddForm = false; editingTaskId = null }"
          class="w-8 h-8 flex items-center justify-center rounded-xl bg-[#132218] border border-[#1f3228] text-[#4a6b58] hover:text-white hover:border-[#2a4035] active:scale-95 transition-all">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <!-- Modal body -->
      <div class="p-5 flex flex-col gap-3.5">
        <input v-model="newTask.title" type="text" placeholder="Task title *"
          class="w-full p-3.5 bg-[#0a0f0b] border border-[#1f3228] text-[#c8ddd5] rounded-xl text-sm outline-none focus:border-[#4ade80]/50 focus:ring-2 focus:ring-[#4ade80]/10 placeholder-[#2d4035] transition-all font-medium" />

        <!-- Duration -->
        <div class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2 border-b border-[#131e17]">
            <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Duration (days)</span>
          </div>
          <div class="px-3.5 py-3">
            <div class="flex items-center gap-3">
              <button type="button" @click="newTask.durationDays = Math.max(1,(newTask.durationDays||1)-1)"
                class="w-8 h-8 rounded-lg bg-[#132218] border border-[#2a4035] text-[#4ade80] text-lg font-bold flex items-center justify-center hover:bg-[#1a3020] active:scale-90 transition-all">-</button>
              <input v-model.number="newTask.durationDays" type="number" min="1" max="365"
                class="w-14 text-center p-2 bg-[#0d1410] border border-[#1f3228] text-[#c8ddd5] rounded-lg text-sm font-bold outline-none focus:border-[#4ade80]/40" />
              <button type="button" @click="newTask.durationDays = (newTask.durationDays||1)+1"
                class="w-8 h-8 rounded-lg bg-[#132218] border border-[#2a4035] text-[#4ade80] text-lg font-bold flex items-center justify-center hover:bg-[#1a3020] active:scale-90 transition-all">+</button>
              <span class="text-xs text-[#3d5a4a]">{{ newTask.durationDays === 1 ? 'single day' : 'days' }}</span>
            </div>
            <div v-if="endDatePreview" class="mt-2.5 flex items-center gap-2 text-[10px]">
              <span class="text-[#4a6b58] font-mono">{{ formatDate(selectedDate) }}</span>
              <svg class="w-3 h-3 text-[#2d4035]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              <span class="text-[#8fb89f] font-mono">{{ endDatePreview }}</span>
            </div>
          </div>
        </div>

        <!-- Time Range -->
        <div class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2 border-b border-[#131e17] flex items-center justify-between">
            <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Time Range</span>
            <span v-if="newTask.durationDays > 1" class="text-[9px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
              For {{ selectedDate ? formatDate(selectedDate) : 'this day' }} only
            </span>
          </div>
          <div class="px-3.5 py-3 flex items-end gap-3">
            <div class="flex-1">
              <div class="text-[9px] text-[#2d4035] mb-1.5 uppercase tracking-widest font-semibold">Start</div>
              <input v-model="newTask.time" type="time"
                class="w-full p-2.5 bg-[#0d1410] border border-[#1f3228] text-[#c8ddd5] rounded-lg text-sm outline-none focus:border-[#4ade80]/40 transition-all" />
            </div>
            <div class="pb-2.5 flex-shrink-0">
              <svg class="w-4 h-4 text-[#2d4035]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
            <div class="flex-1">
              <div class="text-[9px] text-[#2d4035] mb-1.5 uppercase tracking-widest font-semibold">End</div>
              <input v-model="newTask.endTime" type="time"
                class="w-full p-2.5 bg-[#0d1410] border border-[#1f3228] text-[#c8ddd5] rounded-lg text-sm outline-none focus:border-[#4ade80]/40 transition-all" />
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2 border-b border-[#131e17] flex items-center justify-between">
            <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Description</span>
            <span class="text-[9px] text-[#2d4035]">each line = bullet</span>
          </div>
          <textarea v-model="newTask.description" placeholder="Enter each point on a new line" rows="3"
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

        <!-- Project -->
        <div v-if="projectsStore.projects.length > 0" class="bg-[#0a0f0b] border border-[#1f3228] rounded-xl overflow-hidden">
          <div class="px-3.5 py-2 border-b border-[#131e17]">
            <span class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Project</span>
          </div>
          <div class="px-3.5 py-3 flex flex-wrap gap-2">
            <button @click="newTask.projectId = ''"
              :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all',
                !newTask.projectId
                  ? 'bg-[#132218] border-[#2a4035] text-[#c8ddd5]'
                  : 'bg-transparent border-[#1a2820] text-[#4a6b58] hover:border-[#2a4035] hover:text-[#8fb89f]']">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              None
            </button>
            <button v-for="project in projectsStore.projects" :key="project.id"
              @click="newTask.projectId = project.id"
              :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all',
                newTask.projectId === project.id
                  ? 'border-transparent text-[#070c09] font-bold'
                  : 'bg-transparent border-[#1a2820] text-[#4a6b58] hover:border-[#2a4035] hover:text-[#8fb89f]']"
              :style="newTask.projectId === project.id ? { background: project.color } : {}">
              <div v-if="newTask.projectId !== project.id" class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: project.color }" />
              {{ project.name }}
            </button>
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
</template>
