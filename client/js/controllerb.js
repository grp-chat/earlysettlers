/**
 * controllerb.js 
 * Extension for Building Phase Logic: Requirements, Max Limits & Dynamic Costs
 */

(function () {
    console.log("🏗️ Building Phase Extension Loaded (controllerb.js)");

    // --- 1. STYLE INJECTION ---
    const style = document.createElement('style');
    style.textContent = `
        .build-btn { transition: all 0.2s ease; cursor: pointer; position: relative; }
        .build-locked { 
            opacity: 0.15; 
            filter: grayscale(1) blur(1px); 
            pointer-events: none; 
            transform: scale(0.9);
            border: 1px dashed rgba(255,255,255,0.2) !important;
        }
        .build-affordable { 
            opacity: 1 !important; 
            filter: grayscale(0) !important; 
            pointer-events: auto !important;
            transform: scale(1.02);
            border: 2px solid #ffd700 !important;
            box-shadow: 0 0 12px rgba(255, 215, 0, 0.4);
        }
        .active-player {
            outline: 3px solid #fff !important;
            outline-offset: 2px;
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.6);
            transform: scale(1.05);
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);

    // --- 2. GLOBAL REFRESH LISTENER ---
    socket.on('settingsUpdate', (data) => {
        if (currentPhase === 'building') {
            console.log("🔄 Global Refresh: Syncing Players and Buildings");
            renderBuildingPhasePlayers();

            if (selectedPlayerId) {
                const player = allPlayers.find(p => p.id === selectedPlayerId);
                if (player) {
                    updateBuildingAvailability(player);
                }
            } else {
                lockAllBuildings();
            }
        }
    });

    const buildBtn = document.getElementById('btn-building');
    if (buildBtn) {
        buildBtn.addEventListener('click', () => {
            selectedPlayerId = null;
            renderBuildingPhasePlayers();
            lockAllBuildings();
        });
    }

    // --- 3. CORE FUNCTIONS ---

    function lockAllBuildings() {
        document.querySelectorAll('.build-btn').forEach(btn => {
            btn.classList.remove('build-affordable');
            btn.classList.add('build-locked');
            btn.onclick = null;
        });
    }

    function updateBuildingAvailability(player) {
        const teamId = player.teamId;
        const stats = (lastServerData && lastServerData.teamStats) ? lastServerData.teamStats[teamId] : null;

        if (!stats) return lockAllBuildings();

        const teamBuildings = stats.buildings || [];
        const btns = document.querySelectorAll('.build-btn');

        btns.forEach(btn => {
            const nameDiv = btn.querySelector('div:last-child');
            if (!nameDiv) return;

            const buildName = nameDiv.textContent;
            const struct = Object.values(structures).find(s => s.name === buildName);
            if (!struct) return;

            // 1. Requirements Check
            let hasReqs = true;
            if (struct.requires) {
                const reqs = Array.isArray(struct.requires) ? struct.requires : [struct.requires];
                const tempInv = [...teamBuildings.map(b => b.id)];
                for (const r of reqs) {
                    const idx = tempInv.indexOf(r);
                    if (idx === -1) { hasReqs = false; break; }
                    tempInv.splice(idx, 1);
                }
            }

            // 2. Max Check
            const currentCount = teamBuildings.filter(b => b.id === struct.id).length;
            const underMax = currentCount < struct.maxBuild;

            // 2b. DYNAMIC CAPACITY CHECK (Uses the new key from structures.js)
            let hasCapacity = true;
            if (struct.capacity) {
                const { requiredBuilding, ratio } = struct.capacity;
                const parentCount = teamBuildings.filter(b => b.id === requiredBuilding).length;
                if (currentCount >= (parentCount * ratio)) {
                    hasCapacity = false;
                }
            }

            // 3. Dynamic Cost
            const costIdx = currentCount === 0 ? 0 : (struct.woodCost?.length > 1 || struct.clayCost?.length > 1 || struct.stoneCost?.length > 1 ? 1 : 0);
            const wReq = struct.woodCost ? (struct.woodCost[costIdx] ?? struct.woodCost[0]) : 0;
            const cReq = struct.clayCost ? (struct.clayCost[costIdx] ?? struct.clayCost[0]) : 0;
            const sReq = struct.stoneCost ? (struct.stoneCost[costIdx] ?? struct.stoneCost[0]) : 0;

            const canAfford = ((stats.wood || 0) >= wReq && (stats.clay || 0) >= cReq && (stats.stone || 0) >= sReq);

            // Clean Slate for Button
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            if (hasReqs && underMax && canAfford && hasCapacity) {
                newBtn.classList.remove('build-locked');
                newBtn.classList.add('build-affordable');
                newBtn.onclick = (e) => {
                    e.stopPropagation();
                    const costString = `${wReq ? wReq + ' Wood ' : ''}${cReq ? cReq + ' Clay ' : ''}${sReq ? sReq + ' Stone' : ''}`;
                    if (confirm(`Build ${struct.name} for ${costString}?`)) {
                        // --- ADD THE LOG HERE ---
                        if (typeof addLog === 'function') {
                            const teamId = player.teamId;
                            addLog(`${player.name} (Team ${teamId.toUpperCase()}) built ${struct.name.toUpperCase()} 🏗️`, "var(--gold)");
                        }
                        // -----------------------
                        socket.emit('purchaseBuilding', { playerId: selectedPlayerId, buildingId: struct.id });
                    }
                };
            } else {
                newBtn.classList.remove('build-affordable');
                newBtn.classList.add('build-locked');
            }
        });
    }

    function renderBuildingPhasePlayers() {
        const container = document.getElementById('player-grid-container');
        if (!container) return;
        container.innerHTML = "";

        const sortedPlayers = [...allPlayers].sort((a, b) => a.name.localeCompare(b.name));
        sortedPlayers.forEach(player => {
            const chip = document.createElement('div');
            chip.className = `player-chip team-${player.teamId || 'none'}`;
            chip.textContent = player.name;

            if (selectedPlayerId === player.id) {
                chip.classList.add('active-player');
            }

            chip.onclick = function (e) {
                e.stopPropagation();
                selectedPlayerId = player.id;
                renderBuildingPhasePlayers();
                updateBuildingAvailability(player);
            };
            container.appendChild(chip);
        });
    }

    // --- 4. CLICK BACKGROUND TO DESELECT ---
    document.addEventListener('click', (e) => {
        if (currentPhase === 'building') {
            const hitPlayer = e.target.closest('.player-chip');
            const hitBuild = e.target.closest('.build-btn');

            if (!hitPlayer && !hitBuild) {
                selectedPlayerId = null;
                renderBuildingPhasePlayers();
                lockAllBuildings();
            }
        }
    });

})();