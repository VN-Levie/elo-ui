<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router'; // Import useRouter
import EloDistributionChart from '../components/charts/EloDistributionChart.vue';
const eloDistributionData = ref(null);
const isLoadingEloDistribution = ref(false);

const router = useRouter(); // Initialize router

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

const API_BASE_URL = 'http://localhost:3000/api'; // Adjust if your backend runs elsewhere
async function fetchEloDistribution() {
    isLoadingEloDistribution.value = true;
    try {
        const response = await fetch(`${API_BASE_URL}/stats/elo-distribution`); // API endpoint
        if (!response.ok) throw new Error('Failed to fetch Elo distribution');
        const result = await response.json();
        if (result.success) {
            eloDistributionData.value = result.data;
        }
    } catch (error) {
        console.error(error);
        // Handle error display
    } finally {
        isLoadingEloDistribution.value = false;
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

        console.log('Matches simulated:', result.message);
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

watch(leaderboardLimit, (newValue, oldValue) => {
    if (newValue !== oldValue && !isLoading.value) {
        fetchPlayers();
    }
});

onMounted(async () => {
    isLoading.value = true;
    await fetchPlayers();
    await fetchEloDistribution();
    isLoading.value = false;
});
</script>

<template>
    <div>
        <header class="mb-4 p-3 bg-light rounded-3">
            <h2>Simulation Controls & Leaderboard</h2>
            <p>Control match simulations and view player rankings.</p>
        </header>

        <div class="controls-section card card-body mb-4">
            <div class="row gy-2 gx-3 align-items-end">
                <div class="col-md-auto">
                    <label for="simulateCountInput" class="form-label">Matches to Simulate (1-500):</label>
                    <input type="number" class="form-control" id="simulateCountInput" v-model.number="simulateCount" min="1" max="500" style="width: 180px;" :disabled="isSimulating">
                </div>
                <div class="col-md-auto">
                    <button @click="simulateMatches" class="btn btn-primary " :disabled="isSimulating || isLoading">
                        <span v-if="isSimulating" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        {{ isSimulating ? `Simulating (${simulationTimerDisplay})...` : `Simulate ${simulateCount} Matches` }}
                    </button>
                </div>
                <div class="col-md-auto">
                    <label for="leaderboardLimitSelect" class="form-label">Show Top:</label>
                    <select class="form-select" id="leaderboardLimitSelect" v-model.number="leaderboardLimit" style="width: 100px;" :disabled="isSimulating || isLoading">
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
            <div class="row mt-2">
                <div class="col">
                    <small v-if="simulationTime > 0 && !isSimulating" class="text-muted">
                        Last simulation for {{ simulateCount }} matches took: <strong>{{ (simulationTime / 1000).toFixed(2) }}s</strong>
                    </small>
                    <small v-if="isSimulating" class="text-primary">
                        Current simulation running for: <strong>{{ simulationTimerDisplay }}</strong>
                    </small>
                </div>
            </div>
        </div>


        <div v-if="errorMessage" class="alert alert-danger" role="alert">
            {{ errorMessage }}
        </div>

        <div class="leaderboard-section card">
            <div class="card-header">
                <h3>Leaderboard (Top {{ leaderboardLimit }})</h3>
            </div>
            <div class="card-body">
                <div v-if="isLoading && players.length === 0 && !isSimulating" class="text-center py-5">
                    <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading players...</p>
                </div>

                <div v-else-if="!isSimulating && !isLoading && players.length === 0 && !errorMessage" class="alert alert-info">
                    No players to display. Try initializing the system or simulating matches.
                </div>

                <div v-else-if="players.length > 0" class="table-responsive">
                    <table class="table table-striped table-hover align-middle">
                        <thead class="table-dark">
                            <tr>
                                <th scope="col"># Rank</th>
                                <th scope="col">Player Name</th>
                                <th scope="col">Elo</th>
                                <th scope="col">Games Played</th>
                            </tr>
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
                <div v-if="isLoadingEloDistribution">Loading Elo Distribution...</div>
                <EloDistributionChart v-if="eloDistributionData" :chartData="eloDistributionData" class="mt-4 card card-body" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.controls-section,
.leaderboard-section {
    margin-bottom: 2rem;
}

.table-responsive {
    max-height: 60vh;
    /* Example max height for scrollable table */
}
</style>