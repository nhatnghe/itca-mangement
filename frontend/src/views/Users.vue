<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../services/api'
import AppShell from '../components/AppShell.vue'

type Role = {
  id: number
  code: string
  name: string
}

type Department = {
  id: number
  code: string
  name: string
}

type User = {
  id: number
  username: string
  full_name: string
  email?: string | null
  phone?: string | null
  department_id?: number | null
  department_code?: string | null
  department_name?: string | null
  role_id: number
  role_code: string
  role_name: string
  active: number
}

const users = ref<User[]>([])
const roles = ref<Role[]>([])
const departments = ref<Department[]>([])

const loading = ref(false)
const error = ref('')
const search = ref('')

const dialog = ref(false)
const passwordDialog = ref(false)
const statusDialog = ref(false)

const editingId = ref<number | null>(null)
const selectedUser = ref<User | null>(null)

const form = ref({
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  department_id: null as number | null,
  role_id: null as number | null,
})

const newPassword = ref('')

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase()

  if (!q) return users.value

  return users.value.filter(user =>
    user.full_name?.toLowerCase().includes(q) ||
    user.username?.toLowerCase().includes(q) ||
    user.email?.toLowerCase().includes(q) ||
    user.department_name?.toLowerCase().includes(q)
  )
})

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const [userData, optionData] = await Promise.all([
      api('/api/admin/users'),
      api('/api/admin/user-options'),
    ])

    users.value = userData.items || []
    roles.value = optionData.roles || []
    departments.value = optionData.departments || []
  } catch (e: any) {
    error.value = e?.message || 'Không tải được dữ liệu người dùng'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null

  form.value = {
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    department_id: departments.value[0]?.id ?? null,
    role_id: roles.value.find(r => r.code === 'USER')?.id ?? null,
  }

  dialog.value = true
}

function openEdit(user: User) {
  editingId.value = user.id

  form.value = {
    username: user.username,
    password: '',
    full_name: user.full_name,
    email: user.email || '',
    phone: user.phone || '',
    department_id: user.department_id ?? null,
    role_id: user.role_id,
  }

  dialog.value = true
}

async function saveUser() {
  error.value = ''

  try {
    if (editingId.value === null) {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(form.value),
      })
    } else {
      await api(`/api/admin/users/${editingId.value}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: form.value.full_name,
          email: form.value.email,
          phone: form.value.phone,
          department_id: form.value.department_id,
          role_id: form.value.role_id,
        }),
      })
    }

    dialog.value = false
    await loadData()
  } catch (e: any) {
    error.value = e?.message || 'Không lưu được người dùng'
  }
}

function openPassword(user: User) {
  selectedUser.value = user
  newPassword.value = ''
  passwordDialog.value = true
}

async function resetPassword() {
  if (!selectedUser.value) return

  error.value = ''

  try {
    await api(`/api/admin/users/${selectedUser.value.id}/password`, {
      method: 'PUT',
      body: JSON.stringify({
        password: newPassword.value,
      }),
    })

    passwordDialog.value = false
    newPassword.value = ''
  } catch (e: any) {
    error.value = e?.message || 'Không đặt lại được mật khẩu'
  }
}

function openStatus(user: User) {
  selectedUser.value = user
  statusDialog.value = true
}

async function changeStatus() {
  if (!selectedUser.value) return

  error.value = ''

  try {
    await api(`/api/admin/users/${selectedUser.value.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        active: !Boolean(selectedUser.value.active),
      }),
    })

    statusDialog.value = false
    await loadData()
  } catch (e: any) {
    error.value = e?.message || 'Không thay đổi được trạng thái'
  }
}

onMounted(loadData)
</script>

