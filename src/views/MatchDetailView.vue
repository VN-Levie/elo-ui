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
        teamA: { ...calculateTeamStats(teamA), avgElo: matchDetails.value.teamA.avgEloBefore },
        teamB: { ...calculateTeamStats(teamB), avgElo: matchDetails.value.teamB.avgEloBefore },
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
    plugins: { title: { display: true, text: 'Team KDA Comparison', font: { size: 16 } }, legend: { position: 'top' } }
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
    plugins: { title: { display: true, text: 'Team Economy Comparison (Gold & CS)', font: { size: 16 } }, legend: { position: 'top' } }
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

const highlightedPlayer = computed(() => {
    if (!highlightedPlayerId.value || !matchDetails.value) return null;
    const allPlayers = [
        ...matchDetails.value.teamA.players.map(p => ({ ...p, teamLetter: 'A' })),
        ...matchDetails.value.teamB.players.map(p => ({ ...p, teamLetter: 'B' }))
    ];
    return allPlayers.find(p => String(p.playerId) === String(highlightedPlayerId.value)) || null;
});
const highlightedPlayerVictory = computed(() => {
    if (!highlightedPlayer.value || !matchDetails.value) return null;
    return highlightedPlayer.value.teamLetter === matchDetails.value.winningTeam;
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
            <h4>Error Loading Match</h4>
            <p>{{ errorMessage }}</p>
            <button @click="fetchMatchDetails(route.params.matchId)" class="btn btn-warning btn-sm">Try Again</button>
        </div>

        <div v-else-if="matchDetails && pbrConfig">
            <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                <div>
                    <h1 class="display-6">Match: {{ matchDetails.matchId }}</h1>
                    <small class="text-muted">Played on: {{ new Date(matchDetails.timestamp).toLocaleString() }}</small>
                </div>
                <span class="lol-victory-badge" :class="{
                    'lol-victory-a': highlightedPlayer ? highlightedPlayerVictory : false,
                    'lol-victory-b': highlightedPlayer ? highlightedPlayerVictory === false : false
                }">
                    <template v-if="!highlightedPlayer">
                        Game Report
                    </template>
                    <template v-else>
                        {{ highlightedPlayerVictory ? 'VICTORY' : 'DEFEAT' }}
                    </template>
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
                                    <span v-if="scoreboardData.winningTeam === 'A'" class="badge bg-success-subtle text-success-emphasis mt-1">VICTORY</span>
                                    <span v-if="scoreboardData.winningTeam === 'B'" class="badge bg-danger-subtle text-danger-emphasis mt-1">DEFEAT</span>
                                </th>
                                <th scope="col" class="stat-category-header">Statistic</th>
                                <th scope="col" :class="['team-b-header', scoreboardData.winningTeam === 'B' ? 'team-winner-header' : '']">
                                    TEAM B
                                    <small class="d-block">(Avg Elo: {{ scoreboardData.teamB.avgElo?.toFixed(0) || 'N/A' }})</small>
                                    <span v-if="scoreboardData.winningTeam === 'B'" class="badge bg-success-subtle text-success-emphasis mt-1">VICTORY</span>
                                    <span v-if="scoreboardData.winningTeam === 'A'" class="badge bg-danger-subtle text-danger-emphasis mt-1">DEFEAT</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr :class="{ 'fw-bold': scoreboardData.teamA.kills > scoreboardData.teamB.kills && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.kills > scoreboardData.teamA.kills && scoreboardData.winningTeam === 'B' }">
                                <td :class="{ 'text-primary': scoreboardData.teamA.kills > scoreboardData.teamB.kills }">{{ scoreboardData.teamA.kills }}</td>
                                <th scope="row" class="stat-label">Total Kills</th>
                                <td :class="{ 'text-danger': scoreboardData.teamB.kills > scoreboardData.teamA.kills }">{{ scoreboardData.teamB.kills }}</td>
                            </tr>
                            <tr class="" :class="{ 'fw-bold': scoreboardData.teamA.deaths < scoreboardData.teamB.deaths && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.deaths < scoreboardData.teamA.deaths && scoreboardData.winningTeam === 'B' }">
                                <td class="text-danger" :class="{ 'text-primary': scoreboardData.teamA.deaths < scoreboardData.teamB.deaths }">{{ scoreboardData.teamA.deaths }}</td>
                                <th scope="row" class="stat-label text-danger">Total Deaths</th>
                                <td class="text-danger" :class="{ 'text-danger': scoreboardData.teamB.deaths < scoreboardData.teamA.deaths }">{{ scoreboardData.teamB.deaths }}</td>
                            </tr>
                            <tr :class="{ 'fw-bold': scoreboardData.teamA.assists > scoreboardData.teamB.assists && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.assists > scoreboardData.teamA.assists && scoreboardData.winningTeam === 'B' }">
                                <td :class="{ 'text-primary': scoreboardData.teamA.assists > scoreboardData.teamB.assists }">{{ scoreboardData.teamA.assists }}</td>
                                <th scope="row" class="stat-label">Total Assists</th>
                                <td :class="{ 'text-danger': scoreboardData.teamB.assists > scoreboardData.teamA.assists }">{{ scoreboardData.teamB.assists }}</td>
                            </tr>
                            <tr class="" :class="{ 'fw-bold': scoreboardData.teamA.gold > scoreboardData.teamB.gold && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.gold > scoreboardData.teamA.gold && scoreboardData.winningTeam === 'B' }">
                                <td :class="{ 'text-primary': scoreboardData.teamA.gold > scoreboardData.teamB.gold }">{{ scoreboardData.teamA.gold.toLocaleString() }}</td>
                                <th scope="row" class="stat-label">Total Gold</th>
                                <td :class="{ 'text-danger': scoreboardData.teamB.gold > scoreboardData.teamA.gold }">{{ scoreboardData.teamB.gold.toLocaleString() }}</td>
                            </tr>
                            <tr :class="{ 'fw-bold': scoreboardData.teamA.cs > scoreboardData.teamB.cs && scoreboardData.winningTeam === 'A' || scoreboardData.teamB.cs > scoreboardData.teamA.cs && scoreboardData.winningTeam === 'B' }">
                                <td :class="{ 'text-primary': scoreboardData.teamA.cs > scoreboardData.teamB.cs }">{{ scoreboardData.teamA.cs }}</td>
                                <th scope="row" class="stat-label">Total CS</th>
                                <td :class="{ 'text-danger': scoreboardData.teamB.cs > scoreboardData.teamA.cs }">{{ scoreboardData.teamB.cs }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="row mb-4 gy-3">
                <div class="col-lg-6">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div v-if="teamKdaChartData" style="height: 280px;">
                                <Bar :data="teamKdaChartData" :options="teamKdaChartOptions" />
                            </div>
                            <div v-else class="text-center text-muted small p-3">KDA comparison data not available.</div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div v-if="teamEconomyChartData" style="height: 280px;">
                                <Bar :data="teamEconomyChartData" :options="teamEconomyChartOptions" />
                            </div>
                            <div v-else class="text-center text-muted small p-3">Economy comparison data not available.</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card shadow-sm">
                <div class="card-header bg-secondary text-white">
                    <h4 class="mb-0 text-center">Player Performance Breakdown</h4>
                    <h6 class="text-muted mb-0 text-center">
                        Click on a player's name to view their profile.
                    </h6>
                </div>
                <div class="table-responsive">
                    <table class="table table-striped table-hover table-bordered align-middle mb-0 match-players-table">
                        <thead class="table-dark text-center">
                            <tr>
                                <th>Team</th>
                                <th>Player</th>
                                <th>Champion</th>
                                <th>Role</th>
                                <th>KDA</th>
                                <th>CS</th>
                                <th>Gold</th>
                                <th>Elo +/-</th>
                                <th>Grade</th>
                            </tr>
                        </thead>
                        <tbody class="text-center">
                            <template v-for="player in allPlayersInMatchSorted" :key="player.playerId">
                                <tr :class="{
                                    'highlight-player': player.playerId === highlightedPlayerId,
                                    'table-row-clickable': !(player.playerId === highlightedPlayerId),
                                    'team-a-row': player.teamLetter === 'A',
                                    'team-b-row': player.teamLetter === 'B'
                                }" @click="(!(player.playerId === highlightedPlayerId) ? router.push({ name: 'PlayerProfile', params: { playerId: player.playerId } }) : null)">
                                    <td :class="['lol-team-cell', player.isWinner ? 'lol-winner-cell' : 'lol-loser-cell']">
                                        <strong>Team {{ player.teamLetter }}</strong>
                                        <span v-if="player.isWinner" class="d-block small fst-italic lol-winner-text">(Winner)</span>
                                    </td>
                                    <td class="lol-player-cell">
                                        {{ player.playerName }}
                                        <i class="fa-solid fa-eye"></i>
                                    </td>
                                    <td>
                                        <img v-if="player.championName" :src="`https://ddragon.leagueoflegends.com/cdn/14.4.1/img/champion/${player.championId}.png`" :alt="player.championName" width="24" height="24" class="me-1 rounded-circle champ-icon" @error="($event.target.style.display = 'none')">
                                        <span class="lol-champ-cell">{{ player.championName }}</span>
                                    </td>
                                    <td class="lol-role-cell">{{ player.role }}</td>
                                    <td>
                                        <span class="lol-kda-cell">
                                            {{ player.kda.kills }}/<span class="text-danger fw-bold">{{ player.kda.deaths }}</span>/{{ player.kda.assists }}
                                            <small class="d-block text-muted">({{ getKdaRatio(player.kda).toFixed(2) }})</small>
                                        </span>
                                    </td>
                                    <td class="lol-cs-cell">{{ player.cs }}</td>
                                    <td class="lol-gold-cell">{{ player.gold.toLocaleString() }}</td>
                                    <td :class="['fw-bold', player.eloChange > 0 ? 'lol-elo-up' : player.eloChange < 0 ? 'lol-elo-down' : 'lol-elo-neutral']">
                                        {{ player.eloChange >= 0 ? '+' : '' }}{{ player.eloChange.toFixed(0) }}
                                    </td>
                                    <td>
                                        <strong class="fs-5 lol-grade-cell" :class="{
                                            'lol-grade-splus': calculatePlayerPerformanceGrade(player) === 'S+',
                                            'lol-grade-s': calculatePlayerPerformanceGrade(player) === 'S',
                                            'lol-grade-a': calculatePlayerPerformanceGrade(player) === 'A',
                                            'lol-grade-b': calculatePlayerPerformanceGrade(player) === 'B',
                                            'lol-grade-c': calculatePlayerPerformanceGrade(player) === 'C',
                                            'lol-grade-d': calculatePlayerPerformanceGrade(player) === 'D'
                                        }">
                                            {{ calculatePlayerPerformanceGrade(player) }}
                                        </strong>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="text-center mt-4">
                <button @click="router.back()" class="btn btn-outline-secondary px-4 py-2">
                    <i class="fa-solid fa-circle-left"></i>
                    Back
                </button>
            </div>
        </div>
        <div v-else-if="!isLoadingMatch && !isLoadingPbrConfig && !pbrConfigError" class="alert alert-warning text-center">
            Match data could not be loaded or does not exist.
        </div>
    </div>
