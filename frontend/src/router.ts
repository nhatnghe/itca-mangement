import { createRouter, createWebHistory } from 'vue-router'

import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import Leave from './views/Leave.vue'
import Work from './views/Work.vue'
import Stats from './views/Stats.vue'
import Profile from './views/Profile.vue'
import Approvals from './views/Approvals.vue'
import Users from './views/Users.vue'
import Settings from './views/Settings.vue'

export default createRouter({
  history: createWebHistory(),

  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: Login },
    { path: '/dashboard', component: Dashboard },
    { path: '/leave', component: Leave },
    { path: '/work', component: Work },
    { path: '/stats', component: Stats },
    { path: '/profile', component: Profile },
    { path: '/approvals', component: Approvals },
    { path: '/users', component: Users },
	{ path: '/settings', component: Settings },
  ],
})