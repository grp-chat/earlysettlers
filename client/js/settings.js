const socket = io();

// UI Elements
const schoolDisplay = document.getElementById('current-school-display');
const statusDisplay = document.getElementById('connection-status');

// 1. Connection & Initial Data Request
socket.on('connect', () => {
    statusDisplay.textContent = "ONLINE";
    statusDisplay.style.color = "var(--gold)";
    socket.emit('getSettingsData');
});

socket.on('disconnect', () => {
    statusDisplay.textContent = "OFFLINE";
    statusDisplay.style.color = "var(--accent-color)";
});

// 2. Data Listener: Updates the table whenever data changes locally
socket.on('settingsUpdate', (data) => {
    schoolDisplay.textContent = data.currentSchool || "No School Selected";
    renderRoster(data.players);

    // NEW: If there is a saved template, load it into the sidebar
    if (data.config && data.config.resourceTemplate) {
        renderResourceTemplate(data.config.resourceTemplate);
    }
});

// 3. Render Engine: Draws the Settler Roster
function renderRoster(players) {
    const rosterBody = document.getElementById('roster-body');
    const playerCount = document.getElementById('player-count');
    
    rosterBody.innerHTML = '';
    playerCount.textContent = `${players.length} Settlers`;

    players.forEach(player => {
        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid #222";
        
        row.innerHTML = `
            <td style="padding: 15px; color: white;">${player.name}</td>
            
            <td>
                <div style="display: flex; gap: 4px; flex-wrap: wrap; max-width: 250px;">
                    <button class="team-btn ${player.teamId === 'red' ? 'active' : ''}" 
                        style="background: #e74c3c;" onclick="updatePlayer('${player.id}', 'teamId', 'red')">R</button>
                    
                    <button class="team-btn ${player.teamId === 'blue' ? 'active' : ''}" 
                        style="background: #3498db;" onclick="updatePlayer('${player.id}', 'teamId', 'blue')">B</button>
                    
                    <button class="team-btn ${player.teamId === 'green' ? 'active' : ''}" 
                        style="background: #2ecc71;" onclick="updatePlayer('${player.id}', 'teamId', 'green')">G</button>
                    
                    <button class="team-btn ${player.teamId === 'purple' ? 'active' : ''}" 
                        style="background: #9b59b6;" onclick="updatePlayer('${player.id}', 'teamId', 'purple')">P</button>
                    
                    <button class="team-btn ${player.teamId === 'yellow' ? 'active' : ''}" 
                        style="background: #f1c40f; color: black;" onclick="updatePlayer('${player.id}', 'teamId', 'yellow')">Y</button>
                    
                    <button class="team-btn ${player.teamId === 'none' ? 'active' : ''}" 
                        style="background: #333;" onclick="updatePlayer('${player.id}', 'teamId', 'none')">X</button>
                </div>
            </td>

            <td>
                <select onchange="updatePlayer('${player.id}', 'groupId', this.value)" 
                        style="background: #0a0a1a; color: var(--gold); border: 1px solid var(--gold); padding: 5px; border-radius: 4px;">
                    <option value="0" ${player.groupId == 0 ? 'selected' : ''}>No Group</option>
                    ${[1, 2, 3, 4, 5, 6, 7, 8].map(num => `
                        <option value="${num}" ${player.groupId == num ? 'selected' : ''}>Group ${num}</option>
                    `).join('')}
                </select>
            </td>

            <td style="text-align: right; padding-right: 20px;">
                <button onclick="deletePlayer('${player.id}')" style="background: none; border: none; color: #555; cursor: pointer; font-size: 1.2rem;">🗑️</button>
            </td>
        `;
        rosterBody.appendChild(row);
    });
}

// 4. Update Logic: Updates server memory immediately
function updatePlayer(playerId, field, value) {
    // If we are updating groupId, make sure it's a number (0, 1, 2...)
    let finalValue = value;
    if (field === 'groupId') {
        finalValue = parseInt(value);
    }

    // Send the change to the server memory
    socket.emit('updatePlayerSettings', { 
        playerId: playerId, 
        field: field, 
        value: finalValue 
    });
}

// 5. Mass Recruitment Logic
function addBulkPlayers() {
    const textarea = document.getElementById('bulk-player-names');
    const rawText = textarea.value.trim();

    if (!rawText) {
        alert("The list is empty!");
        return;
    }

    const nameList = rawText.split('\n')
                            .map(name => name.trim())
                            .filter(name => name !== "");

    const newPlayers = nameList.map(name => ({
        id: "p" + Math.random().toString(36).substr(2, 9),
        name: name,
        teamId: "none",
        groupId: 0,
        absent: false
    }));

    socket.emit('createBulkPlayers', newPlayers);
    textarea.value = "";
}

// 6. Delete Settler
function deletePlayer(playerId) {
    if (confirm("Remove this settler from the kingdom?")) {
        socket.emit('deletePlayer', playerId);
    }
}

// 7. Cloud Sync: The Big Green Button
function saveAllToCloud() {
    // 1. Grab all the resource dropdowns we created in the sidebar
    const resourceDropdowns = document.querySelectorAll('.resource-select');
    
    // 2. Convert them into a clean array of strings: ['wood', 'clay', 'random'...]
    const currentTemplate = Array.from(resourceDropdowns).map(select => select.value);

    // 3. Send this list to the server memory
    socket.emit('updateRoundTemplate', currentTemplate);

    const btn = event.target;
    btn.textContent = "⏳ SYNCING...";
    btn.style.opacity = "0.7";
    btn.disabled = true;

    socket.emit('saveAllToCloud');
}

// NEW: Function to build the sidebar dropdowns from saved data
function renderResourceTemplate(template) {
    const container = document.getElementById('resource-pool-container');
    container.innerHTML = ''; // Clear the defaults

    template.forEach(resourceValue => {
        const div = document.createElement('div');
        div.className = 'resource-config-item';
        div.innerHTML = `
            <select class="resource-select">
                <option value="wood" ${resourceValue === 'wood' ? 'selected' : ''}>Wood</option>
                <option value="clay" ${resourceValue === 'clay' ? 'selected' : ''}>Clay</option>
                <option value="stone" ${resourceValue === 'stone' ? 'selected' : ''}>Stone</option>
                <option value="random" ${resourceValue === 'random' ? 'selected' : ''}>Random (?)</option>
            </select>
            <button class="remove-btn" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(div);
    });
}

function triggerSoftReset() {
    if (confirm("♻️ CLEAR SESSION? This wipes all resources and buildings in current memory, but will NOT overwrite your GitHub save file.")) {
        if (confirm("Are you sure? This will reset the TV Dashboard to zero immediately.")) {
            socket.emit('requestSoftReset');
        }
    }
}

// Notification Handler
socket.on('notify', (msg) => {
    alert(msg);
    const saveBtn = document.querySelector('button[onclick="saveAllToCloud()"]');
    if(saveBtn) {
        saveBtn.textContent = "🏰 COMMIT TO KINGDOM";
        saveBtn.style.opacity = "1";
        saveBtn.disabled = false;
    }
});