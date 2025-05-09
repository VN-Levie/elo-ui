<script setup>
import { ref, onMounted } from 'vue';
import EloDistributionChart from '../components/charts/EloDistributionChart.vue'; // Adjust path
// Import RoleWinRateChart component after creating it (similar to EloDistributionChart)
// import RoleWinRateChart from '../../components/charts/RoleWinRateChart.vue';


const API_BASE_URL = 'http://localhost:3000/api'; // Or from a central config

const eloDistributionData = ref(null);
const isLoadingEloDistribution = ref(false);
const eloDistError = ref('');

const roleWinRateData = ref(null);
const isLoadingRoleWinRate = ref(false);
const roleWinRateError = ref('');


async function fetchEloDistribution() {
  isLoadingEloDistribution.value = true;
  eloDistError.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/stats/elo-distribution`);
    if (!response.ok) throw new Error('Failed to fetch Elo distribution');
    const result = await response.json();
    if (result.success) eloDistributionData.value = result.data;
    else throw new Error(result.message || 'Unknown error fetching elo distribution');
  } catch (error) {
    console.error("Elo Dist Error:", error);
    eloDistError.value = error.message;
  } finally {
    isLoadingEloDistribution.value = false;
  }
}

async function fetchRoleWinRates() {
  isLoadingRoleWinRate.value = true;
  roleWinRateError.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/stats/role-win-rates`);
    if (!response.ok) throw new Error('Failed to fetch role win rates');
    const result = await response.json();
    if (result.success) roleWinRateData.value = result.data;
     else throw new Error(result.message || 'Unknown error fetching role win rates');
  } catch (error) {
    console.error("Role Win Rate Error:", error);
    roleWinRateError.value = error.message;
  } finally {
    isLoadingRoleWinRate.value = false;
  }
}

onMounted(() => {
  fetchEloDistribution();
  fetchRoleWinRates();
});
</script>

<template>
  <div class="statistics-view">
    <header class="mb-4 p-3 bg-light rounded-3">
      <h2>System Statistics</h2>
      <p>Overview of player and match data.</p>
    </header>

    <div class="row">
      <div class="col-lg-6 mb-4">
        <div class="card h-100">
          <div class="card-body">
            <div v-if="isLoadingEloDistribution" class="text-center"><div class="spinner-border"></div></div>
            <div v-else-if="eloDistError" class="alert alert-danger">{{ eloDistError }}</div>
            <EloDistributionChart v-if="eloDistributionData" :chartData="eloDistributionData" />
            <div v-else-if="!isLoadingEloDistribution && !eloDistributionData" class="alert alert-info">No Elo distribution data available.</div>
          </div>
        </div>
      </div>

      <div class="col-lg-6 mb-4">
        <div class="card h-100">
          <div class="card-body">
             <div v-if="isLoadingRoleWinRate" class="text-center"><div class="spinner-border"></div></div>
             <div v-else-if="roleWinRateError" class="alert alert-danger">{{ roleWinRateError }}</div>
            <!-- Placeholder for RoleWinRateChart -->
            <div v-if="roleWinRateData" style="height:300px; width:100%;">
                <Bar :data="roleWinRateData" :options="{ responsive: true, maintainAspectRatio: false, plugins: { title: {display: true, text: 'Role Win Rates (%)'}}, scales: {y: {suggestedMin: 0, suggestedMax:100}} }" />
            </div>
             <div v-else-if="!isLoadingRoleWinRate && !roleWinRateData" class="alert alert-info">No role win rate data available.</div>
          </div>
        </div>
      </div>
      <!-- Add more charts here -->
    </div>
  </div>
</template>
<style scoped>
.card.h-100 { /* Ensure cards in a row have same height for alignment */
    display: flex;
    flex-direction: column;
}
.card.h-100 .card-body {
    flex-grow: 1;
}
</style>