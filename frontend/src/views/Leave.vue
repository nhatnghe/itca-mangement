<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import { api } from '../services/api'

const route = useRoute()

function localToday() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const today = localToday()

// ========================
// Tạo yêu cầu
// ========================

const type = ref('MORNING_LEAVE')
const date = ref(today)
const end = ref(today)
const startTime = ref('')
const endTime = ref('')
const expectedMinutes = ref<number | null>(null)

const reason = ref('')
const handover = ref<number | null>(null)
const note = ref('')

const users = ref<any[]>([])
const me = ref<any>(null)
const morningStart = ref('08:00')
const morningEnd = ref('11:30')
const afternoonStart = ref('13:00')
const afternoonEnd = ref('17:00')

const msg = ref('')
const error = ref('')
const sending = ref(false)

// ========================
// Lịch sử yêu cầu
// ========================

const history = ref<any[]>([])
const historyLoading = ref(false)
const deletingId = ref<number | null>(null)

const filterFrom = ref('')
const filterTo = ref('')
const filterUserId = ref<number | null>(null)

const isAdmin = computed(() => me.value?.role_code === 'ADMIN')

const types = [
  {
    title: 'Nghỉ buổi sáng',
    value: 'MORNING_LEAVE',
    icon: 'mdi-weather-sunset-up'
  },
  {
    title: 'Nghỉ buổi chiều',
    value: 'AFTERNOON_LEAVE',
    icon: 'mdi-weather-sunset-down'
  },
  {
    title: 'Nghỉ phép',
    value: 'FULL_DAY_LEAVE',
    icon: 'mdi-calendar-remove'
  },
  {
    title: 'Đi muộn',
    value: 'LATE',
    icon: 'mdi-clock-alert-outline'
  },
  {
    title: 'Về sớm',
    value: 'EARLY_LEAVE',
    icon: 'mdi-clock-fast'
  },
  {
    title: 'Làm việc từ xa',
    value: 'REMOTE',
    icon: 'mdi-home-outline'
  }
]

const isFullDay = computed(() =>
  type.value === 'FULL_DAY_LEAVE' ||
  type.value === 'REMOTE'
)

const isLate = computed(() => type.value === 'LATE')
const isEarly = computed(() => type.value === 'EARLY_LEAVE')

const reasonLabel = computed(() => {
  if (type.value === 'LATE') return 'Lý do đi muộn *'
  if (type.value === 'EARLY_LEAVE') return 'Lý do về sớm *'
  if (type.value === 'REMOTE') return 'Lý do làm từ xa *'
  return 'Lý do nghỉ *'
})

const timeTitle = computed(() => {
  if (type.value === 'LATE') return 'Thời gian đi muộn'
  if (type.value === 'EARLY_LEAVE') return 'Thời gian về sớm'
  return 'Thời gian'
})

function typeName(value: string) {
  const item = types.find(x => x.value === value)

  if (item) return item.title

  if (value === 'ANNUAL_LEAVE') return 'Nghỉ phép'
  if (value === 'MAKEUP_LEAVE') return 'Nghỉ bù'

  return value
}

function statusName(status: string) {
  if (status === 'APPROVED') return 'Đã duyệt'
  if (status === 'REJECTED') return 'Từ chối'
  if (status === 'PENDING') return 'Chờ duyệt'
  return status
}

function statusClass(status: string) {
  if (status === 'APPROVED') return 'approved'
  if (status === 'REJECTED') return 'rejected'
  return 'pending'
}

