<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { api } from '../services/api'

const today = new Date().toISOString().slice(0, 10)
const firstDay = new Date()
firstDay.setDate(firstDay.getDate() - 30)

const from = ref(firstDay.toISOString().slice(0, 10))
const to = ref(today)
const selectedUser = ref<number | null>(null)

const users = ref<any[]>([])
const items = ref<any[]>([])
const workDays = ref(0)
const remoteDays = ref(0)
const loading = ref(false)
const error = ref('')

async function loadUsers() {
  const data = await api('/api/search-users')
  users.value = data.items || []
}

async function load() {
  error.value = ''

  if (!from.value || !to.value) {
    error.value = 'Vui lòng chọn từ ngày và đến ngày.'
    return
  }

  if (from.value > to.value) {
    error.value = 'Từ ngày không được lớn hơn đến ngày.'
    return
  }

  loading.value = true

  try {
    const params = new URLSearchParams({
      from: from.value,
      to: to.value
    })

    if (selectedUser.value) {
      params.set('user_id', String(selectedUser.value))
    }

    const data = await api(`/api/stats?${params.toString()}`)

    items.value = data.items || []
    workDays.value = Number(data.work_days || 0)
    remoteDays.value = Number(data.remote_days || 0)
  } catch (e: any) {
    error.value = e.message || 'Không thể tải dữ liệu thống kê.'
  } finally {
    loading.value = false
  }
}

const total = (type: string) =>
  items.value
    .filter(x => x.request_type === type)
    .reduce((sum, x) => sum + Number(x.count || 0), 0)

const minutes = (type: string) =>
  items.value
    .filter(x => x.request_type === type)
    .reduce((sum, x) => sum + Number(x.minutes || 0), 0)

const leaveCount = computed(() =>
  total('MORNING_LEAVE') +
  total('AFTERNOON_LEAVE') +
  total('FULL_DAY_LEAVE')
)

const people = computed(() => {
  const map = new Map<number, any>()

  for (const x of items.value) {
    if (!map.has(x.user_id)) {
      map.set(x.user_id, {
        user_id: x.user_id,
        full_name: x.full_name,
        username: x.username,
        department: x.department,
        late: 0,
        lateMinutes: 0,
        early: 0,
        morning: 0,
        afternoon: 0,
        leave: 0,
        remote: 0
      })
    }

    const person = map.get(x.user_id)

    if (x.request_type === 'LATE') {
      person.late += Number(x.count || 0)
      person.lateMinutes += Number(x.minutes || 0)
    }

    if (x.request_type === 'EARLY_LEAVE') {
      person.early += Number(x.count || 0)
    }

    if (x.request_type === 'MORNING_LEAVE') {
      person.morning += Number(x.count || 0)
    }

    if (x.request_type === 'AFTERNOON_LEAVE') {
      person.afternoon += Number(x.count || 0)
    }

    if (x.request_type === 'FULL_DAY_LEAVE') {
      person.leave += Number(x.count || 0)
    }

    if (x.request_type === 'REMOTE') {
      person.remote += Number(x.count || 0)
    }
  }

  return Array.from(map.values())
})

function typeName(type: string) {
  const names: Record<string, string> = {
    LATE: 'Đi muộn',
    EARLY_LEAVE: 'Về sớm',
    MORNING_LEAVE: 'Nghỉ buổi sáng',
    AFTERNOON_LEAVE: 'Nghỉ buổi chiều',
    FULL_DAY_LEAVE: 'Nghỉ phép',
    REMOTE: 'Làm từ xa'
  }

  return names[type] || type
}

function minuteValue(x: any) {
  return x.request_type === 'LATE' || x.request_type === 'EARLY_LEAVE'
    ? Number(x.minutes || 0)
    : '—'
}

onMounted(async () => {
  try {
    await loadUsers()
    await load()
  } catch (e: any) {
    error.value = e.message || 'Không thể tải dữ liệu.'
  }
})
</script>

