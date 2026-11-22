import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from 'firebase/auth'
import {
     signInWithGoogle,
     logout,
     onAuthChange,
     getUserData,
     type UserData
} from '../firebase/auth'

export const useAuthStore = defineStore('auth', () => {
     const user = ref<User | null>(null)
     const userData = ref<UserData | null>(null)
     const loading = ref(true)
     const error = ref<string | null>(null)

     const isAuthenticated = computed(() => !!user.value)

     // Initialize auth state listener
     const initAuth = () => {
          loading.value = true

          onAuthChange(async (firebaseUser) => {
               user.value = firebaseUser

               if (firebaseUser) {
                    try {
                         // Fetch user data from Firestore
                         userData.value = await getUserData(firebaseUser.uid)
                    } catch (err: any) {
                         console.error('Error fetching user data:', err)
                         error.value = err.message
                    }
               } else {
                    userData.value = null
               }

               loading.value = false
          })
     }

     // Sign in with Google
     const signIn = async () => {
          try {
               loading.value = true
               error.value = null
               await signInWithGoogle()
          } catch (err: any) {
               console.error('Sign in error:', err)
               error.value = err.message
               throw err
          } finally {
               loading.value = false
          }
     }

     // Sign out
     const signOut = async () => {
          try {
               loading.value = true
               error.value = null
               await logout()
               user.value = null
               userData.value = null
          } catch (err: any) {
               console.error('Sign out error:', err)
               error.value = err.message
               throw err
          } finally {
               loading.value = false
          }
     }

     return {
          user,
          userData,
          loading,
          error,
          isAuthenticated,
          initAuth,
          signIn,
          signOut
     }
})
