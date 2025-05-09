<script setup>
import { ref, onMounted, watch, inject, computed } from 'vue'; // Import inject
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const matchDetails = ref(null);
const isLoadingMatch = ref(false); // Renamed to distinguish from config loading
const errorMessage = ref('');

// Inject PBR configuration provided by App.vue
const pbrConfig = inject('pbrConfig');
const isLoadingPbrConfig = inject('isLoadingPbrConfig');
const pbrConfigError = inject('pbrConfigError');


const API_BASE_URL = 'http://localhost:3000/api';

async function fetchMatchDetails(id) {
  isLoadingMatch.value = true;
  errorMessage.value = '';
  matchDetails.value = null;
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
  // Check if pbrConfig is loaded and valid
  if (!pbrConfig.value || !pbrConfig.value.benchmarks || !pbrConfig.value.averageMatchDurationMinutes) {
    // console.warn("PBR Config not available for grade calculation.");
    return 'cfg?'; // Indicate config is missing or loading
  }
  if (!playerData || !playerData.role || !playerData.kda || playerData.cs === undefined || playerData.gold === undefined) {
    return '-'; // Not enough player data
  }

  const benchmarks = pbrConfig.value.benchmarks;
  const avgDuration = pbrConfig.value.averageMatchDurationMinutes;

  const role = playerData.role;
  const benchmark = benchmarks[role] || benchmarks["Top"]; // Default to Top benchmark
  if (!benchmark) return 'N/A';

  const playerKdaRatio = getKdaRatio(playerData.kda);
  const playerCsPerMin = playerData.cs / avgDuration;
  const playerGoldPerMin = playerData.gold / avgDuration;

  let performanceScore = 0;
  const weights = { kda: 0.4, cs: 0.3, gold: 0.3 }; // Can be constants

  // KDA Score
  const kdaDiff = playerKdaRatio - benchmark.kdaRatio;
  performanceScore += (kdaDiff / 1.0) * weights.kda; // Assuming 1.0 KDA ratio diff is significant for this weight
  
  // CS Score
  let csBenchmarkValue = benchmark.csPerMin;
  if (role === "Jungle" && benchmark.totalCS_benchmark) {
      csBenchmarkValue = benchmark.totalCS_benchmark / avgDuration;
  }
  const csDiff = playerCsPerMin - csBenchmarkValue;
  performanceScore += (csDiff / 1.0) * weights.cs; // Assuming 1.0 CS/min diff is significant

  // Gold Score
  const goldDiff = playerGoldPerMin - benchmark.goldPerMin;
  performanceScore += (goldDiff / 50) * weights.gold; // Assuming 50 Gold/min diff is significant

  // Convert performanceScore to Grade (S, A, B, C, D)
  // These thresholds are examples and should be tuned
  if (performanceScore >= 1.2) return 'S+'; // Exceptional
  if (performanceScore >= 0.8) return 'S';  // Excellent
  if (performanceScore >= 0.4) return 'A';  // Good
  if (performanceScore >= -0.2) return 'B'; // Average / Slightly below
  if (performanceScore >= -0.6) return 'C'; // Below Average
  return 'D'; // Poor
}


onMounted(() => {
  if (route.params.matchId) {
    fetchMatchDetails(route.params.matchId);
  }
});

watch(() => route.params.matchId, (newId) => {
  if (newId) {
    fetchMatchDetails(newId);
  }
});

</script>

