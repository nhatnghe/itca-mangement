<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api'

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const router = useRouter()

async function login() {
  error.value = ''
  loading.value = true

  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    })

    await router.push('/dashboard')
  } catch (e: any) {
    error.value = e?.message || 'ÄÄƒng nháº­p khÃ´ng thÃ nh cÃ´ng'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <div class="box">
      <div class="logo">
        <v-icon size="50">mdi-account-group</v-icon>
      </div>

      <h1>ITCA-Management</h1>
      <p>Quản lý ngày làm việc</p>

      <v-text-field
        v-model="username"
        label="Tên đăng nhập"
        prepend-inner-icon="mdi-account"
        autocomplete="username"
      />

      <v-text-field
        v-model="password"
        label="Mật khẩu"
        type="password"
        prepend-inner-icon="mdi-lock"
        autocomplete="current-password"
        @keyup.enter="login"
      />

      <v-alert
        v-if="error"
        type="error"
        density="compact"
        class="mb-4"
      >
        {{ error }}
      </v-alert>

      <v-btn
        block
        size="large"
        color="primary"
        :loading="loading"
        @click="login"
      >
        ĐĂNG NHẬP
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(
    145deg,
    #74091d,
    #a5102e 45%,
    #fff3f5 45%
  );
}

.box {
  width: min(430px, 92vw);
  background: white;
  padding: 34px;
  border-radius: 24px;
  box-shadow: 0 25px 60px #4b001533;
  text-align: center;
}

.logo {
  color: #8b0d24;
}

.box h1 {
  color: #8b0d24;
  margin: 8px 0 0;
}

.box p {
  color: #697386;
  margin-bottom: 25px;
}
</style>