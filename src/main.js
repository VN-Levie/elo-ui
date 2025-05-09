// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'

// Import và đăng ký các thành phần của Chart.js
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,     // For Bar and HorizontalBar charts
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    ArcElement,     // For Pie and Doughnut charts
    RadialLinearScale // For Radar chart
} from 'chart.js'

ChartJS.register(
    Title,
    Tooltip,
    Legend,
    BarElement,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    ArcElement,
    RadialLinearScale
)
const app = createApp(App)
app.use(router)
app.mount('#app')