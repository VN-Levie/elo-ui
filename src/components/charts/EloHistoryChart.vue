<script setup>
import { Line } from 'vue-chartjs';
import { defineProps, computed } from 'vue';

const props = defineProps({
  chartData: {
    type: Object,
    required: true,
    // Example structure:
    // {
    //   labels: ['Match 1', 'Match 2', ...], // Or timestamps
    //   datasets: [
    //     {
    //       label: 'Elo Over Time',
    //       backgroundColor: '#f87979',
    //       borderColor: '#f87979', // Can be different from backgroundColor
    //       data: [1200, 1215, 1205, ...],
    //       fill: false, // Set to true to fill area under the line
    //       tension: 0.1 // Makes the line a bit curvy
    //     }
    //   ]
    // }
  },
  chartOptions: {
    type: Object,
    default: () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false, // Elo doesn't have to start at 0 on the chart
          ticks: {
            // Include a unit in the ticks
            // callback: function(value, index, values) {
            //     return value + ' Elo';
            // }
          },
          title: {
            display: true,
            text: 'Elo Rating'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Match Sequence / Time'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        title: {
          display: true,
          text: 'Player Elo History'
        },
        tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        label += context.parsed.y.toFixed(0) + ' Elo';
                    }
                    return label;
                }
            }
        }
      }
    })
  }
});

// chartId is not strictly necessary for vue-chartjs v4+ with <script setup> if you only have one chart type per component file
// but can be useful if you have multiple chart instances of the same type or for specific testing.
// const chartId = 'elo-history-line-chart';
// const datasetIdKey = 'label'; // Default is 'label'

</script>

<template>
  <div class="chart-container" style="position: relative; height:40vh; width:100%">
    <Line
      :data="chartData"
      :options="chartOptions"
      />
      <!-- :chart-id="chartId"
      :dataset-id-key="datasetIdKey" -->
  </div>
</template>

<style scoped>
.chart-container {
  padding: 1rem;
  background-color: #fff;
  border-radius: 0.25rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}
</style>