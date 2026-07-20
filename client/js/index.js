const socket = io();

/**
 * Helper to add logs to the browser console.
 * This prevents errors since index.html has no #log-container.
 */
function addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 🏰 ${message}`);
}

// Listen for game state updates from server
socket.on('updateState', (data) => {
    // 1. Get references to UI elements
    const woodDisplay = document.getElementById('wood-count');
    const clayDisplay = document.getElementById('clay-count');
    const stoneDisplay = document.getElementById('stone-count');
    const pointsDisplay = document.getElementById('points');

    // 2. Update text only if the elements exist on the current page
    if (data.resources) {
        if (woodDisplay) woodDisplay.textContent = data.resources.wood.toLocaleString();
        if (clayDisplay) clayDisplay.textContent = data.resources.clay.toLocaleString();
        if (stoneDisplay) stoneDisplay.textContent = data.resources.stone.toLocaleString();
    }
    
    if (pointsDisplay && data.points !== undefined) {
        pointsDisplay.textContent = data.points;
    }

    addLog("Settlement data synchronized.");
});

socket.on('connect', () => {
    addLog("Connected to the Kingdom Server (Main Menu).");
});

socket.on('disconnect', () => {
    addLog("Disconnected from server.");
});