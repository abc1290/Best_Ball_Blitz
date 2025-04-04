import * as DataModel from './dataModel.js';
import * as UIController from './uiController.js';

/**
 * App Controller Module
 * Coordinates between the data model and UI, sets up event listeners.
 */

// --- Private Helper Functions ---

/**
 * Handles adding a player via the UI form.
 * Validates input, calls DataModel to add player, updates UI.
 */
function addPlayerHandler() {
    UIController.clearError(); // Clear previous errors
    
    // Validate inputs using UI validation functions first
    const isNameValid = UIController.validateNameInputUI();
    const isHandicapValid = UIController.validateHandicapInputUI();

    if (!isNameValid || !isHandicapValid) {
        return; // Stop if UI validation fails
    }

    const DOMElements = UIController.getDOMElements();
    const nameInput = DOMElements.playerNameInput.value.trim();
    const handicapInput = DOMElements.playerHandicapInput.value.trim();
    
    // Call DataModel to add the player
    const result = DataModel.addPlayer(nameInput, handicapInput);
    
    if (result.valid) {
        UIController.displayPlayers(); // Update player list display
        
        // Clear inputs and set focus
        DOMElements.playerNameInput.value = '';
        DOMElements.playerHandicapInput.value = '';
        DOMElements.playerNameInput.focus();
        
        // If players were already grouped, adding a new one invalidates groups/teams
        if (UIController.getUIState().isGrouped) {
            UIController.resetGroupsUI(); // Reset group/team UI elements
            DataModel.setGroups({ A: [], B: [], C: [], D: [] }); // Reset data model groups
            DataModel.setTeams([]); // Reset data model teams
        }
    } else {
        // This case should ideally be caught by UI validation, but handle defensively
        console.error("DataModel validation failed after UI validation passed:", result.errors);
        UIController.showError("Failed to add player. Please check inputs.");
    }
}

/**
 * Handles grouping players based on handicap.
 * Calls DataModel, updates UI state and displays.
 */
function groupPlayersHandler() {
    UIController.clearError();
    const result = DataModel.groupPlayers();
    
    if (!result.success) {
        UIController.showError(result.message);
        return;
    }
    
    UIController.displayGroups();
    UIController.getUIState().isGrouped = true; // Update UI state
    
    // Enable/disable team selection buttons based on whether teams can be formed
    const canForm = DataModel.canFormTeam();
    const DOMElements = UIController.getDOMElements();
    DOMElements.selectTeamBtn.disabled = !canForm;
    DOMElements.selectAllBtn.disabled = !canForm;
    DOMElements.draftStyleSelectBtn.disabled = !canForm; 
}

/**
 * Handles selecting the next team using the enhanced animation.
 * Calls UI animation, then DataModel, updates UI.
 */
async function selectTeamHandler() {
    UIController.clearError();
    const UIState = UIController.getUIState();
    const DOMElements = UIController.getDOMElements();

    if (!UIState.isGrouped) { UIController.showError("Please group players first."); return; }
    
    if (!DataModel.canFormTeam()) {
        UIController.showError("Not enough players left to form a full team.");
        DOMElements.selectTeamBtn.disabled = true;
        DOMElements.selectAllBtn.disabled = true;
        DOMElements.draftStyleSelectBtn.disabled = true; 
        return;
    }
    
    // Disable buttons during selection
    DOMElements.selectTeamBtn.disabled = true;
    DOMElements.selectAllBtn.disabled = true;
    DOMElements.draftStyleSelectBtn.disabled = true;
    
    // Perform animation (doesn't select players itself)
    await UIController.enhancedTeamSelectionAnimation(); 

    // Now actually select the team in the data model
    const result = DataModel.selectTeam(); 

    if (result.success) {
        // Update UI displays after data model changes
        UIController.displayGroups(); 
        UIController.displayTeams(); 
    } else {
        UIController.showError(result.message || "Failed to select team.");
    }
    
    // Re-enable buttons if more teams can be formed
    const canFormMore = DataModel.canFormTeam();
    DOMElements.selectTeamBtn.disabled = !canFormMore;
    DOMElements.selectAllBtn.disabled = !canFormMore;
    DOMElements.draftStyleSelectBtn.disabled = !canFormMore;
}

