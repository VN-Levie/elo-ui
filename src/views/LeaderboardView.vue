<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import EloDistributionChart from '../components/charts/EloDistributionChart.vue';
import { Bar } from 'vue-chartjs';

const router = useRouter();

const players = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const simulateCount = ref(10);
const leaderboardLimit = ref(10); // Default
const limitOptions = [10, 25, 50, 100];

const simulationTime = ref(0);
const isSimulating = ref(false);
const simulationTimerDisplay = ref('0.0s');
let simulationInterval = null;

const eloDistributionData = ref(null);
const isLoadingEloDistribution = ref(false);
const eloDistError = ref('');

const showLeaderboardAsChart = ref(false);
const MAX_PLAYERS_FOR_CHART_VIEW = 25; // Ngưỡng để tự động chuyển về bảng

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

async function fetchData(endpoint, loadingVar, errorVar, dataVar, processFn = null) {
  loadingVar.value = true;
  errorVar.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/stats/${endpoint}`);
    if (!response.ok) {
        const errorResult = await response.json().catch(()=> ({message: `Failed to fetch ${endpoint}. Status: ${response.status}`}));
        throw new Error(errorResult.message || `Failed to fetch ${endpoint}`);
    }
    const result = await response.json();
    if (result.success) {
      dataVar.value = processFn ? processFn(result.data) : result.data;
    } else {
      throw new Error(result.message || `Unknown error fetching ${endpoint}`);
    }
  } catch (error) {
    console.error(`${endpoint} Error:`, error);
    errorVar.value = error.message;
    dataVar.value = null;
  } finally {
    loadingVar.value = false;
  }
}

async function fetchPlayers() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
        const response = await fetch(`${API_BASE_URL}/players?limit=${leaderboardLimit.value}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
        await fetchPlayers();
    } catch (error) {
        console.error("Failed to simulate matches:", error);
        errorMessage.value = `Failed to simulate matches: ${error.message}`;
        if (simulationInterval) clearInterval(simulationInterval);
        const errorEndTime = performance.now();
        if (startTime) simulationTime.value = errorEndTime - startTime;
        simulationTimerDisplay.value = `${(simulationTime.value / 1000).toFixed(2)}s (Error)`;
    } finally {
        isSimulating.value = false;
        isLoading.value = false;
    }
}

function goToPlayerProfile(playerId) {
    router.push({ name: 'PlayerProfile', params: { playerId: playerId } });
}

watch(leaderboardLimit, (newLimit) => {
    if (!isLoading.value) { // Check isLoading for fetchPlayers
        fetchPlayers();
    }
    if (newLimit > MAX_PLAYERS_FOR_CHART_VIEW) {
        showLeaderboardAsChart.value = false; // Force table view
    }
});

const topPlayersChartData = computed(() => {
    if (!players.value || players.value.length === 0) return null;
    const topNPlayers = players.value; 
    return {
        labels: topNPlayers.map(p => p.playerName).reverse(),
        datasets: [{
            label: 'Elo Rating',
            data: topNPlayers.map(p => p.elo).reverse(),
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
        }]
    };
});

const topPlayersChartOptions = computed(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: { 
        x: { beginAtZero: false, title: { display: true, text: 'Elo Rating' } }, 
        y: { ticks: { autoSkip: false, font: {size: leaderboardLimit.value > 15 ? 9 : 11 } } } // Adjust font size for y-axis labels
    },
    plugins: {
        legend: { display: false },
        title: { display: true, text: `Top ${leaderboardLimit.value} Players by Elo`, font: {size: 16} }
    }
}));

const canShowChartLeaderboard = computed(() => {
    return leaderboardLimit.value <= MAX_PLAYERS_FOR_CHART_VIEW;
});

onMounted(async () => {
    let generalLoading = true; // Temp var for initial combined loading state
    isLoading.value = true;
    isLoadingEloDistribution.value = true;
    
    const playerPromise = fetchPlayers();
    const eloDistPromise = fetchData('elo-distribution', isLoadingEloDistribution, eloDistError, eloDistributionData);

    await Promise.all([playerPromise, eloDistPromise]);
    
    isLoading.value = false; // Turn off general loading after both are done or fail
    // Specific loading vars are handled within fetchData
});
</script>

