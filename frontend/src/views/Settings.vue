<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { api } from '../services/api'

type SettingItem = {
  setting_key: string
  setting_value: string
}

type CalendarDay = {
  id: number
  work_date: string
  is_working: number
  name: string
}

const loading = ref(false)
const saving = ref('')
const error = ref('')
const success = ref('')

const settings = ref<Record<string, boolean>>({})

const morningStart = ref('08:00')
const morningEnd = ref('11:30')
const afternoonStart = ref('13:00')
const afternoonEnd = ref('17:00')
const weekdays = ref<number[]>([1, 2, 3, 4, 5])

const calendarDays = ref<CalendarDay[]>([])
const dayDate = ref('')
const dayType = ref<0 | 1>(0)
const dayName = ref('')
const savingCalendar = ref(false)
const savingDay = ref(false)
const deletingDay = ref<number | null>(null)

const settingList = [
  {
    key: 'approval_LATE',
    title: 'Đi muộn',
    description:
      'Yêu cầu đi muộn có cần trưởng phòng hoặc quản trị viên phê duyệt.'
  },
  {
    key: 'approval_EARLY_LEAVE',
    title: 'Về sớm',
    description: 'Yêu cầu về sớm có cần phê duyệt.'
  },
  {
    key: 'approval_MORNING_LEAVE',
    title: 'Nghỉ buổi sáng',
    description: 'Yêu cầu nghỉ buổi sáng có cần phê duyệt.'
  },
  {
    key: 'approval_AFTERNOON_LEAVE',
    title: 'Nghỉ buổi chiều',
    description: 'Yêu cầu nghỉ buổi chiều có cần phê duyệt.'
  },
  {
    key: 'approval_FULL_DAY_LEAVE',
    title: 'Nghỉ phép',
    description:
      'Áp dụng cho nghỉ phép một ngày hoặc nhiều ngày.'
  },
  {
    key: 'approval_REMOTE',
    title: 'Làm từ xa',
    description:
      'Yêu cầu làm việc từ xa có cần phê duyệt.'
  }
]

const weekOptions = [
  { value: 1, title: 'Thứ Hai' },
  { value: 2, title: 'Thứ Ba' },
  { value: 3, title: 'Thứ Tư' },
  { value: 4, title: 'Thứ Năm' },
  { value: 5, title: 'Thứ Sáu' },
  { value: 6, title: 'Thứ Bảy' },
  { value: 0, title: 'Chủ Nhật' }
]

async function load() {
  loading.value = true
  error.value = ''

  try {
    const [approvalData, calendarData] = await Promise.all([
      api('/api/admin/settings'),
      api('/api/admin/work-calendar')
    ])

    const map: Record<string, boolean> = {}

    for (const item of (approvalData.items || []) as SettingItem[]) {
      map[item.setting_key] = item.setting_value === '1'
    }

    settings.value = map

    morningStart.value =
      calendarData.settings?.morning_start || '08:00'

    morningEnd.value =
      calendarData.settings?.morning_end || '11:30'

    afternoonStart.value =
      calendarData.settings?.afternoon_start || '13:00'

    afternoonEnd.value =
      calendarData.settings?.afternoon_end || '17:00'

    weekdays.value =
      calendarData.settings?.weekdays || [1, 2, 3, 4, 5]

    calendarDays.value = calendarData.days || []
  } catch (e: any) {
    error.value =
      e.message || 'Không thể tải cấu hình hệ thống.'
  } finally {
    loading.value = false
  }
}

async function updateApproval(key: string, value: boolean) {
  saving.value = key
  error.value = ''
  success.value = ''

  try {
    await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        setting_key: key,
        setting_value: value
      })
    })

    settings.value[key] = value
    success.value = 'Đã cập nhật cấu hình phê duyệt.'
  } catch (e: any) {
    settings.value[key] = !value
    error.value =
      e.message || 'Không thể cập nhật cấu hình.'
  } finally {
    saving.value = ''
  }
}

async function saveCalendar() {
  savingCalendar.value = true
  error.value = ''
  success.value = ''

  try {
    await api('/api/admin/work-calendar', {
      method: 'PUT',
      body: JSON.stringify({
        morning_start: morningStart.value,
        morning_end: morningEnd.value,
        afternoon_start: afternoonStart.value,
        afternoon_end: afternoonEnd.value,
        weekdays: weekdays.value
      })
    })

    success.value = 'Đã lưu lịch làm việc.'
  } catch (e: any) {
    error.value =
      e.message || 'Không thể lưu lịch làm việc.'
  } finally {
    savingCalendar.value = false
  }
}

