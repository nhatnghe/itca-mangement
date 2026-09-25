<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import { api } from '../services/api'

const route = useRoute()

const today = new Date().toISOString().slice(0, 10)

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

const msg = ref('')
const error = ref('')
const sending = ref(false)

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
    title: 'Làm từ xa',
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

function applyTypeDefaults() {
  end.value = date.value
  startTime.value = ''
  endTime.value = ''
  expectedMinutes.value = null

  if (type.value === 'MORNING_LEAVE') {
    startTime.value = '08:00'
    endTime.value = '12:00'
  }

  if (type.value === 'AFTERNOON_LEAVE') {
    startTime.value = '13:00'
    endTime.value = '17:00'
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
    users.value = (data.items || []).filter(
      (x: any) => x.id
    )
  } catch {
    users.value = []
  }
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
    error.value = 'Đến ngày không được nhỏ hơn từ ngày.'
    return
  }

  if (
    (isLate.value || isEarly.value) &&
    (!expectedMinutes.value || expectedMinutes.value <= 0)
  ) {
    error.value = 'Vui lòng nhập số phút dự kiến.'
    return
  }

  sending.value = true

  try {
    const data = await api('/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        request_type: type.value,
        start_date: date.value,
        end_date: isFullDay.value ? end.value : date.value,
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
  } catch (e: any) {
    error.value = e.message || 'Không thể gửi yêu cầu.'
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

onMounted(async () => {
  const queryType = String(route.query.type || '')

  if (types.some(x => x.value === queryType)) {
    type.value = queryType
  }

  applyTypeDefaults()
  await loadUsers()
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
          <b>08:00 đến 12:00</b>.
        </v-alert>

        <v-alert
          v-if="type === 'AFTERNOON_LEAVE'"
          color="#fdecef"
          class="mb-4"
        >
          Nghỉ buổi chiều từ
          <b>13:00 đến 17:00</b>.
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

@media (max-width: 700px) {
  .typegrid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dates,
  .time-options {
    grid-template-columns: 1fr;
  }
}
</style>