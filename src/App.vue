<script setup>
import { ref, onMounted, watch } from 'vue';
import PlayerDetail from './components/PlayerDetail.vue'; // Import the new component
// Import constants if needed for PBR grade calculation later
// import { PBR_BENCHMARKS, AVERAGE_MATCH_DURATION_MINUTES } from '../../config/constants.js'; // Adjust path if needed

const players = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const simulateCount = ref(10);
const leaderboardLimit = ref(10);
const limitOptions = [10, 25, 50, 100];

const simulationTime = ref(0);
const isSimulating = ref(false);
const simulationTimerDisplay = ref('0.0s');
let simulationInterval = null;

const selectedPlayer = ref(null); // To store the player object for the detail view
const showPlayerDetailModal = ref(false);

const API_BASE_URL = 'http://localhost:3000/api';

async function fetchPlayers() {
  // ... (giữ nguyên)
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/players?limit=${leaderboardLimit.value}`); 
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    players.value = Array.isArray(data) ? data : (data.data || []);
  } catch (error) {
    console.error("Failed to fetch players:", error);
    errorMessage.value = `Failed to load players: ${error.message}`;
    players.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function simulateMatches() {
  // ... (giữ nguyên)
  if (simulateCount.value < 1 || simulateCount.value > 500) {
    errorMessage.value = 'Number of matches must be between 1 and 500.';
    return;
  }
  isSimulating.value = true;
  isLoading.value = true;
  errorMessage.value = '';
  simulationTime.value = 0;
  simulationTimerDisplay.value = '0.0s';
  const startTime = performance.now();
  let elapsedSeconds = 0;
  simulationInterval = setInterval(() => {
    elapsedSeconds += 0.1;
    simulationTimerDisplay.value = `${elapsedSeconds.toFixed(1)}s`;
  }, 100);
  try {
    const response = await fetch(`${API_BASE_URL}/simulate/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numMatches: simulateCount.value })
    });
    const endTime = performance.now();
    clearInterval(simulationInterval);
    simulationTime.value = endTime - startTime;
    simulationTimerDisplay.value = `${(simulationTime.value / 1000).toFixed(2)}s`;
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }
    console.log('Matches simulated:', result.message);
    await fetchPlayers();
  } catch (error) {
    console.error("Failed to simulate matches:", error);
    errorMessage.value = `Failed to simulate matches: ${error.message}`;
    if (simulationInterval) clearInterval(simulationInterval);
    const errorEndTime = performance.now();
    simulationTime.value = errorEndTime - startTime;
    simulationTimerDisplay.value = `${(simulationTime.value / 1000).toFixed(2)}s (Error)`;
  } finally {
    isSimulating.value = false;
    isLoading.value = false;
  }
}

// Function to fetch full player details for the modal
async function viewPlayerDetails(playerId) {
  if (isLoading.value) return; // Don't fetch if another load is in progress
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/players/${playerId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch player details: ${response.status}`);
    }
    const playerData = await response.json();
    // Assuming API returns player object directly or { success: true, data: playerData }
    selectedPlayer.value = playerData.data || playerData; 
    showPlayerDetailModal.value = true;
  } catch (error) {
    console.error("Error fetching player details:", error);
    errorMessage.value = `Error fetching details for ${playerId}: ${error.message}`;
    selectedPlayer.value = null;
  } finally {
    isLoading.value = false;
  }
}

function closePlayerDetailModal() {
  showPlayerDetailModal.value = false;
  selectedPlayer.value = null;
}


watch(leaderboardLimit, (newValue, oldValue) => {
  if (newValue !== oldValue && !isLoading.value) {
    fetchPlayers();
  }
});

onMounted(async () => {
  isLoading.value = true;
  await fetchPlayers();
  isLoading.value = false;
});
</script>

<template>
  <div class="container mt-5">
    <!-- Header and Controls (giữ nguyên) -->
    <header class="mb-4">
      <h1 class="display-4">LoL Elo System Dashboard</h1>
      <p class="lead">View player rankings and simulate matches.</p>
    </header>

    <div class="row mb-3 gy-2 gx-3 align-items-end">
      <div class="col-md-auto">
        <label for="simulateCountInput" class="form-label">Matches to Simulate (1-500):</label>
        <input 
          type="number" 
          class="form-control" 
          id="simulateCountInput" 
          v-model.number="simulateCount" 
          min="1" 
          max="500"
          style="width: 180px;"
          :disabled="isSimulating"
        >
      </div>
      <div class="col-md-auto">
        <button @click="simulateMatches" class="btn btn-primary " :disabled="isSimulating || isLoading">
          <span v-if="isSimulating" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          {{ isSimulating ? `Simulating (${simulationTimerDisplay})...` : `Simulate ${simulateCount} Matches` }}
        </button>
      </div>
       <div class="col-md-auto">
        <label for="leaderboardLimitSelect" class="form-label">Show Top:</label>
        <select 
          class="form-select" 
          id="leaderboardLimitSelect" 
          v-model.number="leaderboardLimit"
          style="width: 100px;"
          :disabled="isSimulating || isLoading"
        >
          <option v-for="option in limitOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <div class="col-md-auto">
        <button @click="fetchPlayers" class="btn btn-secondary" :disabled="isSimulating || isLoading">
          <span v-if="isLoading && players.length === 0 && !isSimulating" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          Refresh
        </button>
      </div>
    </div>
    <div class="row mb-3">
        <div class="col">
            <small v-if="simulationTime > 0 && !isSimulating">
                Last simulation for {{ simulateCount }} matches took: <strong>{{ (simulationTime / 1000).toFixed(2) }}s</strong>
            </small>
             <small v-if="isSimulating">
                Current simulation running for: <strong>{{ simulationTimerDisplay }}</strong>
            </small>
        </div>
    </div>
    <div v-if="errorMessage" class="alert alert-danger" role="alert">
      {{ errorMessage }}
    </div>

    <!-- Leaderboard Table -->
    <h2>Leaderboard (Top {{ leaderboardLimit }})</h2>
    <!-- ... (Loading and no data states giữ nguyên) ... -->
     <div v-if="isLoading && players.length === 0 && !isSimulating" class="text-center">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>Loading players...</p>
    </div>
    <div v-else-if="!isSimulating && !isLoading && players.length === 0 && !errorMessage" class="alert alert-info">
        No players to display. Try initializing the system or simulating matches.
    </div>

    <table v-else-if="players.length > 0" class="table table-striped table-hover">
      <thead class="table-dark">
        <tr>
          <th scope="col"># Rank</th>
          <th scope="col">Player Name</th>
          <th scope="col">Elo</th>
          <th scope="col">Games Played</th>
        </tr>
      </thead>
      <tbody>
        <!-- Make player name clickable -->
        <tr v-for="(player, index) in players" :key="player.playerId" @click="viewPlayerDetails(player.playerId)" style="cursor: pointer;">
          <th scope="row">{{ index + 1 }}</th>
          <td>{{ player.playerName }}</td>
          <td>{{ player.elo.toFixed(0) }}</td>
          <td>{{ player.gamesPlayed }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Player Detail Modal Component -->
    <PlayerDetail 
      v-if="showPlayerDetailModal && selectedPlayer" 
      :player="selectedPlayer"
      @close="closePlayerDetailModal"      
    />
  </div>
</template>

<style>
/* ... (styles giữ nguyên) ... */
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
.container {
  max-width: 960px;
}
</style>