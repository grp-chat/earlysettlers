const socket = io();
let allPlayers = []; // Local memory of all players
let currentGroupId = 1;
let currentPhase = 'harvest';
let selectedPlayerId = null; // Add this at the very top
let currentClaims = {}; // <--- ADD THIS AT THE TOP
let actedPlayers = []; // <--- ADD THIS LINE
let lastServerData = {}; // Global store for team stats
let localRoundCount = 1; // Start at Round 1

let isLocked = false;

function toggleDashboardLock() {
    isLocked = !isLocked; // Flip the true/false

    // UI Update for the controller button itself
    const lockBtn = document.getElementById('btn-lock-dashboard');
    if (lockBtn) {
        lockBtn.textContent = isLocked ? "UNLOCK DASHBOARD" : "LOCK DASHBOARD";
        lockBtn.style.borderColor = isLocked ? "var(--accent)" : "var(--gold)";
        lockBtn.style.color = isLocked ? "var(--gold)" : "var(--accent)";
    }

    console.log("Sending Lock Command:", isLocked);
    socket.emit('request_lock_dashboard', isLocked);
}

// --- DRAWER CONTROL FUNCTIONS ---

function sendOpenDrawer() {
    console.log("Sending Open Command...");
    socket.emit('request_open_drawer');
}

function sendCloseDrawer() {
    console.log("Sending Close Command...");
    socket.emit('request_close_drawer');
}

// --- SOCKET CONNECTION ---
socket.on('connect', () => {
    console.log("Action Panel Connected 🏰");
    addLog("Connection established with server.", "#2ecc71"); // Optional: Green for success
    socket.emit('getSettingsData');
    socket.emit('getCurrentRoundStatus');
});



// Listen for the start to render the buttons
socket.on('roundStarted', (data) => {
    currentClaims = {}; // Reset local claims memory
    renderResourceButtons(data.template);
    actedPlayers = []; // Ensure this is empty

    // --- ADD THIS LINE TO LIGHT UP CHIPS ---
    renderGroup(currentGroupId);
});

socket.on('settingsUpdate', (data) => {
    lastServerData = data; // <--- ADD THIS LINE HERE
    allPlayers = data.players || allPlayers;

    // 1. Handle Tab Lockdown
    const tabs = document.querySelectorAll('#harvest-tabs .tab-btn');
    tabs.forEach((tab, index) => {
        const groupId = index + 1;
        const hasPlayers = allPlayers.some(p => p.groupId === groupId);

        if (!hasPlayers) {
            tab.style.opacity = "0.2";
            tab.style.pointerEvents = "none";
            tab.style.filter = "grayscale(1)";
        } else {
            tab.style.opacity = "1";
            tab.style.pointerEvents = "auto";
            tab.style.filter = "none";
        }
    });

    // --- RE-SYNC DATA FROM SERVER ON REFRESH ---
    // If the server sent claims/acted players in this packet, save them!
    if (data.claims) currentClaims = data.claims;
    if (data.actedPlayers) actedPlayers = data.actedPlayers;



    // 2. Render resources - CRITICAL: Use currentClaims here
    if (data.config && data.config.resourceTemplate) {
        renderResourceButtons(data.config.resourceTemplate, currentClaims);
    }

    // 3. Render Players - It will now check actedPlayers automatically
    if (currentPhase === 'harvest') {
        renderGroup(currentGroupId);
    } else {
        showAllPlayers();
    }
});

// Add this listener at the bottom of controller.js to catch updates
socket.on('roundUpdate', (data) => {
    // Save the global state locally so the refresh can use it
    currentClaims = data.claims || {};
    actedPlayers = data.actedPlayers || [];

    // Now trigger the UI refresh
    socket.emit('getSettingsData');
});

// Triggered when the server crashes or the connection is lost
socket.on('disconnect', (reason) => {
    console.warn("Lost connection:", reason);
    addLog("⚠️ SERVER DISCONNECTED: Actions will not save!", "#ff4444");
});

// Triggered if the client cannot reach the server at all
socket.on('connect_error', () => {
    addLog("❌ CONNECTION ERROR: Check server status.", "#ff4444");
});




// --- CORE UI FUNCTIONS ---

/**
 * Replaces your existing showGroup logic to use real data
 */
function showGroup(id, btn) {
    currentGroupId = id;

    selectedPlayerId = null;

    // UI: Update Tab Buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    renderGroup(id);
    // ADD THIS: Force the buttons to re-draw so they look at currentGroupId's claims
    socket.emit('getSettingsData');

}

/**
 * Replaces your existing showAllPlayers logic to use real data
 */
function showAllPlayers() {
    const container = document.getElementById('player-grid-container');
    container.innerHTML = "";

    // Sort alphabetically by name
    const sorted = [...allPlayers].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach(player => {
        createPlayerChip(container, player);
    });
}

/**
 * Helper to render only a specific group
 */
function renderGroup(id) {
    const container = document.getElementById('player-grid-container');
    container.innerHTML = "";

    const filtered = allPlayers.filter(p => p.groupId === parseInt(id));

    filtered.forEach(player => {
        createPlayerChip(container, player);
    });
}

/**
 * Creates the HTML for the player chip with team colors
 */
function createPlayerChip(container, player) {
    const chip = document.createElement('div');

    // Apply team-specific color classes
    const teamClass = `team-${player.teamId || 'none'}`;

    // CHECK IF ACTED:
    const hasActed = actedPlayers.includes(player.id);
    const actedClass = hasActed ? 'has-acted' : '';


    chip.className = `player-chip ${teamClass} ${actedClass}`;
    chip.id = `chip-${player.id}`;
    chip.textContent = player.name;

    chip.onclick = function () {
        if (hasActed) return; // Optional: prevent selection of acted players
        selectPlayer(this, player);
    };

    container.appendChild(chip);
}

