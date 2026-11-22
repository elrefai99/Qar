<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRoute, useRouter } from 'vue-router'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { updateProfile as firebaseUpdateProfile } from 'firebase/auth'
import { db, auth } from '../firebase/config'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const showProfile   = ref(false)
const editName      = ref('')
const previewImage  = ref<string | null>(null)
const saving        = ref(false)
const saveSuccess   = ref(false)
const saveError     = ref('')
const fileInputRef  = ref<HTMLInputElement | null>(null)
const mobileMenuOpen = ref(false)

const avatarSrc = computed(() =>
  previewImage.value
    || authStore.user?.photoURL
    || null
)

const userInitials = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.email || '?'
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
})

const navItems = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/board', label: 'Board', icon: 'board' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar' },
  { path: '/projects', label: 'Projects', icon: 'projects' }
]

const isActive = (path: string) => route.path === path

function navigateTo(path: string) {
  router.push(path)
  mobileMenuOpen.value = false
}

function openProfile() {
  editName.value    = authStore.user?.displayName || ''
  previewImage.value = authStore.user?.photoURL || null
  saveSuccess.value  = false
  saveError.value    = ''
  showProfile.value  = true
}

function closeProfile() {
  showProfile.value  = false
  previewImage.value = authStore.user?.photoURL || null
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    saveError.value = 'Image must be under 2 MB.'
    return
  }
  saveError.value = ''
  const reader = new FileReader()
  reader.onload = () => { previewImage.value = reader.result as string }
  reader.readAsDataURL(file)
}

async function saveProfile() {
  if (!authStore.user) return
  if (!editName.value.trim()) { saveError.value = 'Name cannot be empty.'; return }

  saving.value    = true
  saveError.value = ''

  try {
    const photoURL = previewImage.value || authStore.user.photoURL || ''

    if (auth.currentUser) {
      await firebaseUpdateProfile(auth.currentUser, {
        displayName: editName.value.trim(),
        photoURL
      })
    }

    await setDoc(
      doc(db, 'users', authStore.user.uid),
      { displayName: editName.value.trim(), photoURL, updatedAt: serverTimestamp() },
      { merge: true }
    )

    if (authStore.userData) {
      authStore.userData.displayName = editName.value.trim()
      authStore.userData.photoURL    = photoURL
    }
    if (authStore.user) {
      (authStore.user as any).displayName = editName.value.trim()
      ;(authStore.user as any).photoURL   = photoURL
    }

    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2500)
  } catch (err: any) {
    saveError.value = err?.message || 'Failed to save. Try again.'
  } finally {
    saving.value = false
  }
}

async function handleLogout() {
  try { await authStore.signOut() } catch (e) { console.error(e) }
}
</script>

