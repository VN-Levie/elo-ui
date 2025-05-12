<script setup>
import { ref, onMounted, provide, readonly } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { io } from "socket.io-client";

// --- PBR Config State ---
const pbrConfig = ref(null);
const isLoadingConfiguration = ref(true); // Đổi tên cho nhất quán
const configurationError = ref('');    // Đổi tên cho nhất quán

// --- WebSocket and Global Simulation State ---
const socket = ref(null);
const globalSimStatus = ref({
  isRunning: false,
  taskId: null,
  requestedByInfo: null,
  completedMatches: 0,
  totalMatches: 0,
  startTime: null,
  statusMessage: "Connecting to server..."
});
const showGlobalSimBannerInControls = ref(false);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

async function fetchPbrConfig() {
  isLoadingConfiguration.value = true;
  configurationError.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/config/pbr-settings`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.success) {
      pbrConfig.value = data.data;
    } else {
      throw new Error(data.message || "Failed to parse PBR config data");
    }
  } catch (error) {
    console.error("Failed to fetch PBR config:", error);
    configurationError.value = `Failed to load PBR configuration: ${error.message}`;
    pbrConfig.value = null;
  } finally {
    isLoadingConfiguration.value = false;
  }
}

onMounted(() => {
  fetchPbrConfig();

  socket.value = io(WS_URL);

  socket.value.on('connect', () => {
    console.log('Socket connected to server:', socket.value.id);
    if (!globalSimStatus.value.isRunning) {
        globalSimStatus.value.statusMessage = "Idle. Ready to simulate.";
    }
  });

  socket.value.on('disconnect', () => {
    console.log('Socket disconnected from server.');
    globalSimStatus.value.statusMessage = "Disconnected from server. Attempting to reconnect...";
  });

  socket.value.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    globalSimStatus.value.statusMessage = `Connection Error: ${err.message}. Retrying...`;
  });

  socket.value.on('global_simulation_status_update', (status) => {
    console.log('Global sim status update:', status);
    globalSimStatus.value = { ...status };
    showGlobalSimBannerInControls.value = status.isRunning || (status.taskId && !status.isRunning);
  });

  socket.value.on('simulation_job_error', (errorData) => {
    console.error('Simulation Job Error:', errorData);
  });

  socket.value.on('simulation_job_completed', (data) => {
    console.log('My Simulation Job Completed:', data);
  });
});

provide('socket', socket); // KHÔNG dùng readonly cho socket
provide('globalSimStatus', readonly(globalSimStatus));
provide('showGlobalSimBannerInControls', showGlobalSimBannerInControls);
provide('pbrConfig', readonly(pbrConfig));
provide('isLoadingPbrConfigGlobal', readonly(isLoadingConfiguration)); // Key provide đã đổi
provide('pbrConfigErrorGlobal', readonly(configurationError));     // Key provide đã đổi

</script>

<template>
  <div id="elo-dashboard-app">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top shadow-sm">
      <div class="container-fluid">
        <RouterLink class="navbar-brand fw-bold" to="/">EloSim Pro</RouterLink>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNavDropdown">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <RouterLink class="nav-link" active-class="active" to="/">Leaderboard & Sim</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" active-class="active" to="/statistics">Statistics</RouterLink>
            </li>
          </ul>
          <!-- Optional right-aligned items
          <ul class="navbar-nav">
            <li class="nav-item">
              <span class="navbar-text me-3">Welcome, Guest!</span>
            </li>
          </ul>
          -->
        </div>
      </div>
    </nav>

    <main class="container mt-4 main-content">
      <!-- Sử dụng đúng tên biến đã khai báo trong script -->
      <div v-if="isLoadingConfiguration" class="text-center mt-5 pt-5">
        <div class="spinner-border text-info" style="width: 3rem; height: 3rem;" role="status">
          <span class="visually-hidden">Loading configuration...</span>
        </div>
        <p class="lead mt-2">Loading System Configuration...</p>
      </div>
      <div v-else-if="configurationError" class="alert alert-danger mt-5 pt-5" role="alert">
        <h4>Configuration Error</h4> <p>{{ configurationError }}</p>
        <button @click="fetchPbrConfig" class="btn btn-warning">Retry Loading Config</button>
      </div>
      <RouterView v-else />
    </main>

    <footer class="footer mt-auto py-3 bg-secondary-subtle text-center border-top">
      <div class="container">
        <span class="text-muted">© {{ new Date().getFullYear() }} Elo Simulation Project.</span>
      </div>
    </footer>
  </div>
</template>

<style>

</style>