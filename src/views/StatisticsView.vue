<script setup>
import { ref, onMounted, computed } from 'vue';
import { Bar } from 'vue-chartjs';
import EloDistributionChart from '../components/charts/EloDistributionChart.vue';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const serverSummary = ref(null);
const isLoadingSummary = ref(false);
const summaryError = ref('');

const eloDistributionData = ref(null);
const isLoadingEloDistribution = ref(false);
const eloDistError = ref('');

const championPickRateData = ref(null);
const isLoadingChampionPickRate = ref(false);
const championPickRateError = ref('');

const championWinRateData = ref(null);
const isLoadingChampionWinRate = ref(false);
const championWinRateError = ref('');

const averageStatsByRole = ref(null);
const isLoadingAvgStatsByRole = ref(false);
const avgStatsByRoleError = ref('');

const lolChartFont = "'Optimus Princeps', 'Montserrat', Arial, sans-serif";
const lolTextColor = "#C8AA6E";
const lolGridColor = "rgba(200,170,110,0.18)";
const lolAccent = "#0BC6E3";
const lolGold = "#C8AA6E";
const lolRed = "#E84057";
const lolBg = "#1E2328";

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: lolTextColor,
        font: { family: lolChartFont, size: 13 }
      }
    },
    title: {
      color: lolAccent,
      font: { family: lolChartFont, size: 18, weight: 'bold' }
    },
    tooltip: {
      backgroundColor: lolBg,
      titleColor: lolGold,
      bodyColor: lolTextColor,
      borderColor: lolAccent,
      borderWidth: 1,
      bodyFont: { family: lolChartFont }
    }
  },
  scales: {
    x: {
      ticks: { color: lolTextColor, font: { family: lolChartFont } },
      grid: { color: lolGridColor }
    },
    y: {
      ticks: { color: lolTextColor, font: { family: lolChartFont } },
      grid: { color: lolGridColor }
    }
  }
};

const avgKdaByRoleChartOptions = {
  ...baseChartOptions,
  plugins: {
    ...baseChartOptions.plugins,
    title: { ...baseChartOptions.plugins.title, display: true, text: 'Average KDA by Role' }
  },
  scales: {
    ...baseChartOptions.scales,
    y: { ...baseChartOptions.scales.y, beginAtZero: true, title: { display: true, text: 'Count', color: lolGold } }
  }
};

const avgCsByRoleChartOptions = {
  ...baseChartOptions,
  indexAxis: 'y',
  plugins: {
    ...baseChartOptions.plugins,
    legend: { display: false },
    title: { ...baseChartOptions.plugins.title, display: true, text: 'Average CS by Role' }
  },
  scales: {
    ...baseChartOptions.scales,
    x: { ...baseChartOptions.scales.x, beginAtZero: true, title: { display: true, text: 'CS', color: lolGold } }
  }
};

const avgGoldByRoleChartOptions = {
  ...baseChartOptions,
  indexAxis: 'y',
  plugins: {
    ...baseChartOptions.plugins,
    legend: { display: false },
    title: { ...baseChartOptions.plugins.title, display: true, text: 'Average Gold by Role' }
  },
  scales: {
    ...baseChartOptions.scales,
    x: { ...baseChartOptions.scales.x, beginAtZero: true, title: { display: true, text: 'Gold', color: lolGold } }
  }
};

async function fetchData(endpoint, loadingVar, errorVar, dataVar, processFn = null) {
  loadingVar.value = true;
  errorVar.value = '';
  try {
    const response = await fetch(`${API_BASE_URL}/stats/${endpoint}`);
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
    const result = await response.json();
    if (result.success) {
      dataVar.value = processFn ? processFn(result.data) : result.data;
    } else {
      throw new Error(result.message || `Unknown error fetching ${endpoint}`);
    }
  } catch (error) {
    console.error(`${endpoint} Error:`, error);
    errorVar.value = error.message;
    dataVar.value = null; // Clear data on error
  } finally {
    loadingVar.value = false;
  }
}

