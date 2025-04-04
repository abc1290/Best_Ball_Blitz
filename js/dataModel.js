/**
 * Data Model Module
 * Handles data structures, validation, and data persistence.
 */

// Private data store
const _data = {
    players: [],
    groups: { A: [], B: [], C: [], D: [] },
    teams: [],
    holeAssignments: {}, // { "1": [teamId1, teamId2], "5": [teamId3], ... }
    settings: {
        balanceTeams: false,
        maxHandicapDiff: 5,
        startFormat: 'sequential',
        startTime: '08:00',
        timeInterval: 10
    },
    interactiveDraftState: null 
};

// Configuration (can be adjusted if needed)
const doubleStackedHoles = [3, 4, 6, 7, 8, 10, 12, 13, 16, 18];

// --- Private Helper Functions ---

/**
 * Validates a player's name.
 * @param {string} name - The player's name.
 * @returns {{valid: boolean, message?: string}} Validation result.
 */
function validatePlayerName(name) {
    if (!name || name.trim() === '') {
        return { valid: false, message: 'Name is required' };
    }
    if (!name.includes(',')) {
        return { valid: false, message: 'Use format: Last Name, First Name' };
    }
    return { valid: true };
}

/**
 * Validates a player's handicap input.
 * @param {string} handicap - The handicap string (e.g., "10.5", "+2.1").
 * @returns {{valid: boolean, value?: number, isPlus?: boolean, message?: string}} Validation result.
 */
function validateHandicap(handicap) {
    if (!handicap || handicap.trim() === '') {
        return { valid: false, message: 'Handicap is required' };
    }
    const isPlus = handicap.includes('+');
    const handicapValue = parseFloat(isPlus ? handicap.replace('+', '') : handicap);
    if (isNaN(handicapValue)) {
        return { valid: false, message: 'Handicap must be a number' };
    }
    if (handicapValue < 0 && !isPlus) {
        return { valid: false, message: 'Use +value format for plus handicaps' };
    }
    if (handicapValue > 54) { // Max handicap according to WHS
        return { valid: false, message: 'Handicap cannot exceed 54.0' };
    }
    return { valid: true, value: handicapValue, isPlus: isPlus };
}

/**
 * Calculates the total handicap for a team.
 * Plus handicaps contribute negatively.
 * @param {object} team - The team object with a 'members' array.
 * @returns {number} The calculated team handicap.
 */
function calculateTeamHandicap(team) {
    let total = 0;
    if (team && team.members && team.members.length > 0) {
        team.members.forEach(player => {
            if (player) { // Check if player object exists (important for draft)
                total += getNumericHandicap(player);
            }
        });
    }
    return total;
}

/**
 * Gets the numeric value of a player's handicap (plus is negative).
 * @param {object} player - The player object.
 * @returns {number} The numeric handicap value.
 */
const getNumericHandicap = (player) => player.isPlus ? -player.handicap : player.handicap;

/**
 * Checks if enough players exist in each group to form at least one team.
 * @returns {boolean} True if a team can be formed, false otherwise.
 */
function canFormTeam() {
    const groups = _data.groups;
    return groups.A.length > 0 && groups.B.length > 0 && groups.C.length > 0 && groups.D.length > 0;
}

/**
 * Gets all teams that are not currently assigned to a hole.
 * @returns {Array<object>} An array of unassigned team objects.
 */
function getUnassignedTeamsInternal() {
    const allTeams = _data.teams;
    const assignedIds = new Set(getAssignedTeamIds()); 
    return allTeams.filter(team => !assignedIds.has(team.id));
}

// --- Public API ---
// Export functions and getters to be used by other modules.

export function getDoubleStackedHoles() { return doubleStackedHoles; }
export function getPlayers() { return _data.players; }
export function getGroups() { return _data.groups; }
export function getTeams() { return _data.teams; }
export function getHoleAssignments() { return _data.holeAssignments; }
export function getSettings() { return _data.settings; }

export function setPlayers(players) { _data.players = players; }
export function setGroups(groups) { _data.groups = groups; }
export function setTeams(teams) { _data.teams = teams; }
export function setHoleAssignments(assignments) { _data.holeAssignments = assignments; }
export function updateSetting(key, value) { _data.settings[key] = value; }