</template>

<style scoped>
.match-detail-view {
    max-width: 1600px;
    margin-left: auto;
    margin-right: auto;
}

/* Card header, heading, button: font + màu đồng bộ LoL */
.card-header,
.card-header h3,
.card-header h4,
.card-header h5,
.btn,
.lol-button,
.lol-textbox,
.lol-dropdown {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    letter-spacing: 1px;
}

.card-header {
    background: linear-gradient(90deg, var(--lol-primary) 80%, rgba(11, 198, 227, 0.08) 100%);
    color: var(--lol-accent);
    border-bottom: 2.5px solid var(--lol-uikit-gold-dark);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 1px;
    padding: 0.75rem 1.25rem;
}

.card-header h3,
.card-header h4,
.card-header h5 {
    color: var(--lol-accent);
    text-shadow: 0 0 6px rgba(11, 198, 227, 0.18);
    margin-bottom: 0;
}

/* Badge: đồng bộ màu LoL */
.badge.fs-4 {
    font-size: 1.25rem !important;
    border-radius: 0.375rem;
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    letter-spacing: 1px;
    box-shadow: 0 0 8px 0 #CDBE91;
}

/* Table: border, màu, hover đồng bộ */
.table th,
.table td {
    color: var(--lol-text-light);
    border-color: var(--lol-gold-dark);
    background: none;
}