<template>
  <header>
    <nav class="w-full bg-[#0a0f0b]/90 backdrop-blur-md border-b border-[#1a2820] text-white sticky top-0 z-30">
      <div class="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5">

        <!-- Logo + Nav -->
        <div class="flex items-center gap-6">
          <!-- Logo -->
          <button @click="navigateTo('/')" class="flex items-center gap-2 select-none">
            <span class="text-xl font-black text-white tracking-tighter leading-none" style="font-family:'Georgia',serif">
              Qar
            </span>
          </button>

          <!-- Desktop Nav -->
          <div class="hidden sm:flex items-center gap-1">
            <template v-for="item in navItems" :key="item.path">
              <button
                @click="navigateTo(item.path)"
                :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                  isActive(item.path)
                    ? 'bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/25'
                    : 'text-[#4a6b58] hover:text-[#8fb89f] hover:bg-[#111a14] border border-transparent']">
                <!-- Home icon -->
                <svg v-if="item.icon === 'home'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <!-- Board icon -->
                <svg v-else-if="item.icon === 'board'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
                <!-- Calendar icon -->
                <svg v-else-if="item.icon === 'calendar'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <!-- Projects icon -->
                <svg v-else-if="item.icon === 'projects'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 012-2h3l2 3h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
                {{ item.label }}
              </button>
            </template>
          </div>
        </div>

        <!-- Right -->
        <div class="flex items-center gap-3 sm:gap-4">

          <!-- Mobile menu toggle -->
          <button @click="mobileMenuOpen = !mobileMenuOpen" class="sm:hidden p-2 rounded-lg bg-[#111a14] border border-[#1a2820] text-[#4a6b58] hover:text-[#4ade80] transition-all">
            <svg v-if="!mobileMenuOpen" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          <div v-if="authStore.isAuthenticated && authStore.user" class="flex items-center gap-2 sm:gap-3">

            <!-- Clickable avatar -->
            <button @click="openProfile" class="relative group focus:outline-none" title="Profile settings">
              <img v-if="avatarSrc"
                :src="avatarSrc"
                class="w-7 h-7 sm:w-8 sm:h-8 rounded-full ring-1 ring-[#2a4035] object-cover group-hover:ring-[#4ade80]/50 transition-all"
                :alt="authStore.user.displayName || 'User'"
              />
              <div v-else
                class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#132218] border border-[#2a4035] flex items-center justify-center text-[10px] font-bold text-[#4ade80] group-hover:border-[#4ade80]/50 transition-all">
                {{ userInitials }}
              </div>
              <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#4ade80] rounded-full border border-[#0a0f0b]" />
            </button>

            <!-- Name/email -->
            <button @click="openProfile" class="hidden md:block text-left hover:opacity-80 transition-opacity focus:outline-none">
              <p class="text-xs font-semibold text-[#d4e8dc] leading-tight">{{ authStore.user.displayName }}</p>
              <p class="text-[10px] text-[#4a6b58] leading-tight">{{ authStore.user.email }}</p>
            </button>

            <!-- Sign out -->
            <button @click="handleLogout"
              class="px-3 py-1.5 rounded-lg bg-[#1a2820] border border-[#2a3d30] text-[#8fb89f] text-xs font-medium hover:bg-[#1f3228] hover:text-[#4ade80] hover:border-[#4ade80]/30 active:scale-95 transition-all duration-150">
              <span class="hidden sm:inline">Sign out</span>
              <span class="sm:hidden">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              </span>
            </button>
          </div>
        </div>

      </div>

      <!-- Mobile Nav Menu -->
      <div v-if="mobileMenuOpen" class="sm:hidden border-t border-[#1a2820] bg-[#0a0f0b]/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1">
        <template v-for="item in navItems" :key="item.path">
          <button @click="navigateTo(item.path)"
            :class="['w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-left',
              isActive(item.path)
                ? 'bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/25'
                : 'text-[#4a6b58] hover:text-[#8fb89f] hover:bg-[#111a14] border border-transparent']">
            <svg v-if="item.icon === 'home'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <svg v-else-if="item.icon === 'board'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
            <svg v-else-if="item.icon === 'calendar'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <svg v-else-if="item.icon === 'projects'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 012-2h3l2 3h9a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
            {{ item.label }}
          </button>
        </template>
      </div>
    </nav>
  </header>

  <Teleport to="body">
    <div
      v-if="showProfile"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="closeProfile"
    >
      <div class="bg-[#0d1a11]/85 backdrop-blur-xl border border-[#1f3228] rounded-2xl shadow-2xl shadow-black/80 w-full max-w-sm overflow-hidden">

        <div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1f3228]">
          <div>
            <h2 class="text-sm font-bold text-[#c8ddd5]">Profile Settings</h2>
            <p class="text-[10px] text-[#3d5a4a] mt-0.5">Update your name & photo</p>
          </div>
          <button @click="closeProfile"
            class="w-8 h-8 flex items-center justify-center rounded-xl bg-[#132218] border border-[#1f3228] text-[#4a6b58] hover:text-white hover:border-[#2a4035] active:scale-95 transition-all">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="px-5 py-5 flex flex-col gap-5">

          <div class="flex flex-col items-center gap-3">
            <div class="relative group cursor-pointer" @click="fileInputRef?.click()">
              <div class="w-20 h-20 rounded-full overflow-hidden ring-2 ring-[#2a4035] group-hover:ring-[#4ade80]/50 transition-all">
                <img v-if="previewImage" :src="previewImage" class="w-full h-full object-cover" alt="Avatar preview" />
                <div v-else class="w-full h-full bg-[#132218] flex items-center justify-center text-xl font-bold text-[#4ade80]">
                  {{ userInitials }}
                </div>
              </div>
              <div class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#4ade80] flex items-center justify-center shadow-lg border-2 border-[#0d1a11]">
                <svg class="w-3 h-3 text-[#070c09]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>

            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onFileChange"
            />

            <div class="text-center">
              <button @click="fileInputRef?.click()"
                class="text-[10px] text-[#4a6b58] hover:text-[#4ade80] transition-colors font-medium">
                Click photo to change - max 2 MB
              </button>
              <p v-if="previewImage && previewImage !== authStore.user?.photoURL"
                class="text-[9px] text-[#4ade80] mt-0.5">New photo selected</p>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Display Name</label>
            <input
              v-model="editName"
              type="text"
              placeholder="Your name"
              maxlength="40"
              @keydown.enter="saveProfile"
              class="w-full p-3 bg-[#0a0f0b] border border-[#1f3228] text-[#c8ddd5] rounded-xl text-sm outline-none focus:border-[#4ade80]/50 focus:ring-2 focus:ring-[#4ade80]/10 placeholder-[#2d4035] transition-all font-medium"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-[#3d5a4a] uppercase tracking-widest">Email</label>
            <div class="w-full p-3 bg-[#0a0f0b]/60 border border-[#131e17] text-[#3d5a4a] rounded-xl text-sm font-mono flex items-center gap-2">
              <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span class="truncate text-[#4a6b58]">{{ authStore.user?.email }}</span>
              <span class="ml-auto text-[9px] bg-[#132218] border border-[#1f3228] text-[#3d5a4a] px-1.5 py-0.5 rounded font-semibold flex-shrink-0">Google</span>
            </div>
          </div>

          <div v-if="saveError" class="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-400">
            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {{ saveError }}
          </div>
          <div v-if="saveSuccess" class="flex items-center gap-2 p-3 bg-[#0a1f10] border border-[#4ade80]/25 rounded-xl text-xs text-[#4ade80]">
            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Profile saved successfully!
          </div>

          <div class="flex gap-2.5">
            <button
              @click="saveProfile"
              :disabled="saving"
              class="flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              :class="saving ? 'bg-[#4ade80]/50 text-[#070c09]/60 cursor-not-allowed' : 'bg-[#4ade80] text-[#070c09] hover:bg-[#22c55e] shadow-lg shadow-[#4ade80]/20'"
            >
              <svg v-if="saving" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
              <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
            <button @click="closeProfile"
              class="px-4 py-3 rounded-xl font-semibold text-sm bg-[#0a0f0b] border border-[#1f3228] text-[#4a6b58] hover:border-[#2a4035] hover:text-[#8fb89f] active:scale-[0.98] transition-all">
              Cancel
            </button>
          </div>

          <div class="pt-1 border-t border-[#131e17]">
            <button @click="handleLogout"
              class="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs text-[#3d5a4a] hover:text-red-400 hover:bg-red-950/20 transition-all font-medium">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              Sign out of Qar
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