/**
 * Handles auto-selecting all possible remaining teams.
 */
async function selectAllTeamsHandler() {
    UIController.clearError();
    if (!UIController.getUIState().isGrouped) { 
        UIController.showError("Please group players first."); 
        return; 
    }
    
    const DOMElements = UIController.getDOMElements();
    DOMElements.selectTeamBtn.disabled = true;
    DOMElements.selectAllBtn.disabled = true;
    DOMElements.draftStyleSelectBtn.disabled = true;

    let teamsCreated = 0;
    while (DataModel.canFormTeam()) {
        const result = DataModel.selectTeam(); // Use basic selection logic
        if (result.success) {
            teamsCreated++;
            // Optional delay for visual effect
            // await new Promise(resolve => setTimeout(resolve, 50)); 
        } else {
            UIController.showError(result.message || "Failed during auto-select.");
            break; 
        }
    }
    
    // Update UI once after all selections
    UIController.displayGroups();
    UIController.displayTeams();

    if (teamsCreated > 0) {
         UIController.showError(`Auto-selected ${teamsCreated} teams.`);
    } else if (DataModel.getTeams().length > 0) {
         UIController.showError("No more teams could be formed.");
    }
    
    // Final button state check
    const canFormMore = DataModel.canFormTeam();
    DOMElements.selectTeamBtn.disabled = !canFormMore;
    DOMElements.selectAllBtn.disabled = !canFormMore;
    DOMElements.draftStyleSelectBtn.disabled = !canFormMore;
}

/**
 * Handles starting the interactive draft process.
 */
function startDraftStyleSelectionHandler() { 
    UIController.clearError(); 
    const UIState = UIController.getUIState();
    const DOMElements = UIController.getDOMElements();

    if (!UIState.isGrouped) { UIController.showError("Please group players first."); return; }
    if (!DataModel.canFormTeam()) { UIController.showError("Not enough players left to form teams."); return; }

    DOMElements.selectTeamBtn.disabled = true;
    DOMElements.selectAllBtn.disabled = true;
    DOMElements.draftStyleSelectBtn.disabled = true;

    const initResult = DataModel.initializeInteractiveDraft();

    if (initResult.success) {
        UIController.startInteractiveDraftUI(initResult.draftState);
        // Add listener to the dynamically created 'Next Pick' button
        const nextPickBtn = document.getElementById('nextDraftPickBtn');
        if (nextPickBtn) {
            // Remove existing listener if any to prevent duplicates
            nextPickBtn.removeEventListener('click', handleNextDraftPickHandler); 
            nextPickBtn.addEventListener('click', handleNextDraftPickHandler);
        }
    } else {
        UIController.showError(initResult.message);
        const canForm = DataModel.canFormTeam();
        DOMElements.selectTeamBtn.disabled = !canForm;
        DOMElements.selectAllBtn.disabled = !canForm;
        DOMElements.draftStyleSelectBtn.disabled = !canForm;
    }
}

/**
 * Handles the click of the "Next Pick" button during the interactive draft.
 */
function handleNextDraftPickHandler() {
    const pickResult = DataModel.makeInteractiveDraftPick();

    if (pickResult.success) {
        // Update UI to show the pick and highlight next slot
        UIController.updateDraftPickUI(pickResult); 
        
        // If draft is now complete, finalize
        if (pickResult.isDraftComplete) {
            finalizeInteractiveDraftHandler();
        }
    } else {
        console.error("Draft pick failed:", pickResult.message); 
        UIController.showError(pickResult.message || "Failed to make draft pick.");
        // Show close button on error
        const closeButton = document.getElementById('closeDraftOverlayBtn');
        if(closeButton) closeButton.style.display = 'block'; 
    }
}

/**
 * Finalizes the interactive draft, updates data model and UI.
 */
