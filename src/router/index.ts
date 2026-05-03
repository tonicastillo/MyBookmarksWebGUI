import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import EditView from '@/views/EditView.vue'
import CategoriesView from '@/views/CategoriesView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/edit/:id?',
      name: 'edit',
      component: EditView
    },
    {
      path: '/categories',
      name: 'categories',
      component: CategoriesView
    }
  ]
})

export default router