/**
 * Resets all player, group, team, and assignment data. Settings are preserved.
 */
export function resetAll() {
    _data.players = [];
    _data.groups = { A: [], B: [], C: [], D: [] };
    _data.teams = [];
    _data.holeAssignments = {};
    _data.interactiveDraftState = null; // Reset draft state
}

/**
 * Adds a new player after validation.
 * @param {string} nameInput - Player name string.
 * @param {string} handicapInput - Handicap string.
 * @returns {{valid: boolean, player?: object, errors?: object}} Result object.
 */
export function addPlayer(nameInput, handicapInput) {
    const nameValidation = validatePlayerName(nameInput);
    const handicapValidation = validateHandicap(handicapInput);
    if (!nameValidation.valid || !handicapValidation.valid) {
        return {
            valid: false,
            errors: {
                name: nameValidation.valid ? null : nameValidation.message,
                handicap: handicapValidation.valid ? null : handicapValidation.message
            }
        };
    }
    const player = {
        name: nameInput.trim(),
        handicap: handicapValidation.value,
        isPlus: handicapValidation.isPlus,
        displayHandicap: handicapValidation.isPlus ? `+${handicapValidation.value}` : handicapValidation.value.toString()
    };
    _data.players.push(player);
    return { valid: true, player };
}

/**
 * Removes a player by index.
 * @param {number} index - The index of the player to remove.
 * @returns {boolean} True if removal was successful.
 */
export function removePlayer(index) {
    if (index >= 0 && index < _data.players.length) {
        _data.players.splice(index, 1);
        _data.interactiveDraftState = null; // Reset draft if player removed
        return true;
    }
    return false;
}

/**
 * Groups players into A, B, C, D based on handicap.
 * @returns {{success: boolean, message?: string}} Result object.
 */
export function groupPlayers() {
    if (_data.players.length < 4) {
        return { success: false, message: "Please add at least 4 players to form groups." };
    }
    _data.groups = { A: [], B: [], C: [], D: [] };
    const sortedPlayers = [..._data.players].sort((a, b) => {
        const handicapA = getNumericHandicap(a);
        const handicapB = getNumericHandicap(b);
        return handicapA - handicapB; // Lower numeric handicap is better
    });
    const quarterSize = Math.ceil(sortedPlayers.length / 4);
    _data.groups.A = sortedPlayers.slice(0, quarterSize);
    _data.groups.B = sortedPlayers.slice(quarterSize, quarterSize * 2);
    _data.groups.C = sortedPlayers.slice(quarterSize * 2, quarterSize * 3);
    _data.groups.D = sortedPlayers.slice(quarterSize * 3);
    _data.interactiveDraftState = null; // Reset draft state on regroup
    return { success: true };
}

/**
 * Selects a team randomly from available players in each group.
 * @returns {{success: boolean, team?: object, message?: string}} Result object.
 */
export function selectTeam() {
    const groups = _data.groups;
    if (!canFormTeam()) {
        return { success: false, message: "Not enough players left to form a full team." };
    }

    const selectedPlayers = {};
    const playersToRemove = {}; // Track indices to remove

    for (const groupLetter of ['A', 'B', 'C', 'D']) {
        const group = groups[groupLetter];
        const playerIndex = Math.floor(Math.random() * group.length);
        selectedPlayers[groupLetter] = group[playerIndex];
        playersToRemove[groupLetter] = playerIndex;
    }

    const newTeam = {
        id: _data.teams.length + 1,
        members: [selectedPlayers['A'], selectedPlayers['B'], selectedPlayers['C'], selectedPlayers['D']]
    };
    newTeam.totalHandicap = calculateTeamHandicap(newTeam);
    _data.teams.push(newTeam);

    // Remove selected players from groups
    for (const groupLetter in playersToRemove) {
        groups[groupLetter].splice(playersToRemove[groupLetter], 1);
    }

    return { success: true, team: newTeam };
}

/**
 * Adds a pre-formed team (e.g., from draft) and removes its players from the main groups.
 * @param {object} team - The team object to add.
 * @returns {{success: boolean}} Result object.
 */
