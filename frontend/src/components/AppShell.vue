<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../services/api'
import { useRouter } from 'vue-router'

const router = useRouter()
const pendingApprovals = ref(0)

const user = ref<{
  id: number
  username: string
  full_name: string
  role_code: string
  department_id?: number | null
} | null>(null)

async function loadMe() {
  try {
    const data = await api('/api/auth/me')
    user.value = data.user

    if (
      user.value?.role_code === 'ADMIN' ||
      user.value?.role_code === 'TRUONG_PHONG'
    ) {
      const notification = await api('/api/notifications/summary')
      pendingApprovals.value = Number(
        notification.pending_approvals || 0
      )
    }
  } catch {
    await router.push('/login')
  }
}

async function logout() {
  await api('/api/auth/logout', {
    method: 'POST',
  }).catch(() => {})

  await router.push('/login')
}

onMounted(loadMe)
</script>

<template>
  <header>
    <div class="brand">
      <v-icon size="34">
        mdi-account-group
      </v-icon>

      <div>
        <b>ITCA-Management</b>
        <small>Quản lý ngày làm việc</small>
      </div>
    </div>

    <div class="who">
      <router-link
        v-if="
          user?.role_code === 'ADMIN' ||
          user?.role_code === 'TRUONG_PHONG'
        "
        to="/approvals"
        class="notification"
        title="Yêu cầu chờ phê duyệt"
      >
        <v-badge
          :content="pendingApprovals"
          :model-value="pendingApprovals > 0"
          color="error"
        >
          <v-icon>mdi-bell</v-icon>
        </v-badge>
      </router-link>

      <span v-if="user">
        {{ user.full_name }}
      </span>

      <button @click="logout">
        Đăng xuất
      </button>
    </div>
  </header>

  <slot />

  <nav>
    <router-link to="/dashboard">
      <v-icon>mdi-home</v-icon>
      <span>Trang chủ</span>
    </router-link>

    <router-link to="/work">
      <v-icon>mdi-format-list-bulleted</v-icon>
      <span>Công việc</span>
    </router-link>

    <router-link
      class="plus"
      to="/leave"
    >
      <v-icon>mdi-plus</v-icon>
      <span>Yêu cầu</span>
    </router-link>

    <router-link
      v-if="user?.role_code === 'ADMIN'"
      to="/users"
    >
      <v-icon>mdi-account-cog</v-icon>
      <span>Người dùng</span>
    </router-link>

    <router-link to="/stats">
      <v-icon>mdi-chart-bar</v-icon>
      <span>Thống kê</span>
    </router-link>

    <router-link
      v-if="user?.role_code === 'ADMIN'"
      to="/settings"
    >
      <v-icon>mdi-cog</v-icon>
      <span>Cấu hình</span>
    </router-link>

    <router-link to="/profile">
      <v-icon>mdi-account</v-icon>
      <span>Cá nhân</span>
    </router-link>
  </nav>
</template>

<style scoped>
header {
  height: 82px;
  background: linear-gradient(135deg, #74091d, #a5102e);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 max(20px, calc((100% - 1180px) / 2));
  gap: 20px;
}

.brand,
.who {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand b {
  display: block;
  font-size: 22px;
}

.brand small {
  display: block;
  opacity: 0.9;
}

.who button {
  border: 1px solid #ffffff66;
  background: transparent;
  color: white;
  border-radius: 9px;
  padding: 7px 10px;
  cursor: pointer;
}

.notification {
  color: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

nav {
  position: fixed;
  z-index: 20;
  bottom: 0;
  left: 0;
  right: 0;
  min-height: 76px;
  background: white;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: center;
  gap: min(3vw, 42px);
  align-items: center;
  padding: 0 10px;
}

nav a {
  color: #4b5563;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  gap: 3px;
  min-width: 60px;
}

.router-link-active {
  color: #a20d2a !important;
}

.plus .v-icon {
  background: #a20d2a;
  color: white;
  border-radius: 50%;
  padding: 25px;
  margin-top: -30px;
}

@media (max-width: 700px) {
  header {
    height: 76px;
    padding: 0 14px;
  }

  .brand b {
    font-size: 18px;
  }

  .brand small,
  .who span,
  .who button {
    display: none;
  }

  nav {
    justify-content: flex-start;
    gap: 0;
    overflow-x: auto;
  }

  nav a {
    flex: 1 0 68px;
  }
}
</style>