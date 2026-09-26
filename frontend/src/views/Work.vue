<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { api } from '../services/api'

const content = ref('')
const msg = ref('')
const error = ref('')
const loading = ref(false)

const me = ref<any>(null)
const deletingId = ref<number | null>(null)

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
async function deleteWork(work: any) {
  if (me.value?.role_code !== 'ADMIN') return

  const confirmed = window.confirm(
    `Bạn có chắc muốn xóa công việc của ${work.full_name} ngày ${formatDate(work.work_date)}?\n\n` +
    `Hành động này không thể hoàn tác.`
  )

  if (!confirmed) return

  msg.value = ''
  error.value = ''
  deletingId.value = work.id

  try {
    await api(`/api/daily-work/${work.id}`, {
      method: 'DELETE'
    })

    msg.value = 'Đã xóa công việc.'
    await loadWorks()
  } catch (e: any) {
    error.value = e.message || 'Không thể xóa công việc.'
  } finally {
    deletingId.value = null
  }
}
onMounted(async () => {
  try {
    const currentUser = await api('/api/auth/me')
    me.value = currentUser.user

    await loadUsers()
    await loadWorks()
  } catch (e: any) {
    error.value = e.message || 'Không thể tải dữ liệu.'
  }
})
</script>

<template>
  <AppShell>
    <main class="page work-page">
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
          class="save-btn"
          color="#8b0d24"
          size="large"
          @click="save"
        >
          Lưu cập nhật
        </v-btn>
      </div>

      <div class="history-title">
        <h2>Lịch sử công việc</h2>
        <p class="muted">
          Tra cứu công việc của tất cả nhân sự theo khoảng thời gian.
        </p>
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
          @click="loadWorks"
        >
          Tra cứu
        </v-btn>
      </div>

      <div class="card work-list">
        <div v-if="loading" class="empty">
          Đang tải dữ liệu...
        </div>

        <div v-else-if="!works.length" class="empty">
          Không có công việc trong khoảng thời gian đã chọn.
        </div>

        <template v-else>
          <!-- Desktop / laptop -->
          <div class="desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Nhân sự</th>
                  <th>Phòng</th>
                  <th>Công việc</th>
                  <th>Hình thức</th>
				  <th v-if="me?.role_code === 'ADMIN'">Thao tác</th>
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
				  <td
  v-if="me?.role_code === 'ADMIN'"
  class="action-cell"
>
  <v-btn
    color="error"
    variant="text"
    size="small"
    prepend-icon="mdi-delete-outline"
    :loading="deletingId === work.id"
    :disabled="deletingId !== null && deletingId !== work.id"
    @click="deleteWork(work)"
  >
    Xóa
  </v-btn>
</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile / tablet dọc -->
          <div class="mobile-list">
            <article
              v-for="work in works"
              :key="`mobile-${work.id}`"
              class="work-card"
            >
              <div class="work-card-header">
                <div>
                  <div class="work-date">
                    {{ formatDate(work.work_date) }}
                  </div>

                  <div class="work-person">
                    {{ work.full_name }}
                  </div>

                  <div class="work-username">
                    {{ work.username }}
                  </div>
                </div>

                <span
                  :class="[
                    'mode',
                    work.work_mode === 'REMOTE' ? 'remote' : 'office'
                  ]"
                >
                  {{ modeName(work.work_mode) }}
                </span>
              </div>

              <div class="work-meta">
                <span class="label">Phòng</span>
                <span>{{ work.department || '—' }}</span>
              </div>

              <div class="work-content">
                <div class="label">Công việc</div>
                <div class="work-text">
                  {{ work.work_content }}
                </div>
              </div>
			  <div
  v-if="me?.role_code === 'ADMIN'"
  class="mobile-actions"
>
  <v-btn
    color="error"
    variant="tonal"
    size="small"
    prepend-icon="mdi-delete-outline"
    :loading="deletingId === work.id"
    :disabled="deletingId !== null && deletingId !== work.id"
    @click="deleteWork(work)"
  >
    Xóa công việc
  </v-btn>
</div>
            </article>
          </div>
        </template>
      </div>
    </main>
  </AppShell>
</template>

<style scoped>
.work-page {
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
  box-sizing: border-box;
}

.form {
  width: 100%;
  max-width: 720px;
  margin-top: 20px;
  box-sizing: border-box;
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
  grid-template-columns:
    minmax(150px, 180px)
    minmax(150px, 180px)
    minmax(200px, 1fr)
    auto;
  gap: 12px;
  align-items: center;
  margin-top: 14px;
  box-sizing: border-box;
}

.search-btn {
  min-height: 40px;
}

.work-list {
  margin-top: 14px;
  padding: 0;
  overflow: hidden;
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
  max-width: 600px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.mode {
  display: inline-block;
  padding: 5px 9px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.3;
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
  padding: 30px 16px;
  text-align: center;
  color: #697386;
}

.mobile-list {
  display: none;
}

.work-card {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.work-card:last-child {
  border-bottom: 0;
}

.work-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.work-date {
  margin-bottom: 4px;
  color: #8b0d24;
  font-size: 13px;
  font-weight: 700;
}

.work-person {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.work-username {
  margin-top: 2px;
  color: #697386;
  font-size: 12px;
}

.work-meta {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 8px;
  margin-top: 14px;
}

.work-content {
  margin-top: 14px;
}

.label {
  color: #697386;
  font-size: 12px;
  font-weight: 600;
}

.work-text {
  margin-top: 5px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.action-cell {
  width: 1%;
  white-space: nowrap;
}

.mobile-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #eee;
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

  .work-list {
    overflow: visible;
  }
}

@media (max-width: 600px) {
  .work-page {
    overflow-x: hidden;
  }

  .form {
    margin-top: 14px;
  }

  .filters {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }

  .save-btn,
  .search-btn {
    width: 100%;
  }

  .history-title {
    margin-top: 26px;
  }

  .work-card {
    padding: 14px;
  }

  .work-card-header {
    flex-direction: column;
  }

  .work-meta {
    grid-template-columns: 75px minmax(0, 1fr);
  }
}

@media (max-width: 360px) {
  .work-card {
    padding: 12px;
  }

  .work-meta {
    grid-template-columns: 1fr;
    gap: 3px;
  }
}
</style>