function finalizeInteractiveDraftHandler() {
    const result = DataModel.finalizeDraftedTeams();
    const DOMElements = UIController.getDOMElements();

    if (result.success) {
         UIController.showError(`${result.teamsAdded} teams finalized from draft.`);
         UIController.displayGroups(); 
         UIController.displayTeams(); 
         
         if (DataModel.getTeams().length > 0) {
             DOMElements.teeAssignmentTabButton.disabled = false;
         }
    } else {
        UIController.showError(result.message || "Failed to finalize drafted teams.");
    }
    
    // Re-enable buttons if applicable
    const canFormMore = DataModel.canFormTeam();
    DOMElements.selectTeamBtn.disabled = !canFormMore;
    DOMElements.selectAllBtn.disabled = !canFormMore;
    DOMElements.draftStyleSelectBtn.disabled = !canFormMore; 
}

/**
 * Handles file selection for CSV import. Reads the file content.
 * @param {Event} event - The file input change event.
 */
function handleFileUpload(event) { 
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onerror = function(e) {
        console.error("FileReader error:", e.target.error);
        UIController.showError(`Error reading file: ${e.target.error.name}`);
    };
    
    reader.onload = function(e) {
        UIController.clearError(); 
        const contents = e.target.result;
        if (contents === null) {
             UIController.showError("Error: Could not read file content.");
             return;
        }
        processCSVHandler(contents); // Process the content
    };
    
    reader.readAsText(file);
 }

/**
 * Processes the CSV content, adds players, and updates UI.
 * @param {string} csv - The CSV content as a string.
 */
function processCSVHandler(csv) { 
    console.log("Processing CSV data..."); // Debug log
    const result = DataModel.processCSV(csv);
    console.log("CSV Processing Result:", result); // Debug log
    
    if (!result || result.errors.length > 0) { 
        UIController.showError(`CSV Import Error: ${result ? result.errors[0] : 'Unknown processing error'}`);
        return;
    }
    
    // Add imported players
    const currentPlayers = DataModel.getPlayers();
    console.log("Players before import:", currentPlayers); // Debug log
    const combinedPlayers = currentPlayers.concat(result.players);
    console.log("Players to set after import:", combinedPlayers); // Debug log
    DataModel.setPlayers(combinedPlayers);
    
    // Update UI
    console.log("Calling UIController.displayPlayers after CSV import..."); // Debug log
    UIController.displayPlayers();
    console.log("UIController.displayPlayers finished."); // Debug log
    
    // Reset groups if necessary
    if (UIController.getUIState().isGrouped) {
        console.log("Resetting groups after CSV import."); // Debug log
        UIController.resetGroupsUI();
        DataModel.setGroups({ A: [], B: [], C: [], D: [] }); 
        DataModel.setTeams([]); 
    }
    
    // Clear file input
    UIController.getDOMElements().fileInput.value = '';
    UIController.showError(`Imported ${result.players.length} players successfully.`);
 }

/**
 * Handles resetting all application data and UI elements.
 */
function resetAllHandler() { 
    if (confirm("Are you sure you want to reset all players, groups, teams, and assignments?")) {
        DataModel.resetAll();
        UIController.displayPlayers(); // Update player list (will show empty)
        UIController.resetGroupsUI(); // Reset groups, teams, buttons etc.
        UIController.clearError();
        UIController.showError("All data reset.");
        // Also reset tee assignment UI if needed
        UIController.displayUnassignedTeams();
        UIController.updateHoleDisplays();
        UIController.updateTeeSheet();
    }
 }

/**
 * Initializes the Tee Assignment tab UI components.
 */
function initTeeAssignmentUI() { 
    UIController.clearError();
    // These functions read from DataModel and update the UI
    UIController.displayUnassignedTeams();
    UIController.updateHoleDisplays();
    UIController.updateTeeSheet();
 }

/**
 * Handles auto-assigning teams to holes.
 */
