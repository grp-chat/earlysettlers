require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const githubSync = require('./githubSync');

const app = express();
const server = http.createServer(app);
const io = new Server(server);


const structures = require('./structures.js');

// --- DATABASE & SESSION MEMORY ---
let saveData = null;
let isDashboardLocked = false; // Global variable at the top of app.js


// NEW: Temporary memory for the current round (Cleared every 'Next Round')
let liveRound = {
    claims: {},      // Format: { "groupId": [index1, index2] }
    actedPlayers: [] // List of IDs: ['p1', 'p5']
};

app.use(express.static(path.join(__dirname, 'client')));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// --- TEAM INITIALIZATION LOGIC ---
// --- TEAM INITIALIZATION & CLEANUP LOGIC ---
function initializeTeamStats() {
    if (!saveData) return;

    const activeSchool = saveData.settings.currentSchool;
    const school = saveData.schools[activeSchool];

    if (school && school.players) {
        if (!school.teamStats) {
            school.teamStats = {};
        }

        // 1. Get a list of all teams that currently have players
        const teamsWithPlayers = new Set(school.players.map(p => p.teamId).filter(t => t));

        // 2. Add stats for NEW teams found in the player list
        teamsWithPlayers.forEach(team => {
            if (!school.teamStats[team]) {
                school.teamStats[team] = {
                    wood: 0,
                    clay: 0,
                    stone: 0,
                    points: 0,
                    buildings: [],
                    woodBonusCounter: 0 // Added for bonus tracking
                };
                console.log(`Initialized stats for team: ${team}`);
            } else {
                // SAFETY CHECK: If the team exists but woodBonusCounter is missing (from old saves)
                if (school.teamStats[team].woodBonusCounter === undefined) {
                    school.teamStats[team].woodBonusCounter = 0;
                }
            }
        });

        // 3. CLEANUP: Remove stats for teams that no longer have players
        Object.keys(school.teamStats).forEach(teamName => {
            if (!teamsWithPlayers.has(teamName)) {
                delete school.teamStats[teamName];
                console.log(`🗑️ Removed empty team from stats: ${teamName}`);
            }
        });
    }
}

// --- CLOUD INITIALIZATION ---
async function startKingdom() {
    console.log("🏰 Connecting to GitHub cloud...");
    const cloudData = await githubSync.pull();

    if (cloudData && cloudData.settings) {
        saveData = cloudData;
        console.log(`✅ Data Loaded. Active School: ${saveData.settings.currentSchool}`);

        // Setup stats immediately after pulling from cloud
        initializeTeamStats();

    } else {
        console.error("❌ ERROR: Data missing or corrupted. Using fallback.");
        saveData = { settings: { currentSchool: "None" }, schools: {}, config: { resourceTemplate: ['wood', 'wood', 'clay', 'clay', 'stone', 'stone'] } };
    }

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`🚀 Early Settlers running on port: ${PORT}`);
    });
}

