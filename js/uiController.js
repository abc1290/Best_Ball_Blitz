import * as DataModel from './dataModel.js';
// Import AppController later if needed for direct calls, but prefer passing functions/state

/**
 * UI Controller Module
 * Manages the user interface and DOM interactions.
 */

// --- DOM Element References ---
// Encapsulate DOM lookups for better organization and potential caching
const DOMElements = {
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    teeAssignmentTabButton: document.getElementById('teeAssignmentTabButton'),
    playerNameInput: document.getElementById('playerName'),
    playerHandicapInput: document.getElementById('playerHandicap'),
    addPlayerBtn: document.getElementById('addPlayerBtn'),
    resetBtn: document.getElementById('resetBtn'),
    playerList: document.getElementById('playerList'),
    playerCountElement: document.getElementById('playerCount'),
    nameValidation: document.getElementById('nameValidation'),
    handicapValidation: document.getElementById('handicapValidation'),
    balanceTeamsToggle: document.getElementById('balanceTeamsToggle'),
    maxHandicapDiff: document.getElementById('maxHandicapDiff'),
    groupPlayersBtn: document.getElementById('groupPlayersBtn'),
    groupA: document.getElementById('groupA'),
    groupB: document.getElementById('groupB'),
    groupC: document.getElementById('groupC'),
    groupD: document.getElementById('groupD'),
    selectTeamBtn: document.getElementById('selectTeamBtn'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    draftStyleSelectBtn: document.getElementById('draftStyleSelectBtn'), 
    showBracketBtn: document.getElementById('showBracketBtn'),
    teamsContainer: document.getElementById('teamsContainer'),
    teamCountElement: document.getElementById('teamCount'),
    selectionSlots: { 
        A: document.getElementById('slotA'), 
        B: document.getElementById('slotB'), 
        C: document.getElementById('slotC'), 
        D: document.getElementById('slotD') 
    },
    startFormatSelect: document.getElementById('startFormat'),
    startTimeInput: document.getElementById('startTime'),
    timeIntervalInput: document.getElementById('timeInterval'),
    courseLayout: document.getElementById('courseLayout'),
    unassignedTeamsList: document.getElementById('unassignedTeamsList'),
    autoAssignBtn: document.getElementById('autoAssignBtn'),
    randomAssignBtn: document.getElementById('randomAssignBtn'),
    resetAssignmentBtn: document.getElementById('resetAssignmentBtn'),
    teeSheetBody: document.getElementById('teeSheetBody'),
    printTeeSheetBtn: document.getElementById('printTeeSheetBtn'),
    errorMessages: document.getElementById('errorMessages'),
    fileInput: document.getElementById('fileInput'),
    helpButton: document.getElementById('helpButton'),
    saveButton: document.getElementById('saveButton'),
    loadButton: document.getElementById('loadButton'),
    tutorialOverlay: document.getElementById('tutorialOverlay'),
    tutorialSteps: document.querySelector('.tutorial-steps'),
    tutorialPrevBtn: document.getElementById('tutorialPrevBtn'),
    tutorialNextBtn: document.getElementById('tutorialNextBtn'),
    tutorialProgress: document.getElementById('tutorialProgress'),
    tutorialCloseBtn: document.querySelector('.tutorial-close')
};

// --- UI State ---
// Keep track of UI-specific state
const UIState = {
    isGrouped: false,
    selectedTeamId: null,
    currentTutorialStep: 0,
    interactiveDraftState: null // Store draft state for UI interaction
};

// --- Tutorial Content ---
const tutorialStepsContent = [
    { title: "Step 1: Add Players", content: "Enter player names (Last, First) and their handicap (e.g., 10.5 or +2.1). Click 'Add Player'. Alternatively, import players from a CSV file (LastName,FirstName,Handicap format)." },
    { title: "Step 2: Group Players", content: "Once you have enough players (at least 4), click 'Group Players'. This divides players into A, B, C, D groups based on handicap." },
    { title: "Step 3: Select Teams", content: "After grouping, click 'Select Next Team' to form a team randomly (or balanced if toggled). 'Auto-Select All' creates all possible teams. 'Draft Style Pairing' starts an interactive draft." },
    { title: "Step 4: Assign Tees", content: "Go to the 'Tee Assignment' tab. Click a team from the 'Unassigned Teams' list, then click a hole box to assign them. Click a team in a hole box to unassign." },
    { title: "Step 5: View & Print", content: "Use the 'Auto-Assign' or 'Randomize' buttons for quick assignments. View the final pairings in the Tee Sheet table and click 'Print Tee Sheet' when ready." }
];

// --- Private Helper Functions ---

/**
 * Updates the player count display.
 */
function updatePlayerCount() {
    const count = DataModel.getPlayers().length;
    DOMElements.playerCountElement.textContent = `Total players: ${count}`;
}

/**
 * Updates the team count display.
 */
function updateTeamCount() {
     const count = DataModel.getTeams().length;
     DOMElements.teamCountElement.textContent = `Teams created: ${count}`;
}

/**
 * Creates the 18 hole boxes in the UI.
 */
function createCourseLayout() {
    const layoutContainer = DOMElements.courseLayout;
    layoutContainer.innerHTML = ''; // Clear previous layout
    const doubleStacked = DataModel.getDoubleStackedHoles(); 

    for (let i = 1; i <= 18; i++) {
        const holeBox = document.createElement('div');
        holeBox.className = 'hole-box';
        holeBox.setAttribute('data-hole', i); 
        holeBox.setAttribute('tabindex', '0'); // Make focusable
        holeBox.setAttribute('role', 'button'); // Semantics for interaction
        holeBox.setAttribute('aria-label', `Hole ${i}, click to assign selected team`);

        const holeNumberDiv = document.createElement('div');
        holeNumberDiv.className = 'hole-number';
        holeNumberDiv.textContent = `${i}`; 
        holeBox.appendChild(holeNumberDiv);

        const teamsInHoleDiv = document.createElement('div');
        teamsInHoleDiv.className = 'hole-teams-container'; 
        teamsInHoleDiv.id = `hole-${i}-teams`; 
        holeBox.appendChild(teamsInHoleDiv);

        if (doubleStacked.includes(i)) {
            holeBox.classList.add('double-stacked');
        }

        // Event listener will be added in AppController to handle assignment logic
        layoutContainer.appendChild(holeBox);
    }
}

/**
 * Displays a single step of the tutorial.
 */
function displayTutorialStep() {
    const step = tutorialStepsContent[UIState.currentTutorialStep];
    DOMElements.tutorialSteps.innerHTML = `
        <div class="tutorial-step">
            <h4>${step.title}</h4>
            <p>${step.content}</p>
        </div>
    `;
    DOMElements.tutorialProgress.textContent = `Step ${UIState.currentTutorialStep + 1} of ${tutorialStepsContent.length}`;
    DOMElements.tutorialPrevBtn.disabled = UIState.currentTutorialStep === 0;
    DOMElements.tutorialNextBtn.disabled = UIState.currentTutorialStep === tutorialStepsContent.length - 1;
}

/**
 * Generates the HTML structure for the tournament bracket display.
 * @param {Array<object>} teams - Array of team objects.
 * @returns {string} HTML string for the bracket.
 */
function generateBracketHTML(teams) {
    if (!teams || teams.length < 2) {
        return '<p>Not enough teams to generate a bracket.</p>';
    }

    let round = 1;
    let currentTeams = [...teams]; 
    let bracketHTML = '<div class="bracket">';

    while (currentTeams.length >= 1) {
        bracketHTML += `<div class="round"><h3>Round ${round}</h3>`;
        let nextRoundTeams = []; 
        
        for (let i = 0; i < currentTeams.length; i += 2) {
            const team1 = currentTeams[i];
            const team2 = currentTeams[i + 1]; 

            bracketHTML += '<div class="match">';
            bracketHTML += `<div class="team">Team ${team1.id}</div>`;
            
            if (team2) {
                bracketHTML += `<div class="team">Team ${team2.id}</div>`;
                nextRoundTeams.push(team1); // Placeholder: advance first team
            } else {
                bracketHTML += `<div class="team">BYE</div>`; 
                nextRoundTeams.push(team1); 
            }
            bracketHTML += '</div>'; 
        }
        
        bracketHTML += '</div>'; 

        currentTeams = nextRoundTeams;
        round++;

        if (currentTeams.length === 1 && round > 1) { 
             bracketHTML += `<div class="round"><h3>Winner</h3><div class="match"><div class="team">Team ${currentTeams[0].id}</div></div></div>`;
             break; 
        }
         if (round > 10) break; // Safety break
    }

    bracketHTML += '</div>'; 
    return bracketHTML;
}

// --- Publicly Exported UI Functions ---

/**
 * Initializes basic UI elements and state.
 */
export function init() {
    DOMElements.selectTeamBtn.disabled = true;
    DOMElements.selectAllBtn.disabled = true;
    DOMElements.draftStyleSelectBtn.disabled = true; 
    DOMElements.showBracketBtn.disabled = true;
    DOMElements.teeAssignmentTabButton.disabled = true;
    createCourseLayout(); // Create the hole layout on init
    // Initial display updates will be triggered by AppController after potential data load
}

/**
 * Gets the collection of DOM elements.
 * @returns {object} The DOMElements object.
 */
export function getDOMElements() { return DOMElements; }

/**
 * Gets the current UI state.
 * @returns {object} The UIState object.
 */
export function getUIState() { return UIState; }

/**
 * Displays the list of players.
 * Adds event listeners for removing players.
 */
export function displayPlayers() {
    const players = DataModel.getPlayers();
    const playerListElement = DOMElements.playerList;
    
    playerListElement.innerHTML = ''; 
    
    if (players.length === 0) {
        playerListElement.innerHTML = '<p>No players added yet.</p>';
    } else {
        players.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'player-item';
            item.setAttribute('data-index', index); 
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = `${player.name} (${player.displayHandicap})`; 
            
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.className = 'remove-btn';
            removeBtn.setAttribute('aria-label', `Remove ${player.name}`);
            // Note: The actual removal logic will be handled by an event listener 
            // set up in AppController, which will call DataModel.removePlayer.
            
            item.appendChild(nameSpan);
            item.appendChild(removeBtn);
            playerListElement.appendChild(item);
        });
    }
    updatePlayerCount(); 
}