<template>
  <div class="match-detail-view">
    <!-- Loading/Error for PBR Config (Can be displayed more gracefully) -->
    <div v-if="isLoadingPbrConfig" class="alert alert-info">Loading PBR configuration...</div>
    <div v-if="pbrConfigError && !isLoadingPbrConfig" class="alert alert-danger">
      PBR Configuration Error: {{ pbrConfigError }}
    </div>

    <div v-if="isLoadingMatch" class="text-center py-5">
      <!-- ... spinner ... -->
    </div>
    <div v-else-if="errorMessage" class="alert alert-danger" role="alert">
      {{ errorMessage }}
    </div>
    <div v-else-if="matchDetails && pbrConfig" class="card"> <!-- Ensure pbrConfig is loaded before rendering grades -->
      <div class="card-header">
        <!-- ... header content ... -->
         <div class="d-flex justify-content-between align-items-center">
            <h2>Match Details: {{ matchDetails.matchId }}</h2>
            <span :class="['badge fs-5', matchDetails.winningTeam === 'A' ? 'bg-primary' : 'bg-danger']">
                Team {{ matchDetails.winningTeam }} Victory
            </span>
        </div>
        <small class="text-muted">Timestamp: {{ new Date(matchDetails.timestamp).toLocaleString() }}</small>
      </div>
      <div class="card-body">
        <div class="row">
          <!-- Team A -->
          <div class="col-md-6 team-section mb-3">
            <h4 :class="{'text-primary': matchDetails.winningTeam === 'A', 'text-muted': matchDetails.winningTeam !== 'A'}">
              Team A (Avg Elo: {{ matchDetails.teamA.avgEloBefore?.toFixed(0) || 'N/A' }})
              <span v-if="matchDetails.winningTeam === 'A'" class="badge bg-success ms-2">Winner</span>
            </h4>
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Player</th><th>Champion</th><th>Role</th><th>KDA</th><th>CS</th><th>Gold</th><th>Elo +/-</th><th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="player in matchDetails.teamA.players" :key="player.playerId" @click="router.push({ name: 'PlayerProfile', params: { playerId: player.playerId }})" style="cursor:pointer;">
                    <td>{{ player.playerName }}</td>
                    <td>{{ player.championName }}</td>
                    <td>{{ player.role }}</td>
                    <td>{{ player.kda.kills }}/{{ player.kda.deaths }}/{{ player.kda.assists }} <small>({{ getKdaRatio(player.kda).toFixed(2) }})</small></td>
                    <td>{{ player.cs }}</td>
                    <td>{{ player.gold.toLocaleString() }}</td>
                    <td :class="{'text-success': player.eloChange > 0, 'text-danger': player.eloChange < 0}">
                        {{ player.eloChange >= 0 ? '+' : '' }}{{ player.eloChange.toFixed(0) }}
                    </td>
                    <td><strong>{{ calculatePlayerPerformanceGrade(player) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Team B -->
          <div class="col-md-6 team-section mb-3">
            <h4 :class="{'text-primary': matchDetails.winningTeam === 'B', 'text-muted': matchDetails.winningTeam !== 'B'}">
              Team B (Avg Elo: {{ matchDetails.teamB.avgEloBefore?.toFixed(0) || 'N/A' }})
              <span v-if="matchDetails.winningTeam === 'B'" class="badge bg-success ms-2">Winner</span>
            </h4>
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle">
                <thead class="table-light">
                   <tr>
                    <th>Player</th><th>Champion</th><th>Role</th><th>KDA</th><th>CS</th><th>Gold</th><th>Elo +/-</th><th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="player in matchDetails.teamB.players" :key="player.playerId" @click="router.push({ name: 'PlayerProfile', params: { playerId: player.playerId }})" style="cursor:pointer;">
                    <td>{{ player.playerName }}</td>
                    <td>{{ player.championName }}</td>
                    <td>{{ player.role }}</td>
                    <td>{{ player.kda.kills }}/{{ player.kda.deaths }}/{{ player.kda.assists }} <small>({{ getKdaRatio(player.kda).toFixed(2) }})</small></td>
                    <td>{{ player.cs }}</td>
                    <td>{{ player.gold.toLocaleString() }}</td>
                     <td :class="{'text-success': player.eloChange > 0, 'text-danger': player.eloChange < 0}">
                        {{ player.eloChange >= 0 ? '+' : '' }}{{ player.eloChange.toFixed(0) }}
                    </td>
                    <td><strong>{{ calculatePlayerPerformanceGrade(player) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="card-footer text-center">
        <button @click="router.back()" class="btn btn-secondary">Go Back</button>
      </div>
    </div>
     <div v-else-if="!isLoadingMatch && !isLoadingPbrConfig && !pbrConfigError" class="alert alert-warning">
        Match data not found or an error occurred.
    </div>
  </div>
</template>

<style scoped>
/* ... styles ... */
.match-detail-view { max-width: 1400px; margin: auto; }
.team-section h4 { margin-bottom: 1rem; }
.table-sm th, .table-sm td { padding: 0.5rem; font-size: 0.875rem; }
.table-responsive { max-height: 65vh; }
.badge.fs-5 { font-size: 1.1rem !important; }
</style>