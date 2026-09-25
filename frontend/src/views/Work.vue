<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { api } from '../services/api'

const content = ref('')
const msg = ref('')
const error = ref('')
const loading = ref(false)

const today = new Date().toISOString().slice(0, 10)
const firstDay = new Date()
firstDay.setDate(firstDay.getDate() - 30)

const from = ref(firstDay.toISOString().slice(0, 10))
const to = ref(today)
const selectedUser = ref<number | null>(null)

const users = ref<any[]>([])
const works = ref<any[]>([])

async function save() {
  msg.value = ''
  error.value = ''

  if (!content.value.trim()) {
    error.value = 'Vui lòng nhập nội dung công việc.'
    return
  }

  try {
    await api('/api/daily-work/today', {
      method: 'PUT',
      body: JSON.stringify({
        work_content: content.value,
        work_mode: 'OFFICE'
      })
    })

    msg.value = 'Đã cập nhật công việc hôm nay.'
    await loadWorks()
  } catch (e: any) {
    error.value = e.message || 'Không thể cập nhật công việc.'
  }
}

async function loadUsers() {
  try {
    const data = await api('/api/search-users')
    users.value = data.items || []
  } catch (e: any) {
    error.value = e.message || 'Không thể tải danh sách nhân sự.'
  }
}

async function loadWorks() {
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

    const data = await api(`/api/daily-work?${params.toString()}`)
    works.value = data.items || []
  } catch (e: any) {
    error.value = e.message || 'Không thể tải danh sách công việc.'
  } finally {
    loading.value = false
  }
}

function formatDate(value: string) {
  if (!value) return ''

  const parts = value.split('-')
  if (parts.length !== 3) return value

  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function modeName(mode: string) {
  return mode === 'REMOTE' ? 'Làm từ xa' : 'Tại văn phòng'
}

onMounted(async () => {
  await loadUsers()
  await loadWorks()
})
</script>

<template>
  <AppShell>
    <main class="page">
      <div class="title">Công việc hôm nay</div>

      <p class="muted">
        Cập nhật nội dung công việc bạn đang thực hiện trong ngày.
      </p>

      <div class="card form">
        <v-textarea
          v-model="content"
          label="Hôm nay tôi làm gì?"
          rows="5"
          counter="500"
        />

        <v-alert
          v-if="msg"
          type="success"
          density="compact"
          class="mb-3"
        >
          {{ msg }}
        </v-alert>

        <v-alert
          v-if="error"
          type="error"
          density="compact"
          class="mb-3"
        >
          {{ error }}
        </v-alert>

        <v-btn
          color="#8b0d24"
          size="large"
          @click="save"
        >
          Lưu cập nhật
        </v-btn>
      </div>

      <div class="history-title">
        <div>
          <h2>Lịch sử công việc</h2>
          <p class="muted">
            Tra cứu công việc của tất cả nhân sự theo khoảng thời gian.
          </p>
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
          color="#8b0d24"
          :loading="loading"
          @click="loadWorks"
        >
          Tra cứu
        </v-btn>
      </div>

      <div class="card work-list">
        <div
          v-if="loading"
          class="empty"
        >
          Đang tải dữ liệu...
        </div>

        <div
          v-else-if="!works.length"
          class="empty"
        >
          Không có công việc trong khoảng thời gian đã chọn.
        </div>

        <div
          v-else
          class="table-wrap"
        >
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Nhân sự</th>
                <th>Phòng</th>
                <th>Công việc</th>
                <th>Hình thức</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="work in works"
                :key="work.id"
              >
                <td class="date">
                  {{ formatDate(work.work_date) }}
                </td>

                <td>
                  <b>{{ work.full_name }}</b>
                  <small>{{ work.username }}</small>
                </td>

                <td>
                  {{ work.department || '—' }}
                </td>

                <td class="content">
                  {{ work.work_content }}
                </td>

                <td>
                  <span
                    :class="[
                      'mode',
                      work.work_mode === 'REMOTE' ? 'remote' : 'office'
                    ]"
                  >
                    {{ modeName(work.work_mode) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </AppShell>
</template>

<style scoped>
.form {
  max-width: 720px;
  margin-top: 20px;
}

.history-title {
  margin-top: 32px;
}

.history-title h2 {
  margin: 0;
  color: #8b0d24;
}

.history-title p {
  margin-top: 5px;
}

.filters {
  display: grid;
  grid-template-columns: 180px 180px minmax(220px, 1fr) auto;
  gap: 12px;
  align-items: center;
  margin-top: 14px;
}

.work-list {
  margin-top: 14px;
  padding: 0;
  overflow: hidden;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 13px 14px;
  color: #8b0d24;
  background: #fff7f8;
  border-bottom: 1px solid #eadde0;
  white-space: nowrap;
}

td {
  padding: 13px 14px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}

tbody tr:last-child td {
  border-bottom: 0;
}

tbody tr:hover {
  background: #fffafa;
}

td small {
  display: block;
  margin-top: 3px;
  color: #697386;
}

.date {
  white-space: nowrap;
}

.content {
  min-width: 260px;
  white-space: pre-wrap;
}

.mode {
  display: inline-block;
  padding: 5px 9px;
  border-radius: 12px;
  font-size: 12px;
  white-space: nowrap;
}

.office {
  color: #166534;
  background: #dcfce7;
}

.remote {
  color: #6d28d9;
  background: #ede9fe;
}

.empty {
  padding: 30px;
  text-align: center;
  color: #697386;
}

@media (max-width: 800px) {
  .filters {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 550px) {
  .filters {
    grid-template-columns: 1fr;
  }
}
</style>