function formatDate(value?: string | null) {
  if (!value) return '—'

  const parts = value.slice(0, 10).split('-')

  if (parts.length !== 3) return value

  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function requestDateText(item: any) {
  const start = formatDate(item.start_date)
  const finish = formatDate(item.end_date)

  if (
    item.end_date &&
    item.start_date &&
    item.end_date !== item.start_date
  ) {
    return `${start} → ${finish}`
  }

  return start
}

function requestTimeText(item: any) {
  if (item.request_type === 'LATE') {
    const parts: string[] = []

    if (item.expected_minutes) {
      parts.push(`${item.expected_minutes} phút`)
    }

    if (item.start_time) {
      parts.push(`đến lúc ${item.start_time}`)
    }

    return parts.join(' · ') || '—'
  }

  if (item.request_type === 'EARLY_LEAVE') {
    const parts: string[] = []

    if (item.expected_minutes) {
      parts.push(`${item.expected_minutes} phút`)
    }

    if (item.end_time) {
      parts.push(`về lúc ${item.end_time}`)
    }

    return parts.join(' · ') || '—'
  }

  if (item.start_time || item.end_time) {
    return `${item.start_time || '—'} - ${item.end_time || '—'}`
  }

  return '—'
}

function applyTypeDefaults() {
  end.value = date.value
  startTime.value = ''
  endTime.value = ''
  expectedMinutes.value = null

if (type.value === 'MORNING_LEAVE') {
  startTime.value = morningStart.value
  endTime.value = morningEnd.value
}

if (type.value === 'AFTERNOON_LEAVE') {
  startTime.value = afternoonStart.value
  endTime.value = afternoonEnd.value
}
}

watch(type, applyTypeDefaults)

watch(date, value => {
  if (!isFullDay.value) {
    end.value = value
  }

  if (end.value < value) {
    end.value = value
  }
})

async function loadUsers() {
  try {
    const data = await api('/api/search-users')
    users.value = (data.items || []).filter((x: any) => x.id)
  } catch {
    users.value = []
  }
}

async function loadHistory() {
  historyLoading.value = true

  try {
    const params = new URLSearchParams()

    if (filterFrom.value) {
      params.set('from', filterFrom.value)
    }

    if (filterTo.value) {
      params.set('to', filterTo.value)
    }

    if (filterUserId.value) {
      params.set('user_id', String(filterUserId.value))
    }

    const query = params.toString()

    const data = await api(
      `/api/leave-requests${query ? `?${query}` : ''}`
    )

    history.value = data.items || []
  } catch (e: any) {
    error.value =
      e.message || 'Không thể tải lịch sử yêu cầu.'
  } finally {
    historyLoading.value = false
  }
}

async function clearHistoryFilters() {
  filterFrom.value = ''
  filterTo.value = ''
  filterUserId.value = null
  await loadHistory()
}

async function send() {
  msg.value = ''
  error.value = ''

  if (!reason.value.trim()) {
    error.value = 'Vui lòng nhập lý do.'
    return
  }

  if (!date.value) {
    error.value = 'Vui lòng chọn ngày.'
    return
  }

  if (isFullDay.value && !end.value) {
    error.value = 'Vui lòng chọn đến ngày.'
    return
  }

  if (end.value < date.value) {
    error.value =
      'Đến ngày không được nhỏ hơn từ ngày.'
    return
  }

  if (
    (isLate.value || isEarly.value) &&
    (!expectedMinutes.value || expectedMinutes.value <= 0)
  ) {
    error.value =
      'Vui lòng nhập số phút dự kiến.'
    return
  }

  sending.value = true

  try {
    const data = await api('/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        request_type: type.value,
        start_date: date.value,
        end_date: isFullDay.value
          ? end.value
          : date.value,
        start_time: startTime.value || null,
        end_time: endTime.value || null,
        expected_minutes:
          isLate.value || isEarly.value
            ? Number(expectedMinutes.value)
            : null,
        reason: reason.value.trim(),
        handover_to_user_id: handover.value,
        note: note.value.trim() || null
      })
    })

    msg.value =
      data.message ||
      (
        data.requires_approval
          ? 'Yêu cầu đã được gửi và đang chờ phê duyệt.'
          : 'Yêu cầu đã được ghi nhận và có hiệu lực ngay.'
      )

    reason.value = ''
    note.value = ''
    handover.value = null
    expectedMinutes.value = null

    applyTypeDefaults()

    await loadHistory()
  } catch (e: any) {
    error.value =
      e.message || 'Không thể gửi yêu cầu.'
  } finally {
    sending.value = false
  }
}

function cancel() {
  reason.value = ''
  note.value = ''
  handover.value = null
  expectedMinutes.value = null
  msg.value = ''
  error.value = ''
  date.value = today
  end.value = today
  applyTypeDefaults()
}