/**
 * Displays players sorted into their respective groups (A, B, C, D).
 */
export function displayGroups() {
    const groups = DataModel.getGroups();
    const groupElements = {
        A: DOMElements.groupA, B: DOMElements.groupB,
        C: DOMElements.groupC, D: DOMElements.groupD
    };

    const populateGroupList = (element, players) => {
        element.innerHTML = ''; 
        if (players.length === 0) {
            element.innerHTML = '<p>No players in this group.</p>';
        } else {
            players.forEach(player => {
                const item = document.createElement('div');
                item.className = 'player-item'; 
                item.textContent = `${player.name} (${player.displayHandicap})`; 
                element.appendChild(item);
            });
        }
    };

    populateGroupList(groupElements.A, groups.A);
    populateGroupList(groupElements.B, groups.B);
    populateGroupList(groupElements.C, groups.C);
    populateGroupList(groupElements.D, groups.D);
}

/**
 * Displays the created teams in a grid format.
 */
export function displayTeams() {
    const teams = DataModel.getTeams();
    const teamsContainer = DOMElements.teamsContainer;
    
    teamsContainer.innerHTML = ''; 
    
    if (teams.length === 0) {
        teamsContainer.innerHTML = '<p>No teams created yet.</p>';
    } else {
        teams.forEach(team => {
            const card = document.createElement('div');
            card.className = 'team-card';
            card.setAttribute('data-team-id', team.id); 
            
            const title = document.createElement('h3');
            title.textContent = `Team ${team.id}`;
            card.appendChild(title);
            
            team.members.forEach((player, index) => {
                if (player) { 
                    const memberDiv = document.createElement('div');
                    memberDiv.className = 'team-member';
                    const groupLetter = ['A', 'B', 'C', 'D'][index]; // Determine group letter
                    memberDiv.textContent = `${groupLetter}: ${player.name} (${player.displayHandicap})`;
                    card.appendChild(memberDiv);
                }
            });
            
            const statsDiv = document.createElement('div');
            statsDiv.className = 'team-stats';
            const totalHandicap = DataModel.calculateTeamHandicap(team); 
            statsDiv.textContent = `Total Handicap: ${totalHandicap.toFixed(1)}`;
            card.appendChild(statsDiv);
            
            teamsContainer.appendChild(card);
        });
    }
    
    updateTeamCount();
    DOMElements.showBracketBtn.disabled = teams.length < 2;
    DOMElements.teeAssignmentTabButton.disabled = teams.length === 0;
}

