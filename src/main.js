// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
// import './assets/main.css'

// Import và đăng ký các thành phần của Chart.js
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale, // For X axis
  LinearScale,   // For Y axis
  PointElement
} from 'chart.js'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement
)

const app = createApp(App)
app.use(router)
app.mount('#app')