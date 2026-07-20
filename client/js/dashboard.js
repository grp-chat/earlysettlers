/**
 * dashboard.js
 * Main Scoreboard & Architect Drawer Logic
 */

const socket = io();
let isDrawerOpen = false;
let lastServerData = null;

// --- SOCKET CONNECTION ---
socket.on('connect', () => {
    console.log("Dashboard Connected 📺");
    socket.emit('getSettingsData');
});

// Command to show the universal drawer
socket.on('forceOpenArchitect', () => {
    openDrawer();
});

// Command to hide the universal drawer
socket.on('forceCloseArchitect', () => {
    closeDrawer();
});

socket.on('settingsUpdate', (data) => {
    lastServerData = data;
    
    // Update School Name Header
    const schoolEl = document.getElementById('school-name');
    if (schoolEl && data.currentSchool) {
        schoolEl.textContent = data.currentSchool.toUpperCase();
    }
    
    // Update the main team grid (Leaderboard Style)
    renderTeamStats(data); 

    // LIVE UPDATE: If the drawer is visible, refresh resource counts and build status
    if(isDrawerOpen) {
        updateDrawerResources(data);
        refreshDrawerStatus();
    }
});

// --- UI NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(`btn-${tabId}`);
    if (targetBtn) targetBtn.classList.add('active');

    document.querySelectorAll('.dashboard-view').forEach(view => view.classList.remove('active'));
    const view = document.getElementById(`view-${tabId}`);
    if (view) view.classList.add('active');
}

socket.on('lockStatusUpdate', (locked) => {
    const body = document.body;
    const lockStatus = document.getElementById('lockStatus');
    const drawerTitle = document.getElementById('drawer-title');

    if (locked) {
        // This prevents ALL mouse clicks, scrolls, and interactions
        body.style.pointerEvents = "none";
        // 1. Update Main Dashboard Header
        if (lockStatus) {
            lockStatus.innerHTML = `<span style="color:var(--accent)">🔒 SYSTEM LOCKED BY ARCHITECT</span>`;
        }
        // 2. Update Drawer Header (if it exists/is open)
        if (drawerTitle) {
            drawerTitle.innerHTML = `<span style="color:var(--accent)">🔒 ARCHITECT LOCKED</span>`;
        }

        // body.style.filter = "grayscale(0.5) contrast(0.8)"; // Optional: visual cue
        console.log("🔒 Dashboard Locked by GM");
    } else {
        body.style.pointerEvents = "auto";
        // Restore Main Dashboard Header
        if (lockStatus) {
            lockStatus.textContent = "";
        }

        // Restore Drawer Header
        if (drawerTitle) {
            drawerTitle.textContent = `ARCHITECT`;
        }
        // body.style.filter = "none";
        console.log("🔓 Dashboard Unlocked");
    }
});