/**
 * Updates the display of teams assigned to each hole box.
 */
export function updateHoleDisplays() {
    const assignments = DataModel.getHoleAssignments(); 
    const doubleStacked = DataModel.getDoubleStackedHoles();

    for (let i = 1; i <= 18; i++) {
        const teamsContainer = document.getElementById(`hole-${i}-teams`);
        if (!teamsContainer) continue; 

        teamsContainer.innerHTML = ''; 
        const teamsOnThisHole = assignments[i.toString()] || []; // Ensure string key

        teamsOnThisHole.forEach(teamId => {
            const teamDiv = document.createElement('div');
            teamDiv.className = 'hole-team';
            teamDiv.textContent = `T${teamId}`; 
            teamDiv.setAttribute('data-team-id', teamId);
            teamDiv.setAttribute('tabindex', '0'); // Make focusable
            teamDiv.setAttribute('role', 'button'); // Semantics
            teamDiv.setAttribute('aria-label', `Team ${teamId}, click to unassign`);
            // Click listener for removal will be added in AppController
            teamsContainer.appendChild(teamDiv);
        });
        
        const holeBox = teamsContainer.closest('.hole-box');
        if (holeBox) {
             const maxTeams = doubleStacked.includes(i) ? 2 : 1;
             holeBox.classList.toggle('hole-full', teamsOnThisHole.length >= maxTeams);
        }
    }
}

