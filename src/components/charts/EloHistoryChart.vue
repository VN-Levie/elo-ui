<script setup>
import { Line } from 'vue-chartjs';
import { defineProps } from 'vue';

const props = defineProps({
  chartData: {
    type: Object,
    required: true,
  },
  chartOptions: {
    type: Object,
    default: () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            color: "#C8AA6E",
            font: { family: "'Optimus Princeps', 'Montserrat', Arial, sans-serif" }
          },
          grid: { color: "rgba(200,170,110,0.18)" },
          title: {
            display: true,
            text: 'Elo Rating',
            color: "#C8AA6E",
            font: { family: "'Optimus Princeps', 'Montserrat', Arial, sans-serif", size: 15 }
          }
        },
        x: {
          ticks: {
            color: "#C8AA6E",
            font: { family: "'Optimus Princeps', 'Montserrat', Arial, sans-serif" }
          },
          grid: { color: "rgba(200,170,110,0.18)" },
          title: {
            display: true,
            text: 'Match Sequence / Time',
            color: "#C8AA6E",
            font: { family: "'Optimus Princeps', 'Montserrat', Arial, sans-serif", size: 15 }
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: "#C8AA6E",
            font: { family: "'Optimus Princeps', 'Montserrat', Arial, sans-serif", size: 13 }
          }
        },
        title: {
          display: true,
          text: 'Player Elo History',
          color: "#0BC6E3",
          font: { family: "'Optimus Princeps', 'Montserrat', Arial, sans-serif", size: 18, weight: 'bold' }
        },
        tooltip: {
          backgroundColor: "#1E2328",
          titleColor: "#C8AA6E",
          bodyColor: "#C8AA6E",
          borderColor: "#0BC6E3",
          borderWidth: 1,
          bodyFont: { family: "'Optimus Princeps', 'Montserrat', Arial, sans-serif" },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) label += context.parsed.y.toFixed(0) + ' Elo';
              return label;
            }
          }
        }
      }
    })
  }
});
</script>

<template>
  <div class="chart-container" style="position: relative; height:40vh; width:100%">
    <Line
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<style scoped>
.chart-container {
  /* Sử dụng style chung đã có ở main.css */
  /* Nếu muốn override thêm, có thể thêm ở đây */
}
</style>