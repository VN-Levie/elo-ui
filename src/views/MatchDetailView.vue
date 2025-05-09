// src/views/MatchDetailView.vue
<script setup>
import { ref, onMounted, watch, inject, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bar } from 'vue-chartjs';

const route = useRoute();
const router = useRouter();

const matchDetails = ref(null);
const isLoadingMatch = ref(false);
const errorMessage = ref('');
const highlightedPlayerId = ref(route.query.highlightedPlayerId || null);

const pbrConfig = inject('pbrConfig');
const isLoadingPbrConfig = inject('isLoadingPbrConfig');
const pbrConfigError = inject('pbrConfigError');

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

async function fetchMatchDetails(id) {
  isLoadingMatch.value = true;
  errorMessage.value = '';
  matchDetails.value = null;
  highlightedPlayerId.value = route.query.highlightedPlayerId || null;
  try {
    const response = await fetch(`${API_BASE_URL}/matches/${id}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    matchDetails.value = data.data || data;
  } catch (error) {
    console.error(`Failed to fetch match ${id}:`, error);
    errorMessage.value = `Failed to load match details: ${error.message}`;
  } finally {
    isLoadingMatch.value = false;
  }
}

function getKdaRatio(kda) {
  if (!kda || typeof kda.deaths !== 'number') return 'N/A';
  return ((kda.kills || 0) + (kda.assists || 0)) / Math.max(1, kda.deaths);
}

function calculatePlayerPerformanceGrade(playerData) {
  if (!pbrConfig.value || !pbrConfig.value.benchmarks || !pbrConfig.value.averageMatchDurationMinutes) { 
    return 'cfg?';
  }
  if (!playerData || !playerData.role || !playerData.kda || playerData.cs === undefined || playerData.gold === undefined) {
    return '-';
  }
  const benchmarks = pbrConfig.value.benchmarks;
  const avgDuration = pbrConfig.value.averageMatchDurationMinutes;
  const role = playerData.role;
  const benchmark = benchmarks[role] || benchmarks["Top"];
  if (!benchmark) return 'N/A';
  const playerKdaRatio = getKdaRatio(playerData.kda);
  const playerCsPerMin = playerData.cs / avgDuration;
  const playerGoldPerMin = playerData.gold / avgDuration;
  let performanceScore = 0;
  const weights = { kda: 0.4, cs: 0.3, gold: 0.3 };
  const kdaDiff = playerKdaRatio - benchmark.kdaRatio;
  performanceScore += (kdaDiff / 1.0) * weights.kda;
  let csBenchmarkValue = benchmark.csPerMin;
  if (role === "Jungle" && benchmark.totalCS_benchmark) {
      csBenchmarkValue = benchmark.totalCS_benchmark / avgDuration;
  }
  const csDiff = playerCsPerMin - csBenchmarkValue;
  performanceScore += (csDiff / 1.0) * weights.cs;
  const goldDiff = playerGoldPerMin - benchmark.goldPerMin;
  performanceScore += (goldDiff / 50) * weights.gold;
  if (performanceScore >= 1.2) return 'S+';
  if (performanceScore >= 0.8) return 'S';
  if (performanceScore >= 0.4) return 'A';
  if (performanceScore >= -0.2) return 'B';
  if (performanceScore >= -0.6) return 'C';
  return 'D';
}

const scoreboardData = computed(() => {
    if (!matchDetails.value) return null;
    const teamA = matchDetails.value.teamA.players;
    const teamB = matchDetails.value.teamB.players;
    const calculateTeamStats = (players) => {
        return {
            kills: players.reduce((sum, p) => sum + (p.kda?.kills || 0), 0),
            deaths: players.reduce((sum, p) => sum + (p.kda?.deaths || 0), 0),
            assists: players.reduce((sum, p) => sum + (p.kda?.assists || 0), 0),
            gold: players.reduce((sum, p) => sum + (p.gold || 0), 0),
            cs: players.reduce((sum, p) => sum + (p.cs || 0), 0),
            avgElo: matchDetails.value.teamA.avgEloBefore // This is a bit off, should be specific to team
        };
    };
    return {
        teamA: {...calculateTeamStats(teamA), avgElo: matchDetails.value.teamA.avgEloBefore},
        teamB: {...calculateTeamStats(teamB), avgElo: matchDetails.value.teamB.avgEloBefore},
        winningTeam: matchDetails.value.winningTeam
    };
});

const teamKdaChartData = computed(() => {
    if (!matchDetails.value) return null;
    const teamA = matchDetails.value.teamA;
    const teamB = matchDetails.value.teamB;
    const totalKillsA = teamA.players.reduce((sum, p) => sum + (p.kda?.kills || 0), 0);
    const totalDeathsA = teamA.players.reduce((sum, p) => sum + (p.kda?.deaths || 0), 0);
    const totalAssistsA = teamA.players.reduce((sum, p) => sum + (p.kda?.assists || 0), 0);
    const totalKillsB = teamB.players.reduce((sum, p) => sum + (p.kda?.kills || 0), 0);
    const totalDeathsB = teamB.players.reduce((sum, p) => sum + (p.kda?.deaths || 0), 0);
    const totalAssistsB = teamB.players.reduce((sum, p) => sum + (p.kda?.assists || 0), 0);
    return {
        labels: ['Kills', 'Deaths', 'Assists'],
        datasets: [
            {
                label: `Team A (${matchDetails.value.winningTeam === 'A' ? 'Winner' : 'Loser'})`,
                data: [totalKillsA, totalDeathsA, totalAssistsA],
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            },
            {
                label: `Team B (${matchDetails.value.winningTeam === 'B' ? 'Winner' : 'Loser'})`,
                data: [totalKillsB, totalDeathsB, totalAssistsB],
                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }
        ]
    };
});

const teamKdaChartOptions = ref({
    responsive: true, maintainAspectRatio: false,
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Count' } } },
    plugins: { title: { display: true, text: 'Team KDA Comparison', font: {size: 16}}, legend: { position: 'top' } }
});

const teamEconomyChartData = computed(() => {
    if (!matchDetails.value) return null;
    const teamA = matchDetails.value.teamA;
    const teamB = matchDetails.value.teamB;
    const totalGoldA = teamA.players.reduce((sum, p) => sum + (p.gold || 0), 0);
    const totalCsA = teamA.players.reduce((sum, p) => sum + (p.cs || 0), 0);
    const totalGoldB = teamB.players.reduce((sum, p) => sum + (p.gold || 0), 0);
    const totalCsB = teamB.players.reduce((sum, p) => sum + (p.cs || 0), 0);
    return {
        labels: ['Total Gold', 'Total CS'],
        datasets: [
            {
                label: `Team A (${matchDetails.value.winningTeam === 'A' ? 'Winner' : 'Loser'})`,
                data: [totalGoldA, totalCsA],
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            },
            {
                label: `Team B (${matchDetails.value.winningTeam === 'B' ? 'Winner' : 'Loser'})`,
                data: [totalGoldB, totalCsB],
                backgroundColor: 'rgba(255, 159, 64, 0.7)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1
            }
        ]
    };
});

const teamEconomyChartOptions = ref({
    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
    scales: { x: { beginAtZero: true, title: { display: true, text: 'Total Value' } } },
    plugins: { title: { display: true, text: 'Team Economy Comparison (Gold & CS)', font: {size: 16}}, legend: { position: 'top' } }
});

const allPlayersInMatchSorted = computed(() => {
    if (!matchDetails.value) return [];
    const playersA = matchDetails.value.teamA.players.map(p => ({ ...p, teamLetter: 'A', isWinner: matchDetails.value.winningTeam === 'A' }));
    const playersB = matchDetails.value.teamB.players.map(p => ({ ...p, teamLetter: 'B', isWinner: matchDetails.value.winningTeam === 'B' }));
    const roleOrder = { "Top": 1, "Jungle": 2, "Mid": 3, "ADC": 4, "Support": 5 };
    const combined = [...playersA, ...playersB];
    combined.sort((a, b) => {
        if (a.teamLetter < b.teamLetter) return -1;
        if (a.teamLetter > b.teamLetter) return 1;
        return (roleOrder[a.role] || 6) - (roleOrder[b.role] || 6);
    });
    return combined;
});

onMounted(() => { if (route.params.matchId) fetchMatchDetails(route.params.matchId); });
watch(() => route.query.highlightedPlayerId, (newVal) => { highlightedPlayerId.value = newVal || null; });
watch(() => route.params.matchId, (newId) => { if (newId) fetchMatchDetails(newId); });
</script>

<template>
  <div class="match-detail-view py-4">
    <div v-if="isLoadingPbrConfig && isLoadingMatch" class="alert alert-info">Loading PBR configuration and Match Details...</div>
    <div v-else-if="isLoadingPbrConfig" class="alert alert-info">Loading PBR configuration...</div>
    <div v-if="pbrConfigError && !isLoadingPbrConfig" class="alert alert-danger"> PBR Configuration Error: {{ pbrConfigError }} </div>

    <div v-if="isLoadingMatch" class="text-center py-5">
      <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"><span class="visually-hidden">Loading...</span></div>
      <p class="mt-2 lead">Loading Match Details...</p>
    </div>
    <div v-else-if="errorMessage" class="alert alert-danger" role="alert">
      <h4>Error Loading Match</h4> <p>{{ errorMessage }}</p>
      <button @click="fetchMatchDetails(route.params.matchId)" class="btn btn-warning btn-sm">Try Again</button>
    </div>
    
    <div v-else-if="matchDetails && pbrConfig">
        <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
            <div>
                <h1 class="display-6">Match: {{ matchDetails.matchId }}</h1>
                <small class="text-muted">Played on: {{ new Date(matchDetails.timestamp).toLocaleString() }}</small>
            </div>
            <span :class="['badge fs-4 p-2 shadow-sm', matchDetails.winningTeam === 'A' ? 'bg-primary text-white' : 'bg-danger text-white']">
                TEAM {{ matchDetails.winningTeam }} VICTORY
            </span>
        </div>

        <!-- Unified Scoreboard Section -->
        <div v-if="scoreboardData" class="card shadow-sm mb-4 scoreboard-unified">
            <div class="card-header bg-dark text-white">
                <h3 class="mb-0 text-center">Match Scoreboard</h3>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-bordered text-center align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th scope="col" :class="['team-a-header', scoreboardData.winningTeam === 'A' ? 'team-winner-header' : '']">
                                TEAM A 
                                <small class="d-block">(Avg Elo: {{ scoreboardData.teamA.avgElo?.toFixed(0) || 'N/A' }})</small>
                                <span v-if="scoreboardData.winningTeam === 'A'" class="badge bg-success-subtle text-success-emphasis mt-1">WINNER</span>
                            </th>
                            <th scope="col" class="stat-category-header">Statistic</th>
                            <th scope="col" :class="['team-b-header', scoreboardData.winningTeam === 'B' ? 'team-winner-header' : '']">
                                TEAM B
                                <small class="d-block">(Avg Elo: {{ scoreboardData.teamB.avgElo?.toFixed(0) || 'N/A' }})</small>
                                <span v-if="scoreboardData.winningTeam === 'B'" class="badge bg-success-subtle text-success-emphasis mt-1">WINNER</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr :class="{'fw-bold': scoreboardData.teamA.kills > scoreboardData.teamB.kills && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.kills > scoreboardData.teamA.kills && scoreboardData.winningTeam === 'B'}">
                            <td :class="{'text-primary': scoreboardData.teamA.kills > scoreboardData.teamB.kills}">{{ scoreboardData.teamA.kills }}</td>
                            <th scope="row" class="stat-label">Total Kills</th>
                            <td :class="{'text-danger': scoreboardData.teamB.kills > scoreboardData.teamA.kills}">{{ scoreboardData.teamB.kills }}</td>
                        </tr>
                        <tr class="bg-light-subtle" :class="{'fw-bold': scoreboardData.teamA.deaths < scoreboardData.teamB.deaths && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.deaths < scoreboardData.teamA.deaths && scoreboardData.winningTeam === 'B'}">
                            <td class="text-danger" :class="{'text-primary': scoreboardData.teamA.deaths < scoreboardData.teamB.deaths}">{{ scoreboardData.teamA.deaths }}</td>
                            <th scope="row" class="stat-label text-danger">Total Deaths</th>
                            <td class="text-danger" :class="{'text-danger': scoreboardData.teamB.deaths < scoreboardData.teamA.deaths}">{{ scoreboardData.teamB.deaths }}</td>
                        </tr>
                        <tr :class="{'fw-bold': scoreboardData.teamA.assists > scoreboardData.teamB.assists && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.assists > scoreboardData.teamA.assists && scoreboardData.winningTeam === 'B'}">
                            <td :class="{'text-primary': scoreboardData.teamA.assists > scoreboardData.teamB.assists}">{{ scoreboardData.teamA.assists }}</td>
                            <th scope="row" class="stat-label">Total Assists</th>
                            <td :class="{'text-danger': scoreboardData.teamB.assists > scoreboardData.teamA.assists}">{{ scoreboardData.teamB.assists }}</td>
                        </tr>
                        <tr class="bg-light-subtle" :class="{'fw-bold': scoreboardData.teamA.gold > scoreboardData.teamB.gold && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.gold > scoreboardData.teamA.gold && scoreboardData.winningTeam === 'B'}">
                            <td :class="{'text-primary': scoreboardData.teamA.gold > scoreboardData.teamB.gold}">{{ scoreboardData.teamA.gold.toLocaleString() }}</td>
                            <th scope="row" class="stat-label">Total Gold</th>
                            <td :class="{'text-danger': scoreboardData.teamB.gold > scoreboardData.teamA.gold}">{{ scoreboardData.teamB.gold.toLocaleString() }}</td>
                        </tr>
                        <tr :class="{'fw-bold': scoreboardData.teamA.cs > scoreboardData.teamB.cs && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.cs > scoreboardData.teamA.cs && scoreboardData.winningTeam === 'B'}">
                            <td :class="{'text-primary': scoreboardData.teamA.cs > scoreboardData.teamB.cs}">{{ scoreboardData.teamA.cs }}</td>
                            <th scope="row" class="stat-label">Total CS</th>
                            <td :class="{'text-danger': scoreboardData.teamB.cs > scoreboardData.teamA.cs}">{{ scoreboardData.teamB.cs }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="row mb-4 gy-3">
            <div class="col-lg-6">
                <div class="card shadow-sm"><div class="card-body">
                        <div v-if="teamKdaChartData" style="height: 280px;"><Bar :data="teamKdaChartData" :options="teamKdaChartOptions" /></div>
                        <div v-else class="text-center text-muted small p-3">KDA comparison data not available.</div>
                </div></div>
            </div>
            <div class="col-lg-6">
                 <div class="card shadow-sm"><div class="card-body">
                        <div v-if="teamEconomyChartData" style="height: 280px;"><Bar :data="teamEconomyChartData" :options="teamEconomyChartOptions" /></div>
                        <div v-else class="text-center text-muted small p-3">Economy comparison data not available.</div>
                </div></div>
            </div>
        </div>

        <div class="card shadow-sm">
            <div class="card-header bg-secondary text-white"><h4 class="mb-0 text-center">Player Performance Breakdown</h4></div>
            <div class="table-responsive">
                <table class="table table-striped table-hover table-bordered align-middle mb-0 match-players-table">
                    <thead class="table-dark text-center"><tr><th>Team</th><th>Player</th><th>Champion</th><th>Role</th><th>KDA</th><th>CS</th><th>Gold</th><th>Elo +/-</th><th>Grade</th></tr></thead>
                    <tbody class="text-center">
                        <template v-for="player in allPlayersInMatchSorted" :key="player.playerId">
                            <tr :class="{ 'highlight-player': player.playerId === highlightedPlayerId, 'table-row-clickable': true, 'team-a-row': player.teamLetter === 'A', 'team-b-row': player.teamLetter === 'B' }"
                                @click="router.push({ name: 'PlayerProfile', params: { playerId: player.playerId }})">
                                <td :class="player.isWinner ? 'text-success-emphasis' : 'text-danger-emphasis'">
                                    <strong>Team {{ player.teamLetter }}</strong>
                                    <span v-if="player.isWinner" class="d-block small fst-italic">(Winner)</span>
                                </td>
                                <td>{{ player.playerName }}</td>
                                <td>
                                    <img v-if="player.championName" :src="`https://ddragon.leagueoflegends.com/cdn/14.4.1/img/champion/${player.championId}.png`" :alt="player.championName" width="24" height="24" class="me-1 rounded-circle champ-icon" @error="($event.target.style.display='none')">
                                    {{ player.championName }}
                                </td>
                                <td>{{ player.role }}</td>
                                <td>{{ player.kda.kills }}/<span class="text-danger fw-bold">{{ player.kda.deaths }}</span>/{{ player.kda.assists }} <small class="d-block text-muted">({{ getKdaRatio(player.kda).toFixed(2) }})</small></td>
                                <td>{{ player.cs }}</td>
                                <td>{{ player.gold.toLocaleString() }}</td>
                                <td :class="{'text-success': player.eloChange > 0, 'text-danger': player.eloChange < 0, 'fw-bold':true}">
                                    {{ player.eloChange >= 0 ? '+' : '' }}{{ player.eloChange.toFixed(0) }}
                                </td>
                                <td><strong class="fs-5">{{ calculatePlayerPerformanceGrade(player) }}</strong></td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="text-center mt-4">
             <button @click="router.back()" class="btn btn-outline-secondary px-4 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left me-2" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"/></svg>
                Go Back
            </button>
        </div>
    </div>
    <div v-else-if="!isLoadingMatch && !isLoadingPbrConfig && !pbrConfigError" class="alert alert-warning text-center">
        Match data could not be loaded or does not exist.
    </div>
  </div>
</template>

<style scoped>
.match-detail-view { max-width: 1600px; margin-left: auto; margin-right: auto; }
.champ-icon { border: 1px solid #ddd; background-color: #212529; }
.highlight-player td { background-color: #fff3cd !important; }
.table-row-clickable:hover td { cursor: pointer; background-color: #e9ecef; }
.badge.fs-4 { font-size: 1.25rem !important; }
.bg-light-subtle { background-color: #fcfcfd !important; }

/* Unified Scoreboard Styles */
.scoreboard-unified .card-header { border-bottom: 2px solid #343a40; }
.scoreboard-unified thead.table-light th {
    background-color: #e9ecef; /* Lighter header for categories */
    font-weight: 600;
    border-bottom-width: 2px;
}
.scoreboard-unified .team-a-header { color: #0d6efd; /* Bootstrap Primary */ }
.scoreboard-unified .team-b-header { color: #dc3545; /* Bootstrap Danger */ }
.scoreboard-unified .team-winner-header { font-weight: bold; /* background-color: #d1e7dd; Bootstrap success-subtle */ }

.scoreboard-unified tbody th.stat-label { /* Statistic Category (Kills, Gold, etc.) */
    font-weight: 500;
    background-color: #f8f9fa;
    width: 20%; /* Adjust as needed */
}
.scoreboard-unified tbody td { /* Stat values for Team A and Team B */
    font-size: 1.1rem;
    font-weight: bold;
    width: 40%; /* Adjust as needed */
}
.scoreboard-unified tr:nth-child(even) th.stat-label { /* Zebra striping for stat labels */
    background-color: #efefef;
}


/* Player Performance Breakdown Table Styles */
.match-players-table th, .match-players-table td { font-size: 0.9rem; padding: 0.75rem 0.5rem; }
.match-players-table thead.table-dark th { border-bottom-width: 0; }
.team-a-row td:first-child { border-left: 4px solid rgba(54, 162, 235, 0.7); }
.team-b-row td:first-child { border-left: 4px solid rgba(255, 99, 132, 0.7); }
</style>