<template>
    <div class="leaderboard-view py-4">
        <header class="mb-4 p-4 bg-primary-subtle text-primary-emphasis rounded-3 shadow-sm">
            <h1 class="display-5">Simulation Dashboard</h1>
            <p class="lead mb-0">Control match simulations and view player rankings & statistics.</p>
        </header>

        <div class="controls-section card shadow-sm mb-4">
            <div class="card-header bg-light"><h5 class="mb-0">Simulation Controls</h5></div>
            <div class="card-body">
                <div class="row gy-3 gx-3 align-items-end">
                    <div class="col-md-auto">
                        <label for="simulateCountInput" class="form-label fw-medium">Matches to Simulate:</label>
                        <input type="number" class="form-control" id="simulateCountInput" v-model.number="simulateCount" min="1" max="500" style="width: 150px;" :disabled="isSimulating">
                    </div>
                    <div class="col-md-auto">
                        <button @click="simulateMatches" class="btn btn-primary btn-lg px-4" :disabled="isSimulating || isLoading">
                            <span v-if="isSimulating" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            {{ isSimulating ? `Simulating...` : `Run Simulation` }}
                        </button>
                    </div>
                    <div class="col-md-auto ms-md-auto">
                        <label for="leaderboardLimitSelect" class="form-label fw-medium">Show Top Players:</label>
                        <select class="form-select" id="leaderboardLimitSelect" v-model.number="leaderboardLimit" style="width: 100px;" :disabled="isSimulating || isLoading">
                            <option v-for="option in limitOptions" :key="option" :value="option">{{ option }}</option>
                        </select>
                    </div>
                     <div class="col-md-auto">
                        <button @click="fetchPlayers" class="btn btn-outline-secondary" :disabled="isSimulating || isLoading" title="Refresh Leaderboard & Charts">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg>
                            Refresh Data
                        </button>
                    </div>
                </div>
                <div v-if="isSimulating || simulationTime > 0" class="mt-3 text-center">
                    <small v-if="isSimulating" class="text-primary fst-italic">
                        Simulation in progress: <strong>{{ simulationTimerDisplay }}</strong>
                    </small>
                    <small v-else-if="simulationTime > 0" class="text-muted">
                        Last simulation of {{ simulateCount }} matches took: <strong>{{ (simulationTime / 1000).toFixed(2) }}s</strong>
                    </small>
                </div>
            </div>
        </div>

        <div v-if="errorMessage" class="alert alert-danger" role="alert"> {{ errorMessage }} </div>

        <div class="row gy-4">
            <div class="col-lg-7">
                <div class="leaderboard-section card shadow-sm h-100">
                    <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
                        <h4 class="mb-0">Leaderboard (Top {{ leaderboardLimit }})</h4>
                        <div v-if="canShowChartLeaderboard" class="btn-group btn-group-sm" role="group" aria-label="View toggle">
                            <button type="button" class="btn btn-outline-light" :class="{'active': !showLeaderboardAsChart}" @click="showLeaderboardAsChart = false" title="Table View">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-table" viewBox="0 0 16 16"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm15 2h-4v3h4zm0 4h-4v3h4zm0 4h-4v3h3a1 1 0 0 0 1-1zm-5 3v-3H6v3zm-5 0v-3H1v2a1 1 0 0 0 1 1zm-4-4h4V8H1zm0-4h4V4H1zm5-3v3h4V4zm4 4H6v3h4z"/></svg>
                            </button>
                            <button type="button" class="btn btn-outline-light" :class="{'active': showLeaderboardAsChart}" @click="showLeaderboardAsChart = true" title="Chart View">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-bar-chart-line-fill" viewBox="0 0 16 16"><path d="M11 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h1V7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7h1z"/></svg>
                            </button>
                        </div>
                         <small v-else class="text-light fst-italic">(Table view only for > {{MAX_PLAYERS_FOR_CHART_VIEW}} players)</small>
                    </div>
                    <div class="card-body">
                        <div v-if="isLoading && players.length === 0 && !isSimulating" class="d-flex justify-content-center align-items-center" style="min-height: 300px;">
                            <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"><span class="visually-hidden">Loading...</span></div>
                        </div>
                        <div v-else-if="!isSimulating && !isLoading && players.length === 0 && !errorMessage" class="alert alert-info">No players to display.</div>
                        
                        <div v-if="players.length > 0">
                            <div v-if="showLeaderboardAsChart && canShowChartLeaderboard && topPlayersChartData" style="height: 500px;">
                                <Bar :data="topPlayersChartData" :options="topPlayersChartOptions" />
                            </div>
                            <div v-if="!showLeaderboardAsChart || !canShowChartLeaderboard" class="table-responsive" style="max-height: 500px;">
                                <table class="table table-striped table-hover align-middle">
                                    <thead class="table-dark sticky-top">
                                        <tr><th>#</th><th>Player</th><th>Elo</th><th>Games</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(player, index) in players" :key="player.playerId" @click="goToPlayerProfile(player.playerId)" style="cursor: pointer;">
                                            <th scope="row">{{ index + 1 }}</th>
                                            <td>{{ player.playerName }}</td>
                                            <td>{{ player.elo.toFixed(0) }}</td>
                                            <td>{{ player.gamesPlayed }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-5">
                <div class="card shadow-sm h-100">
                    <div class="card-header bg-dark text-white"><h5 class="mb-0">Player Elo Distribution</h5></div>
                    <div class="card-body d-flex align-items-center justify-content-center">
                        <div v-if="isLoadingEloDistribution" class="text-center"><div class="spinner-border"></div></div>
                        <div v-else-if="eloDistError" class="alert alert-danger w-100">{{ eloDistError }}</div>
                        <EloDistributionChart v-if="eloDistributionData" :chartData="eloDistributionData" style="min-height: 300px; height: 100%; max-height: 500px;" />
                        <div v-else-if="!isLoadingEloDistribution && !eloDistributionData" class="alert alert-info w-100">No Elo distribution data.</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.leaderboard-view { max-width: 1600px; margin: auto; }
.controls-section .card-header, .leaderboard-section .card-header, .statistics-view .card-header {
    padding: 0.75rem 1.25rem;
}
.card-header h5, .card-header h4, .card-header h3 {
    margin-bottom: 0;
}
.sticky-top {
    top: -1px; 
}
.btn-group-sm > .btn {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>