function autoAssignTeamsHandler() { 
    UIController.clearError();
    const result = DataModel.autoAssignTeams();
    if (result.success) {
        UIController.displayUnassignedTeams();
        UIController.updateHoleDisplays();
        UIController.updateTeeSheet();
        UIController.selectTeamForAssignment(null); 
        UIController.showError("Teams auto-assigned sequentially.");
    } else {
        UIController.showError(result.message || "Auto-assignment failed.");
    }
 }

/**
 * Handles randomly assigning teams to holes.
 */
function randomizeTeamAssignmentsHandler() { 
    UIController.clearError();
     const result = DataModel.randomizeTeamAssignments();
     if (result.success) {
         UIController.displayUnassignedTeams();
         UIController.updateHoleDisplays();
         UIController.updateTeeSheet();
         UIController.selectTeamForAssignment(null); 
         UIController.showError("Tee assignments randomized.");
     } else {
         UIController.showError(result.message || "Random assignment failed.");
     }
 }

/**
 * Handles resetting all hole assignments.
 */
function resetAssignmentsHandler() { 
    if (confirm("Are you sure you want to clear all hole assignments?")) {
        UIController.clearError();
        DataModel.setHoleAssignments({}); 
        UIController.displayUnassignedTeams();
        UIController.updateHoleDisplays();
        UIController.updateTeeSheet();
        UIController.selectTeamForAssignment(null); 
        UIController.showError("Hole assignments cleared.");
    }
 }

/**
 * Handles printing the tee sheet.
 */
function printTeeSheetHandler() { 
    window.print();
 }

/**
 * Sets up all primary event listeners for the application.
 */