const processPickRateData = (data) => {
  if (!data || !data.datasets || !data.datasets[0] || !data.labels) return null;
  const sortedData = data.datasets[0].data
    .map((value, index) => ({ label: data.labels[index], value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);
  return {
    labels: sortedData.map(item => item.label),
    datasets: [{ label: 'Pick Rate (%)', data: sortedData.map(item => item.value), backgroundColor: 'rgba(255, 159, 64, 0.7)', borderColor: 'rgba(255, 159, 64, 1)' }]
  };
};

const processWinRateData = (data) => {
  if (!Array.isArray(data)) return null;
  const filteredAndSortedData = data
    .filter(champ => champ.gamesPlayed >= 10)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 15);
  return {
    labels: filteredAndSortedData.map(item => item.championName),
    datasets: [{ label: 'Win Rate (%)', data: filteredAndSortedData.map(item => item.winRate), backgroundColor: 'rgba(75, 192, 192, 0.7)', borderColor: 'rgba(75, 192, 192, 1)' }]
  };
};

const avgKdaByRoleChartData = computed(() => {
  if (!averageStatsByRole.value) return null;
  return {
    labels: averageStatsByRole.value.map(r => r.role),
    datasets: [
      { label: 'Avg Kills', data: averageStatsByRole.value.map(r => r.avgKills), backgroundColor: 'rgba(75, 192, 192, 0.7)' },
      { label: 'Avg Deaths', data: averageStatsByRole.value.map(r => r.avgDeaths), backgroundColor: 'rgba(255, 99, 132, 0.7)' },
      { label: 'Avg Assists', data: averageStatsByRole.value.map(r => r.avgAssists), backgroundColor: 'rgba(255, 205, 86, 0.7)' },
    ]
  };
});

const avgCsByRoleChartData = computed(() => {
  if (!averageStatsByRole.value) return null;
  return {
    labels: averageStatsByRole.value.map(r => r.role),
    datasets: [{ label: 'Avg CS', data: averageStatsByRole.value.map(r => r.avgCs), backgroundColor: 'rgba(153, 102, 255, 0.7)' }]
  };
});

const avgGoldByRoleChartData = computed(() => {
  if (!averageStatsByRole.value) return null;
  return {
    labels: averageStatsByRole.value.map(r => r.role),
    datasets: [{ label: 'Avg Gold', data: averageStatsByRole.value.map(r => r.avgGold), backgroundColor: 'rgba(255, 159, 64, 0.7)' }]
  };
});

onMounted(() => {
  fetchData('server-summary', isLoadingSummary, summaryError, serverSummary);
  fetchData('elo-distribution', isLoadingEloDistribution, eloDistError, eloDistributionData);
  fetchData('champion-pick-rates', isLoadingChampionPickRate, championPickRateError, championPickRateData, processPickRateData);
  fetchData('champion-win-rates', isLoadingChampionWinRate, championWinRateError, championWinRateData, processWinRateData);
  fetchData('average-stats-by-role', isLoadingAvgStatsByRole, avgStatsByRoleError, averageStatsByRole);
});
</script>

<template>
  <div class="statistics-view py-4">
    <header class="mb-4 p-3 bg-primary-subtle text-primary-emphasis rounded-3 shadow-sm">
      <h1 class="display-5">System-Wide Statistics</h1>
      <p class="lead mb-0">An overview of player demographics, match outcomes, and champion meta.</p>
    </header>

    <div v-if="isLoadingSummary" class="text-center my-3">
      <div class="spinner-border text-secondary"></div>
      <p>Loading summary...</p>
    </div>
    <div v-else-if="summaryError" class="alert alert-warning">{{ summaryError }}</div>
    <div v-else-if="serverSummary" class="row text-center mb-4 gy-3">
      <div class="col-md-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h5 class="card-title text-muted text-uppercase small">Total Players</h5>
            <p class="card-text fs-1 fw-bold">{{ serverSummary.totalPlayers?.toLocaleString() || 'N/A' }}</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h5 class="card-title text-muted text-uppercase small">Total Matches</h5>
            <p class="card-text fs-1 fw-bold">{{ serverSummary.totalMatches?.toLocaleString() || 'N/A' }}</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <h5 class="card-title text-muted text-uppercase small">Average Elo</h5>
            <p class="card-text fs-1 fw-bold">{{ serverSummary.averageElo?.toFixed(0) || 'N/A' }}</p>
          </div>
        </div>
      </div>
    </div>
    <hr v-if="serverSummary" class="my-4">

    <div class="row gy-4">
      <div class="col-lg-12">
        <div class="card shadow-sm h-100">
          <div class="card-header bg-dark text-white">
            <h5 class="mb-0">Player Elo Distribution</h5>
          </div>
          <div class="card-body d-flex align-items-center justify-content-center">
            <div v-if="isLoadingEloDistribution" class="text-center">
              <div class="spinner-border"></div>
            </div>
            <div v-else-if="eloDistError" class="alert alert-danger w-100">{{ eloDistError }}</div>
            <EloDistributionChart v-if="eloDistributionData" :chartData="eloDistributionData" style="min-height: 300px; height: 100%; max-height: 500px;" />
            <div v-else-if="!isLoadingEloDistribution && !eloDistributionData" class="alert alert-info w-100">No Elo distribution data.</div>
          </div>
        </div>
      </div>


      <div class="col-lg-12">
        <div class="card shadow-sm h-100">
          <div class="card-header">
            <h5 class="mb-0">Average KDA by Role</h5>
          </div>
          <div class="card-body d-flex align-items-center justify-content-center">
            <div v-if="isLoadingAvgStatsByRole" class="text-center">
              <div class="spinner-border"></div>
            </div>
            <div v-else-if="avgStatsByRoleError" class="alert alert-danger w-100">{{ avgStatsByRoleError }}</div>
            <div v-if="avgKdaByRoleChartData" class="chart-container" style="position: relative; height:300px; width:100%;">
              <Bar :data="avgKdaByRoleChartData" :options="avgKdaByRoleChartOptions" />
            </div>
            <div v-else-if="!isLoadingAvgStatsByRole && !averageStatsByRole" class="alert alert-info w-100">No average KDA by role data.</div>
          </div>
        </div>
      </div>

      <div class="col-lg-12">
        <div class="card shadow-sm h-100">
          <div class="card-header">
            <h5 class="mb-0">Average CS by Role</h5>
          </div>
          <div class="card-body d-flex align-items-center justify-content-center">
            <div v-if="isLoadingAvgStatsByRole" class="text-center">
              <div class="spinner-border"></div>
            </div>
            <div v-else-if="avgStatsByRoleError" class="alert alert-danger w-100">{{ avgStatsByRoleError }}</div>
            <div v-if="avgCsByRoleChartData" class="chart-container" style="position: relative; height:300px; width:100%;">
              <Bar :data="avgCsByRoleChartData" :options="avgCsByRoleChartOptions" />
            </div>
            <div v-else-if="!isLoadingAvgStatsByRole && !averageStatsByRole" class="alert alert-info w-100">No average CS by role data.</div>
          </div>
        </div>
      </div>

      <div class="col-lg-12">
        <div class="card shadow-sm h-100">
          <div class="card-header">
            <h5 class="mb-0">Average Gold by Role</h5>
          </div>
          <div class="card-body d-flex align-items-center justify-content-center">
            <div v-if="isLoadingAvgStatsByRole" class="text-center">
              <div class="spinner-border"></div>
            </div>
            <div v-else-if="avgStatsByRoleError" class="alert alert-danger w-100">{{ avgStatsByRoleError }}</div>
            <div v-if="avgGoldByRoleChartData" class="chart-container" style="position: relative; height:300px; width:100%;">
              <Bar :data="avgGoldByRoleChartData" :options="avgGoldByRoleChartOptions" />
            </div>
            <div v-else-if="!isLoadingAvgStatsByRole && !averageStatsByRole" class="alert alert-info w-100">No average Gold by role data.</div>
          </div>
        </div>
      </div>

      <div class="col-lg-12">
        <div class="card shadow-sm h-100">
          <div class="card-header">
            <h5 class="mb-0">Top 15 Champion Pick Rates (%)</h5>
          </div>
          <div class="card-body d-flex align-items-center justify-content-center">
            <div v-if="isLoadingChampionPickRate" class="text-center">
              <div class="spinner-border"></div>
            </div>
            <div v-else-if="championPickRateError" class="alert alert-danger w-100">{{ championPickRateError }}</div>
            <div v-if="championPickRateData" class="chart-container" style="position: relative; height:400px; width:100%;">
              <Bar :data="championPickRateData" :options="{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, title: { display: false } }, scales: { x: { ticks: { callback: function (value) { return value + '%' } } } } }" />
            </div>
            <div v-else-if="!isLoadingChampionPickRate && !championPickRateData" class="alert alert-info w-100">No champion pick rate data.</div>
          </div>
        </div>
      </div>

      <div class="col-lg-12">
        <div class="card shadow-sm h-100">
          <div class="card-header">
            <h5 class="mb-0">Top 15 Champion Win Rates (%) <small class="text-muted fw-normal">(min. 10 games)</small></h5>
          </div>
          <div class="card-body d-flex align-items-center justify-content-center">
            <div v-if="isLoadingChampionWinRate" class="text-center">
              <div class="spinner-border"></div>
            </div>
            <div v-else-if="championWinRateError" class="alert alert-danger w-100">{{ championWinRateError }}</div>
            <div v-if="championWinRateData" class="chart-container" style="position: relative; height:400px; width:100%;">
              <Bar :data="championWinRateData" :options="{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, title: { display: false } }, scales: { x: { suggestedMin: 30, suggestedMax: 70, ticks: { callback: function (value) { return value + '%' } } } } }" />
            </div>
            <div v-else-if="!isLoadingChampionWinRate && !championWinRateData" class="alert alert-info w-100">No champion win rate data (or too few games played).</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.statistics-view {
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}

.card.h-100 {
  display: flex;
  flex-direction: column;
}

.card.h-100 .card-body {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.card-header {
  background: linear-gradient(90deg, var(--lol-primary) 80%, rgba(11, 198, 227, 0.08) 100%);
  color: var(--lol-accent);
  letter-spacing: 1px;
  font-weight: 600;
}

.card-header h5 {
  color: var(--lol-accent);
  text-shadow: 0 0 6px rgba(11, 198, 227, 0.18);
}

.card-body>div[style*="height"] {
  min-height: 250px;
}

.chart-container {
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
}

.card-header,
.card-header h5,
.card-header h4 {
  font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
}
</style>