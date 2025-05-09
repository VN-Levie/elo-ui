<script setup>
import { ref, onMounted, provide } from 'vue'; // Import provide

const pbrConfig = ref(null);
const isLoadingConfig = ref(true);
const configError = ref('');

const API_BASE_URL = 'http://localhost:3000/api'; // Ensure this is correct

async function fetchPbrConfig() {
  isLoadingConfig.value = true;
  configError.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/config/pbr-settings`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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
    pbrConfig.value = null; // Reset on error
  } finally {
    isLoadingConfig.value = false;
  }
}

onMounted(() => {
  fetchPbrConfig();
});

// Provide the config to be injected by child components
provide('pbrConfig', pbrConfig); // Child components can inject 'pbrConfig'
provide('isLoadingPbrConfig', isLoadingConfig);
provide('pbrConfigError', configError);

</script>

<template>
  <div id="elo-dashboard">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
      <!-- ... Navbar content ... -->
    </nav>

    <main class="container mt-4" style="padding-top: 56px;">
      <div v-if="isLoadingConfig" class="text-center mt-5">
        <div class="spinner-border text-info" role="status">
          <span class="visually-hidden">Loading configuration...</span>
        </div>
        <p>Loading system configuration...</p>
      </div>
      <div v-else-if="configError" class="alert alert-warning">
        {{ configError }} <button @click="fetchPbrConfig" class="btn btn-sm btn-warning ms-2">Retry</button>
      </div>
      <!-- Render router-view only after config is loaded or if there's an error (to show error) -->
      <router-view v-else></router-view>
    </main>

    <footer class="text-center mt-auto py-3 bg-light">
      <p class="mb-0">© {{ new Date().getFullYear() }} Elo Simulation Project</p>
    </footer>
  </div>
</template>

<style>
/* ... styles ... */
</style>