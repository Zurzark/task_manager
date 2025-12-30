I have analyzed `js/main.js` and `index.html`. `main.js` is currently over 1800 lines long and handles too many responsibilities (UI, Logic, Events, AI, Backup).

I propose to split it into logical modules without changing any functionality.

### **Proposed File Structure**

1.  **`js/ui/` Directory** (New):
    *   **`core.js`**: Core UI functions (`initUI`, `updateUI`, `updateCounts`, `renderCategoryList`).
    *   **`modal-task.js`**: Task editing modal (`openTaskModal`, `saveTaskEdit`).
    *   **`modal-settings.js`**: Settings & Logs modals (`openSettingsModal`, `openLogsModal`).
    *   **`modal-memory.js`**: Memory management modal (`openMemoryModal`).
    *   **`modal-ai.js`**: AI confirmation modal (`openAIConfirmModal`).

2.  **`js/features/` Directory** (New):
    *   **`ai.js`**: AI parsing logic (`handleAIParse`).
    *   **`backup.js`**: Backup & Restore logic (`setupBackupListeners`).

3.  **`js/actions.js`** (New):
    *   Global event handlers exposed to `window` (e.g., `toggleTaskComplete`, `deleteTaskAndClose`, `handleQuickAdd`). This ensures HTML `onclick` attributes continue to work.

4.  **`js/utils.js`**:
    *   Move helper functions like `getShanghaiInputValue` and `extractJsonFromResponse` here.

5.  **`js/main.js`** (Entry Point):
    *   Will be reduced to ~50 lines.
    *   Imports and initializes all the above modules.

### **Execution Steps**

1.  Create `js/ui` and `js/features` directories.
2.  Update `js/utils.js` with shared helpers.
3.  Extract code from `main.js` into the new files, ensuring correct imports/exports.
4.  Create `js/actions.js` to map window functions.
5.  Rewrite `js/main.js` to wire everything together.
6.  Verify that `index.html` (using `<script type="module" src="js/main.js">`) works without changes.

This refactoring will make the codebase much easier to maintain and extend.