async function saveSpecialDay() {
  if (!dayDate.value) {
    error.value = 'Vui lòng chọn ngày.'
    return
  }

  if (!dayName.value.trim()) {
    error.value =
      dayType.value === 1
        ? 'Vui lòng nhập tên ngày làm việc đặc biệt.'
        : 'Vui lòng nhập tên ngày nghỉ.'
    return
  }

  savingDay.value = true
  error.value = ''
  success.value = ''

  try {
    await api('/api/admin/work-calendar/days', {
      method: 'POST',
      body: JSON.stringify({
        work_date: dayDate.value,
        is_working: dayType.value,
        name: dayName.value.trim()
      })
    })

    dayDate.value = ''
    dayName.value = ''

    success.value =
      dayType.value === 1
        ? 'Đã lưu ngày làm việc đặc biệt.'
        : 'Đã lưu ngày nghỉ theo QĐ.'

    await load()
  } catch (e: any) {
    error.value =
      e.message || 'Không thể lưu ngày đặc biệt.'
  } finally {
    savingDay.value = false
  }
}

async function deleteSpecialDay(item: CalendarDay) {
  const ok = window.confirm(
    `Xóa cấu hình ngày ${item.work_date} - ${item.name}?`
  )

  if (!ok) return

  deletingDay.value = item.id
  error.value = ''
  success.value = ''

  try {
    await api(`/api/admin/work-calendar/days/${item.id}`, {
      method: 'DELETE'
    })

    success.value = 'Đã xóa ngày khỏi lịch đặc biệt.'
    await load()
  } catch (e: any) {
    error.value =
      e.message || 'Không thể xóa ngày đặc biệt.'
  } finally {
    deletingDay.value = null
  }
}

onMounted(load)
</script>

