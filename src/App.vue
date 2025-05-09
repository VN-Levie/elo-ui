<script setup>
import { ref, onMounted, provide } from 'vue';
import { RouterLink, RouterView } from 'vue-router'; // Import RouterLink and RouterView

const pbrConfig = ref(null);
const isLoadingConfig = ref(true);
const configError = ref('');

// Ensure your backend API base URL is correct
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

async function fetchPbrConfig() {
  isLoadingConfig.value = true;
  configError.value = '';
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
    configError.value = `Failed to load PBR configuration: ${error.message}`;
    pbrConfig.value = null;
  } finally {
    isLoadingConfig.value = false;
  }
}

onMounted(() => {
  fetchPbrConfig();
});

provide('pbrConfig', pbrConfig);
provide('isLoadingPbrConfig', isLoadingConfig);
provide('pbrConfigError', configError);

</script>

<template>
  <div id="elo-dashboard-app">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top shadow-sm">
      <div class="container-fluid">
        <!-- Brand/Logo as Text -->
        <RouterLink class="navbar-brand fw-bold" to="/">EloSim Pro</RouterLink>

        <!-- Navbar Toggler for mobile -->
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>

        <!-- Navbar Links -->
        <div class="collapse navbar-collapse" id="navbarNavDropdown">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <RouterLink class="nav-link" active-class="active" to="/">Leaderboard</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" active-class="active" to="/statistics">Statistics</RouterLink>
            </li>
            <!-- Add more navigation links here as needed -->
            <!-- Example:
            <li class="nav-item">
              <RouterLink class="nav-link" active-class="active" to="/champions">Champions</RouterLink>
            </li>
            <li class="nav-item dropdown">
              <a class="nav-link dropdown-toggle" href="#" id="navbarDropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                More
              </a>
              <ul class="dropdown-menu dropdown-menu-dark" aria-labelledby="navbarDropdownMenuLink">
                <li><RouterLink class="dropdown-item" to="/settings">Settings</RouterLink></li>
                <li><RouterLink class="dropdown-item" to="/about">About</RouterLink></li>
              </ul>
            </li>
            -->
          </ul>

          <!-- Right-aligned items (optional, e.g., user profile, logout) -->
          <ul class="navbar-nav">
            <li class="nav-item">
              <span class="navbar-text me-3">
                Welcome, Guest! <!-- Placeholder for user name -->
              </span>
            </li>
            <!-- Example Logout Button (if you implement auth)
            <li class="nav-item">
              <button class="btn btn-outline-light btn-sm" @click="logout">Logout</button>
            </li>
            -->
          </ul>
        </div>
      </div>
    </nav>

    <main class="container mt-4 main-content">
      <div v-if="isLoadingConfig" class="text-center mt-5 pt-5">
        <div class="spinner-border text-info" style="width: 3rem; height: 3rem;" role="status">
          <span class="visually-hidden">Loading configuration...</span>
        </div>
        <p class="lead mt-2">Loading System Configuration...</p>
      </div>
      <div v-else-if="configError" class="alert alert-danger mt-5 pt-5" role="alert">
        <h4>Configuration Error</h4>
        <p>{{ configError }}</p>
        <button @click="fetchPbrConfig" class="btn btn-warning">Retry Loading Config</button>
      </div>
      <RouterView v-else />
    </main>

    <footer class="footer mt-auto py-3 bg-secondary-subtle text-center border-top">
      <div class="container">
        <span class="text-muted">© {{ new Date().getFullYear() }} Elo Simulation Project. All Rights Reserved.</span>
      </div>
    </footer>
  </div>
</template>

<style>
/* Global styles (can also be in src/assets/main.css) */
html, body {
  height: 100%;
}

#elo-dashboard-app {
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* Ensure footer sticks to bottom */
}

.main-content {
  flex-grow: 1;
  padding-top: 70px; /* Adjust based on actual navbar height + some margin */
  padding-bottom: 2rem; /* Space above footer */
}

.navbar-brand {
  letter-spacing: 0.5px;
}

.nav-link.active {
  font-weight: bold;
  /* color: #0d6efd !important; /* Bootstrap primary blue, or your theme color */
}

.footer {
    font-size: 0.9em;
}
</style>