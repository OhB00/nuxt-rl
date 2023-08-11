<template>
  <div>
    Login!

    <div>
      username
      <input v-model="username" />
    </div>

    <div>
      password
      <input type="password" v-model="password" />
    </div>

    <div>
        <button @click="login">Login</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"

const username = ref("")
const password = ref("")

async function login() {
    await $fetch("/api/login", {
        method: "POST",
        body: {
            username: username.value,
            password: password.value
        }
    })
}
</script>