function setupEventListeners() {
    const DOMElements = UIController.getDOMElements();
    
    // Tab navigation
    DOMElements.tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            DOMElements.tabButtons.forEach(btn => btn.classList.remove('active'));
            DOMElements.tabContents.forEach(content => content.classList.remove('active'));
            
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            const activeContent = document.getElementById(tabId);
            if (activeContent) {
                activeContent.classList.add('active');
                if (tabId === 'teeAssignmentTab') {
                    initTeeAssignmentUI(); 
                }
            }
        });
    });
    
    // Player Input
    DOMElements.addPlayerBtn.addEventListener('click', addPlayerHandler);
    DOMElements.resetBtn.addEventListener('click', resetAllHandler);
    DOMElements.fileInput.addEventListener('change', handleFileUpload);
    DOMElements.playerHandicapInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addPlayerHandler(); });
    DOMElements.playerNameInput.addEventListener('input', UIController.validateNameInputUI);
    DOMElements.playerHandicapInput.addEventListener('input', UIController.validateHandicapInputUI);
    // Player list remove buttons (using event delegation)
    DOMElements.playerList.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-btn')) {
            const playerItem = event.target.closest('.player-item');
            if (playerItem) {
                const index = parseInt(playerItem.getAttribute('data-index'));
                 if (confirm(`Are you sure you want to remove ${DataModel.getPlayers()[index]?.name}?`)) {
                    DataModel.removePlayer(index);
                    UIController.displayPlayers(); 
                    if (UIController.getUIState().isGrouped) {
                         UIController.resetGroupsUI(); 
                         DataModel.setGroups({ A: [], B: [], C: [], D: [] }); 
                         DataModel.setTeams([]); 
                    }
                }
            }
        }
    });

    // Grouping and Team Selection
    DOMElements.groupPlayersBtn.addEventListener('click', groupPlayersHandler);
    DOMElements.selectTeamBtn.addEventListener('click', selectTeamHandler); 
    DOMElements.selectAllBtn.addEventListener('click', selectAllTeamsHandler);
    DOMElements.draftStyleSelectBtn.addEventListener('click', startDraftStyleSelectionHandler); 
    
    // Tee Assignment
    DOMElements.autoAssignBtn.addEventListener('click', autoAssignTeamsHandler);
    DOMElements.randomAssignBtn.addEventListener('click', randomizeTeamAssignmentsHandler);
    DOMElements.resetAssignmentBtn.addEventListener('click', resetAssignmentsHandler);
    DOMElements.printTeeSheetBtn.addEventListener('click', printTeeSheetHandler);
    // Tee Assignment - Manual Assignment (using event delegation on layout container)
    DOMElements.courseLayout.addEventListener('click', (event) => {
        const holeBox = event.target.closest('.hole-box');
        if (holeBox) {
            const selectedTeamId = UIController.getUIState().selectedTeamId;
            if (selectedTeamId) {
                const holeNumber = parseInt(holeBox.getAttribute('data-hole'));
                const assignResult = DataModel.assignTeamToHole(selectedTeamId, holeNumber); 
                if (assignResult.success) {
                    UIController.displayUnassignedTeams(); 
                    UIController.updateHoleDisplays(); 
                    UIController.updateTeeSheet(); 
                    UIController.selectTeamForAssignment(null); // Deselect
                } else {
                    UIController.showError(assignResult.message); 
                }
            } else if (!event.target.classList.contains('hole-team')) { // Don't show error if clicking on an assigned team
                UIController.showError("Select a team from the 'Unassigned Teams' list first.");
            }
        }
    });
     // Tee Assignment - Manual Unassignment (using event delegation on layout container)
    DOMElements.courseLayout.addEventListener('click', (event) => {
        if (event.target.classList.contains('hole-team')) {
             event.stopPropagation(); // Prevent hole box click
             const teamId = parseInt(event.target.getAttribute('data-team-id'));
             const holeBox = event.target.closest('.hole-box');
             const holeNumber = parseInt(holeBox.getAttribute('data-hole'));
             if (teamId && holeNumber) {
                 const removeResult = DataModel.removeTeamFromHole(teamId, holeNumber); 
                 if (removeResult.success) {
                     UIController.displayUnassignedTeams(); 
                     UIController.updateHoleDisplays(); 
                     UIController.updateTeeSheet(); 
                 } else {
                     UIController.showError(removeResult.message || "Failed to remove team.");
                 }
             }
        }
    });
     // Tee Assignment - Select Unassigned Team (using event delegation)
     DOMElements.unassignedTeamsList.addEventListener('click', (event) => {
         if (event.target.classList.contains('unassigned-team')) {
             const teamId = parseInt(event.target.getAttribute('data-team-id'));
             UIController.selectTeamForAssignment(teamId);
         }
     });
     DOMElements.unassignedTeamsList.addEventListener('keydown', (event) => {
         if (event.target.classList.contains('unassigned-team') && (event.key === 'Enter' || event.key === ' ')) {
             event.preventDefault(); 
             const teamId = parseInt(event.target.getAttribute('data-team-id'));
             UIController.selectTeamForAssignment(teamId);
         }
     });


    // Settings listeners
    DOMElements.balanceTeamsToggle.addEventListener('change', function() {
        DataModel.updateSetting('balanceTeams', this.checked);
    });
    DOMElements.maxHandicapDiff.addEventListener('change', function() {
        DataModel.updateSetting('maxHandicapDiff', parseFloat(this.value) || 0);
    });
    DOMElements.startFormatSelect.addEventListener('change', function() {
        DataModel.updateSetting('startFormat', this.value);
        UIController.updateTeeSheet(); // Update tee sheet when format changes
    });
    DOMElements.startTimeInput.addEventListener('change', function() {
        DataModel.updateSetting('startTime', this.value);
        UIController.updateTeeSheet(); // Update tee sheet when time changes
    });
    DOMElements.timeIntervalInput.addEventListener('change', function() {
        DataModel.updateSetting('timeInterval', parseInt(this.value) || 10);
        UIController.updateTeeSheet(); // Update tee sheet when interval changes
    });

    // Help, Save, Load
    DOMElements.helpButton.addEventListener('click', UIController.showTutorial); 
    DOMElements.saveButton.addEventListener('click', () => {
        const result = DataModel.saveToLocalStorage();
        UIController.showError(result.success ? "Data saved successfully!" : result.message); 
    });
    DOMElements.loadButton.addEventListener('click', () => {
        UIController.clearError(); 
        const result = DataModel.loadFromLocalStorage();
        if (result.success) {
            // Update all relevant UI parts after loading data
            UIController.displayPlayers();
            UIController.displayGroups();
            UIController.displayTeams();
            UIController.getUIState().isGrouped = DataModel.getTeams().length > 0; // Update grouped state
            const canForm = DataModel.canFormTeam();
            DOMElements.selectTeamBtn.disabled = !canForm;
            DOMElements.selectAllBtn.disabled = !canForm;
            DOMElements.draftStyleSelectBtn.disabled = !canForm;
            DOMElements.showBracketBtn.disabled = DataModel.getTeams().length < 2;
            DOMElements.teeAssignmentTabButton.disabled = DataModel.getTeams().length === 0;
            // Update settings UI
            DOMElements.balanceTeamsToggle.checked = DataModel.getSettings().balanceTeams;
            DOMElements.maxHandicapDiff.value = DataModel.getSettings().maxHandicapDiff;
            DOMElements.startFormatSelect.value = DataModel.getSettings().startFormat;
            DOMElements.startTimeInput.value = DataModel.getSettings().startTime;
            DOMElements.timeIntervalInput.value = DataModel.getSettings().timeInterval;
            // Update tee assignment UI if that tab is active
            if (document.getElementById('teeAssignmentTab').classList.contains('active')) {
                initTeeAssignmentUI(); 
            }
            UIController.showError("Data loaded successfully!"); 
        } else {
            UIController.showError(result.message);
        }
    });
     // Tutorial navigation
    DOMElements.tutorialPrevBtn.addEventListener('click', () => UIController.navigateTutorial(-1));
    DOMElements.tutorialNextBtn.addEventListener('click', () => UIController.navigateTutorial(1));
    DOMElements.tutorialCloseBtn.addEventListener('click', UIController.closeTutorial);
    // Bracket listener
    DOMElements.showBracketBtn.addEventListener('click', UIController.createTournamentBracket);
}