/**
 * Displays the list of teams that are not yet assigned to a hole.
 */
export function displayUnassignedTeams() {
    const unassignedTeams = DataModel.getUnassignedTeams(); // Use the exported function
    const listContainer = DOMElements.unassignedTeamsList;
    listContainer.innerHTML = ''; 

    if (unassignedTeams.length === 0 && DataModel.getTeams().length > 0) { 
        listContainer.innerHTML = '<p>All teams assigned.</p>';
    } else if (unassignedTeams.length > 0) {
        unassignedTeams.forEach(team => {
            const teamElement = document.createElement('span'); 
            teamElement.className = 'unassigned-team';
            teamElement.textContent = `Team ${team.id}`;
            teamElement.setAttribute('data-team-id', team.id);
            teamElement.setAttribute('role', 'button'); 
            teamElement.setAttribute('tabindex', '0'); 
            // Click/keydown listeners for selection will be added in AppController
            listContainer.appendChild(teamElement);
        });
    } else {
         listContainer.innerHTML = '<p>No teams created yet.</p>'; 
    }
    // Ensure correct team is highlighted after update
    selectTeamForAssignment(UIState.selectedTeamId && unassignedTeams.some(t => t.id === UIState.selectedTeamId) ? UIState.selectedTeamId : null); 
}

/**
 * Updates the visual selection state for an unassigned team.
 * @param {number | null} teamId - The ID of the team to select, or null to deselect all.
 */
export function selectTeamForAssignment(teamId) {
    UIState.selectedTeamId = teamId; 
    const teamElements = DOMElements.unassignedTeamsList.querySelectorAll('.unassigned-team');
    
    teamElements.forEach(el => {
        const elTeamId = parseInt(el.getAttribute('data-team-id'));
        const isSelected = elTeamId === teamId;
        el.classList.toggle('selected', isSelected);
        el.setAttribute('aria-pressed', isSelected ? 'true' : 'false'); 
    });
}

/**
 * Updates the tee sheet table based on current assignments and settings.
 */