export function addTeamAndRemovePlayers(team) {
     _data.teams.push(team);
     team.members.forEach(player => {
         if (!player) return; // Skip empty slots if any
         for (const groupLetter in _data.groups) {
             const group = _data.groups[groupLetter];
             const playerIndex = group.findIndex(p => p === player); // Find by object reference
             if (playerIndex > -1) {
                 group.splice(playerIndex, 1);
                 break; // Player found and removed, move to next member
             }
         }
     });
     return { success: true };
}

export { canFormTeam }; // Export the function directly

/**
 * Finds a team by its ID.
 * @param {number} teamId - The ID of the team to find.
 * @returns {object | undefined} The team object or undefined if not found.
 */
export function findTeamById(teamId) { return _data.teams.find(team => team.id === teamId); }

/**
 * Assigns a team to a specific hole, respecting hole capacity.
 * @param {number} teamId - The ID of the team to assign.
 * @param {number} hole - The hole number (1-18).
 * @returns {{success: boolean, message?: string}} Result object.
 */
export function assignTeamToHole(teamId, hole) {
    if (!teamId || !hole || hole < 1 || hole > 18) {
        console.error("Invalid teamId or hole number for assignment.");
        return { success: false, message: "Invalid input for assignment." };
    }

    const holeStr = hole.toString(); // Use string keys for object
    const teamsOnHole = _data.holeAssignments[holeStr] || [];
    const maxTeams = doubleStackedHoles.includes(hole) ? 2 : 1;

    // Check if team is already assigned somewhere else
    for (const h in _data.holeAssignments) {
        if (_data.holeAssignments[h].includes(teamId)) {
            console.warn(`Team ${teamId} is already assigned to hole ${h}. Cannot assign again.`);
            return { success: false, message: `Team ${teamId} is already assigned to hole ${h}.` };
        }
    }

    // Check if hole is full
    if (teamsOnHole.length >= maxTeams) {
        console.warn(`Hole ${hole} is full (Max: ${maxTeams}). Cannot assign Team ${teamId}.`);
        return { success: false, message: `Hole ${hole} is already full.` };
    }

    // Add the team
    _data.holeAssignments[holeStr] = [...teamsOnHole, teamId];
    console.log(`Assigned Team ${teamId} to Hole ${hole}. Assignments:`, _data.holeAssignments);
    return { success: true };
}

/**
 * Removes a team from a specific hole.
 * @param {number} teamId - The ID of the team to remove.
 * @param {number} hole - The hole number (1-18).
 * @returns {{success: boolean, message?: string}} Result object.
 */
export function removeTeamFromHole(teamId, hole) {
     if (!teamId || !hole || hole < 1 || hole > 18) {
        console.error("Invalid teamId or hole number for removal.");
        return { success: false, message: "Invalid input for removal." };
    }
    const holeStr = hole.toString();
    if (!_data.holeAssignments[holeStr] || !_data.holeAssignments[holeStr].includes(teamId)) {
         console.warn(`Team ${teamId} not found on hole ${hole}. Cannot remove.`);
         return { success: false, message: `Team ${teamId} not found on hole ${hole}.` };
    }

    // Filter out the teamId
    _data.holeAssignments[holeStr] = _data.holeAssignments[holeStr].filter(id => id !== teamId);

    // If the hole is now empty, remove the key from the assignments object
    if (_data.holeAssignments[holeStr].length === 0) {
        delete _data.holeAssignments[holeStr];
    }
    
    console.log(`Removed Team ${teamId} from Hole ${hole}. Assignments:`, _data.holeAssignments);
    return { success: true };
}

/**
 * Gets an array of all team IDs currently assigned to any hole.
 * @returns {Array<number>} Array of assigned team IDs.
 */
export function getAssignedTeamIds() {
    const assignedIds = new Set();
    Object.values(_data.holeAssignments).forEach(teamIdArray => {
        teamIdArray.forEach(teamId => assignedIds.add(teamId));
    });
    return Array.from(assignedIds); // Return as an array
}

export { getUnassignedTeamsInternal as getUnassignedTeams }; // Export internal helper with public name

/**
 * Automatically assigns all unassigned teams sequentially, filling single slots first, then double slots.
 * @returns {{success: boolean}} Result object.
 */