// --- ARCHITECT DRAWER LOGIC ---
function openDrawer() {
    if (typeof structures === 'undefined') return;

    isDrawerOpen = true;
    const drawer = document.getElementById('architect-drawer');
    const grid = document.getElementById('drawer-grid');
    const title = document.getElementById('drawer-title');
    
    // if (title) title.textContent = `ARCHITECT`;

    // Reset grid content
    grid.innerHTML = '';
    
    const allTeams = ['red', 'blue', 'green', 'purple', 'yellow', 'none'];
    const teamColors = {
        'red': '#e74c3c', 'blue': '#3498db', 'green': '#2ecc71',
        'purple': '#9b59b6', 'yellow': '#f1c40f', 'none': '#777'
    };

    const formatVal = (val) => {
        if (Array.isArray(val) && val.length > 1 && val[0] !== val[1]) {
            return `${val[0]}<span style="opacity:0.5; font-size:0.8em; margin:0 3px;">➔</span>${val[1]}`;
        }
        return Array.isArray(val) ? val[0] : val;
    };

    Object.values(structures).forEach(s => {
        const card = document.createElement('div');
        card.id = `card-${s.id}`;
        card.className = `drawer-card`;
        
        let costs = [];
        if(s.woodCost) costs.push(`🪵<span>${formatVal(s.woodCost)}</span>`);
        if(s.clayCost) costs.push(`🏺<span>${formatVal(s.clayCost)}</span>`);
        if(s.stoneCost) costs.push(`🪨<span>${formatVal(s.stoneCost)}</span>`);
        
        const ptDisplay = formatVal(s.points);
        costs.push(`<span style="color:var(--gold)">🏆<span>${ptDisplay}</span></span>`);

        let infoText = "";
        if (s.specialText) {
            infoText = s.specialText.toUpperCase();
        } else if (s.requires) {
            const reqs = Array.isArray(s.requires) ? s.requires : [s.requires];
            infoText = reqs.join(', ').toUpperCase();
        }

        // Show status indicators for ALL teams in the universal drawer
        let statusRowHtml = allTeams.map(tName => `
            <div class="team-status-indicator" id="status-${tName}-${s.id}">
                <span style="color:${teamColors[tName]}">${tName === 'none' ? 'UNAS' : tName.toUpperCase().substring(0,3)}:</span>
                <span class="status-icon">❌</span>
            </div>
        `).join('');

        const frameContent = s.image 
            ? `<div style="display: inline-block; background: #000; height: 80px; line-height: 0; border-bottom: 1px solid #444;">
                <img src="${s.image}" style="height: 100%; width: auto; display: block;">
               </div>` 
            : `<div style="width: 100%; height: 80px; display: flex; align-items: center; justify-content: center; color: #444; font-size: 0.6rem; background: #222;">
                [ ${s.id.toUpperCase()} ]
               </div>`;

        card.innerHTML = `
            <div class="card-img-header" style="width: 100%; display: flex; justify-content: center; background: transparent;">
                ${frameContent}
            </div>
            <div class="card-details">
                <h4>${s.name.toUpperCase()}</h4>
                <p style="min-height: 1.2em; font-size: 0.5rem;">${infoText}</p>
                <div class="mini-costs" style="display: flex; gap: 8px; flex-wrap: wrap;">${costs.join(' ')}</div>
                <div class="team-availability-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2px;">
                    ${statusRowHtml}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (lastServerData) {
        updateDrawerResources(lastServerData);
        refreshDrawerStatus();
    }
}

function closeDrawer() {
    const drawer = document.getElementById('architect-drawer');
    if (drawer) drawer.classList.remove('open');
    document.body.style.overflow = 'auto'; 
    isDrawerOpen = false;
}

// --- DATA CALCULATION ---
function checkCanBuild(structure, teamName) {
    if (!lastServerData || !lastServerData.teamStats || !lastServerData.teamStats[teamName]) return false;
    
    const teamData = lastServerData.teamStats[teamName];
    const teamBuildings = teamData.buildings || [];
    
    const currentCount = teamBuildings.filter(b => (b.id || b) === structure.id).length;
    if (currentCount >= structure.maxBuild) return false;

    if (structure.id === 'boat') {
        const pierCount = teamBuildings.filter(b => (b.id || b) === 'fishing_pier').length;
        if (currentCount >= pierCount * 2) return false;
    }

    const costIdx = currentCount === 0 ? 0 : (structure.woodCost?.length > 1 || structure.clayCost?.length > 1 || structure.stoneCost?.length > 1 ? 1 : 0);
    const w = structure.woodCost ? (structure.woodCost[costIdx] ?? structure.woodCost[0]) : 0;
    const c = structure.clayCost ? (structure.clayCost[costIdx] ?? structure.clayCost[0]) : 0;
    const s = structure.stoneCost ? (structure.stoneCost[costIdx] ?? structure.stoneCost[0]) : 0;
    
    if (teamData.wood < w || teamData.clay < c || teamData.stone < s) return false;

    if (structure.requires) {
        const reqs = Array.isArray(structure.requires) ? structure.requires : [structure.requires];
        const ownedIds = teamBuildings.map(b => b.id || b);
        if (!reqs.every(reqId => ownedIds.includes(reqId))) return false;
    }
    
    return true;
}

// --- UI UPDATERS ---

function refreshDrawerStatus() {
    if (!lastServerData) return;
    
    const allTeams = ['red', 'blue', 'green', 'purple', 'yellow', 'none'];

    Object.values(structures).forEach(s => {
        allTeams.forEach(team => {
            const statusContainer = document.getElementById(`status-${team}-${s.id}`);
            if (statusContainer) {
                const canBuild = checkCanBuild(s, team);
                const iconSpan = statusContainer.querySelector('.status-icon');
                if (iconSpan) {
                    iconSpan.textContent = canBuild ? '✔️' : '❌';
                }
                statusContainer.style.opacity = canBuild ? "1" : "0.3";
            }
        });
    });
}

function updateDrawerResources(data) {
    if(!data.teamStats) return;
    const teams = ['red', 'blue', 'green', 'purple', 'yellow', 'none'];
    
    teams.forEach(team => {
        const t = data.teamStats[team];
        if(t) {
            ['wood', 'clay', 'stone', 'points'].forEach(res => {
                const el = document.getElementById(`dw-${res}-${team}`);
                if(el) el.textContent = t[res] !== undefined ? t[res] : 0;
            });
        }
    });
}

function renderTeamStats(data) {
    const stats = data.teamStats || {};
    const teams = ['red', 'blue', 'green', 'purple', 'yellow', 'none'];

    teams.forEach(team => {
        const t = stats[team];
        if(!t) return;

        ['wood', 'clay', 'stone', 'points'].forEach(res => {
            const el = document.getElementById(`${res}-${team}`);
            if(el) el.textContent = t[res] !== undefined ? t[res] : 0;
        });

        const assetContainer = document.getElementById(`assets-${team}`);
        if (assetContainer) {
            const buildings = t.buildings || [];
            if (buildings.length === 0) {
                assetContainer.innerHTML = '<div class="empty-msg" style="color:#555; font-size:10px;">NO BUILDINGS</div>';
            } else {
                const localCounts = {}; 
                assetContainer.innerHTML = buildings.map(b => {
                    const struct = typeof structures !== 'undefined' ? structures[b.id] : null;
                    if (!struct) return `<div class="asset-row">${b.id}</div>`;

                    localCounts[b.id] = (localCounts[b.id] || 0) + 1;
                    const qty = localCounts[b.id];
                    const pts = (qty > 1 && struct.points.length > 1) ? struct.points[1] : struct.points[0];

                    return `
                        <div class="asset-row" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); margin-bottom: 2px; padding: 2px 5px; border-radius: 2px; font-size: 11px; border-left: 2px solid #444;">
                            <span style="color: #bbb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">${struct.name.toUpperCase()}</span>
                            <span style="color: #f1c40f; font-weight: bold;">+${pts}</span>
                        </div>`;
                }).join('');
            }
        }
    });
}