// --- Public API ---
export function init() {
    console.log("AppController initializing...");
    UIController.init(); // Initialize UI elements
    setupEventListeners(); // Set up event listeners

    // Attempt to load saved data and update UI
    const loadResult = DataModel.loadFromLocalStorage();
    if (loadResult.success) {
        console.log("Loaded data from localStorage.");
        UIController.displayPlayers();
        UIController.displayGroups();
        UIController.displayTeams();
        UIController.getUIState().isGrouped = DataModel.getTeams().length > 0;
        
        const DOMElements = UIController.getDOMElements();
        const canForm = DataModel.canFormTeam();
        DOMElements.selectTeamBtn.disabled = !canForm;
        DOMElements.selectAllBtn.disabled = !canForm;
        DOMElements.draftStyleSelectBtn.disabled = !canForm; 
        DOMElements.showBracketBtn.disabled = DataModel.getTeams().length < 2;
        DOMElements.teeAssignmentTabButton.disabled = DataModel.getTeams().length === 0;
        // Update settings UI from loaded data
        DOMElements.balanceTeamsToggle.checked = DataModel.getSettings().balanceTeams;
        DOMElements.maxHandicapDiff.value = DataModel.getSettings().maxHandicapDiff;
        DOMElements.startFormatSelect.value = DataModel.getSettings().startFormat;
        DOMElements.startTimeInput.value = DataModel.getSettings().startTime;
        DOMElements.timeIntervalInput.value = DataModel.getSettings().timeInterval;

        // If tee assignment tab happens to be active on load (unlikely but possible)
        if (document.getElementById('teeAssignmentTab').classList.contains('active')) {
            initTeeAssignmentUI(); 
        }
    } else {
        console.log("No saved data found or load error:", loadResult.message);
        // Initialize with default empty state (already done by UIController.init)
        UIController.displayPlayers(); // Ensure empty player list is shown
    }
    console.log("AppController initialization complete.");
}

// Expose functions needed by dynamically added elements (like draft buttons)
export { handleNextDraftPickHandler, finalizeInteractiveDraftHandler };