export function autoAssignTeams() {
    _data.holeAssignments = {}; // Clear existing assignments
    const teamsToAssign = getUnassignedTeamsInternal(); 
    let teamIndex = 0;

    // First pass: Assign one team per hole
    for (let hole = 1; hole <= 18 && teamIndex < teamsToAssign.length; hole++) {
        const teamId = teamsToAssign[teamIndex].id;
        const assignResult = assignTeamToHole(teamId, hole); 
        if (assignResult.success) {
            teamIndex++;
        } else {
            console.error(`Failed to assign team ${teamId} to hole ${hole}: ${assignResult.message}`);
        }
    }

    // Second pass: Fill double-stacked holes if teams remain
    for (let hole = 1; hole <= 18 && teamIndex < teamsToAssign.length; hole++) {
        if (doubleStackedHoles.includes(hole)) {
            const teamsOnHole = _data.holeAssignments[hole.toString()] || [];
            if (teamsOnHole.length < 2) {
                 const teamId = teamsToAssign[teamIndex].id;
                 const assignResult = assignTeamToHole(teamId, hole);
                 if (assignResult.success) {
                     teamIndex++;
                 } else {
                      console.error(`Failed to assign second team ${teamId} to hole ${hole}: ${assignResult.message}`);
                 }
            }
        }
     }
     console.log("Auto-assignment complete. Assignments:", _data.holeAssignments);
     return { success: true };
}

/**
 * Randomly assigns all unassigned teams to available hole slots.
 * @returns {{success: boolean}} Result object.
 */
export function randomizeTeamAssignments() {
     _data.holeAssignments = {}; // Clear existing assignments
     let teamsToAssign = getUnassignedTeamsInternal(); 
     
     // Shuffle the teams array (Fisher-Yates shuffle)
     for (let i = teamsToAssign.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [teamsToAssign[i], teamsToAssign[j]] = [teamsToAssign[j], teamsToAssign[i]];
     }

     let teamIndex = 0;
     // Assign shuffled teams using the same logic as autoAssign
     // First pass
     for (let hole = 1; hole <= 18 && teamIndex < teamsToAssign.length; hole++) {
        const teamId = teamsToAssign[teamIndex].id;
        const assignResult = assignTeamToHole(teamId, hole);
         if (assignResult.success) {
            teamIndex++;
        } else {
            console.error(`Failed to assign team ${teamId} to hole ${hole}: ${assignResult.message}`);
        }
     }
     // Second pass (double-stacked)
     for (let hole = 1; hole <= 18 && teamIndex < teamsToAssign.length; hole++) {
        if (doubleStackedHoles.includes(hole)) {
            const teamsOnHole = _data.holeAssignments[hole.toString()] || [];
            if (teamsOnHole.length < 2) {
                 const teamId = teamsToAssign[teamIndex].id;
                 const assignResult = assignTeamToHole(teamId, hole);
                 if (assignResult.success) {
                     teamIndex++;
                 } else {
                     console.error(`Failed to assign second team ${teamId} to hole ${hole}: ${assignResult.message}`);
                 }
            }
        }
     }
     console.log("Random assignment complete. Assignments:", _data.holeAssignments);
     return { success: true };
}

/**
 * Processes CSV text data to extract players.
 * @param {string} csv - The CSV content string.
 * @returns {{players: Array<object>, errors: Array<string>}} Result object.
 */
export function processCSV(csv) {
    const lines = csv.split(/\r\n|\n/);
    const importedPlayers = [];
    const errors = [];
    
    try { 
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].trim()) continue; 
            
            const parts = lines[i].split(',');
            if (parts.length < 3) {
            errors.push(`Line ${i+1} doesn't have enough data. Format should be LastName,FirstName,Handicap`);
            continue;
        }
        
        const lastName = parts[0].trim();
        const firstName = parts[1].trim();
        const handicapInput = parts[2].trim();
        
        const handicapValidation = validateHandicap(handicapInput); 
        
        if (!handicapValidation.valid) {
            errors.push(`Invalid handicap format in line ${i+1}: ${handicapValidation.message}`);
            continue;
        }
        
        const player = {
            name: `${lastName}, ${firstName}`,
            handicap: handicapValidation.value,
            isPlus: handicapValidation.isPlus,
            displayHandicap: handicapValidation.isPlus ? 
                `+${handicapValidation.value}` : 
                handicapValidation.value.toString()
        };
        
            importedPlayers.push(player);
        }
    } catch (error) { 
        console.error("Error processing CSV line:", error);
        errors.push(`Error processing CSV: ${error.message}. Please check file format.`);
    }
    
    console.log("DataModel.processCSV returning:", { players: importedPlayers, errors }); 
    return { players: importedPlayers, errors };
}

