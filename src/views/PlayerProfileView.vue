// src/views/PlayerProfileView.vue
<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EloHistoryChart from '../components/charts/EloHistoryChart.vue'; // Import the chart component

const route = useRoute();
const router = useRouter();

const player = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');

const API_BASE_URL = 'http://localhost:3000/api';

async function fetchPlayerProfile(id) {
  // ... (fetchPlayerProfile function remains the same)
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
  // ... (kdaRatio function remains the same)
  if (!kda || typeof kda.deaths !== 'number') return 'N/A';
  return ((kda.kills || 0) + (kda.assists || 0)) / Math.max(1, kda.deaths);
};

const sortedMatchHistory = computed(() => {
  // ... (sortedMatchHistory computed property remains the same)
  if (!player.value || !player.value.matchHistory) return [];
  return player.value.matchHistory; // Assuming already sorted by newest (which is what we want for chart labels)
});

// Computed property for chart data
const eloChartData = computed(() => {
  if (!player.value || !player.value.matchHistory || player.value.matchHistory.length === 0) {
    return {
      labels: [],
      datasets: [{ data: [] }] // Chart.js needs datasets to be an array
    };
  }

  // We need to calculate Elo at each point in history.
  // matchHistory stores eloChange. We know currentElo.
  // So, we work backwards from currentElo.
  // History is newest first.
  const history = [...player.value.matchHistory].reverse(); // Oldest first for calculating forward
  const labels = [];
  const eloData = [];
  let currentEloForChart = player.value.elo; // Start with the very latest elo

  // To plot elo *after* each match, we work backwards from current elo
  // The matchHistory is newest first, so the last element in history (after reversing) is the oldest recorded match.
  // Elo *before* the oldest recorded match is unknown without more data or assumptions.
  // Let's plot Elo *after* each match in the recorded history.

  // If matchHistory stores elo *after* that match, it's simpler.
  // Our current player.matchHistory doesn't store elo *at that point*. It stores eloChange.
  // So we must reconstruct it.

  const reversedHistory = [...player.value.matchHistory]; // Newest first
  let eloPoints = [];
  let eloTracker = player.value.elo; // Start with current ELO

  // Add current ELO as the last point (most recent)
  eloPoints.push(eloTracker);
  
  // Iterate from newest match to oldest, subtracting eloChange to get previous ELO
  for (let i = 0; i < reversedHistory.length -1; i++) { // -1 because the last point is already player.elo
      const match = reversedHistory[i];
      eloTracker -= match.eloChange; // Elo before this match was current eloTracker - eloChange
      eloPoints.push(eloTracker);
      // We want to plot elo *after* match[i-1] (which is eloTracker for match[i])
  }
  eloPoints.reverse(); // Now oldest to newest ELO values *after* each match in history

  const chartLabels = player.value.matchHistory.map((_, index) => `M${player.value.gamesPlayed - player.value.matchHistory.length + index + 1}`).reverse();
  // If history is less than gamesPlayed, adjust starting match number.
  // If only 10 matches in history and 50 games played, labels are M41, M42... M50

  return {
    labels: chartLabels, // Labels from oldest match to newest
    datasets: [
      {
        label: 'Elo Rating',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgb(75, 192, 192)',
        data: eloPoints, // Elo after each match, oldest to newest
        fill: true,
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  };
});


function goToMatchDetail(matchId) {
  // ... (goToMatchDetail function remains the same)
   if (matchId) {
    router.push({ name: 'MatchDetail', params: { matchId: matchId } });
  }
}

onMounted(() => {
  if (route.params.playerId) {
    fetchPlayerProfile(route.params.playerId);
  }
});

watch(() => route.params.playerId, (newId) => {
  if (newId) {
    fetchPlayerProfile(newId);
  }
});
</script>

<template>
  <div class="player-profile-view">
    <div v-if="isLoading" class="text-center py-5">
      <!-- ... spinner ... -->
    </div>
    <div v-else-if="errorMessage" class="alert alert-danger" role="alert">
      {{ errorMessage }}
    </div>
    <div v-else-if="player" class="card">
      <div class="card-header">
        <h2>{{ player.playerName }} <small class="text-muted">({{ player.playerId }})</small></h2>
      </div>
      <div class="card-body">
        <div class="row mb-3">
            <!-- ... player stats ... -->
             <div class="col-md-3"><strong>Elo:</strong> {{ player.elo.toFixed(0) }}</div>
            <div class="col-md-3"><strong>Games Played:</strong> {{ player.gamesPlayed }}</div>
            <div class="col-md-3"><strong>Win Streak:</strong> {{ player.currentWinStreak || 0 }}</div>
            <div class="col-md-3"><strong>Loss Streak:</strong> {{ player.currentLossStreak || 0 }}</div>
        </div>
        
        <!-- Elo History Chart -->
        <div v-if="player.matchHistory && player.matchHistory.length > 0" class="mb-4">
          <h4>Elo Progression (Last {{ player.matchHistory.length }} Games)</h4>
          <EloHistoryChart :chartData="eloChartData" />
        </div>
        <div v-else-if="player.gamesPlayed > 0" class="alert alert-info">
            Not enough match history to display Elo progression chart.
        </div>


        <hr v-if="player.matchHistory && player.matchHistory.length > 0"/>
        <h4>Match History</h4>
        <!-- ... Match History Table (giữ nguyên) ... -->
         <div v-if="sortedMatchHistory.length === 0" class="alert alert-info mt-3">No match history available for this player.</div>
        <div v-else class="table-responsive mt-3" style="max-height: 70vh;">
            <table class="table table-sm table-hover align-middle">
                <thead class="table-light sticky-top">
                    <tr>
                        <th>Match ID</th><th>Champion</th><th>Role</th><th>Result</th><th>Elo +/-</th><th>KDA</th><th>CS</th><th>Gold</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="match in sortedMatchHistory" :key="match.matchId || match.timestamp" @click="goToMatchDetail(match.matchId)" :class="{'table-row-clickable': match.matchId}">
                        <td><small>{{ match.matchId || 'N/A' }}</small></td>
                        <td>{{ match.championPlayed?.championName || 'N/A' }}</td>
                        <td>{{ match.role || 'N/A' }}</td>
                        <td :class="{'text-success fw-bold': match.result === 'win', 'text-danger fw-bold': match.result === 'loss'}">
                        {{ match.result === 'win' ? 'Victory' : 'Defeat' }}
                        </td>
                        <td :class="{'text-success': match.eloChange > 0, 'text-danger': match.eloChange < 0}">
                        {{ match.eloChange >= 0 ? '+' : '' }}{{ match.eloChange?.toFixed(0) || '0' }}
                        <small v-if="match.streakAdjustment && match.streakAdjustment !== 0" :class="{'text-success': match.streakAdjustment > 0, 'text-danger': match.streakAdjustment < 0}">
                            ({{ match.streakAdjustment > 0 ? '+' : '' }}{{ match.streakAdjustment }} streak)
                        </small>
                        </td>
                        <td>
                        {{ match.kda?.kills || 0 }}/{{ match.kda?.deaths || 0 }}/{{ match.kda?.assists || 0 }}
                        <small>({{ kdaRatio(match.kda).toFixed(2) }})</small>
                        </td>
                        <td>{{ match.cs || 0 }}</td>
                        <td>{{ (match.gold || 0).toLocaleString() }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
       <div class="card-footer">
        <button @click="router.back()" class="btn btn-secondary">Back to Leaderboard</button>
      </div>
    </div>
     <div v-else class="alert alert-warning">
      Player data not found or an error occurred.
    </div>
  </div>
</template>

<style scoped>
/* ... (styles giữ nguyên) ... */
.player-profile-view { max-width: 1200px; margin: auto; }
.table-responsive { font-size: 0.9rem; }
.table-row-clickable:hover { cursor: pointer; background-color: #f0f0f0; }
.sticky-top { top: -1px; }
</style>