async function deleteRequest(item: any) {
  if (!isAdmin.value) return

  const confirmed = window.confirm(
    `Bạn có chắc muốn xóa yêu cầu "${typeName(item.request_type)}" của ${item.full_name} ngày ${requestDateText(item)}?\n\n` +
    'Hành động này không thể hoàn tác.'
  )

  if (!confirmed) return

  msg.value = ''
  error.value = ''
  deletingId.value = item.id

  try {
    const data = await api(
      `/api/leave-requests/${item.id}`,
      {
        method: 'DELETE'
      }
    )

    msg.value =
      data.message || 'Đã xóa yêu cầu.'

    await loadHistory()
  } catch (e: any) {
    error.value =
      e.message || 'Không thể xóa yêu cầu.'
  } finally {
    deletingId.value = null
  }
}
async function loadWorkCalendar() {
  const calendar = await api('/api/work-calendar')

  morningStart.value = calendar.morning_start || '08:00'
  morningEnd.value = calendar.morning_end || '11:30'
  afternoonStart.value = calendar.afternoon_start || '13:00'
  afternoonEnd.value = calendar.afternoon_end || '17:00'
}
onMounted(async () => {
  const queryType = String(route.query.type || '')

  if (types.some(x => x.value === queryType)) {
    type.value = queryType
  }



  try {
  await loadWorkCalendar()
applyTypeDefaults()
    const currentUser = await api('/api/auth/me')
    me.value = currentUser.user

    await loadUsers()
    await loadHistory()
  } catch (e: any) {
    error.value =
      e.message || 'Không thể tải dữ liệu.'
  }
})
</script>