/**
 * Saves the current application state to localStorage.
 * @returns {{success: boolean, message?: string}} Result object.
 */
export function saveToLocalStorage() {
    try {
        const dataToSave = {
            players: _data.players,
            groups: _data.groups,
            teams: _data.teams,
            holeAssignments: _data.holeAssignments,
            settings: _data.settings
        };
        localStorage.setItem('golfApp', JSON.stringify(dataToSave));
        return { success: true };
    } catch (error) {
        return { success: false, message: `Failed to save data: ${error.message}` };
    }
}

/**
 * Loads application state from localStorage.
 * @returns {{success: boolean, message?: string}} Result object.
 */
export function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('golfApp');
        if (!savedData) { 
            return { success: false, message: 'No saved data found' }; 
        }
        
        const parsedData = JSON.parse(savedData);
        _data.players = parsedData.players || [];
        _data.groups = parsedData.groups || { A: [], B: [], C: [], D: [] };
        _data.teams = parsedData.teams || [];
        _data.holeAssignments = parsedData.holeAssignments || {};
        
        if (parsedData.settings) {
            _data.settings = parsedData.settings;
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, message: `Failed to load data: ${error.message}` }; 
    }
}

// --- Interactive Draft Style Functions ---

/**
 * Initializes the state for an interactive draft.
 * @returns {{success: boolean, draftState?: object, message?: string}} Result object.
 */
export function initializeInteractiveDraft() {
    const groups = _data.groups;
    const numTeams = Math.min(groups.A.length, groups.B.length, groups.C.length, groups.D.length);
    
    if (numTeams === 0) {
        return { success: false, message: "Not enough players in all groups to form any teams." };
    }

    _data.interactiveDraftState = {
        numTeams: numTeams,
        currentTeamIndex: 0,
        currentRoundIndex: 0, // 0=D, 1=C, 2=B, 3=A
        draftOrder: ['D', 'C', 'B', 'A'],
        availableGroups: { // Make copies
            A: [...groups.A],
            B: [...groups.B],
            C: [...groups.C],
            D: [...groups.D]
        },
        draftedTeamsData: Array.from({ length: numTeams }, () => ({ members: [null, null, null, null], partialHandicap: 0 })), // Pre-fill with nulls
        targetTeamHandicap: 0, 
        avgPlayerHandicap: 0   
    };

    // Calculate balancing targets if needed
    if (_data.settings.balanceTeams) {
         if (_data.players.length > 0) {
            let totalPlayerHandicap = 0;
            _data.players.forEach(p => { totalPlayerHandicap += getNumericHandicap(p); });
            _data.interactiveDraftState.avgPlayerHandicap = totalPlayerHandicap / _data.players.length;
            _data.interactiveDraftState.targetTeamHandicap = _data.interactiveDraftState.avgPlayerHandicap * 4;
        }
        // Adjust target based on existing teams if any (might not be ideal, but keeps consistency)
        if (_data.teams.length > 0) {
            let existingTeamTotalHandicap = 0;
            _data.teams.forEach(team => { existingTeamTotalHandicap += calculateTeamHandicap(team); });
            _data.interactiveDraftState.targetTeamHandicap = existingTeamTotalHandicap / _data.teams.length;
        }
    }
    
    return { success: true, draftState: _data.interactiveDraftState };
}

/**
 * Makes a single pick in the interactive draft, considering balancing if enabled.
 * @returns {{success: boolean, player?: object, teamIndex?: number, groupLetter?: string, isDraftComplete?: boolean, updatedState?: object, message?: string}} Result object.
 */
