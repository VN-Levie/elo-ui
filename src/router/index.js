import { createRouter, createWebHistory } from 'vue-router';
import LeaderboardView from '../views/LeaderboardView.vue';
import PlayerProfileView from '../views/PlayerProfileView.vue';
import MatchDetailView from '../views/MatchDetailView.vue';
import StatisticsView from '../views/StatisticsView.vue';
const routes = [
    {
        path: '/',
        name: 'Leaderboard',
        component: LeaderboardView
    },
    {
        path: '/player/:playerId', // Route động cho profile người chơi
        name: 'PlayerProfile',
        component: PlayerProfileView,
        props: true // Cho phép truyền route params làm props cho component
    },
    {
        path: '/match/:matchId', // Route động cho chi tiết trận đấu
        name: 'MatchDetail',
        component: MatchDetailView,
        props: true
    },
    {
        path: '/statistics',
        name: 'Statistics',
        component: () => StatisticsView // Lazy loading example
    },
    // {
    //   path: '/champions',
    //   name: 'Champions',
    //   component: () => import('../views/ChampionsView.vue') // Lazy loading
    // },
    // {
    //   path: '/statistics',
    //   name: 'Statistics',
    //   component: () => import('../views/StatisticsView.vue') // Lazy loading
    // }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL), // Hoặc createWebHashHistory() nếu không muốn config server
    routes
});

export default router;