export function updateTeeSheet() {
    const assignments = DataModel.getHoleAssignments(); 
    const settings = DataModel.getSettings();
    const tableBody = DOMElements.teeSheetBody;
    tableBody.innerHTML = ''; 

    const teams = DataModel.getTeams(); 
    if (teams.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7; 
        cell.textContent = 'No teams created yet.';
        cell.style.textAlign = 'center';
        return; 
    }

    const formatTime = (date) => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    let baseTime = new Date(`1970-01-01T${settings.startTime}`); 
    const intervalMinutes = settings.timeInterval;
    let assignedCount = 0;
    const teeSheetData = []; 

    for (let hole = 1; hole <= 18; hole++) {
        const teamIdsOnHole = assignments[hole.toString()] || []; 
        
        teamIdsOnHole.forEach((teamId) => {
            const team = DataModel.findTeamById(teamId);
            if (!team) return; 

            let teeTime;
            if (settings.startFormat === 'shotgun') {
                teeTime = formatTime(baseTime); 
            } else {
                const timeOffset = assignedCount * intervalMinutes;
                const holeTime = new Date(baseTime.getTime() + timeOffset * 60000);
                teeTime = formatTime(holeTime);
                assignedCount++;
            }

            teeSheetData.push({
                hole: hole,
                teeTime: teeTime,
                teamId: team.id,
                players: team.members.map(p => p ? `${p.name} (${p.displayHandicap})` : 'N/A') // Include handicap
            });
        });
    }

    // Sort data for display
    if (settings.startFormat === 'sequential') {
         teeSheetData.sort((a, b) => {
            if (a.teeTime < b.teeTime) return -1;
            if (a.teeTime > b.teeTime) return 1;
            return a.hole - b.hole; 
         });
    } else {
         teeSheetData.sort((a, b) => a.hole - b.hole); 
    }

    // Render sorted data
    if (teeSheetData.length === 0) {
         const row = tableBody.insertRow();
         const cell = row.insertCell();
         cell.colSpan = 7; 
         cell.textContent = 'No teams assigned to holes yet.';
         cell.style.textAlign = 'center';
    } else {
        teeSheetData.forEach(data => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = data.hole;
            row.insertCell().textContent = data.teeTime;
            row.insertCell().textContent = `Team ${data.teamId}`;
            for (let i = 0; i < 4; i++) {
                row.insertCell().textContent = data.players[i] || ''; 
            }
        });
    }
}

/**
 * Displays an error message to the user.
 * @param {string} message - The error message to display.
 */
export function showError(message) {
    DOMElements.errorMessages.textContent = message; 
    DOMElements.errorMessages.style.display = 'block'; 
    DOMElements.errorMessages.setAttribute('aria-live', 'assertive'); 
}

/**
 * Clears any currently displayed error message.
 */
export function clearError() {
    DOMElements.errorMessages.textContent = '';
    DOMElements.errorMessages.style.display = 'none'; 
    DOMElements.errorMessages.setAttribute('aria-live', 'off'); 
}

/**
 * Resets the group displays and related UI state.
 */
export function resetGroupsUI() {
    clearError(); 
    UIState.isGrouped = false;
    DOMElements.selectTeamBtn.disabled = true;
    DOMElements.selectAllBtn.disabled = true;
    DOMElements.draftStyleSelectBtn.disabled = true; 
    DOMElements.showBracketBtn.disabled = true;
    DOMElements.groupA.innerHTML = '';
    DOMElements.groupB.innerHTML = '';
    DOMElements.groupC.innerHTML = '';
    DOMElements.groupD.innerHTML = '';
    DOMElements.teamsContainer.innerHTML = ''; // Also clear teams display
    updateTeamCount(); // Update count after clearing teams
    DOMElements.teeAssignmentTabButton.disabled = true;
    UIState.interactiveDraftState = null; 
}

/**
 * Performs the enhanced team selection animation and returns the selected players.
 * Note: Actual team creation and data update happen in AppController/DataModel.
 * @returns {Promise<{success: boolean, team?: object, message?: string}>} Promise resolving with selection result.
 */
export async function enhancedTeamSelectionAnimation() {
    const slots = ['A', 'B', 'C', 'D'];
    const selectedPlayers = {};
    const groups = DataModel.getGroups(); // Get current groups from DataModel

    if (!DataModel.canFormTeam()) {
         return { success: false, message: "Not enough players to form a team." };
    }

    // Animation loop
    for (const slot of slots) {
        const slotElement = DOMElements.selectionSlots[slot];
        slotElement.classList.add('selecting');
        await new Promise(resolve => setTimeout(resolve, 200)); 

        const groupPlayers = groups[slot];
        if (!groupPlayers || groupPlayers.length === 0) {
            console.error(`No players available in Group ${slot}`);
            showError(`Error: No players left in Group ${slot}. Cannot form team.`);
             slots.forEach(s => DOMElements.selectionSlots[s].classList.remove('selecting'));
             return { success: false, message: `No players left in Group ${slot}.` };
        }
        
        // Select a random player *for animation display only*
        // The actual selection happens in the DataModel.selectTeam function called by AppController
        const tempPlayerIndex = Math.floor(Math.random() * groupPlayers.length);
        const tempSelectedPlayer = groupPlayers[tempPlayerIndex];
        
        slotElement.textContent = tempSelectedPlayer.name.split(',')[0]; 
        await new Promise(resolve => setTimeout(resolve, 300)); 
        
        slotElement.classList.remove('selecting');
        slotElement.textContent = slot; 
    }

    // Indicate animation complete; actual team data comes from DataModel call
    return { success: true }; 
}

