<script setup>
import { ref, onMounted, watch, computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import EloDistributionChart from '../components/charts/EloDistributionChart.vue';
import { Bar } from 'vue-chartjs';
import { Modal } from 'bootstrap';

const router = useRouter();
const socket = inject('socket');
const globalSimStatus = inject('globalSimStatus');
const showGlobalSimBannerInControls = inject('showGlobalSimBannerInControls');

const players = ref([]);
const isLoadingPlayers = ref(false);
const generalErrorMessage = ref('');
const successMessage = ref('');

const simulateCount = ref(10);
// Leaderboard Pagination State
const leaderboardItemsPerPage = ref(10); // Số item mỗi trang, có thể thay đổi bằng select nếu muốn
const leaderboardCurrentPage = ref(1);
const leaderboardTotalPlayers = ref(0);
const leaderboardTotalPages = ref(1);

const limitOptions = [10, 25, 50, 100]; // Vẫn dùng cho select "Show Top" nếu muốn giữ lại, hoặc chỉ dùng cho itemsPerPage

const eloDistributionData = ref(null);
const isLoadingEloDistribution = ref(false);
const eloDistError = ref('');

const resetConfirmModalRef = ref(null);
let resetModalInstance = null;
const isResetting = ref(false);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

async function fetchData(endpoint, loadingVar, errorVar, dataVar, processFn = null) {
    loadingVar.value = true; errorVar.value = '';
    try {
        const response = await fetch(`${API_BASE_URL}/stats/${endpoint}`);
        if (!response.ok) { const errRes = await response.json().catch(() => ({})); throw new Error(errRes.message || `Err ${endpoint}`); }
        const result = await response.json();
        if (result.success) dataVar.value = processFn ? processFn(result.data) : result.data;
        else throw new Error(result.message || `Unknown err ${endpoint}`);
    } catch (error) {
        console.error(`${endpoint} Error:`, error); errorVar.value = error.message; dataVar.value = null;
    } finally { loadingVar.value = false; }
}

async function fetchPlayersWithPagination(showMainLoading = true) {
    if (showMainLoading && !globalSimStatus.value?.isRunning) isLoadingPlayers.value = true;
    generalErrorMessage.value = '';
    // successMessage.value = ''; // Keep success messages until next action

    try {
        const response = await fetch(`${API_BASE_URL}/players?limit=${leaderboardItemsPerPage.value}&page=${leaderboardCurrentPage.value}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
            throw new Error(errorData.message || `HTTP error ${response.status}`);
        }
        const result = await response.json();
        if (result.success && result.data) {
            players.value = result.data;
            if (result.pagination) {
                leaderboardTotalPlayers.value = result.pagination.totalPlayers;
                leaderboardTotalPages.value = result.pagination.totalPages;
                leaderboardCurrentPage.value = result.pagination.currentPage; // Ensure current page is updated from response
            }
        } else {
            throw new Error(result.message || "Failed to parse player data.");
        }
    } catch (error) {
        console.error("Failed to fetch players:", error);
        generalErrorMessage.value = `Failed to load players: ${error.message}`;
        players.value = [];
        leaderboardTotalPlayers.value = 0;
        leaderboardTotalPages.value = 1;
    } finally {
        if (showMainLoading && !globalSimStatus.value?.isRunning) isLoadingPlayers.value = false;
    }
}

async function fetchAllInitialData(showMainLoading = true) {
    if (showMainLoading) isLoadingPlayers.value = true; // Use one main loading indicator
    await Promise.all([
        fetchPlayersWithPagination(false), // false to avoid double setting isLoadingPlayers
        fetchData('elo-distribution', isLoadingEloDistribution, eloDistError, eloDistributionData)
    ]);
    if (showMainLoading) isLoadingPlayers.value = false;
}


function requestSimulation() {
    if (globalSimStatus.value?.isRunning) { generalErrorMessage.value = "A simulation is already in progress globally."; return; }
    if (simulateCount.value < 1 || simulateCount.value > 10000) { generalErrorMessage.value = 'Matches must be between 1 and 10000.'; return; }
    if (socket.value && socket.value.connected) {
        successMessage.value = ''; generalErrorMessage.value = '';
        socket.value.emit('start_simulation_job', { numMatches: simulateCount.value });
    } else { generalErrorMessage.value = 'Not connected to simulation server. Please check or refresh.'; }
}

function openResetModal() { if (resetModalInstance) resetModalInstance.show(); }
async function confirmResetSystem() {
    if (resetModalInstance) resetModalInstance.hide();
    isResetting.value = true; generalErrorMessage.value = ''; successMessage.value = '';
    try {
        const response = await fetch(`${API_BASE_URL}/players/initialize`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceReset: true })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `HTTP error! Status: ${response.status}`);
        successMessage.value = result.message || 'System data reset successfully.';
        leaderboardCurrentPage.value = 1; // Reset to first page
        await fetchAllInitialData(false);
    } catch (error) {
        console.error("Reset error:", error); generalErrorMessage.value = `System reset failed: ${error.message}`;
    } finally { isResetting.value = false; }
}

function goToPlayerProfile(playerId) { router.push({ name: 'PlayerProfile', params: { playerId: playerId } }); }

function changeLeaderboardPage(page) {
    if (page >= 1 && page <= leaderboardTotalPages.value && !isLoadingPlayers.value && !globalSimStatus.value?.isRunning) {
        leaderboardCurrentPage.value = page;
        fetchPlayersWithPagination(false);
    }
}
watch(leaderboardItemsPerPage, () => { // Watch items per page change
    leaderboardCurrentPage.value = 1; // Reset to first page
    if (!isLoadingPlayers.value && !globalSimStatus.value?.isRunning) {
        fetchPlayersWithPagination(false);
    }
});


const paginationRange = computed(() => {
    const current = leaderboardCurrentPage.value;
    const total = leaderboardTotalPages.value;
    const delta = 2; // Number of pages to show around current page
    const range = [];
    const rangeWithDots = [];
    let l;

    range.push(1);
    if (total <= 1) return range;

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
        range.push(i);
    }
    range.push(total);

    range.forEach((i) => {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    });
    return rangeWithDots;
});

watch(() => globalSimStatus.value?.isRunning, (newIsRunning, oldIsRunning) => {
    if (oldIsRunning === true && newIsRunning === false && globalSimStatus.value?.taskId) {
        if (!globalSimStatus.value.statusMessage.toLowerCase().includes('error') && !globalSimStatus.value.statusMessage.toLowerCase().includes('cancel')) {
            successMessage.value = globalSimStatus.value.statusMessage || `Sim task ${globalSimStatus.value.taskId} completed.`;
        }
        console.log(`Global sim ${globalSimStatus.value.taskId} ended. Refreshing data.`);
        leaderboardCurrentPage.value = 1; // Go to first page after sim
        fetchAllInitialData(false);
    }
});

onMounted(async () => {
    await fetchAllInitialData();
    if (resetConfirmModalRef.value) {
        resetModalInstance = new Modal(resetConfirmModalRef.value);
    }
});
</script>

<template>
    <div class="leaderboard-view py-4">
        <header class="mb-4 p-4 bg-primary-subtle text-primary-emphasis rounded-3 shadow-sm">
            <h1 class="display-5">Simulation Dashboard</h1>
            <p class="lead mb-0">Control match simulations and view player rankings & statistics.</p>
        </header>

        <div class="controls-section card shadow-sm mb-4">
            <div class="card-header bg-dark d-flex justify-content-between align-items-center">
                <h5 class="mb-0">System Controls</h5>
                <button class="btn btn-danger btn-sm lol-button" @click="openResetModal" :disabled="globalSimStatus?.isRunning || isResetting || isLoadingPlayers">
                    <i class="fa-solid fa-trash-can me-1"></i>
                    Reset System Data
                </button>
            </div>
            <div class="card-body">
                <div class="row gy-3 gx-3 align-items-end mb-3">
                    <div class="col-md-auto">
                        <label for="simulateCountInput" class="form-label fw-medium">Matches to Simulate:</label>
                        <input type="number" class="form-control lol-textbox" id="simulateCountInput" v-model.number="simulateCount" min="1" max="10000" style="width: 150px;" :disabled="globalSimStatus?.isRunning || isResetting">
                    </div>
                    <div class="col-md-auto">
                        <button @click="requestSimulation" class="btn btn-primary btn-sm px-4 lol-button" :disabled="globalSimStatus?.isRunning || isResetting || isLoadingPlayers">
                            <span v-if="globalSimStatus?.isRunning && globalSimStatus?.taskId" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            <template v-else>
                                <i class="fa-solid fa-play me-1"></i>
                            </template>
                            {{ globalSimStatus?.isRunning ? `Simulating...` : `Run Simulation` }}
                        </button>
                    </div>
                </div>

                <div v-if="showGlobalSimBannerInControls && globalSimStatus" class="global-simulation-controls-display mt-3 p-3 border rounded bg-lol-info">
                    <h6 class="mb-2">System Simulation Status:</h6>
                    <div v-if="globalSimStatus.isRunning && globalSimStatus.taskId">
                        <p class="mb-1 small">
                            Task <strong>{{ globalSimStatus.taskId }}</strong> running.
                            <span v-if="globalSimStatus.requestedByInfo?.socketId">By: {{ globalSimStatus.requestedByInfo.socketId.substring(0, 6) }}...</span>
                        </p>
                        <div class="progress lol-progress" style="height: 25px; font-size: 0.85rem;">
                            <div class="progress-bar progress-bar-striped progress-bar-animated bg-lol-accent text-dark"
                                 role="progressbar"
                                 :style="{ width: (globalSimStatus.totalMatches > 0 ? (globalSimStatus.completedMatches / globalSimStatus.totalMatches * 100) : 0) + '%' }"
                                 :aria-valuenow="globalSimStatus.completedMatches" aria-valuemin="0" :aria-valuemax="globalSimStatus.totalMatches">
                                <strong>{{ globalSimStatus.completedMatches }} / {{ globalSimStatus.totalMatches }}</strong>
                            </div>
                        </div>
                        <p class="mt-1 mb-0 small text-muted fst-italic">{{ globalSimStatus.statusMessage }}</p>
                    </div>
                    <div v-else-if="globalSimStatus.taskId && !globalSimStatus.isRunning">
                        <p class="mb-1" :class="globalSimStatus.statusMessage.toLowerCase().includes('error') || globalSimStatus.statusMessage.toLowerCase().includes('cancel') ? 'text-danger' : 'text-success'">
                            Task <strong>{{ globalSimStatus.taskId }}</strong> {{ globalSimStatus.statusMessage.toLowerCase().includes('completed') || globalSimStatus.statusMessage.toLowerCase().includes('finished') ? 'finished' : 'status' }}.
                        </p>
                        <p class="mb-0 small text-muted fst-italic">{{ globalSimStatus.statusMessage }}</p>
                    </div>
                    <div v-else class="text-muted"> {{ globalSimStatus.statusMessage || "System is Idle." }} </div>
                </div>
            </div>
        </div>

        <div v-if="successMessage" class="alert alert-success alert-dismissible fade show lol-alert lol-alert-success" role="alert">
            {{ successMessage }}
            <button type="button" class="btn-close btn-sm" @click="successMessage = ''" aria-label="Close"></button>
        </div>
        <div v-if="generalErrorMessage" class="alert alert-danger alert-dismissible fade show lol-alert lol-alert-danger" role="alert">
            {{ generalErrorMessage }}
            <button type="button" class="btn-close btn-sm" @click="generalErrorMessage = ''" aria-label="Close"></button>
        </div>

        <div class="row gy-4">
            <div class="col-lg-12">
                <div class="leaderboard-section card shadow-sm h-100">
                    <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
                        <h4 class="mb-0">Leaderboard</h4>
                        <div class="d-flex align-items-center gap-2">
                            <label for="leaderboardItemsPerPageSelect" class="form-label fw-medium mb-0 me-2" style="font-size: 0.95em;">Players per Page:</label>
                            <select class="form-select lol-dropdown" id="leaderboardItemsPerPageSelect" v-model.number="leaderboardItemsPerPage" style="width: 100px;" :disabled="globalSimStatus?.isRunning || isResetting || isLoadingPlayers">
                                <option v-for="option in limitOptions" :key="option" :value="option">{{ option }}</option>
                            </select>
                            <button @click="() => fetchAllInitialData()" class="btn btn-outline-secondary btn-sm lol-button" :disabled="globalSimStatus?.isRunning || isResetting || isLoadingPlayers" title="Refresh All Data">
                                <i class="fa-solid fa-arrows-rotate"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-body d-flex flex-column">
                        <div v-if="isLoadingPlayers && players.length === 0 && !globalSimStatus?.isRunning && !isResetting" class="d-flex justify-content-center align-items-center flex-grow-1" style="min-height: 300px;">
                            <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"><span class="visually-hidden">Loading...</span></div>
                        </div>
                        <div v-else-if="!globalSimStatus?.isRunning && !isLoadingPlayers && !isResetting && players.length === 0 && !generalErrorMessage" class="alert alert-info flex-grow-1">No players to display.</div>

                        <div v-if="players.length > 0" class="table-responsive flex-grow-1">
                            <table class="table table-striped table-hover align-middle lol-table">
                                <thead class="table-dark sticky-top">
                                    <tr>
                                        <th>#</th>
                                        <th>Player</th>
                                        <th>Elo</th>
                                        <th>Games</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(player, index) in players" :key="player.playerId" @click="goToPlayerProfile(player.playerId)" style="cursor: pointer;">
                                        <th scope="row">{{ (leaderboardCurrentPage - 1) * leaderboardItemsPerPage + index + 1 }}</th>
                                        <td>{{ player.playerName }}</td>
                                        <td>{{ player.elo.toFixed(0) }}</td>
                                        <td>{{ player.gamesPlayed }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <!-- Pagination Controls -->
                        <nav v-if="leaderboardTotalPages > 1 && players.length > 0" aria-label="Leaderboard navigation" class="mt-auto pt-3">
                            <ul class="pagination justify-content-center mb-0">
                                <li class="page-item" :class="{ disabled: leaderboardCurrentPage === 1 }">
                                    <a class="page-link" href="#" @click.prevent="changeLeaderboardPage(leaderboardCurrentPage - 1)">« Prev</a>
                                </li>
                                <li v-for="pageNumber in paginationRange" :key="pageNumber" class="page-item" :class="{ active: pageNumber === leaderboardCurrentPage, disabled: pageNumber === '...' }">
                                    <a class="page-link" href="#" @click.prevent="pageNumber !== '...' && changeLeaderboardPage(pageNumber)">{{ pageNumber }}</a>
                                </li>
                                <li class="page-item" :class="{ disabled: leaderboardCurrentPage === leaderboardTotalPages }">
                                    <a class="page-link" href="#" @click.prevent="changeLeaderboardPage(leaderboardCurrentPage + 1)">Next »</a>
                                </li>
                            </ul>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="modal fade" ref="resetConfirmModalRef" tabindex="-1" aria-labelledby="resetModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title" id="resetModalLabel">
                            <i class="fa-solid fa-triangle-exclamation me-2"></i>
                            Confirm System Reset
                        </h5>
                        <button type="button" class="btn-close btn-close-white btn-sm" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to reset all player data and match history? This action is irreversible and will set all players to 0 Elo and 0 games played.</p>
                        <p class="fw-bold text-danger">All current progress will be lost!</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal" :disabled="isResetting">Cancel</button>
                        <button type="button" class="btn btn-danger btn-sm" @click="confirmResetSystem" :disabled="isResetting">
                            <span v-if="isResetting" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            {{ isResetting ? 'Resetting...' : 'Yes, Reset Data' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.leaderboard-view {
    max-width: 1600px;
    margin: auto;
}

.controls-section .card-header,
.leaderboard-section .card-header {
    padding: 0.75rem 1.25rem;
}

.card-header h5,
.card-header h4,
.card-header h3 {
    margin-bottom: 0;
}

.btn-group-sm>.btn {
    display: flex;
    align-items: center;
    justify-content: center;
}

.global-simulation-controls-display {
    font-size: 0.9rem;
}

.bg-light-subtle {
    background-color: #f8f9fa !important;
}

.table-responsive {
    overflow-y: auto;
    /* Ensure vertical scroll if content overflows max-height */
}

.card-header,
.card-header h5,
.card-header h4,
.btn,
.lol-button,
.lol-textbox,
.lol-dropdown {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
}

.pagination,
.page-link {
    font-family: "beaufort-bold", 'Optimus Princeps', 'Montserrat', Arial, sans-serif !important;
    letter-spacing: 1px;
}

.bg-lol-info {
    background-color: rgba(11,198,227,0.10) !important;
}
.lol-alert-success {
    background-color: rgba(54, 180, 116, 0.13) !important;
    color: #36B474 !important;
    border-left: 4px solid #36B474 !important;
}
.lol-alert-danger {
    background-color: rgba(232, 64, 87, 0.13) !important;
    color: #E84057 !important;
    border-left: 4px solid #E84057 !important;
}
.lol-progress .progress-bar.bg-lol-accent {
    background-color: var(--lol-accent) !important;
    color: #fff !important;
}
.btn, .lol-button, .btn-sm {
    min-width: 120px;
    min-height: 36px;
    font-size: 1rem;
    padding: 0.375rem 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.btn-sm {
    font-size: 0.95rem;
    min-width: 100px;
    min-height: 32px;
    padding: 0.25rem 0.75rem;
}
</style>