<script setup>
import { defineProps, defineEmits, computed } from 'vue';

const props = defineProps({
  player: {
    type: Object,
    default: null
  },
  // Benchmarks needed to calculate performance grade later
  // pbrBenchmarks: {
  //   type: Object,
  //   required: true
  // },
  // averageMatchDuration: {
  //   type: Number,
  //   required: true
  // }
});

const emit = defineEmits(['close']);

const kdaRatio = (kda) => {
  if (!kda || typeof kda.deaths !== 'number') return 'N/A';
  return ((kda.kills || 0) + (kda.assists || 0)) / Math.max(1, kda.deaths);
};

// Placeholder for performance grade - to be implemented
// function calculatePerformanceGrade(match) {
//   if (!props.player || !match.role || !match.kda || match.cs === undefined || match.gold === undefined) {
//     return 'N/A';
//   }
//   const role = match.role;
//   const benchmark = props.pbrBenchmarks[role] || props.pbrBenchmarks["Top"];
//   if (!benchmark) return 'N/A';

//   const playerKdaRatio = kdaRatio(match.kda);
//   const playerCsPerMin = match.cs / props.averageMatchDuration;
//   const playerGoldPerMin = match.gold / props.averageMatchDuration;

//   let performanceScore = 0;
//   // Simplified scoring logic - needs to match eloService.js or be tailored for display
//   const kdaDiff = playerKdaRatio - benchmark.kdaRatio;
//   performanceScore += (kdaDiff / 1.0) * 0.4;

//   let csBenchmarkValue = benchmark.csPerMin;
//   if (role === "Jungle" && benchmark.totalCS_benchmark) {
//       csBenchmarkValue = benchmark.totalCS_benchmark / props.averageMatchDuration;
//   }
//   const csDiff = playerCsPerMin - csBenchmarkValue;
//   performanceScore += (csDiff / 1.0) * 0.3;

//   const goldDiff = playerGoldPerMin - benchmark.goldPerMin;
//   performanceScore += (goldDiff / 50) * 0.3;

//   // Convert performanceScore to Grade (S, A, B, C, D)
//   if (performanceScore >= 1.5) return 'S+';
//   if (performanceScore >= 1.0) return 'S';
//   if (performanceScore >= 0.5) return 'A';
//   if (performanceScore >= 0) return 'B';
//   if (performanceScore >= -0.5) return 'C';
//   return 'D';
// }

const sortedMatchHistory = computed(() => {
  if (!props.player || !props.player.matchHistory) return [];
  // Assuming matchHistory is already sorted newest first from backend ($push with $slice: -N)
  // If not, sort by timestamp: return [...props.player.matchHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return props.player.matchHistory;
});

</script>

<template>
  <div v-if="player" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Player Details: {{ player.playerName }}</h5>
          <button type="button" class="btn-close" @click="emit('close')" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="row mb-3">
            <div class="col-md-4">
              <strong>Elo:</strong> {{ player.elo.toFixed(0) }}
            </div>
            <div class="col-md-4">
              <strong>Games Played:</strong> {{ player.gamesPlayed }}
            </div>
            <div class="col-md-4">
              <strong>Rank:</strong> {{ player.rank || 'Unranked' }} <!-- Placeholder for rank -->
            </div>
             <div class="col-md-6 mt-2">
              <strong>Win Streak:</strong> {{ player.currentWinStreak || 0 }}
            </div>
            <div class="col-md-6 mt-2">
              <strong>Loss Streak:</strong> {{ player.currentLossStreak || 0 }}
            </div>
          </div>

          <h6>Match History (Last {{ sortedMatchHistory.length }} matches)</h6>
          <div v-if="sortedMatchHistory.length === 0" class="alert alert-info">No match history available.</div>
          <table v-else class="table table-sm table-hover">
            <thead class="table-light">
              <tr>
                <th>Match ID</th>
                <th>Champion</th>
                <th>Role</th>
                <th>Result</th>
                <th>Elo +/-</th>
                <th>KDA</th>
                <th>CS</th>
                <th>Gold</th>
                <!-- <th>Grade</th> Placeholder -->
              </tr>
            </thead>
            <tbody>
              <tr v-for="match in sortedMatchHistory" :key="match.matchId || match.timestamp">
                <td>
                  <small>{{ match.matchId || 'N/A' }}</small>
                  <!-- Make this clickable later for full match details -->
                </td>
                <td>{{ match.championPlayed?.championName || 'N/A' }}</td>
                <td>{{ match.role || 'N/A' }}</td>
                <td :class="{'text-success': match.result === 'win', 'text-danger': match.result === 'loss'}">
                  {{ match.result === 'win' ? 'Victory' : 'Defeat' }}
                </td>
                <td :class="{'text-success': match.eloChange > 0, 'text-danger': match.eloChange < 0}">
                  {{ match.eloChange >= 0 ? '+' : '' }}{{ match.eloChange.toFixed(0) }}
                  <small v-if="match.streakAdjustment && match.streakAdjustment !== 0"> ({{ match.streakAdjustment > 0 ? '+' : '' }}{{ match.streakAdjustment }} streak)</small>
                </td>
                <td>
                  {{ match.kda?.kills || 0 }}/{{ match.kda?.deaths || 0 }}/{{ match.kda?.assists || 0 }}
                  <small>({{ kdaRatio(match.kda).toFixed(2) }})</small>
                </td>
                <td>{{ match.cs || 0 }}</td>
                <td>{{ (match.gold || 0).toLocaleString() }}</td>
                <!-- <td>{{ calculatePerformanceGrade(match) }}</td> Placeholder -->
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="emit('close')">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal.show {
  display: block;
}
.table-sm th, .table-sm td {
  padding: 0.4rem;
  font-size: 0.85rem;
}
</style>