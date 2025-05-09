<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router'; // Import useRoute and useRouter

const route = useRoute();
const router = useRouter(); // For navigation, e.g., back button or to match details

const player = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');

const API_BASE_URL = 'http://localhost:3000/api';

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
    player.value = data.data || data; // Assuming API might wrap in 'data'
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
  // Assuming matchHistory is already sorted newest first from backend
  return player.value.matchHistory;
});

function goToMatchDetail(matchId) {
  if (matchId) {
    router.push({ name: 'MatchDetail', params: { matchId: matchId } });
  }
}


onMounted(() => {
  if (route.params.playerId) {
    fetchPlayerProfile(route.params.playerId);
  }
});

// Watch for route param changes if user navigates between profiles directly (less common without specific UI for it)
watch(() => route.params.playerId, (newId) => {
  if (newId) {
    fetchPlayerProfile(newId);
  }
});

</script>

<template>
  <div class="player-profile-view">
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
        <span class="visually-hidden">Loading profile...</span>
      </div>
      <p class="mt-2">Loading player profile...</p>
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
            <div class="col-md-3"><strong>Elo:</strong> {{ player.elo.toFixed(0) }}</div>
            <div class="col-md-3"><strong>Games Played:</strong> {{ player.gamesPlayed }}</div>
            <div class="col-md-3"><strong>Win Streak:</strong> {{ player.currentWinStreak || 0 }}</div>
            <div class="col-md-3"><strong>Loss Streak:</strong> {{ player.currentLossStreak || 0 }}</div>
        </div>
        <hr/>
        <h4>Match History</h4>
        <div v-if="sortedMatchHistory.length === 0" class="alert alert-info mt-3">No match history available for this player.</div>
        <div v-else class="table-responsive mt-3" style="max-height: 70vh;">
            <table class="table table-sm table-hover align-middle">
                <thead class="table-light sticky-top">
                    <tr>
                        <th>Match ID</th>
                        <th>Champion</th>
                        <th>Role</th>
                        <th>Result</th>
                        <th>Elo +/-</th>
                        <th>KDA</th>
                        <th>CS</th>
                        <th>Gold</th>
                        <!-- <th>Grade</th> -->
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
                        <!-- <td>{{ calculatePerformanceGrade(match) }}</td> -->
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
.player-profile-view {
  max-width: 1200px;
  margin: auto;
}
.table-responsive {
    font-size: 0.9rem;
}
.table-row-clickable:hover {
    cursor: pointer;
    background-color: #f0f0f0;
}
.sticky-top {
    top: -1px; /* Minor adjustment for table header */
}
</style>