<template>
  <AppShell>
    <main class="page">
      <div class="title">Tạo yêu cầu</div>

      <p class="muted">
        Đăng ký nghỉ phép, đi muộn, về sớm hoặc làm việc từ xa.
      </p>

      <div class="card leave">
        <h3>1. Loại yêu cầu</h3>

        <div class="typegrid">
          <button
            v-for="item in types"
            :key="item.value"
            type="button"
            :class="{ active: type === item.value }"
            @click="type = item.value"
          >
            <v-icon>{{ item.icon }}</v-icon>
            <span>{{ item.title }}</span>
          </button>
        </div>

        <h3>2. {{ timeTitle }}</h3>

        <div
          v-if="isFullDay"
          class="dates"
        >
          <v-text-field
            v-model="date"
            type="date"
            label="Từ ngày"
          />

          <v-text-field
            v-model="end"
            type="date"
            label="Đến ngày"
            :min="date"
          />
        </div>

        <div v-else>
          <v-text-field
            v-model="date"
            type="date"
            label="Ngày"
          />
        </div>

        <v-alert
          v-if="type === 'MORNING_LEAVE'"
          color="#fdecef"
          class="mb-4"
        >
          Nghỉ buổi sáng từ
          <b>{{ morningStart }} đến {{ morningEnd }}</b>.
        </v-alert>

        <v-alert
          v-if="type === 'AFTERNOON_LEAVE'"
          color="#fdecef"
          class="mb-4"
        >
          Nghỉ buổi chiều từ
          <b>{{ afternoonStart }} đến {{ afternoonEnd }}</b>.
        </v-alert>

        <div
          v-if="isLate || isEarly"
          class="time-options"
        >
          <v-text-field
            v-model.number="expectedMinutes"
            type="number"
            min="1"
            label="Số phút dự kiến *"
            suffix="phút"
          />

          <v-text-field
            v-if="isLate"
            v-model="startTime"
            type="time"
            label="Giờ dự kiến đến"
          />

          <v-text-field
            v-if="isEarly"
            v-model="endTime"
            type="time"
            label="Giờ dự kiến về"
          />
        </div>

        <h3>3. {{ reasonLabel }}</h3>

        <v-textarea
          v-model="reason"
          placeholder="Nhập lý do"
          rows="4"
          counter="500"
        />

        <h3>4. Người bàn giao công việc</h3>

        <v-select
          v-model="handover"
          :items="users"
          item-title="full_name"
          item-value="id"
          label="Chọn người bàn giao"
          clearable
        />

        <h3>5. Ghi chú thêm (nếu có)</h3>

        <v-textarea
          v-model="note"
          rows="2"
          placeholder="Nhập ghi chú"
        />

        <v-alert
          v-if="msg"
          type="success"
          class="mb-4"
        >
          {{ msg }}
        </v-alert>

        <v-alert
          v-if="error"
          type="error"
          class="mb-4"
        >
          {{ error }}
        </v-alert>

        <div class="buttons">
          <v-btn
            variant="outlined"
            color="#8b0d24"
            @click="cancel"
          >
            Hủy bỏ
          </v-btn>

          <v-btn
            color="#8b0d24"
            :loading="sending"
            @click="send"
          >
            Gửi yêu cầu
          </v-btn>
        </div>
      </div>

      <!-- LỊCH SỬ YÊU CẦU -->
      <section class="history-section">
        <div class="history-heading">
          <div>
            <h2>Lịch sử yêu cầu</h2>
            <p class="muted">
              Tra cứu các yêu cầu nghỉ, đi muộn, về sớm và làm việc từ xa.
            </p>
          </div>

          <v-btn
            variant="text"
            prepend-icon="mdi-refresh"
            :loading="historyLoading"
            @click="loadHistory"
          >
            Làm mới
          </v-btn>
        </div>

        <div class="card history-filter">
          <v-text-field
            v-model="filterFrom"
            type="date"
            label="Từ ngày"
            hide-details
          />

          <v-text-field
            v-model="filterTo"
            type="date"
            label="Đến ngày"
            hide-details
          />

          <v-select
            v-model="filterUserId"
            :items="users"
            item-title="full_name"
            item-value="id"
            label="Nhân viên"
            clearable
            hide-details
          />

          <v-btn
            color="#8b0d24"
            prepend-icon="mdi-magnify"
            :loading="historyLoading"
            @click="loadHistory"
          >
            Tìm kiếm
          </v-btn>

          <v-btn
            variant="outlined"
            color="#8b0d24"
            @click="clearHistoryFilters"
          >
            Xóa lọc
          </v-btn>
        </div>

        <div
          v-if="historyLoading"
          class="card history-state"
        >
          <v-progress-circular
            indeterminate
            color="#8b0d24"
          />
          <span>Đang tải lịch sử...</span>
        </div>

        <div
          v-else-if="!history.length"
          class="card history-state muted"
        >
          Không có yêu cầu phù hợp.
        </div>

        <!-- Desktop / laptop -->
        <div
          v-else
          class="card history-table-wrap"
        >
          <table class="history-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Loại yêu cầu</th>
                <th>Ngày</th>
                <th>Thời gian</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
                <th v-if="isAdmin">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="item in history"
                :key="item.id"
              >
                <td>
                  <b>{{ item.full_name }}</b>
                  <small>
                    {{ item.department || '—' }}
                  </small>
                </td>

                <td>
                  {{ typeName(item.request_type) }}
                </td>

                <td>
                  {{ requestDateText(item) }}
                </td>

                <td>
                  {{ requestTimeText(item) }}
                </td>

                <td class="reason-cell">
                  {{ item.reason || '—' }}
                </td>

                <td>
                  <span
                    :class="[
                      'status',
                      statusClass(item.status)
                    ]"
                  >
                    {{ statusName(item.status) }}
                  </span>
                </td>

                <td
                  v-if="isAdmin"
                  class="action-cell"
                >
                  <v-btn
                    color="error"
                    variant="text"
                    size="small"
                    prepend-icon="mdi-delete-outline"
                    :loading="deletingId === item.id"
                    :disabled="
                      deletingId !== null &&
                      deletingId !== item.id
                    "
                    @click="deleteRequest(item)"
                  >
                    Xóa
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile / tablet portrait -->
        <div
          v-if="!historyLoading && history.length"
          class="history-mobile"
        >
          <article
            v-for="item in history"
            :key="`mobile-${item.id}`"
            class="card request-card"
          >
            <div class="request-card-header">
              <div>
                <b>{{ item.full_name }}</b>
                <small>
                  {{ item.department || '—' }}
                </small>
              </div>

              <span
                :class="[
                  'status',
                  statusClass(item.status)
                ]"
              >
                {{ statusName(item.status) }}
              </span>
            </div>

            <div class="request-type">
              {{ typeName(item.request_type) }}
            </div>

            <div class="request-info">
              <div>
                <span>Ngày</span>
                <b>{{ requestDateText(item) }}</b>
              </div>

              <div>
                <span>Thời gian</span>
                <b>{{ requestTimeText(item) }}</b>
              </div>
            </div>

            <div class="request-reason">
              <span>Lý do</span>
              <p>{{ item.reason || '—' }}</p>
            </div>

            <div
              v-if="isAdmin"
              class="mobile-actions"
            >
              <v-btn
                color="error"
                variant="tonal"
                prepend-icon="mdi-delete-outline"
                :loading="deletingId === item.id"
                :disabled="
                  deletingId !== null &&
                  deletingId !== item.id
                "
                @click="deleteRequest(item)"
              >
                Xóa yêu cầu
              </v-btn>
            </div>
          </article>
        </div>
      </section>
    </main>
  </AppShell>