<template>
  <AppShell>
    <main class="page stats-page">
      <div class="head">
        <div>
          <div class="title">Thống kê</div>

          <div class="muted">
            Tra cứu tình hình làm việc của tất cả nhân sự theo khoảng thời gian.
          </div>
        </div>
      </div>

      <div class="card filters">
        <v-text-field
          v-model="from"
          type="date"
          label="Từ ngày"
          density="compact"
          hide-details
        />

        <v-text-field
          v-model="to"
          type="date"
          label="Đến ngày"
          density="compact"
          hide-details
        />

        <v-select
          v-model="selectedUser"
          :items="users"
          item-title="full_name"
          item-value="id"
          label="Nhân sự"
          density="compact"
          hide-details
          clearable
          placeholder="Tất cả nhân sự"
        />

        <v-btn
          class="search-btn"
          color="#8b0d24"
          :loading="loading"
          @click="load"
        >
          Thống kê
        </v-btn>
      </div>

      <v-alert
        v-if="error"
        type="error"
        density="compact"
        class="mt-3"
      >
        {{ error }}
      </v-alert>

      <!-- Tổng quan -->
      <div class="stats">
        <div class="card">
          <v-icon>mdi-briefcase</v-icon>
          <b>{{ workDays }}</b>
          <span>Lượt cập nhật công việc</span>
        </div>

        <div class="card amber">
          <v-icon>mdi-clock-alert-outline</v-icon>
          <b>{{ total('LATE') }}</b>
          <span>Lần đi muộn</span>
          <small>{{ minutes('LATE') }} phút</small>
        </div>

        <div class="card orange">
          <v-icon>mdi-clock-fast</v-icon>
          <b>{{ total('EARLY_LEAVE') }}</b>
          <span>Lần về sớm</span>
        </div>

        <div class="card red">
          <v-icon>mdi-calendar-remove</v-icon>
          <b>{{ leaveCount }}</b>
          <span>Lượt nghỉ</span>
        </div>

        <div class="card purple">
          <v-icon>mdi-home-outline</v-icon>
          <b>{{ remoteDays }}</b>
          <span>Lượt làm từ xa</span>
        </div>
      </div>

      <!-- Chi tiết -->
      <div class="card detail">
        <h3>Chi tiết theo loại yêu cầu</h3>

        <div
          v-if="!items.length"
          class="empty"
        >
          Chưa có dữ liệu trong khoảng thời gian đã chọn.
        </div>

        <template v-else>
          <!-- Desktop -->
          <div class="desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Nhân sự</th>
                  <th>Phòng</th>
                  <th>Loại</th>
                  <th>Số lượt</th>
                  <th>Số phút</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="(x, index) in items"
                  :key="`${x.user_id}-${x.request_type}-${index}`"
                >
                  <td>
                    <b>{{ x.full_name }}</b>
                    <small>{{ x.username }}</small>
                  </td>

                  <td>{{ x.department || '—' }}</td>

                  <td>{{ typeName(x.request_type) }}</td>

                  <td>{{ x.count }}</td>

                  <td>{{ minuteValue(x) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile / tablet dọc -->
          <div class="mobile-list">
            <article
              v-for="(x, index) in items"
              :key="`detail-${x.user_id}-${x.request_type}-${index}`"
              class="mobile-card"
            >
              <div class="mobile-card-header">
                <div>
                  <div class="person-name">
                    {{ x.full_name }}
                  </div>

                  <div class="person-sub">
                    {{ x.username }}
                  </div>
                </div>

                <span class="request-badge">
                  {{ typeName(x.request_type) }}
                </span>
              </div>

              <div class="mobile-row">
                <span>Phòng</span>
                <b>{{ x.department || '—' }}</b>
              </div>

              <div class="mobile-row">
                <span>Số lượt</span>
                <b>{{ x.count }}</b>
              </div>

              <div
                v-if="
                  x.request_type === 'LATE' ||
                  x.request_type === 'EARLY_LEAVE'
                "
                class="mobile-row"
              >
                <span>Số phút</span>
                <b>{{ Number(x.minutes || 0) }}</b>
              </div>
            </article>
          </div>
        </template>
      </div>

      <!-- Tổng hợp nhân sự -->
      <div
        v-if="!selectedUser && people.length"
        class="card detail"
      >
        <h3>Tổng hợp theo nhân sự</h3>

        <!-- Desktop -->
        <div class="desktop-table">
          <table>
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Đi muộn</th>
                <th>Phút muộn</th>
                <th>Về sớm</th>
                <th>Nghỉ sáng</th>
                <th>Nghỉ chiều</th>
                <th>Nghỉ phép</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="person in people"
                :key="person.user_id"
              >
                <td>
                  <b>{{ person.full_name }}</b>
                  <small>{{ person.department || '—' }}</small>
                </td>

                <td>{{ person.late }}</td>
                <td>{{ person.lateMinutes }}</td>
                <td>{{ person.early }}</td>
                <td>{{ person.morning }}</td>
                <td>{{ person.afternoon }}</td>
                <td>{{ person.leave }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile / tablet dọc -->
        <div class="mobile-list">
          <article
            v-for="person in people"
            :key="`person-${person.user_id}`"
            class="mobile-card"
          >
            <div class="person-name">
              {{ person.full_name }}
            </div>

            <div class="person-sub">
              {{ person.department || '—' }}
            </div>

            <div class="person-grid">
              <div>
                <span>Đi muộn</span>
                <b>{{ person.late }}</b>
              </div>

              <div>
                <span>Phút muộn</span>
                <b>{{ person.lateMinutes }}</b>
              </div>

              <div>
                <span>Về sớm</span>
                <b>{{ person.early }}</b>
              </div>

              <div>
                <span>Nghỉ sáng</span>
                <b>{{ person.morning }}</b>
              </div>

              <div>
                <span>Nghỉ chiều</span>
                <b>{{ person.afternoon }}</b>
              </div>

              <div>
                <span>Nghỉ phép</span>
                <b>{{ person.leave }}</b>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
  </AppShell>
</template>

<style scoped>
.stats-page {
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
  box-sizing: border-box;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
}

.filters {
  display: grid;
  grid-template-columns:
    minmax(150px, 180px)
    minmax(150px, 180px)
    minmax(200px, 1fr)
    auto;
  gap: 12px;
  align-items: center;
  margin-top: 20px;
}

.search-btn {
  min-height: 40px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.stats .card {
  min-width: 0;
  text-align: center;
}

.stats b {
  display: block;
  margin-top: 5px;
  font-size: 30px;
  color: #16a34a;
}

.stats span,
.stats small {
  display: block;
  overflow-wrap: anywhere;
}

.stats small {
  margin-top: 4px;
  color: #697386;
}

.stats .v-icon {
  color: #16a34a;
}

.amber b,
.amber .v-icon {
  color: #f59e0b;
}

.orange b,
.orange .v-icon {
  color: #ea580c;
}

.red b,
.red .v-icon {
  color: #ef4444;
}

.purple b,
.purple .v-icon {
  color: #7c3aed;
}

.detail {
  margin-top: 14px;
  padding: 0;
  overflow: hidden;
}

.detail h3 {
  margin: 0;
  padding: 16px;
  color: #8b0d24;
  border-bottom: 1px solid #eee;
}

.desktop-table {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: 12px 14px;
  text-align: left;
  color: #8b0d24;
  background: #fff7f8;
  white-space: nowrap;
}

td {
  padding: 12px 14px;
  border-top: 1px solid #eee;
  vertical-align: top;
}

td small {
  display: block;
  margin-top: 3px;
  color: #697386;
}

.empty {
  padding: 30px 16px;
  text-align: center;
  color: #697386;
}

.mobile-list {
  display: none;
}

.mobile-card {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.mobile-card:last-child {
  border-bottom: 0;
}

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.person-name {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.person-sub {
  margin-top: 3px;
  color: #697386;
  font-size: 12px;
}

.request-badge {
  flex-shrink: 0;
  padding: 5px 9px;
  border-radius: 12px;
  color: #8b0d24;
  background: #fff0f2;
  font-size: 12px;
  font-weight: 600;
}

.mobile-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  border-top: 1px dashed #eee;
}

.mobile-row span {
  color: #697386;
}

.mobile-row b {
  text-align: right;
}

.person-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.person-grid > div {
  padding: 10px;
  text-align: center;
  background: #fff7f8;
  border-radius: 8px;
}

.person-grid span {
  display: block;
  min-height: 32px;
  color: #697386;
  font-size: 12px;
}

.person-grid b {
  display: block;
  margin-top: 4px;
  color: #8b0d24;
  font-size: 18px;
}

@media (max-width: 1100px) {
  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-btn {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }

  .mobile-list {
    display: block;
  }

  .detail {
    overflow: visible;
  }
}

@media (max-width: 600px) {
  .stats-page {
    overflow-x: hidden;
  }

  .filters {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }

  .search-btn {
    width: 100%;
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats .card {
    padding: 14px 8px;
  }

  .stats b {
    font-size: 26px;
  }

  .mobile-card {
    padding: 14px;
  }
}

@media (max-width: 400px) {
  .stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .person-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mobile-card-header {
    flex-direction: column;
  }
}
</style>