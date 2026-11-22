<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from './stores/auth'
import Login from './components/Login.vue'
import ScheduleApp from './App.vue'

const authStore = useAuthStore()

const showLogin = computed(() => !authStore.isAuthenticated && !authStore.loading)
const showApp = computed(() => authStore.isAuthenticated && !authStore.loading)
</script>

<template>
  <div>
    <!-- Loading State -->
    <div
      v-if="authStore.loading"
      class="min-h-screen flex items-center justify-center bg-[#070c09]"
    >
      <div class="flex flex-col items-center gap-4">
        <!-- Logo spinner -->
        <div class="relative w-30 h-50 flex items-center justify-center">
          <svg class="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="24" stroke="#1a2820" stroke-width="3"/>
            <path
              d="M28 4a24 24 0 0 1 24 24"
              stroke="#4ade80"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
          <span
            class="text-lg font-black text-white leading-none"
            style="font-family:'Georgia',serif"
          >
        <span class="text-[#4ade80]">Qar</span>. </span>
          
        </div>
        <p class="text-[#4a6b58] text-sm font-light tracking-wide">Loading your workspace…</p>
      </div>
    </div>

    <!-- Login Page -->
    <Login v-if="showLogin" />

    <!-- Main App -->
    <ScheduleApp v-if="showApp" />
  </div>
</template>