<template>
  <AppShell>
    <main class="page">
      <div class="page-header">
        <div>
          <h1>Quản lý người dùng</h1>
          <p>Quản lý tài khoản, vai trò và phòng ban</p>
        </div>

        <v-btn
          color="primary"
          prepend-icon="mdi-account-plus"
          @click="openCreate"
        >
          Thêm người dùng
        </v-btn>
      </div>

      <v-alert
        v-if="error"
        type="error"
        closable
        class="mb-4"
        @click:close="error = ''"
      >
        {{ error }}
      </v-alert>

      <v-card class="card">
        <v-card-text>
          <v-text-field
            v-model="search"
            label="Tìm kiếm người dùng"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="comfortable"
            hide-details
          />
        </v-card-text>

        <v-progress-linear
          v-if="loading"
          indeterminate
          color="primary"
        />

        <div
          v-for="user in filteredUsers"
          :key="user.id"
          class="user-row"
        >
          <div class="avatar">
            {{ user.full_name?.charAt(0).toUpperCase() || '?' }}
          </div>

          <div class="user-info">
            <strong>{{ user.full_name }}</strong>

            <span>
              @{{ user.username }}
              · {{ user.department_name || 'Chưa có phòng' }}
            </span>

            <div class="chips">
              <v-chip
                size="small"
                color="primary"
                variant="tonal"
              >
                {{ user.role_name }}
              </v-chip>

              <v-chip
                size="small"
                :color="user.active ? 'success' : 'grey'"
                variant="tonal"
              >
                {{ user.active ? 'Đang hoạt động' : 'Đã khóa' }}
              </v-chip>
            </div>
          </div>

          <div class="actions">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              title="Sửa"
              @click="openEdit(user)"
            />

            <v-btn
              icon="mdi-key"
              variant="text"
              title="Đặt lại mật khẩu"
              @click="openPassword(user)"
            />

            <v-btn
              :icon="user.active ? 'mdi-lock' : 'mdi-lock-open'"
              variant="text"
              :title="user.active ? 'Khóa tài khoản' : 'Mở tài khoản'"
              @click="openStatus(user)"
            />
          </div>
        </div>

        <div
          v-if="!loading && filteredUsers.length === 0"
          class="empty"
        >
          Không tìm thấy người dùng.
        </div>
      </v-card>
    </main>

    <!-- Thêm / sửa -->
    <v-dialog
      v-model="dialog"
      max-width="600"
    >
      <v-card>
        <v-card-title>
          {{ editingId === null ? 'Thêm người dùng' : 'Sửa người dùng' }}
        </v-card-title>

        <v-card-text>
          <v-text-field
            v-model="form.username"
            label="Tên đăng nhập"
            :disabled="editingId !== null"
          />

          <v-text-field
            v-model="form.full_name"
            label="Họ và tên"
          />

          <v-text-field
            v-model="form.email"
            label="Email"
            type="email"
          />

          <v-text-field
            v-model="form.phone"
            label="Số điện thoại"
          />

          <v-select
            v-model="form.department_id"
            :items="departments"
            item-title="name"
            item-value="id"
            label="Phòng ban"
          />

          <v-select
            v-model="form.role_id"
            :items="roles"
            item-title="name"
            item-value="id"
            label="Vai trò"
          />

          <v-text-field
            v-if="editingId === null"
            v-model="form.password"
            label="Mật khẩu ban đầu"
            type="password"
            hint="Tối thiểu 8 ký tự"
            persistent-hint
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />

          <v-btn @click="dialog = false">
            Hủy
          </v-btn>

          <v-btn
            color="primary"
            @click="saveUser"
          >
            Lưu
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reset password -->
    <v-dialog
      v-model="passwordDialog"
      max-width="480"
    >
      <v-card>
        <v-card-title>Đặt lại mật khẩu</v-card-title>

        <v-card-text>
          <p class="dialog-text">
            Tài khoản:
            <strong>{{ selectedUser?.username }}</strong>
          </p>

          <v-text-field
            v-model="newPassword"
            label="Mật khẩu mới"
            type="password"
            hint="Tối thiểu 8 ký tự"
            persistent-hint
            @keyup.enter="resetPassword"
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />

          <v-btn @click="passwordDialog = false">
            Hủy
          </v-btn>

          <v-btn
            color="primary"
            @click="resetPassword"
          >
            Đặt lại mật khẩu
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Khóa / mở -->
    <v-dialog
      v-model="statusDialog"
      max-width="480"
    >
      <v-card>
        <v-card-title>
          {{ selectedUser?.active ? 'Khóa tài khoản' : 'Mở tài khoản' }}
        </v-card-title>

        <v-card-text>
          Bạn có chắc muốn
          {{ selectedUser?.active ? 'khóa' : 'mở' }}
          tài khoản
          <strong>{{ selectedUser?.username }}</strong>?
        </v-card-text>

        <v-card-actions>
          <v-spacer />

          <v-btn @click="statusDialog = false">
            Hủy
          </v-btn>

          <v-btn
            color="primary"
            @click="changeStatus"
          >
            Xác nhận
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </AppShell>
</template>

<style scoped>
.page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 20px 110px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.page-header h1 {
  color: #74091d;
  margin: 0;
}

.page-header p {
  color: #6b7280;
  margin: 5px 0 0;
}

.card {
  border-radius: 18px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-top: 1px solid #eee;
}

.avatar {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  border-radius: 50%;
  background: #fdecef;
  color: #8b0d24;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 700;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-info strong {
  display: block;
  color: #17223b;
}

.user-info > span {
  display: block;
  margin: 3px 0 8px;
  color: #6b7280;
  font-size: 13px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.actions {
  display: flex;
}

.empty {
  padding: 35px;
  text-align: center;
  color: #6b7280;
}

.dialog-text {
  margin-bottom: 18px;
}

@media (max-width: 650px) {
  .page {
    padding: 20px 12px 100px;
  }

  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .user-row {
    align-items: flex-start;
    padding: 15px 12px;
  }

  .actions {
    flex-direction: column;
  }
}
</style>