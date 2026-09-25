<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { api } from '../services/api'

type SettingItem = {
  setting_key: string
  setting_value: string
  description?: string
}

const loading = ref(false)
const saving = ref('')
const error = ref('')
const success = ref('')
const settings = ref<Record<string, boolean>>({})

const settingList = [
  {
    key: 'approval_LATE',
    title: 'Đi muộn',
    description: 'Yêu cầu đi muộn có cần trưởng phòng hoặc quản trị viên phê duyệt.'
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
    description: 'Áp dụng cho nghỉ phép một ngày hoặc nhiều ngày.'
  },
  {
    key: 'approval_REMOTE',
    title: 'Làm từ xa',
    description: 'Yêu cầu làm việc từ xa có cần phê duyệt.'
  }
]

async function load() {
  loading.value = true
  error.value = ''

  try {
    const data = await api('/api/admin/settings')

    const map: Record<string, boolean> = {}

    for (const item of (data.items || []) as SettingItem[]) {
      map[item.setting_key] = item.setting_value === '1'
    }

    settings.value = map
  } catch (e: any) {
    error.value = e.message || 'Không thể tải cấu hình hệ thống.'
  } finally {
    loading.value = false
  }
}

async function update(key: string, value: boolean) {
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
    success.value = 'Đã cập nhật cấu hình.'
  } catch (e: any) {
    settings.value[key] = !value
    error.value = e.message || 'Không thể cập nhật cấu hình.'
  } finally {
    saving.value = ''
  }
}

onMounted(load)
</script>

<template>
  <AppShell>
    <main class="page">
      <div class="title">Cấu hình hệ thống</div>

      <p class="muted">
        Thiết lập loại yêu cầu nào cần được phê duyệt trước khi có hiệu lực.
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

      <div v-else class="settings">
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
              {{ settings[item.key] ? 'Cần phê duyệt' : 'Tự động duyệt' }}
            </span>

            <v-switch
              :model-value="settings[item.key]"
              :loading="saving === item.key"
              color="#8b0d24"
              hide-details
              @update:model-value="
                update(item.key, Boolean($event))
              "
            />
          </div>
        </div>
      </div>

      <div class="card note">
        <v-icon>mdi-information-outline</v-icon>

        <div>
          <b>Nguyên tắc áp dụng</b>

          <p>
            Khi bật “Cần phê duyệt”, yêu cầu mới sẽ ở trạng thái chờ duyệt.
            Khi tắt, yêu cầu mới được tự động phê duyệt và có hiệu lực ngay.
          </p>

          <p>
            Thay đổi cấu hình không làm thay đổi trạng thái của các yêu cầu
            đã tạo trước đó.
          </p>
        </div>
      </div>
    </main>
  </AppShell>
</template>

<style scoped>
.settings {
  display: grid;
  gap: 12px;
  margin-top: 20px;
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

.setting p {
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

.loading {
  margin-top: 20px;
  text-align: center;
  color: #697386;
}

.note {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  background: #fff7f8;
}

.note .v-icon {
  color: #8b0d24;
}

.note b {
  color: #8b0d24;
}

.note p {
  margin: 5px 0 0;
  color: #697386;
}

@media (max-width: 650px) {
  .setting {
    align-items: flex-start;
    flex-direction: column;
  }

  .switch-area {
    width: 100%;
    justify-content: space-between;
  }
}
</style>