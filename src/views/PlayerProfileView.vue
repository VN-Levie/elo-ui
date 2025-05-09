<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EloHistoryChart from '../components/charts/EloHistoryChart.vue';
import { Doughnut, Radar } from 'vue-chartjs'; // Added Radar
import { STANDARD_ROLES } from '../../config/constants.js'; // Assuming you have this for role radar chart

const route = useRoute();
const router = useRouter();

const player = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

async function fetchPlayerProfile(id) {
    isLoading.value = true;
    errorMessage.value = '';
    player.value = null;
    try {
        const response = await fetch(`${API_BASE_URL}/players/${id}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        player.value = data.data || data;
    } catch (error) {
        console.error(`Failed to fetch player ${id}:`, error);
        errorMessage.value = `Failed to load player profile: ${error.message}`;
    } finally {
        isLoading.value = false;
    }
}

const kdaRatio = (kda) => {
    if (!kda || typeof kda.deaths !== 'number') return 'N/A';
    return ((kda.kills || 0) + (kda.assists || 0)) / Math.max(1, kda.deaths);
};

const sortedMatchHistory = computed(() => {
    if (!player.value || !player.value.matchHistory) return [];
    return player.value.matchHistory;
});

const eloChartData = computed(() => {
    if (!player.value || !player.value.matchHistory || player.value.matchHistory.length < 2) { // Need at least 2 points for a line
        return { labels: [], datasets: [{ data: [] }] };
    }
    const reversedHistory = [...player.value.matchHistory];
    let eloPoints = [];
    let eloTracker = player.value.elo;
    eloPoints.push(eloTracker);
    for (let i = 0; i < reversedHistory.length - 1; i++) {
        const match = reversedHistory[i];
        eloTracker -= match.eloChange;
        eloPoints.push(eloTracker);
    }
    eloPoints.reverse();
    const chartLabels = player.value.matchHistory.map((_, index) => `M${player.value.gamesPlayed - player.value.matchHistory.length + index + 1}`).reverse();
    return {
        labels: chartLabels,
        datasets: [{
            label: 'Elo Rating', backgroundColor: 'rgba(54, 162, 235, 0.2)', borderColor: 'rgb(54, 162, 235)',
            data: eloPoints, fill: true, tension: 0.1, pointRadius: 2, pointHoverRadius: 4
        }]
    };
});

const winLossChartData = computed(() => {
    if (!player.value || !player.value.matchHistory || player.value.matchHistory.length === 0) return null;
    let wins = 0; let losses = 0;
    player.value.matchHistory.forEach(match => {
        if (match.result === 'win') wins++; else if (match.result === 'loss') losses++;
    });
    if (wins === 0 && losses === 0) return null;
    return {
        labels: [`Wins (${wins})`, `Losses (${losses})`],
        datasets: [{ backgroundColor: ['#28a745', '#dc3545'], data: [wins, losses] }]
    };
});

const winLossChartOptions = ref({
    responsive: true, maintainAspectRatio: false, cutout: '70%',
    plugins: { legend: { display: true, position: 'bottom', labels: { padding: 15 } }, title: { display: false } }
});


const rolePerformanceChartData = computed(() => {
    if (!player.value || !player.value.matchHistory || player.value.matchHistory.length === 0) return null;
    const roleStats = {};
    STANDARD_ROLES.forEach(role => { roleStats[role] = { wins: 0, games: 0 }; });
    player.value.matchHistory.forEach(match => {
        if (match.role && roleStats[match.role]) {
            roleStats[match.role].games++;
            if (match.result === 'win') roleStats[match.role].wins++;
        }
    });
    const labels = STANDARD_ROLES.filter(role => roleStats[role].games > 2); // Min 3 games for radar
    if (labels.length < 3) return null;
    const winRates = labels.map(role => (roleStats[role].games > 0 ? (roleStats[role].wins / roleStats[role].games) * 100 : 0));
    return {
        labels: labels,
        datasets: [{
            label: 'Win Rate (%) by Role', data: winRates,
            backgroundColor: 'rgba(255, 99, 132, 0.2)', borderColor: 'rgb(255, 99, 132)',
            pointBackgroundColor: 'rgb(255, 99, 132)', pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff', pointHoverBorderColor: 'rgb(255, 99, 132)'
        }]
    };
});
const rolePerformanceChartOptions = ref({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        r: {
            angleLines: {
                display: true,
                color: "rgba(200,170,110,0.18)" // vàng kim cho lưới trục góc
            },
            grid: {
                color: "rgba(200,170,110,0.18)" // vàng kim cho lưới trục tròn
            },
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: {
                backdropColor: 'transparent',
                stepSize: 25
            },
            pointLabels: {
                font: { size: 13 }
            }
        }
    },
    plugins: {
        title: { display: false },
        legend: { display: false }
    }
});



function goToMatchDetail(matchId) {
    if (matchId && player.value) { // Ensure player.value is available for playerId
        router.push({
            name: 'MatchDetail',
            params: { matchId: matchId },
            query: { highlightedPlayerId: player.value.playerId } // <<<< ADD THIS
        });
    }
}


onMounted(() => { if (route.params.playerId) fetchPlayerProfile(route.params.playerId); });
watch(() => route.params.playerId, (newId) => { if (newId) fetchPlayerProfile(newId); });
</script>

<template>
    <div class="player-profile-view py-4">
        <div v-if="isLoading" class="text-center py-5">
            <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading profile...</span>
            </div>
            <p class="mt-2 lead">Loading player profile...</p>
        </div>
        <div v-else-if="errorMessage" class="alert alert-danger" role="alert">
            <h4>Error Loading Profile</h4>
            <p>{{ errorMessage }}</p>
            <button @click="fetchPlayerProfile(route.params.playerId)" class="btn btn-warning btn-sm">Try Again</button>
        </div>
        <div v-else-if="player">
            <!-- Player Header -->
            <div class="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
                <div>
                    <h1 class="display-5">{{ player.playerName }}</h1>
                    <p class="text-muted mb-0">Player ID: {{ player.playerId }}</p>
                </div>
                <button @click="router.back()" class="btn btn-outline-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left-circle me-1" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-4.5-.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5z" />
                    </svg>
                    Back
                </button>
            </div>

            <!-- Player Summary Row -->
            <div class="row mb-4 gy-3">
                <div class="col-lg-8">
                    <div class="card shadow-sm h-100">
                        <div class="card-body">
                            <h5 class="card-title text-primary mb-3">Player Statistics</h5>
                            <div class="row">
                                <div class="col-sm-6 col-md-3 mb-2 mb-md-0">
                                    <div class="stat-item text-center p-2 border rounded">
                                        <h6 class="text-muted small">ELO RATING</h6>
                                        <p class="fs-4 fw-bold mb-0">{{ player.elo.toFixed(0) }}</p>
                                    </div>
                                </div>
                                <div class="col-sm-6 col-md-3 mb-2 mb-md-0">
                                    <div class="stat-item text-center p-2 border rounded">
                                        <h6 class="text-muted small">GAMES PLAYED</h6>
                                        <p class="fs-4 fw-bold mb-0">{{ player.gamesPlayed }}</p>
                                    </div>
                                </div>
                                <div class="col-sm-6 col-md-3 mb-2 mb-md-0">
                                    <div class="stat-item text-center p-2 border rounded">
                                        <h6 class="text-muted small">WIN STREAK</h6>
                                        <p class="fs-4 fw-bold mb-0 text-success">{{ player.currentWinStreak || 0 }}</p>
                                    </div>
                                </div>
                                <div class="col-sm-6 col-md-3">
                                    <div class="stat-item text-center p-2 border rounded">
                                        <h6 class="text-muted small">LOSS STREAK</h6>
                                        <p class="fs-4 fw-bold mb-0 text-danger">{{ player.currentLossStreak || 0 }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="card shadow-sm h-100">
                        <div class="card-body d-flex flex-column justify-content-center align-items-center">
                            <h5 class="card-title text-primary mb-3">Win/Loss (Last {{ sortedMatchHistory.length }})</h5>
                            <div v-if="winLossChartData" style="position: relative; height:180px; width:180px;">
                                <Doughnut :data="winLossChartData" :options="winLossChartOptions" />
                            </div>
                            <div v-else class="text-muted small mt-3">Not enough data for Win/Loss chart.</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Elo Progression & Role Performance Row -->
            <div class="card  mb-4 gy-3">
                <div class="row">
                    <div class="col-lg-8">
                        <div class=" shadow-sm">
                            <div class="card-body">
                                <h5 class="card-title text-primary mb-3">Elo Progression (Last {{ sortedMatchHistory.length }} Games)</h5>
                                <div v-if="eloChartData.datasets[0].data.length > 1">
                                    <EloHistoryChart :chartData="eloChartData" />
                                </div>
                                <div v-else-if="player.gamesPlayed > 0" class="alert alert-light text-center small p-3">
                                    Play at least 2 games with recorded history to see Elo progression.
                                </div>
                                <div v-else class="alert alert-light text-center small p-3">
                                    No match history for Elo progression chart.
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class=" shadow-sm h-100">
                            <div class="card-body d-flex flex-column justify-content-center align-items-center">
                                <h5 class="card-title text-primary mb-3">Role Win Rate (%)</h5>
                                <div v-if="rolePerformanceChartData" class="chart-container" style="position: relative; height:250px; width:100%;">
                                    <Radar :data="rolePerformanceChartData" :options="rolePerformanceChartOptions" />
                                </div>
                                <div v-else class="text-muted small mt-3">Not enough data (min 3 games per role, 3 roles played) for Role Performance chart.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            <!-- Match History Table -->
            <div class="card shadow-sm">
                <div class="card-header">
                    <h4 class="mb-0 text-primary">Match History</h4>
                    <h6 class="text-muted mb-0">
                        Click on a match to view details.
                    </h6>
                </div>
                <div class="card-body">
                    <div v-if="sortedMatchHistory.length === 0" class="alert alert-info mt-0">No match history available for this player.</div>
                    <div v-else class="table-responsive" style="max-height: 80vh;">
                        <table class="table table-sm table-hover align-middle lol-table">
                            <thead class="table-dark sticky-top">
                                <tr>
                                    <th>Match ID</th>
                                    <th>Champion</th>
                                    <th>Role</th>
                                    <th>Result</th>
                                    <th>Elo +/-</th>
                                    <th>KDA</th>
                                    <th>CS</th>
                                    <th>Gold</th>
                                    <th>Played on</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="match in sortedMatchHistory" :key="match.matchId || match.timestamp" @click="goToMatchDetail(match.matchId)" :class="{ 'table-row-clickable': match.matchId }">
                                    <td>
                                        <small>{{ match.matchId || 'N/A' }}</small> <i class="fa-solid fa-eye"></i>
                                    </td>
                                    <td>
                                        <img v-if="match.championPlayed && match.championPlayed.championId" :src="`https://ddragon.leagueoflegends.com/cdn/14.4.1/img/champion/${match.championPlayed.championId}.png`" :alt="match.championPlayed.championName" width="24" height="24" class="me-1 rounded-circle champion-icon-fallback" @error="($event.target.style.display = 'none')">
                                        {{ match.championPlayed?.championName || 'N/A' }}
                                    </td>
                                    <td>{{ match.role || 'N/A' }}</td>
                                    <td :class="{ 'text-success fw-bold': match.result === 'win', 'text-danger fw-bold': match.result === 'loss' }">
                                        {{ match.result === 'win' ? 'Victory' : 'Defeat' }}
                                    </td>
                                    <td :class="{ 'text-success': match.eloChange > 0, 'text-danger': match.eloChange < 0 }">
                                        {{ match.eloChange >= 0 ? '+' : '' }}{{ match.eloChange?.toFixed(1) }}
                                        <small v-if="match.streakInfo && match.streakInfo.adjustmentValue !== 0" :class="{ 'text-success-emphasis': match.streakInfo.adjustmentValue > 0, 'text-danger-emphasis': match.streakInfo.adjustmentValue < 0 }" class="d-block fst-italic">
                                            ({{ match.streakInfo.type === 'win' ? 'W' : 'L' }}{{ match.streakInfo.count }}: {{ match.streakInfo.adjustmentValue > 0 ? '+' : '' }}{{ match.streakInfo.adjustmentValue.toFixed(1) }})
                                        </small>
                                    </td>
                                    <td>
                                        {{ match.kda?.kills || 0 }}/<span class="text-danger">{{ match.kda?.deaths || 0 }}</span>/{{ match.kda?.assists || 0 }}
                                        <small class="d-block text-muted">({{ kdaRatio(match.kda).toFixed(2) }} KDA)</small>
                                    </td>
                                    <td>{{ match.cs || 0 }}</td>
                                    <td>{{ (match.gold || 0).toLocaleString() }}</td>
                                    <td>
                                        <small>{{ new Date(match.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) }}</small>
                                        <br>
                                        <small>{{ new Date(match.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }}</small>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
        <div v-else-if="!isLoading" class="alert alert-warning text-center">
            Player data could not be loaded or does not exist.
        </div>
    </div>
</template>

<style scoped>
.player-profile-view {
    max-width: 1320px;
    /* Bootstrap's xxl container width */
    margin-left: auto;
    margin-right: auto;
}

.stat-item h6 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.champion-icon-fallback {
    /* Basic style for champion icons, can be improved */
    background-color: var(--lol-primary);
    border: 1px solid var(--lol-gold-dark);
}

.card-header {
    background: linear-gradient(90deg, var(--lol-primary) 80%, rgba(11, 198, 227, 0.08) 100%);
    color: var(--lol-accent);
    letter-spacing: 1px;
    font-weight: 600;
}

.card-header h4,
.card-header h5 {
    color: var(--lol-accent);
    text-shadow: 0 0 6px rgba(11, 198, 227, 0.18);
}

.card-header,
.card-header h4,
.card-header h5,
.btn,
.lol-button,
.lol-textbox,
.lol-dropdown {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
}

/* Đảm bảo pagination controls dùng font và màu LoL nếu có */
.pagination,
.page-link {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    letter-spacing: 1px;
}
</style>