/**
 * Creates and displays the tournament bracket overlay.
 */
export function createTournamentBracket() {
    const teams = DataModel.getTeams();
    if (teams.length < 2) {
        showError("Need at least 2 teams to create a bracket.");
        return;
    }

    let overlay = document.getElementById('tournament-bracket-overlay');
    if (overlay) {
        document.body.removeChild(overlay); 
    }
    
    overlay = document.createElement('div');
    overlay.id = 'tournament-bracket-overlay'; 
    overlay.className = 'tournament-bracket-container'; 

    const title = document.createElement('h2');
    title.textContent = 'Tournament Bracket';
    overlay.appendChild(title);

    const bracketContent = document.createElement('div');
    bracketContent.innerHTML = generateBracketHTML(teams); 
    overlay.appendChild(bracketContent);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close Bracket';
    closeButton.className = 'close-bracket-btn'; 
    closeButton.onclick = function() {
        document.body.removeChild(overlay);
    };
    overlay.appendChild(closeButton);

    document.body.appendChild(overlay);
}

/**
 * Shows the tutorial overlay.
 */
export function showTutorial() {
    UIState.currentTutorialStep = 0;
    displayTutorialStep();
    DOMElements.tutorialOverlay.style.display = 'flex';
}

/**
 * Navigates the tutorial steps.
 * @param {number} direction - 1 for next, -1 for previous.
 */
export function navigateTutorial(direction) {
    const newStep = UIState.currentTutorialStep + direction;
    if (newStep >= 0 && newStep < tutorialStepsContent.length) {
        UIState.currentTutorialStep = newStep;
        displayTutorialStep();
    }
}

/**
 * Closes the tutorial overlay.
 */
export function closeTutorial() {
    DOMElements.tutorialOverlay.style.display = 'none';
}

// --- Interactive Draft UI Functions ---

/**
 * Creates and displays the interactive draft overlay.
 * @param {object} draftState - The initial state of the draft from DataModel.
 */
export function startInteractiveDraftUI(draftState) {
    UIState.interactiveDraftState = draftState; 

    const overlay = document.createElement('div');
    overlay.className = 'selection-fullscreen';
    overlay.id = 'interactive-draft-overlay'; 

    const title = document.createElement('h2');
    title.textContent = `Interactive Draft (${draftState.numTeams} Teams)`;
    overlay.appendChild(title);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'draft-overlay-content'; 
    overlay.appendChild(contentDiv);

    for (let i = 0; i < draftState.numTeams; i++) {
        const teamId = DataModel.getTeams().length + i + 1; 
        const column = document.createElement('div');
        column.className = 'draft-team-column';
        column.id = `draft-team-column-${i}`;
        column.innerHTML = `<h3>Team ${teamId}</h3>`;
        
        ['D', 'C', 'B', 'A'].forEach(groupLetter => {
            const slot = document.createElement('div');
            slot.className = 'draft-player-slot';
            slot.id = `draft-slot-team${i}-group${groupLetter}`;
            slot.textContent = `${groupLetter}: ...`; 
            column.appendChild(slot);
        });
        contentDiv.appendChild(column);
    }

    const controlsDiv = document.createElement('div');
    controlsDiv.style.marginTop = '20px';
    const nextPickButton = document.createElement('button');
    nextPickButton.id = 'nextDraftPickBtn';
    nextPickButton.textContent = 'Next Pick (D)';
    // Event listener will be added in AppController
    controlsDiv.appendChild(nextPickButton);
    
    const closeButton = document.createElement('button');
    closeButton.id = 'closeDraftOverlayBtn';
    closeButton.textContent = 'Close';
    closeButton.style.display = 'none'; 
    closeButton.addEventListener('click', () => {
         const draftOverlay = document.getElementById('interactive-draft-overlay');
         if (draftOverlay) document.body.removeChild(draftOverlay);
    });
    controlsDiv.appendChild(closeButton);

    overlay.appendChild(controlsDiv);
    document.body.appendChild(overlay);

    displayDraftPickUI(); 
}