function calculateTeamPoints(teamId) {
    if (!saveData) return;
    const activeSchool = saveData.settings.currentSchool;
    const school = saveData.schools[activeSchool];
    const stats = school.teamStats[teamId];

    if (!stats || !stats.buildings) return;

    let totalPoints = 0;
    const counts = {}; // To track how many of each building the team has

    // 1. Calculate Base Points
    stats.buildings.forEach(b => {
        const struct = structures[b.id];
        if (!struct) return;

        // Track quantity of this specific building type
        counts[b.id] = (counts[b.id] || 0) + 1;
        const currentQty = counts[b.id];

        // LOGIC: Use index 1 for 2nd house onwards, otherwise use index 0
        const pointValue = (currentQty > 1 && struct.points.length > 1)
            ? struct.points[1]
            : struct.points[0];

        totalPoints += pointValue;
    });

    // 2. Apply Specialty Buffs (Pond Logic)
    // Check if team has at least one Pond
    if (counts['pond'] > 0) {
        const penCount = counts['animal_pen'] || 0;
        // Add +1 for every Animal Pen
        totalPoints += (penCount * 1);
        console.log(`✨ Team ${teamId} Pond Bonus: +${penCount} points`);
    }

    // 3. Save result to memory
    stats.points = totalPoints;
    console.log(`📊 Team ${teamId} Total Points: ${totalPoints}`);
}

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {

    console.log('👤 Settler connected:', socket.id);

    socket.emit('lockStatusUpdate', isDashboardLocked);

    socket.on('request_lock_dashboard', (shouldLock) => {
        isDashboardLocked = shouldLock;
        console.log(`Dashboard Lock Status: ${isDashboardLocked}`);
        // Broadcast to everyone (Dashboard and Controllers)
        io.emit('lockStatusUpdate', isDashboardLocked);
    });

    // 1. Initial Data Request
    socket.on('getSettingsData', () => {
        if (!saveData) return;
        const activeSchool = saveData.settings.currentSchool;
        const school = saveData.schools[activeSchool];
        const players = school?.players || [];

        socket.emit('settingsUpdate', {
            currentSchool: activeSchool,
            players,
            teamStats: school?.teamStats || {},
            config: saveData.config
        });
    });

    // 2. Update Player (Memory Only)
    socket.on('updatePlayerSettings', (data) => {
        if (!saveData) return;
        const activeSchool = saveData.settings.currentSchool;
        const school = saveData.schools[activeSchool];

        if (school) {
            const player = school.players.find(p => p.id === data.playerId);
            if (player) {
                player[data.field] = data.value;
                io.emit('settingsUpdate', { currentSchool: activeSchool, players: school.players, teamStats: school.teamStats });
                console.log(`⚡ Local update: ${player.name} -> ${data.field}: ${data.value}`);
            }
        }
    });

    // 3. Bulk Add (Memory Only)
    socket.on('createBulkPlayers', (newPlayers) => {
        if (!saveData) return;
        const activeSchool = saveData.settings.currentSchool;

        if (!saveData.schools[activeSchool]) {
            saveData.schools[activeSchool] = { players: [], teamStats: {} };
        }

        const initializedPlayers = newPlayers.map(p => ({
            ...p,
            groupId: p.groupId || 0
        }));

        saveData.schools[activeSchool].players.push(...initializedPlayers);

        // Re-run initialization to catch any new teams added via bulk
        initializeTeamStats();

        io.emit('settingsUpdate', {
            currentSchool: activeSchool,
            players: saveData.schools[activeSchool].players,
            teamStats: saveData.schools[activeSchool].teamStats
        });
    });

    // 4. Delete Player (Memory Only)
    socket.on('deletePlayer', (playerId) => {
        if (!saveData) return;
        const activeSchool = saveData.settings.currentSchool;
        const school = saveData.schools[activeSchool];

        if (school) {
            school.players = school.players.filter(p => p.id !== playerId);
            io.emit('settingsUpdate', { currentSchool: activeSchool, players: school.players, teamStats: school.teamStats });
            console.log(`🗑️ Deleted player ${playerId} locally.`);
        }
    });

    // --- NEW: Update Round Template from Settings ---
    socket.on('updateRoundTemplate', (newTemplate) => {
        if (!saveData) return;

        // Ensure the config object exists
        if (!saveData.config) saveData.config = {};

        // Update the list of resources (e.g. ['wood', 'stone', 'random'])
        saveData.config.resourceTemplate = newTemplate;

        console.log("🛠️ Round Template Updated:", saveData.config.resourceTemplate);
    });

    // 5. GLOBAL SAVE
    socket.on('saveAllToCloud', async () => {
        console.log("🛰️ Pushing Kingdom State to GitHub...");

        try {
            if (saveData && saveData.schools) {
                const activeSchool = saveData.settings.currentSchool;
                const school = saveData.schools[activeSchool];

                if (!saveData.config) {
                    saveData.config = { resourceTemplate: ['wood', 'wood', 'clay', 'clay', 'stone', 'stone'] };
                }

                if (school && school.players) {
                    // Clean formatting for players
                    school.players = school.players.map(p => {
                        return {
                            id: p.id,
                            name: p.name,
                            teamId: p.teamId || 'none',
                            groupId: p.groupId !== undefined ? p.groupId : 0,
                            absent: p.absent !== undefined ? p.absent : false
                        };
                    });
                }

                // Push the full saveData. githubSync handles the stringification.
                await githubSync.push(saveData);
                io.emit('notify', "🏰 Kingdom state and team stats saved!");
                console.log("✅ GitHub Save Successful.");
            }
        } catch (err) {
            console.error("❌ Save failed:", err);
            io.emit('notify', "❌ Failed to save.");
        }
    });

    // --- Start Next Round ---
    // --- Start Next Round ---
    socket.on('startNextRound', async () => { // Added async here
        if (!saveData) return;

        // 1. Wipe the "Scratchpad" (Live memory only)
        liveRound.claims = {};
        liveRound.actedPlayers = [];

        console.log("🔄 Round Reset: Claims and Acted Players cleared.");

        // 2. SILENT SAVE TO CLOUD
        // This ensures all resources gained in the previous round are backed up
        try {
            console.log("🛰️ Auto-Saving Kingdom State to GitHub...");
            await githubSync.push(saveData);
            console.log("✅ Auto-Save Successful.");
        } catch (err) {
            console.error("❌ Auto-Save failed:", err);
            socket.emit('notify', "⚠️ Warning: Could not auto-save to cloud.");
        }

        // 3. Broadcast to Dashboard and all Controllers
        io.emit('roundStarted', {
            template: saveData.config?.resourceTemplate || ['wood', 'clay', 'stone'],
            activeSchool: saveData.settings.currentSchool
        });

        // Also emit settingsUpdate so Dashboard TV shows the final count from last round
        const activeSchool = saveData.settings.currentSchool;
        const school = saveData.schools[activeSchool];
        io.emit('settingsUpdate', {
            currentSchool: activeSchool,
            players: school.players,
            teamStats: school.teamStats,
            config: saveData.config
        });
    });


    // --- Claim Resource Logic ---
    socket.on('claimResource', (data) => {
        const { playerId, groupId, resourceIndex, resourceName } = data;

        // 1. Validation Checks
        if (!liveRound.claims[groupId]) liveRound.claims[groupId] = [];

        if (liveRound.claims[groupId].includes(resourceIndex)) {
            return socket.emit('notify', "❌ This resource is already claimed!");
        }

        if (liveRound.actedPlayers.includes(playerId)) {
            return socket.emit('notify', "❌ You have already acted this round!");
        }

        // 2. Register the claim in Live Memory
        liveRound.claims[groupId].push(resourceIndex);
        liveRound.actedPlayers.push(playerId);

        // 3. PERMANENTLY AWARD RESOURCE TO TEAM
        if (saveData) {
            const activeSchool = saveData.settings.currentSchool;
            const school = saveData.schools[activeSchool];

            if (school) {
                const player = school.players.find(p => p.id === playerId);

                // Ensure player has a team and the team exists in stats
                if (player && player.teamId && school.teamStats[player.teamId]) {
                    const stats = school.teamStats[player.teamId];

                    // Award the base resource
                    if (stats[resourceName] !== undefined) {
                        stats[resourceName] += 1;
                        console.log(`📦 Team ${player.teamId}: +1 ${resourceName} (Total: ${stats[resourceName]})`);

                        // --- LUMBER MILL BONUS LOGIC ---
                        if (resourceName === 'wood') {
                            const hasLumberMill = (stats.buildings || []).some(b => b.id === 'lumber_mill');

                            if (hasLumberMill) {
                                // Update the persistent counter (defaults to 0 if missing)
                                stats.woodBonusCounter = (stats.woodBonusCounter || 0) + 1;

                                if (stats.woodBonusCounter >= 4) {
                                    stats.wood += 1; // Award the bonus wood
                                    stats.woodBonusCounter = 0; // Reset counter

                                    // Notify all connected clients
                                    io.emit('notify', `🪓 Team ${player.teamId} Lumber Mill Bonus: +1 Wood!`);
                                    console.log(`✨ Bonus Wood awarded to Team ${player.teamId} (Counter Reset)`);
                                }
                            }
                        }
                        // --- END LUMBER MILL BONUS LOGIC ---
                    }
                }
            }
        }

        // 4. Update Everyone
        // Tell controllers to dim buttons
        io.emit('roundUpdate', {
            claims: liveRound.claims,
            actedPlayers: liveRound.actedPlayers
        });

        // Update stats (Dashboard and Settings will see the new resource totals)
        const activeSchool = saveData.settings.currentSchool;
        const school = saveData.schools[activeSchool];
        io.emit('settingsUpdate', {
            currentSchool: activeSchool,
            players: school.players,
            teamStats: school.teamStats,
            config: saveData.config
        });
    });

    // --- ADD THIS TO app.js inside io.on('connection') ---
    // 1b. Round Status Request (for when a user refreshes the page)
    socket.on('getCurrentRoundStatus', () => {
        // Send the current liveRound data ONLY to the person who asked
        socket.emit('roundUpdate', {
            claims: liveRound.claims,
            actedPlayers: liveRound.actedPlayers
        });
    });

    // --- PURCHASE BUILDING LISTENER ---
    socket.on('purchaseBuilding', (data) => {
        const { playerId, buildingId } = data;
        if (!saveData) return;

        const activeSchool = saveData.settings.currentSchool;
        const school = saveData.schools[activeSchool];
        const struct = structures[buildingId];

        if (!school || !struct) return;

        const player = school.players.find(p => p.id === playerId);
        if (!player || !player.teamId || player.teamId === 'none') return;

        const stats = school.teamStats[player.teamId];
        const teamBuildings = stats.buildings || [];

        // 1. REQUIREMENT CHECK (Tech Tree)
        if (struct.requires) {
            const reqs = Array.isArray(struct.requires) ? struct.requires : [struct.requires];
            const tempInv = [...teamBuildings.map(b => b.id)];
            let meetsReqs = true;
            for (const r of reqs) {
                const idx = tempInv.indexOf(r);
                if (idx === -1) { meetsReqs = false; break; }
                tempInv.splice(idx, 1);
            }
            if (!meetsReqs) return socket.emit('notify', "❌ You don't have the required buildings!");
        }

        // 2. MAX BUILD CHECK
        const currentCount = teamBuildings.filter(b => b.id === buildingId).length;
        if (currentCount >= struct.maxBuild) {
            return socket.emit('notify', "❌ Maximum limit reached for this building!");
        }

        // 2b. DYNAMIC CAPACITY CHECK
        if (struct.capacity) {
            const { requiredBuilding, ratio } = struct.capacity;
            const parentCount = teamBuildings.filter(b => b.id === requiredBuilding).length;
            const currentCount = teamBuildings.filter(b => b.id === buildingId).length;
            if (currentCount >= parentCount * ratio) {
                const parentName = structures[requiredBuilding]?.name || "Required Buildings";
                return socket.emit('notify', `❌ Not enough ${parentName}s to support more ${struct.name}s!`);
            }
        }

        // --- NEW: 2c. CONVERSION (CONSUMPTION) CHECK ---
        if (struct.conversion) {
            const targetId = struct.conversion.consumes;
            const hasTarget = teamBuildings.some(b => b.id === targetId);
            if (!hasTarget) {
                const targetName = structures[targetId]?.name || targetId;
                return socket.emit('notify', `❌ You need a ${targetName} to convert into a ${struct.name}!`);
            }
        }

        // 3. DYNAMIC COST CALCULATION
        const costIdx = currentCount === 0 ? 0 : (struct.woodCost?.length > 1 || struct.clayCost?.length > 1 || struct.stoneCost?.length > 1 ? 1 : 0);
        const wCost = struct.woodCost ? (struct.woodCost[costIdx] ?? struct.woodCost[0]) : 0;
        const cCost = struct.clayCost ? (struct.clayCost[costIdx] ?? struct.clayCost[0]) : 0;
        const sCost = struct.stoneCost ? (struct.stoneCost[costIdx] ?? struct.stoneCost[0]) : 0;

        // 4. FINAL RESOURCE CHECK
        if (stats.wood >= wCost && stats.clay >= cCost && stats.stone >= sCost) {

            // --- EXECUTE CONVERSION (REMOVING THE OLD BUILDING) ---
            if (struct.conversion) {
                const targetId = struct.conversion.consumes;
                const indexToRemove = stats.buildings.findIndex(b => b.id === targetId);
                if (indexToRemove !== -1) {
                    stats.buildings.splice(indexToRemove, 1); // This removes the Stone House!
                    console.log(`♻️ Team ${player.teamId}: Consumed 1 ${targetId}`);
                }
            }

            // Deduct Resources
            stats.wood -= wCost;
            stats.clay -= cCost;
            stats.stone -= sCost;

            // Add new building to inventory
            if (!stats.buildings) stats.buildings = [];
            stats.buildings.push({
                id: struct.id,
                name: struct.name,
                builtBy: player.name,
                timestamp: Date.now()
            });

            // --- TRIGGER POINT RECALCULATION ---
            calculateTeamPoints(player.teamId);

            console.log(`🏠 ${player.name} (Team ${player.teamId}) built ${struct.name}`);

            // --- RECALCULATE POINTS HERE LATER ---
            // calculateTeamPoints(player.teamId); 

            io.emit('settingsUpdate', {
                currentSchool: activeSchool,
                players: school.players,
                teamStats: school.teamStats,
                config: saveData.config
            });

            socket.emit('notify', `✅ Success! You built a ${struct.name}.`);
        } else {
            socket.emit('notify', "❌ Not enough resources!");
        }
    });

    // --- MANUAL ADJUSTMENT LISTENER ---
    socket.on('applyManualAdjustment', (data) => {
        if (!saveData) return;

        const activeSchool = saveData.settings.currentSchool;
        const school = saveData.schools[activeSchool];
        const { teamId, wood, clay, stone, points } = data;

        // Reach inside the existing memory to change only the specific numbers
        if (school && school.teamStats[teamId]) {
            const stats = school.teamStats[teamId];

            stats.wood = Number(wood);
            stats.clay = Number(clay);
            stats.stone = Number(stone);
            stats.points = Number(points);

            console.log(`🛠️ Manual Adjustment: Team ${teamId} set to W:${wood} C:${clay} S:${stone} P:${points}`);

            // Broadcast the update so the Dashboard TV and other screens refresh immediately
            io.emit('settingsUpdate', {
                currentSchool: activeSchool,
                players: school.players,
                teamStats: school.teamStats,
                config: saveData.config
            });
        } else {
            socket.emit('notify', "❌ Error: Team not found.");
        }
    });

    // --- REMOTE UI CONTROL ---

    // When controller sends the "open" signal
    socket.on('request_open_drawer', () => {
        console.log("Remote Command: Opening Architect Drawer on TV");
        io.emit('forceOpenArchitect'); // Sends to Dashboard
    });

    // When controller sends the "close" signal
    socket.on('request_close_drawer', () => {
        console.log("Remote Command: Closing Architect Drawer on TV");
        io.emit('forceCloseArchitect'); // Sends to Dashboard
    });

    // --- SESSION-ONLY SOFT RESET ---
    socket.on('requestSoftReset', () => {
        if (!saveData) return;

        const activeSchool = saveData.settings.currentSchool;
        const school = saveData.schools[activeSchool];

        if (school && school.teamStats) {
            console.log("♻️ Performing LOCAL Reset (No Cloud Sync) for:", activeSchool);

            // 1. Wipe Team Stats in local memory only
            Object.keys(school.teamStats).forEach(teamId => {
                school.teamStats[teamId] = {
                    wood: 0,
                    clay: 0,
                    stone: 0,
                    points: 0,
                    buildings: [],
                    woodBonusCounter: 0
                };
            });

            // 2. Clear Live Round (Harvesting/Acting)
            liveRound.claims = {};
            liveRound.actedPlayers = [];
            
            // 3. Reset Dashboard Lock
            isDashboardLocked = false;

            // 4. BROADCAST TO ALL SCREENS (TV, Controllers, Settings)
            io.emit('lockStatusUpdate', isDashboardLocked);
            
            // Refresh everyone's UI with the zeroed-out memory
            io.emit('settingsUpdate', {
                currentSchool: activeSchool,
                players: school.players,
                teamStats: school.teamStats,
                config: saveData.config
            });

            // Specific notification for this type of reset
            io.emit('notify', "♻️ Session Reset: All scores cleared locally.");
        }
    });

    socket.on('disconnect', () => {
        console.log('👤 Settler disconnected');
    });
});

startKingdom();