/**
 * Highlights the player and logs the selection
 */
function selectPlayer(el, playerObj) {
    document.querySelectorAll('.player-chip').forEach(chip => chip.classList.remove('active-player'));
    el.classList.add('active-player');

    selectedPlayerId = playerObj.id; // <--- ADD THIS LINE

    console.log(`Targeting: ${playerObj.name} | Team: ${playerObj.teamId}`);

    // Add logic to the log panel
    const log = document.getElementById('log-container');
    const entry = document.createElement('div');
    entry.textContent = `[Log] Selected ${playerObj.name} (Team ${playerObj.teamId})`;
    log.prepend(entry);
}

function renderBuildingGrid() {
    const container = document.getElementById('building-grid');
    container.innerHTML = "";

    // Object.values converts your { farm_house: {...} } into [{...}, {...}]
    // This allows us to use .forEach()
    Object.values(structures).forEach(build => {
        const btn = document.createElement('div');
        btn.className = 'build-btn';

        // Note: Your structures.js doesn't have icons yet, 
        // so I'm using a fallback emoji.
        btn.innerHTML = `
            <div style="font-size: 1.2rem;">${build.icon || '🏗️'}</div>
            <div style="font-size: 0.65rem; margin-top: 4px;">${build.name}</div>
        `;

        btn.onclick = function () {
            // This will now pass the whole building object to your click handler
            if (typeof handleBuildClick === 'function') {
                handleBuildClick(build);
            } else {
                console.log("Selected building:", build.name);
            }
        };

        container.appendChild(btn);
    });
}

/**
 * Updates the global phase state
 */
function setPhase(phase, btn) {
    currentPhase = phase;

    // Existing UI logic from your HTML
    document.getElementById('btn-harvest').classList.remove('active-phase');
    document.getElementById('btn-building').classList.remove('active-phase');
    btn.classList.add('active-phase');

    const hTabs = document.getElementById('harvest-tabs');
    const hGrid = document.getElementById('harvest-grid');
    const bGrid = document.getElementById('building-grid');
    const resLabel = document.getElementById('resource-label');

    if (phase === 'harvest') {
        hTabs.classList.remove('hidden');
        hGrid.classList.remove('hidden');
        bGrid.classList.add('hidden');
        resLabel.textContent = "Resources";
        socket.emit('getSettingsData');
    } else {
        hTabs.classList.add('hidden');
        hGrid.classList.add('hidden');
        bGrid.classList.remove('hidden');
        resLabel.textContent = "Buildings";
        showAllPlayers();
        renderBuildingGrid();
    }
}

// The Trigger
function triggerNextRound() {
    if (confirm("Clear all claims and start the next round?")) {
        // --- ADD THESE TWO LINES ---
        actedPlayers = [];   // Clear the local "dark" chips immediately
        currentClaims = {};  // Clear local claims
        // ---------------------------
        socket.emit('startNextRound');

        // UI Log
        const log = document.getElementById('log-container');
        const entry = document.createElement('div');
        entry.textContent = `[Log] New Round Started.`;
        entry.style.color = "var(--gold)";
        log.prepend(entry);

        // 1. Increment the local counter
        localRoundCount++;

        // 2. Update the UI Element immediately
        const roundEl = document.getElementById('round');
        if (roundEl) {
            roundEl.textContent = `ROUND: ${localRoundCount}`;
        }
    }
}



// Render the dynamic resource buttons
function renderResourceButtons(template, claims = {}) {
    const grid = document.getElementById('harvest-grid');
    grid.innerHTML = "";

    // Ensure we are looking at the numeric ID for claims
    const groupClaims = claims[parseInt(currentGroupId)] || [];

    template.forEach((res, index) => {
        const isClaimed = groupClaims.includes(index);
        const btn = document.createElement('div');

        // Style the button
        btn.className = `res-btn res-${res} ${isClaimed ? 'claimed' : ''}`;

        // Choose Display Icon
        let displayIcon = (res === 'wood') ? "🪵" : 
                         (res === 'clay') ? "🏺" : 
                         (res === 'stone') ? "🪨" : "🎲";

        btn.innerHTML = `${displayIcon} ${res.toUpperCase()}`;

        btn.onclick = () => {
            if (isClaimed) return; 
            if (!selectedPlayerId) return alert("Select a settler first!");

            // Find the player in our local memory
            const player = allPlayers.find(p => p.id === selectedPlayerId);
            if (!player) return;

            // --- RANDOM LOGIC ---
            let finalResource = res;
            let logIcon = displayIcon;

            if (res === 'random') {
                const options = ['wood', 'clay', 'stone'];
                finalResource = options[Math.floor(Math.random() * options.length)];
                
                // Update icon for the log specifically
                if (finalResource === 'wood') logIcon = "🪵";
                if (finalResource === 'clay') logIcon = "🏺";
                if (finalResource === 'stone') logIcon = "🪨";
            }

            // --- UI LOGGING (LOCAL ONLY) ---
            addLog(`${player.name} gathered ${logIcon} ${finalResource.toUpperCase()}`, "var(--gold)");

            // --- SEND TO SERVER ---
            socket.emit('claimResource', {
                playerId: player.id,
                groupId: player.groupId,
                resourceIndex: index, 
                resourceName: finalResource
            });
        };

        grid.appendChild(btn);
    });
}


function addLog(message, color = "inherit") {
    const log = document.getElementById('log-container');
    if (!log) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.style.marginBottom = "2px";
    entry.style.color = color;
    entry.innerHTML = `<span style="opacity:0.5; font-size:0.8em;">[${time}]</span> ${message}`;

    log.prepend(entry);
}