export function makeInteractiveDraftPick() {
    const state = _data.interactiveDraftState;
    if (!state) {
        return { success: false, message: "Draft not initialized." };
    }

    const teamIndex = state.currentTeamIndex;
    const roundIndex = state.currentRoundIndex;
    const groupLetter = state.draftOrder[roundIndex];
    const currentAvailableGroup = state.availableGroups[groupLetter];

    if (currentAvailableGroup.length === 0) {
         return { success: false, message: `No available players left in Group ${groupLetter}.` };
    }

    let chosenPlayer;
    let chosenPlayerIndex;

    // Balancing logic
    if (_data.settings.balanceTeams && groupLetter !== 'D') { // Often start random/snake for D
        const currentPartialHandicap = state.draftedTeamsData[teamIndex].partialHandicap;
        let bestPlayer = null;
        let bestPlayerIdx = -1;
        let minDifference = Infinity;

        for (let j = 0; j < currentAvailableGroup.length; j++) {
            const potentialPlayer = currentAvailableGroup[j];
            const potentialPlayerHandicap = getNumericHandicap(potentialPlayer);
            const remainingRounds = state.draftOrder.length - (roundIndex + 1);
            // Predict final handicap based on average remaining picks
            const predictedFinalHandicap = currentPartialHandicap + potentialPlayerHandicap + (remainingRounds * state.avgPlayerHandicap);
            const difference = Math.abs(predictedFinalHandicap - state.targetTeamHandicap);

            if (difference < minDifference) {
                minDifference = difference;
                bestPlayer = potentialPlayer;
                bestPlayerIdx = j;
            }
        }
         if (bestPlayerIdx === -1) { // Fallback if calculation fails
            bestPlayerIdx = Math.floor(Math.random() * currentAvailableGroup.length);
            bestPlayer = currentAvailableGroup[bestPlayerIdx];
        }
        chosenPlayer = bestPlayer;
        chosenPlayerIndex = bestPlayerIdx;
    } else {
        // Random pick
        chosenPlayerIndex = Math.floor(Math.random() * currentAvailableGroup.length);
        chosenPlayer = currentAvailableGroup[chosenPlayerIndex];
    }

    // Assign player to the correct slot (A=0, B=1, C=2, D=3)
    const memberIndex = state.draftOrder.length - 1 - roundIndex; // D=3, C=2, B=1, A=0
    state.draftedTeamsData[teamIndex].members[memberIndex] = chosenPlayer;
    state.draftedTeamsData[teamIndex].partialHandicap += getNumericHandicap(chosenPlayer);
    
    // Remove player from available group for this draft
    currentAvailableGroup.splice(chosenPlayerIndex, 1);

    // Advance draft state
    state.currentTeamIndex++;
    if (state.currentTeamIndex >= state.numTeams) {
        state.currentTeamIndex = 0;
        state.currentRoundIndex++;
    }
    
    const isDraftComplete = state.currentRoundIndex >= state.draftOrder.length;

    return { 
        success: true, 
        player: chosenPlayer, 
        teamIndex: teamIndex, 
        groupLetter: groupLetter, 
        isDraftComplete: isDraftComplete,
        updatedState: state // Return updated state
    };
}

/**
 * Finalizes the draft, adds completed teams to the main list, and removes players from groups.
 * @returns {{success: boolean, teamsAdded?: number, message?: string}} Result object.
 */
export function finalizeDraftedTeams() {
    const state = _data.interactiveDraftState;
    if (!state || state.currentRoundIndex < state.draftOrder.length) {
        return { success: false, message: "Draft is not complete." };
    }

    const finalTeams = [];
    state.draftedTeamsData.forEach((draftedTeamData, index) => {
         if (draftedTeamData.members.every(p => p !== null)) { // Check if team is full
            const newTeam = {
                id: _data.teams.length + finalTeams.length + 1,
                members: draftedTeamData.members // Already in A,B,C,D order due to index mapping
            };
            newTeam.totalHandicap = calculateTeamHandicap(newTeam);
            finalTeams.push(newTeam);

            // Remove players from main data groups
            newTeam.members.forEach(player => {
                const groupKey = ['A', 'B', 'C', 'D'].find(key => _data.groups[key].some(orig => orig === player));
                if (groupKey) {
                    const playerIndex = _data.groups[groupKey].indexOf(player);
                    if (playerIndex > -1) {
                        _data.groups[groupKey].splice(playerIndex, 1);
                    }
                }
            });
        } else {
            console.error("Incomplete team data found during finalization:", draftedTeamData);
        }
    });

    _data.teams.push(...finalTeams);
    _data.interactiveDraftState = null; // Clear draft state
    return { success: true, teamsAdded: finalTeams.length };
}

// Export the specific calculation function if needed elsewhere (though it's mainly internal)
export { calculateTeamHandicap };
