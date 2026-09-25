<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { api } from '../services/api'

const items = ref<any[]>([])
const me = ref<any>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const [dashboard, currentUser] = await Promise.all([
      api('/api/dashboard/today'),
      api('/api/auth/me'),
    ])

    items.value = dashboard.items || []
    me.value = currentUser.user
  } catch {
    // AppShell sẽ xử lý trường hợp session hết hạn
  } finally {
    loading.value = false
  }
})

const countStatus = (status: string) =>
  items.value.filter(x => x.status === status).length

const canApprove = computed(() =>
  me.value?.role_code === 'ADMIN' ||
  me.value?.role_code === 'TRUONG_PHONG'
)

function statusText(status: string) {
  const labels: Record<string, string> = {
    WORKING: 'Đang làm',
    LATE: 'Đi muộn',
    EARLY_LEAVE: 'Về sớm',
    LEAVE: 'Nghỉ phép',
    REMOTE: 'Từ xa',
  }

  return labels[status] || status
}
</script>

<template>
  <AppShell>
    <main class="page">
      <div class="hero">
        <div>
          <div class="title">
            Tình hình hôm nay
          </div>

          <div class="muted">
            Mở lên là biết hôm nay cả phòng đang thế nào
          </div>
        </div>

        <router-link
          v-if="canApprove"
          to="/approvals"
        >
          <v-btn color="#8b0d24">
            Yêu cầu chờ duyệt
          </v-btn>
        </router-link>
      </div>

      <section class="summary">
        <div class="card">
          <b>{{ items.length }}</b>
          <span>Tổng nhân sự</span>
        </div>

        <div class="card green">
          <b>{{ countStatus('WORKING') }}</b>
          <span>Đang làm việc</span>
        </div>

        <div class="card amber">
          <b>{{ countStatus('LATE') }}</b>
          <span>Đi muộn</span>
        </div>

        <div class="card orange">
          <b>{{ countStatus('EARLY_LEAVE') }}</b>
          <span>Về sớm</span>
        </div>

        <div class="card red">
          <b>{{ countStatus('LEAVE') }}</b>
          <span>Nghỉ phép</span>
        </div>

        <div class="card purple">
          <b>{{ countStatus('REMOTE') }}</b>
          <span>Làm từ xa</span>
        </div>
      </section>

      <h2 class="burgundy">
        Tình hình hôm nay
      </h2>

      <div
        v-if="!loading"
        class="people card"
      >
        <div
          v-for="p in items"
          :key="p.id"
          class="person"
        >
          <v-avatar color="#fdecef">
            {{ p.full_name?.split(' ').slice(-1)[0]?.[0] }}
          </v-avatar>

          <div class="info">
            <b>{{ p.full_name }}</b>

            <small>
              {{ p.department || 'Chưa có phòng' }}
              ·
              {{ p.work_content || 'Chưa cập nhật công việc' }}
            </small>

            <small
              v-if="p.status === 'LATE' && p.reason"
              class="detail"
            >
              Đi muộn: {{ p.reason }}
            </small>

            <small
              v-if="p.status === 'EARLY_LEAVE'"
              class="detail"
            >
              Về sớm
              <template v-if="p.end_time">
                lúc {{ p.end_time }}
              </template>
              <template v-if="p.reason">
                · {{ p.reason }}
              </template>
            </small>
          </div>

          <span :class="['status', p.status]">
            {{ statusText(p.status) }}
          </span>
        </div>

        <div
          v-if="!items.length"
          class="muted"
        >
          Chưa có dữ liệu hôm nay.
        </div>
      </div>

      <h2 class="burgundy">
        Thao tác nhanh
      </h2>

      <div class="actions">
        <router-link to="/work">
          <v-icon>mdi-briefcase-edit</v-icon>
          Cập nhật công việc
        </router-link>

        <router-link to="/leave?type=LATE">
          <v-icon>mdi-clock-alert</v-icon>
          Xin đi muộn
        </router-link>

        <router-link to="/leave?type=MORNING_LEAVE">
          <v-icon>mdi-weather-sunset-up</v-icon>
          Nghỉ buổi sáng
        </router-link>

        <router-link to="/leave?type=EARLY_LEAVE">
          <v-icon>mdi-exit-run</v-icon>
          Xin về sớm
        </router-link>
      </div>
    </main>
  </AppShell>
</template>

<style scoped>
.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 8px 0 22px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

.summary .card {
  text-align: center;
}

.summary b {
  display: block;
  font-size: 30px;
  color: #8b0d24;
}

.summary span {
  font-size: 13px;
}

.green b {
  color: #16a34a;
}

.amber b {
  color: #f59e0b;
}

.orange b {
  color: #ea580c;
}

.red b {
  color: #ef4444;
}

.purple b {
  color: #7c3aed;
}

.person {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid #f2f2f2;
}

.person:last-child {
  border: 0;
}

.info {
  flex: 1;
}

.info small {
  display: block;
  color: #697386;
  margin-top: 3px;
}

.info .detail {
  color: #8b0d24;
}

.actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.actions a {
  background: white;
  border: 1px solid #f1d9de;
  border-radius: 16px;
  padding: 20px 12px;
  text-decoration: none;
  color: #8b0d24;
  font-weight: 700;
  text-align: center;
}

.actions .v-icon {
  display: block;
  margin: 0 auto 8px;
}

@media (max-width: 900px) {
  .summary {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 700px) {
  .hero .v-btn {
    display: none;
  }

  .summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .actions {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>