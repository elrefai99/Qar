<template>
  <div class="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#070c09]">
    <!-- Animated gradient blobs -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="blob blob-1" />
      <div class="blob blob-2" />
      <div class="blob blob-3" />
      <!-- Subtle noise grain overlay -->
      <div
        class="absolute inset-0 opacity-[0.04]"
        style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E');background-size:180px 180px"
      />
    </div>

    <!-- Top-right subtle icon -->
    <div class="absolute top-5 right-6">
      <svg class="w-5 h-5 text-[#3d5a4a] opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 5h18M6 12h12M10 19h4" stroke-linecap="round"/>
      </svg>
    </div>

    <!-- Main content -->
    <div class="relative z-10 flex flex-col items-center text-center px-6 w-full max-w-md">

      <!-- Wordmark -->
      <div class="mb-6 select-none">
        <h1
          class="text-5xl font-black text-white tracking-tighter leading-none"
          style="font-family:'Georgia',serif"
        ><span class="text-[#4ade80]">Qar</span></h1>
        <h2 class="text-[2rem] sm:text-[2rem] font-bold text-white leading-[1] mb-2 tracking-tight" style="font-family:'Georgia',serif">
          Intelligent Schedule & Task Manager
        </h2>
      </div>

      <!-- Subtext -->
      <p class="text-[#6b8f7c] text-sm sm:text-base font-light leading-relaxed mb-8">
        Organize your day with smart task management
      </p>

      <!-- Error -->
      <div
        v-if="authStore.error"
        class="mb-4 w-full px-4 py-2.5 rounded-xl bg-red-950/50 border border-red-800/40 text-red-300 text-sm"
      >
        {{ authStore.error }}
      </div>

      <!-- Divider -->
      <div class="flex items-center w-full gap-3 my-4">
        <div class="flex-1 h-px bg-[#1a2820]" />
        <span class="text-[#334d3e] text-xs font-medium">or sign in</span>
        <div class="flex-1 h-px bg-[#1a2820]" />
      </div>

      <!-- Google button -->
      <button
        @click="handleSignIn"
        :disabled="authStore.loading"
        class="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-full border border-[#233329] bg-[#0d1810]/80 backdrop-blur-md text-[#b8d4c4] text-sm font-medium hover:border-[#4ade80]/25 hover:bg-[#111f16]/90 active:scale-[0.99] transition-all duration-200 shadow-xl shadow-black/40 disabled:opacity-50"
      >
        <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <p class="mt-8 text-[#2e4438] text-xs">No spam. Just your stuff, saved.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const email = ref('')

const handleSignIn = async () => {
  try {
    await authStore.signIn()
  } catch (error) {
    console.error('Sign in failed:', error)
  }
}

const handleEarlyAccess = () => {
  // Could wire up email collection here; for now triggers Google auth
  handleSignIn()
}
</script>

<style scoped>
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  pointer-events: none;
  animation: blobFloat 15s ease-in-out infinite alternate;
}
.blob-1 {
  width: 560px; height: 480px;
  background: radial-gradient(ellipse, #1c4d30 0%, transparent 65%);
  top: -180px; left: -120px;
  opacity: 0.4;
  animation-duration: 16s;
}
.blob-2 {
  width: 420px; height: 420px;
  background: radial-gradient(ellipse, #0e3320 0%, transparent 65%);
  bottom: -120px; right: -100px;
  opacity: 0.35;
  animation-duration: 12s;
  animation-delay: -5s;
}
.blob-3 {
  width: 280px; height: 280px;
  background: radial-gradient(ellipse, #153d22 0%, transparent 65%);
  top: 45%; left: 60%;
  opacity: 0.3;
  animation-duration: 18s;
  animation-delay: -9s;
}
@keyframes blobFloat {
  0%   { transform: translate(0px, 0px) scale(1); }
  33%  { transform: translate(28px, -18px) scale(1.04); }
  66%  { transform: translate(-18px, 14px) scale(0.97); }
  100% { transform: translate(14px, 22px) scale(1.02); }
}
</style>