/**
 * Highlights the current team and slot in the draft UI.
 */
export function displayDraftPickUI() {
    const state = UIState.interactiveDraftState;
    if (!state || state.currentRoundIndex >= state.draftOrder.length) return; 

    const teamIndex = state.currentTeamIndex;
    const groupLetter = state.draftOrder[state.currentRoundIndex];

    document.querySelectorAll('.draft-player-slot.selecting').forEach(el => el.classList.remove('selecting'));
    document.querySelectorAll('.draft-team-column.selecting').forEach(el => el.classList.remove('selecting'));

    const currentColumn = document.getElementById(`draft-team-column-${teamIndex}`);
    const currentSlot = document.getElementById(`draft-slot-team${teamIndex}-group${groupLetter}`);
    
    if (currentColumn) currentColumn.classList.add('selecting');
    if (currentSlot) currentSlot.classList.add('selecting');

    const nextPickButton = document.getElementById('nextDraftPickBtn');
    if (nextPickButton) {
         nextPickButton.textContent = `Pick Team ${DataModel.getTeams().length + teamIndex + 1} - Group ${groupLetter}`;
    }
}

/**
 * Updates the draft UI after a pick has been made.
 * @param {object} pickResult - The result object from DataModel.makeInteractiveDraftPick.
 */
export function updateDraftPickUI(pickResult) {
     const state = UIState.interactiveDraftState; // Get current UI state
     if (!state || !pickResult || !pickResult.success) return;

     const { player, teamIndex, groupLetter, isDraftComplete } = pickResult;
     
     const slotElement = document.getElementById(`draft-slot-team${teamIndex}-group${groupLetter}`);
     if (player && slotElement) {
         slotElement.textContent = `${groupLetter}: ${player.name} (${player.displayHandicap})`;
         slotElement.classList.add('reveal');
         slotElement.classList.remove('selecting'); 
     }

     const columnElement = document.getElementById(`draft-team-column-${teamIndex}`);
     if(columnElement) columnElement.classList.remove('selecting');

     if (isDraftComplete) {
         const nextPickButton = document.getElementById('nextDraftPickBtn');
         const closeButton = document.getElementById('closeDraftOverlayBtn');
         if(nextPickButton) nextPickButton.style.display = 'none';
         if(closeButton) closeButton.style.display = 'block';
         showError("Draft Complete!");
     } else {
         // Update UI state with the *new* state returned from the pick
         UIState.interactiveDraftState = pickResult.updatedState; 
         displayDraftPickUI(); // Highlight the *next* pick
     }
}

/**
 * Validates the player name input field and provides UI feedback.
 */
export function validateNameInputUI() {
    const name = DOMElements.playerNameInput.value;
    const validationResult = DataModel.validatePlayerName(name); 
    const feedbackElement = DOMElements.nameValidation;
    const inputElement = DOMElements.playerNameInput;

    if (!validationResult.valid && name.trim() !== '') { 
        feedbackElement.textContent = validationResult.message;
        inputElement.classList.add('input-invalid');
        inputElement.setAttribute('aria-invalid', 'true');
        feedbackElement.setAttribute('role', 'alert');
    } else {
        feedbackElement.textContent = '';
        inputElement.classList.remove('input-invalid');
        inputElement.removeAttribute('aria-invalid');
        feedbackElement.removeAttribute('role');
    }
    return validationResult.valid; 
}

/**
 * Validates the player handicap input field and provides UI feedback.
 */
export function validateHandicapInputUI() {
     const handicap = DOMElements.playerHandicapInput.value;
     const validationResult = DataModel.validateHandicap(handicap); 
     const feedbackElement = DOMElements.handicapValidation;
     const inputElement = DOMElements.playerHandicapInput;

     if (!validationResult.valid && handicap.trim() !== '') { 
         feedbackElement.textContent = validationResult.message;
         inputElement.classList.add('input-invalid');
         inputElement.setAttribute('aria-invalid', 'true');
         feedbackElement.setAttribute('role', 'alert');
     } else {
         feedbackElement.textContent = '';
         inputElement.classList.remove('input-invalid');
         inputElement.removeAttribute('aria-invalid');
         feedbackElement.removeAttribute('role');
     }
     return validationResult.valid; 
}