.table thead th,
.table-dark th,
thead.table-dark th {
    background: linear-gradient(90deg, var(--lol-primary) 80%, rgba(200, 170, 110, 0.08) 100%) !important;
    color: var(--lol-gold-primary) !important;
    border-bottom: 2px solid var(--lol-gold-dark) !important;
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    font-size: 1.05em;
    letter-spacing: 0.5px;
}

.table-hover tbody tr:hover td,
.table-hover tbody tr:hover th,
.table-row-clickable:hover td {
    background-color: rgba(11, 198, 227, 0.15) !important;
    color: var(--lol-accent) !important;
    cursor: pointer;
}

/* Highlight player row: vàng nhạt LoL */
.highlight-player td {
    background-color: rgba(200, 170, 110, 0.15) !important;
}

/* Team A/B header màu LoL */
.scoreboard-unified .team-a-header {
    color: var(--lol-blue-bright) !important;
}

.scoreboard-unified .team-b-header {
    color: var(--lol-danger) !important;
}

.scoreboard-unified .team-winner-header {
    font-weight: bold;
}

/* Stat label, zebra, background */
.scoreboard-unified tbody th.stat-label {
    font-weight: 500;
    background-color: var(--lol-grey-medium);
    color: var(--lol-text-secondary);
    width: 20%;
}

