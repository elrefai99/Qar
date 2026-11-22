import { createRouter, createWebHistory } from 'vue-router'

const routes = [
     {
          path: '/',
          name: 'Home',
          component: () => import('../pages/HomePage.vue')
     },
     {
          path: '/board',
          name: 'Board',
          component: () => import('../pages/BoardPage.vue')
     },
     {
          path: '/calendar',
          name: 'Calendar',
          component: () => import('../pages/CalendarPage.vue')
     },
     {
          path: '/projects',
          name: 'Projects',
          component: () => import('../pages/ProjectsPage.vue')
     },
]

const router = createRouter({
     history: createWebHistory(),
     routes,
     scrollBehavior: () => ({ top: 0 })
})

export default router