<template>
  <AppShell>
    <main class="page">
      <div class="title">Cấu hình hệ thống</div>

      <p class="muted">
        Quản lý quy trình phê duyệt và lịch làm việc của ITCA-Management.
      </p>

      <v-alert
        v-if="error"
        type="error"
        density="compact"
        class="mt-4"
      >
        {{ error }}
      </v-alert>

      <v-alert
        v-if="success"
        type="success"
        density="compact"
        class="mt-4"
      >
        {{ success }}
      </v-alert>

      <div v-if="loading" class="card loading">
        Đang tải cấu hình...
      </div>

      <template v-else>
        <section class="section">
          <h2>Phê duyệt yêu cầu</h2>

          <p class="muted">
            Chọn loại yêu cầu cần được phê duyệt trước khi có hiệu lực.
          </p>

          <div class="settings">
            <div
              v-for="item in settingList"
              :key="item.key"
              class="card setting"
            >
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>

              <div class="switch-area">
                <span>
                  {{
                    settings[item.key]
                      ? 'Cần phê duyệt'
                      : 'Tự động duyệt'
                  }}
                </span>

                <v-switch
                  :model-value="settings[item.key]"
                  :loading="saving === item.key"
                  color="#8b0d24"
                  hide-details
                  @update:model-value="
                    updateApproval(item.key, Boolean($event))
                  "
                />
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <h2>Lịch làm việc</h2>

          <p class="muted">
            Thiết lập giờ làm việc và các ngày làm việc trong tuần.
          </p>

          <div class="card">
            <div class="time-grid">
              <v-text-field
                v-model="morningStart"
                label="Bắt đầu buổi sáng"
                type="time"
                variant="outlined"
                hide-details
              />

              <v-text-field
                v-model="morningEnd"
                label="Kết thúc buổi sáng"
                type="time"
                variant="outlined"
                hide-details
              />

              <v-text-field
                v-model="afternoonStart"
                label="Bắt đầu buổi chiều"
                type="time"
                variant="outlined"
                hide-details
              />

              <v-text-field
                v-model="afternoonEnd"
                label="Kết thúc buổi chiều"
                type="time"
                variant="outlined"
                hide-details
              />
            </div>

            <div class="weekday-title">
              Ngày làm việc trong tuần
            </div>

            <div class="weekday-grid">
              <v-checkbox
                v-for="day in weekOptions"
                :key="day.value"
                v-model="weekdays"
                :value="day.value"
                :label="day.title"
                color="#8b0d24"
                hide-details
              />
            </div>

            <div class="actions">
              <v-btn
                color="#8b0d24"
                :loading="savingCalendar"
                @click="saveCalendar"
              >
                Lưu lịch làm việc
              </v-btn>
            </div>
          </div>
        </section>

        <section class="section">
          <h2>Ngày nghỉ / ngày làm việc đặc biệt</h2>

          <p class="muted">
            Ngày đặc biệt sẽ được ưu tiên hơn lịch làm việc theo thứ trong tuần.
          </p>

          <div class="card">
            <div class="special-grid">
              <v-text-field
                v-model="dayDate"
                label="Ngày"
                type="date"
                variant="outlined"
                hide-details
              />

              <v-select
                v-model="dayType"
                label="Loại ngày"
                :items="[
                  { title: 'Ngày nghỉ theo QĐ', value: 0 },
                  { title: 'Ngày làm việc đặc biệt / làm bù', value: 1 }
                ]"
                variant="outlined"
                hide-details
              />

              <v-text-field
                v-model="dayName"
                label="Tên / lý do"
                placeholder="Ví dụ: Quốc khánh"
                variant="outlined"
                hide-details
              />

              <v-btn
                color="#8b0d24"
                :loading="savingDay"
                @click="saveSpecialDay"
              >
                Thêm / cập nhật
              </v-btn>
            </div>
          </div>

          <div
            v-if="calendarDays.length === 0"
            class="card empty"
          >
            Chưa có ngày nghỉ hoặc ngày làm việc đặc biệt.
          </div>

          <div v-else class="calendar-list">
            <div
              v-for="item in calendarDays"
              :key="item.id"
              class="card calendar-item"
            >
              <div>
                <strong>{{ item.work_date }}</strong>

                <div class="day-name">
                  {{ item.name }}
                </div>
              </div>

              <div class="day-actions">
                <v-chip
                  :color="item.is_working ? 'success' : 'secondary'"
                  size="small"
                >
                  {{
                    item.is_working
                      ? 'Ngày làm việc đặc biệt'
                      : 'Ngày nghỉ theo QĐ'
                  }}
                </v-chip>

                <v-btn
                  icon="mdi-delete-outline"
                  variant="text"
                  color="error"
                  size="small"
                  :loading="deletingDay === item.id"
                  @click="deleteSpecialDay(item)"
                />
              </div>
            </div>
          </div>
        </section>

        <div class="card note">
          <v-icon>mdi-information-outline</v-icon>

          <div>
            <b>Nguyên tắc áp dụng</b>

            <p>
              Ngày nghỉ hoặc ngày làm việc đặc biệt được ưu tiên hơn lịch
              theo thứ trong tuần.
            </p>

            <p>
              Ví dụ: Thứ Bảy mặc định nghỉ nhưng có thể cấu hình một
              Thứ Bảy cụ thể thành ngày làm việc đặc biệt.
            </p>
          </div>
        </div>
      </template>
    </main>
  </AppShell>
</template>

<style scoped>
.section {
  margin-top: 28px;
}

.section h2 {
  margin: 0 0 6px;
  color: #8b0d24;
  font-size: 20px;
}

.settings,
.calendar-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.setting {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

.setting h3 {
  margin: 0 0 5px;
  color: #8b0d24;
}

.setting p,
.day-name {
  margin: 0;
  color: #697386;
}

.switch-area {
  min-width: 190px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.switch-area span {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.weekday-title {
  margin-top: 22px;
  font-weight: 700;
}

.weekday-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px 12px;
  margin-top: 6px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.special-grid {
  display: grid;
  grid-template-columns: 180px 260px minmax(220px, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.calendar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.day-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading,
.empty {
  margin-top: 20px;
  text-align: center;
  color: #697386;
}

.note {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  background: #fff7f8;
}

.note .v-icon,
.note b {
  color: #8b0d24;
}

.note p {
  margin: 5px 0 0;
  color: #697386;
}

@media (max-width: 1024px) {
  .time-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .weekday-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .special-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 650px) {
  .setting,
  .calendar-item {
    align-items: flex-start;
    flex-direction: column;
  }

  .switch-area,
  .day-actions {
    width: 100%;
    justify-content: space-between;
  }

  .time-grid,
  .special-grid {
    grid-template-columns: 1fr;
  }

  .weekday-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .actions,
  .actions .v-btn,
  .special-grid .v-btn {
    width: 100%;
  }
}

@media (max-width: 400px) {
  .weekday-grid {
    grid-template-columns: 1fr;
  }
}
</style>