.scoreboard-unified tr:nth-child(even) th.stat-label {
    background-color: #23272e;
}

.scoreboard-unified tbody td {
    font-size: 1.1rem;
    font-weight: bold;
    width: 40%;
}

/* Chart container: dùng style chung */
.chart-container {
    font-family: "beaufort-regular", 'Montserrat', Arial, sans-serif !important;
    background: linear-gradient(135deg, #0A323C 80%, rgba(11, 198, 227, 0.08) 100%);
    border: 1.5px solid var(--lol-uikit-gold-dark);
    box-shadow: 0 0 18px 0 rgba(11, 198, 227, 0.08), 0 2px 8px rgba(0, 0, 0, 0.25);
    color: var(--lol-uikit-gold);
    padding: 1.25rem;
    border-radius: var(--lol-border-radius);
    transition: box-shadow 0.2s;
}

.chart-container:hover {
    box-shadow: 0 0 24px 0 var(--lol-blue-glow), 0 4px 16px rgba(0, 0, 0, 0.35);
}

/* Champion icon: border vàng */
.champ-icon {
    background-color: var(--lol-primary);
    border: 1px solid var(--lol-gold-dark);
    display: inline-block;
    text-align: center;
    line-height: 22px;
    font-size: 10px;
    color: var(--lol-text-light);
}

/* Button: inherit global style, override if needed */
.btn,
.lol-button {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: var(--lol-border-radius);
    background-color: #1E2328;
    color: var(--lol-uikit-gold);
    border: 2px solid;
    border-image-slice: 1;
    border-image-source: linear-gradient(var(--lol-uikit-gold), var(--lol-uikit-gold-dark));
    text-shadow: 0 0 2px #000;
    transition: all 0.2s, border-image-source 0.2s, color 0.2s, background 0.2s;
}

.btn:hover,
.lol-button:hover {
    border-image-source: linear-gradient(#EBE1CC, #C5993E);
    color: #F0E6D2;
    background: linear-gradient(#1F2428, #393934);
    box-shadow: 0 0 8px 0 #CDBE91;
}

.btn:active,
.lol-button:active {
    border-image-source: linear-gradient(#5C5B57, #5C5B57);
    background: #1E2328;
    color: #5C5B57;
}

.btn:disabled,
.lol-button:disabled {
    color: #3C3C41 !important;
    background: #1E2328 !important;
    border-image-source: linear-gradient(#5C5B57, #5C5B57) !important;
    cursor: not-allowed;
    opacity: 0.7;
}

/* Responsive fix for table */
.table-responsive {
    overflow-y: auto;
}

/* Subtle background for .bg-light-subtle */
.bg-light-subtle {
    background-color: #fcfcfd !important;
}

/* Đảm bảo pagination controls dùng font và màu LoL nếu có */
.pagination,
.page-link {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    letter-spacing: 1px;
}

/* League of Legends-like Victory Badge */
.lol-victory-badge {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    background: linear-gradient(90deg, #0A323C 80%, rgba(200, 170, 110, 0.18) 100%);
    color: #F0E6D2;
    border: 2.5px solid #C8AA6E;
    border-radius: 0.5rem;
    font-size: 1.35rem;
    font-weight: bold;
    letter-spacing: 1.5px;
    padding: 0.5rem 2.2rem;
    box-shadow: 0 0 16px 0 rgba(200, 170, 110, 0.18), 0 2px 8px rgba(0, 0, 0, 0.15);
    text-shadow: 0 0 8px #0BC6E3;
    display: inline-block;
}

.lol-victory-a {
    border-color: #0BC6E3;
    color: #0BC6E3;
    background: linear-gradient(90deg, #0A323C 80%, rgba(11, 198, 227, 0.18) 100%);
}

.lol-victory-b {
    border-color: #E84057;
    color: #E84057;
    background: linear-gradient(90deg, #2a0a0a 80%, rgba(232, 64, 87, 0.18) 100%);
}

/* Player Performance Breakdown highlight */
.lol-team-cell {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    font-size: 1.1rem;
    color: #C8AA6E;
    background: rgba(11, 198, 227, 0.04);
    border-left: 4px solid #C8AA6E;
}

.lol-winner-cell {
    background: rgba(54, 162, 235, 0.10);
    color: #0BC6E3;
    border-left: 4px solid #0BC6E3;
}

.lol-loser-cell {
    background: rgba(232, 64, 87, 0.07);
    color: #E84057;
    border-left: 4px solid #E84057;
}

.lol-winner-text {
    color: #36B474 !important;
    font-weight: bold;
    text-shadow: 0 0 4px #C8AA6E;
}

.lol-player-cell,
.lol-champ-cell,
.lol-role-cell,
.lol-cs-cell,
.lol-gold-cell {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    color: #F0E6D2;
    font-size: 1.05rem;
}

.lol-kda-cell {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    color: #C8AA6E;
}

.lol-elo-up {
    color: #36B474 !important;
    text-shadow: 0 0 4px #36B474;
}

.lol-elo-down {
    color: #E84057 !important;
    text-shadow: 0 0 4px #E84057;
}

.lol-elo-neutral {
    color: #C8AA6E !important;
}

.lol-grade-cell {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    letter-spacing: 1px;
}

.lol-grade-splus {
    color: #FFD700;
    text-shadow: 0 0 8px #FFD700;
}

.lol-grade-s {
    color: #C8AA6E;
    text-shadow: 0 0 6px #C8AA6E;
}

.lol-grade-a {
    color: #0BC6E3;
}

.lol-grade-b {
    color: #36B474;
}

.lol-grade-c {
    color: #A092B1;
}

.lol-grade-d {
    color: #E84057;
}
</style>
```