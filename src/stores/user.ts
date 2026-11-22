import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
     state: () => ({
          user: null as null | {
               name: string
               email: string
               picture: string
          }
     }),

     getters: {
          isLoggedIn: (state) => !!state.user
     },

     actions: {
          setUser(userData: { name: string; email: string; picture: string }) {
               this.user = userData
          },
          logout() {
               this.user = null
          }
     }
})
