<script setup>
import { Bar } from 'vue-chartjs';
import { defineProps } from 'vue';

defineProps({
  chartData: { type: Object, required: true },
  chartOptions: {
    type: Object,
    default: () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Players' } }, x: { title: { display: true, text: 'Elo Range' } } },
      plugins: { legend: { display: false }, title: { display: true, text: 'Player Elo Distribution' } }
    })
  }
});
</script>
<template>
  <div style="height:300px; width:100%;">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>