</template>

<style scoped>
.leave {
  margin-top: 20px;
}

.leave h3 {
  color: #8b0d24;
  margin: 20px 0 12px;
}

.typegrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.typegrid button {
  min-height: 82px;
  padding: 14px 10px;
  border: 1px solid #efd6db;
  border-radius: 14px;
  background: #fff8f9;
  color: #4b5563;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

.typegrid button:hover {
  background: #fff0f2;
}

.typegrid button.active {
  border: 2px solid #a20d2a;
  background: #fdecef;
  color: #8b0d24;
  font-weight: 700;
}

.dates,
.time-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* HISTORY */

.history-section {
  margin-top: 36px;
}

.history-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.history-heading h2 {
  color: #8b0d24;
  margin: 0 0 5px;
}

.history-heading p {
  margin: 0;
}

.history-filter {
  display: grid;
  grid-template-columns:
    minmax(150px, 1fr)
    minmax(150px, 1fr)
    minmax(200px, 1.4fr)
    auto
    auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.history-state {
  min-height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.history-table-wrap {
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 950px;
}

.history-table th,
.history-table td {
  padding: 14px 12px;
  border-bottom: 1px solid #eee;
  text-align: left;
  vertical-align: top;
}

.history-table th {
  color: #6b7280;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.history-table td small {
  display: block;
  margin-top: 4px;
  color: #6b7280;
}

.reason-cell {
  min-width: 180px;
  max-width: 320px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.action-cell {
  width: 1%;
  white-space: nowrap;
}

.status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.status.approved {
  background: #e8f5e9;
  color: #237a35;
}

.status.pending {
  background: #fff4d6;
  color: #8a6500;
}

.status.rejected {
  background: #fdecec;
  color: #b42318;
}

.history-mobile {
  display: none;
}

.request-card {
  margin-bottom: 12px;
}

.request-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.request-card-header small {
  display: block;
  color: #6b7280;
  margin-top: 3px;
}

.request-type {
  margin: 14px 0;
  color: #8b0d24;
  font-weight: 700;
}

.request-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.request-info > div,
.request-reason {
  padding: 10px 0;
}

.request-info span,
.request-reason > span {
  display: block;
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 4px;
}

.request-reason p {
  margin: 0;
  overflow-wrap: anywhere;
}

.mobile-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

@media (max-width: 1100px) {
  .history-filter {
    grid-template-columns: 1fr 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .history-table-wrap {
    display: none;
  }

  .history-mobile {
    display: block;
  }

  .history-filter {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 700px) {
  .typegrid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dates,
  .time-options {
    grid-template-columns: 1fr;
  }

  .buttons {
    flex-direction: column-reverse;
  }

  .buttons .v-btn {
    width: 100%;
  }
}

@media (max-width: 600px) {
  .history-heading {
    display: block;
  }

  .history-heading .v-btn {
    margin-top: 8px;
  }

  .history-filter {
    grid-template-columns: 1fr;
  }

  .history-filter .v-btn {
    width: 100%;
  }

  .request-info {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .mobile-actions .v-btn {
    width: 100%;
  }
}
</style>