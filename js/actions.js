import { store } from './store.js';
import { updateUI } from './ui/core.js';
import { getFilteredTasks } from './views.js';
import { openTaskModal, saveTaskEdit, deleteTaskAndClose, addRelationRow } from './ui/modal-task.js';
import { openSettingsModal, openLogsModal, switchSettingsTab, savePrompt, setActiveApi, editApi, resetEditForm, deleteApi, saveApiForm, saveGeneralSettings } from './ui/modal-settings.js';
import { openMemoryModal, switchMemoryTab, saveMemoryProfile, saveMemoryConfig, openAddMemoryModal, saveNewMemory, toggleMemory, editMemory, saveEditedMemory, deleteMemory, organizeMemories } from './ui/modal-memory.js';
import { openAIConfirmModal, toggleTempTask, confirmImportTasks } from './ui/modal-ai.js';
import { getShanghaiInputValue } from './utils.js';
import { insertTaskRef } from './ui/core.js';

// Map imported functions to window
window.addRelationRow = addRelationRow;
window.triggerEdit = openTaskModal; // Alias
window.saveTaskEdit = saveTaskEdit;
window.deleteTaskAndClose = deleteTaskAndClose;
window.insertTaskRef = insertTaskRef;

window.openSettingsModal = openSettingsModal; 
window.switchSettingsTab = switchSettingsTab;
window.savePrompt = savePrompt;
window.setActiveApi = setActiveApi;
window.editApi = editApi;
window.resetEditForm = resetEditForm;
window.deleteApi = deleteApi;
window.saveApiForm = saveApiForm;
window.saveGeneralSettings = saveGeneralSettings;

window.switchMemoryTab = switchMemoryTab;
window.saveMemoryProfile = saveMemoryProfile;
window.saveMemoryConfig = saveMemoryConfig;
window.openAddMemoryModal = openAddMemoryModal;
window.saveNewMemory = saveNewMemory;
window.toggleMemory = toggleMemory;
window.editMemory = editMemory;
window.saveEditedMemory = saveEditedMemory;
window.deleteMemory = deleteMemory;
window.organizeMemories = organizeMemories;

window.toggleTempTask = toggleTempTask;
window.confirmImportTasks = confirmImportTasks;


// Define and map other global actions

export function handleQuickAdd() {
    const input = document.getElementById('task-input');
    const text = input.value.trim();
    if (!text) return;
    
    store.addTask({
        title: text,
        priority: 'medium',
        category: '工作'
    });
    input.value = '';
    updateUI();
}
window.handleQuickAdd = handleQuickAdd;

window.handleDateInput = (input, originalValStr) => {
    const val = input.value;
    if (!val) return;
    
    const [datePart, timePart] = val.split('T');
    
    // 获取配置的下班时间 (默认 18:15)
    const workEnd = (store.config.workHours && store.config.workHours.end) ? store.config.workHours.end : '18:15';
    
    // 判断是否需要自动填充时间
    // 逻辑：如果原始值为空（新设置），或者日期部分发生了变化，则将时间重置为下班时间
    let shouldUpdate = false;
    
    if (!originalValStr) {
        shouldUpdate = true;
    } else {
        // originalValStr 是 ISO 格式，需要转换对比
        const originalDatePart = getShanghaiInputValue(originalValStr).split('T')[0];
        if (datePart !== originalDatePart) {
            shouldUpdate = true;
        }
    }
    
    // 只有当当前时间不是用户手动设定的特定时间（难以判断，这里简单假设：如果日期变了，我们就重置时间）
    // 为了防止死循环或用户无法修改时间：
    // 我们检查 input.dataset.lastDate，如果用户是在同一个 session 里修改日期，也触发
    // 但如果用户是在修改时间（日期没变），则不触发
    
    if (shouldUpdate) {
        // 防止用户刚改了时间又被重置：只有当日期确实变了才重置
        // 如果用户先改了日期（触发重置），再改时间（日期没变），就不会触发这里
        if (input.dataset.lastDate !== datePart) {
             input.value = `${datePart}T${workEnd}`;
             input.dataset.lastDate = datePart; // 标记该日期已处理
        }
    }
};

window.handleDateInputWithDefault = (input, originalValStr, defaultTime) => {
    const val = input.value;
    if (!val) return;
    const [datePart] = val.split('T');
    const fallback = defaultTime || ((store.config.workHours && store.config.workHours.end) ? store.config.workHours.end : '18:15');
    
    let shouldUpdate = false;
    if (!originalValStr) {
        shouldUpdate = true;
    } else {
        const originalDatePart = getShanghaiInputValue(originalValStr).split('T')[0];
        if (datePart !== originalDatePart) {
            shouldUpdate = true;
        }
    }
    if (shouldUpdate && input.dataset.lastDate !== datePart) {
        input.value = `${datePart}T${fallback}`;
        input.dataset.lastDate = datePart;
    }
};

window.editTaskField = (taskId, field, event) => {
    const task = store.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const cell = event.currentTarget;
    const currentVal = task[field];
    
    // 防止重复点击触发
    if (cell.querySelector('input, select')) return;
    
    let inputHtml = '';
    
    if (field === 'status') {
        inputHtml = `
            <select class="text-sm border rounded p-1 w-full" onblur="window.saveTaskField('${taskId}', '${field}', this.value)" onchange="this.blur()" onclick="event.stopPropagation()">
                <option value="pending" ${currentVal === 'pending' ? 'selected' : ''}>待开始</option>
                <option value="active" ${currentVal === 'active' ? 'selected' : ''}>进行中</option>
                <option value="done" ${currentVal === 'done' ? 'selected' : ''}>已完成</option>
                <option value="cancelled" ${currentVal === 'cancelled' ? 'selected' : ''}>已取消</option>
            </select>
        `;
    } else if (field.includes('Date') || field.includes('Time') || field === 'completedAt') {
        let dateVal = getShanghaiInputValue(currentVal);
        inputHtml = `<input type="datetime-local" class="text-xs border rounded p-1 w-full" value="${dateVal}" oninput="window.handleDateInput(this, '${currentVal || ''}')" onblur="window.saveTaskField('${taskId}', '${field}', this.value)" onkeydown="if(event.key==='Enter') this.blur()" onclick="event.stopPropagation()">`;
    }
    
    cell.innerHTML = inputHtml;
    const input = cell.querySelector('input, select');
    if (input) input.focus();
};

window.saveTaskField = (taskId, field, value) => {
    const task = store.tasks.find(t => t.id === taskId);
    if (task) {
        let hasChanges = false;
        
        if (field === 'status') {
            if (task.status !== value) {
                task.status = value;
                if (value === 'done' && !task.completedAt) {
                    task.completedAt = new Date().toISOString();
                } else if (value !== 'done') {
                    task.completedAt = null;
                }
                hasChanges = true;
            }
        } else {
             let newVal = null;
             if (value) {
                 newVal = new Date(value + '+08:00').toISOString();
             }
             if (task[field] !== newVal) {
                 task[field] = newVal;
                 hasChanges = true;
             }
        }
        
        if (hasChanges) {
            store.saveData(); 
            updateUI();
        } else {
            updateUI(); // 刷新以恢复原样
        }
    }
};

window.toggleTaskComplete = (id) => {
    const task = store.tasks.find(t => t.id === id);
    if (task) {
        store.updateTask(id, { status: task.status === 'done' ? 'pending' : 'done' });
        updateUI();
    }
};

window.toggleCollapse = (id) => {
    const task = store.tasks.find(t => t.id === id);
    if (task) {
        task.collapsed = !task.collapsed;
        store.saveData();
        updateUI();
    }
};

window.toggleSelection = (id) => {
    if (store.selectedTaskIds.has(id)) {
        store.selectedTaskIds.delete(id);
    } else {
        store.selectedTaskIds.add(id);
    }
    updateUI();
};

window.clearSelection = () => {
    store.selectedTaskIds.clear();
    updateUI();
};

window.toggleSelectAll = (checked) => {
    const tasks = getFilteredTasks();
    if (checked) {
        tasks.forEach(t => store.selectedTaskIds.add(t.id));
    } else {
        store.selectedTaskIds.clear();
    }
    updateUI();
};

window.batchComplete = () => {
    store.batchComplete();
    updateUI();
};

window.batchDelete = () => {
    if (confirm('确定删除选中任务?')) {
        store.batchDelete();
        updateUI();
    }
};

window.toggleSort = (field) => {
    const current = store.sortState.find(s => s.field === field);
    if (current) {
        if (current.direction === 'asc') current.direction = 'desc';
        else store.sortState = store.sortState.filter(s => s.field !== field);
    } else {
        store.sortState = [{ field, direction: 'asc' }, ...store.sortState];
    }
    store.saveConfig();
    updateUI();
};

window.toggleStatusFilter = (e) => {
    const el = document.getElementById('status-filter-dropdown');
    if (el) el.classList.toggle('hidden');
};

window.applyStatusFilter = (status) => {
    store.statusFilter = status;
    updateUI();
};

window.filterByCategory = (cat) => {
    store.categoryFilter = store.categoryFilter === cat ? null : cat;
    updateUI();
};

window.updateDateRangeFilter = () => {
    const start = document.getElementById('filter-date-start').value;
    const end = document.getElementById('filter-date-end').value;
    const label = document.getElementById('deadline-filter-label');
    const popover = document.getElementById('deadline-filter-popover');
    
    if (start && end) {
        if (new Date(start) > new Date(end)) {
            alert('开始日期不能晚于结束日期');
            return;
        }
        store.dateRangeFilter = { start, end };
        if (label) {
            label.textContent = `${start.slice(5)}~${end.slice(5)}`;
            label.classList.add('text-blue-600', 'font-medium');
        }
    } else {
        store.dateRangeFilter = null;
        if (label) {
            label.textContent = '不限时间';
            label.classList.remove('text-blue-600', 'font-medium');
        }
    }
    // 重置分页
    store.pagination.list.page = 1;
    if (popover) popover.classList.add('hidden');
    updateUI();
};

window.clearDateFilter = () => {
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    const label = document.getElementById('deadline-filter-label');
    const popover = document.getElementById('deadline-filter-popover');

    store.dateRangeFilter = null;
    if (label) {
        label.textContent = '不限时间';
        label.classList.remove('text-blue-600', 'font-medium');
    }

    store.pagination.list.page = 1;
    if (popover) popover.classList.add('hidden');
    updateUI();
};

window.updateCreatedFilter = () => {
    const start = document.getElementById('filter-created-start').value;
    const end = document.getElementById('filter-created-end').value;
    const label = document.getElementById('created-filter-label');
    const popover = document.getElementById('created-filter-popover');
    
    if (start && end) {
        if (new Date(start) > new Date(end)) {
            alert('开始日期不能晚于结束日期');
            return;
        }
        store.createdAtRangeFilter = { start, end };
        label.textContent = `${start.slice(5)}~${end.slice(5)}`;
        label.classList.add('text-blue-600', 'font-medium');
    } else {
        store.createdAtRangeFilter = null;
        label.textContent = '不限时间';
        label.classList.remove('text-blue-600', 'font-medium');
    }
    
    store.pagination.list.page = 1;
    popover.classList.add('hidden');
    updateUI();
};

window.clearCreatedFilter = () => {
    document.getElementById('filter-created-start').value = '';
    document.getElementById('filter-created-end').value = '';
    const label = document.getElementById('created-filter-label');
    const popover = document.getElementById('created-filter-popover');
    
    store.createdAtRangeFilter = null;
    label.textContent = '不限时间';
    label.classList.remove('text-blue-600', 'font-medium');
    
    store.pagination.list.page = 1;
    popover.classList.add('hidden');
    updateUI();
};

window.changeListPageSize = (size) => {
    store.pagination.list.pageSize = parseInt(size);
    store.pagination.list.page = 1;
    updateUI();
};

window.goToListPage = (page) => {
    store.pagination.list.page = page;
    updateUI();
};

window.changeListPage = (delta) => {
    const { page } = store.pagination.list;
    const newPage = page + delta;
    if (newPage < 1) return;
    
    store.pagination.list.page = newPage;
    updateUI();
};

window.changeQuadrantPage = (priorityKey, delta) => {
    const current = store.pagination.quadrant[priorityKey];
    if (!current) return;
    const newPage = current.page + delta;
    if (newPage < 1) return;
    
    store.pagination.quadrant[priorityKey].page = newPage;
    updateUI();
};

window.setCalendarView = (mode) => {
    store.calendarView = mode;
    updateUI();
};

window.moveCalendar = (delta) => {
    const d = new Date(store.calendarDate);
    if (store.calendarView === 'month') {
        d.setMonth(d.getMonth() + delta);
    } else {
        d.setDate(d.getDate() + (delta * 7));
    }
    store.calendarDate = d;
    updateUI();
};

window.resetCalendar = () => {
    store.calendarDate = new Date();
    updateUI();
};

window.toggleFrog = (id) => {
    const task = store.tasks.find(t => t.id === id);
    if (task) {
        store.updateTask(id, { isFrog: !task.isFrog });
        updateUI();
    }
};

window.updateActionType = (id, type) => {
    store.updateTask(id, { actionType: type });
    updateUI();
};

window.toggleFrogFilter = (checked) => {
    store.frogFilter = checked;
    updateUI();
};

window.updateActionTypeFilter = (value) => {
    store.actionTypeFilter = value;
    updateUI();
};

window.toggleStatusDropdown = () => {
    const menu = document.getElementById('status-filter-menu');
    menu.classList.toggle('hidden');
    
    const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
    const current = store.statusFilter;
    
    checkboxes.forEach(cb => {
        if (cb.value === 'all') {
            cb.checked = current.length === 0;
        } else {
            cb.checked = current.includes(cb.value);
        }
    });
};

window.updateStatusFilter = (value, checked) => {
    let current = [...store.statusFilter];
    
    if (value === 'all') {
        if (checked) {
            current = [];
        } else {
            current = [];
        }
    } else {
        if (checked) {
            if (!current.includes(value)) current.push(value);
        } else {
            current = current.filter(v => v !== value);
        }
    }
    
    store.statusFilter = current;
    
    const label = document.getElementById('status-filter-label');
    if (current.length === 0) {
        label.textContent = '全部';
    } else {
        const map = { pending: '待开始', active: '进行中', done: '已完成', cancelled: '已取消' };
        if (current.length === 1) {
            label.textContent = map[current[0]];
        } else {
            label.textContent = `已选 ${current.length} 项`;
        }
    }
    
    if (value === 'all' && checked) {
        const menu = document.getElementById('status-filter-menu');
        menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.value !== 'all') cb.checked = false;
        });
    } else if (value !== 'all' && checked) {
        const menu = document.getElementById('status-filter-menu');
        const allCb = menu.querySelector('input[value="all"]');
        if (allCb) allCb.checked = false;
    }
    
    updateUI();
};

window.updatePriority = (id, priority) => {
    store.updateTask(id, { priority });
    updateUI();
};

window.updateKeywordFilter = (keyword) => {
    store.keywordFilter = keyword;
    store.pagination.list.page = 1; // Reset pagination
    
    // Toggle clear button
    const btn = document.getElementById('btn-clear-search');
    if (btn) {
        if (keyword && keyword.trim().length > 0) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }
    
    updateUI();
};

window.clearKeywordFilter = () => {
    store.keywordFilter = '';
    store.pagination.list.page = 1;
    
    const input = document.getElementById('keyword-search-input');
    if (input) input.value = '';
    
    const btn = document.getElementById('btn-clear-search');
    if (btn) btn.classList.add('hidden');
    
    updateUI();
};

// ============ 拖拽排序/层级管理 ============
let draggedTaskId = null;

// Helper: 检查是否产生循环引用 (检查 targetId 是否是 possibleParentId 的后代)
function isDescendant(possibleParentId, targetId) {
    if (possibleParentId === targetId) return true; // Self check
    
    let current = store.tasks.find(t => t.id === targetId);
    while (current && current.parentId) {
        if (current.parentId === possibleParentId) return true;
        current = store.tasks.find(t => t.id === current.parentId);
    }
    return false;
}

window.handleDragStart = (e, taskId) => {
    draggedTaskId = taskId;
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires setData
    e.dataTransfer.setData('text/plain', taskId);
    
    // Add a slight delay to add 'dragging' class for visual feedback if needed
    setTimeout(() => {
        const row = e.target.closest('tr');
        if (row) row.classList.add('opacity-50');
    }, 0);
};

window.handleDragOver = (e, taskId) => {
    e.preventDefault(); // Allow drop
    e.stopPropagation(); // Prevent container dragover

    if (!draggedTaskId || draggedTaskId === taskId) return;
    
    // Check circular dependency
    if (isDescendant(draggedTaskId, taskId)) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    const row = e.currentTarget;
    const rect = row.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;
    
    // Clear all classes first
    row.classList.remove('drop-target-inside', 'drop-target-top', 'drop-target-bottom');
    
    if (offsetY < height * 0.25) {
        row.classList.add('drop-target-top');
    } else if (offsetY > height * 0.75) {
        row.classList.add('drop-target-bottom');
    } else {
        row.classList.add('drop-target-inside');
    }
};

window.handleDragLeave = (e, taskId) => {
    const row = e.currentTarget;
    row.classList.remove('drop-target-inside', 'drop-target-top', 'drop-target-bottom');
};

window.handleDrop = (e, taskId) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to container
    
    const row = e.currentTarget;
    const isTop = row.classList.contains('drop-target-top');
    const isBottom = row.classList.contains('drop-target-bottom');
    const isInside = row.classList.contains('drop-target-inside');
    
    // Cleanup
    row.classList.remove('drop-target-inside', 'drop-target-top', 'drop-target-bottom');
    
    if (!draggedTaskId || draggedTaskId === taskId) return;
    if (isDescendant(draggedTaskId, taskId)) return;
    
    const draggedTask = store.tasks.find(t => t.id === draggedTaskId);
    const targetTask = store.tasks.find(t => t.id === taskId);
    
    if (!draggedTask || !targetTask) return;
    
    if (isTop || isBottom) {
        // Reordering (Insert Before/After)
        draggedTask.parentId = targetTask.parentId;
        
        // Calculate Order
        // Use getFilteredTasks to get the current visual order
        const allTasks = getFilteredTasks(); 
        const siblings = allTasks.filter(t => t.parentId === targetTask.parentId);
        
        // 1. Normalize orders if needed (if collisions exist or not strictly ascending)
        let needNormalize = false;
        for (let i = 0; i < siblings.length - 1; i++) {
            const curr = siblings[i].order || 0;
            const next = siblings[i+1].order || 0;
            if (curr >= next || (next - curr) < 0.0001) {
                needNormalize = true;
                break;
            }
        }
        
        if (needNormalize) {
            siblings.forEach((t, i) => {
                t.order = (i + 1) * 100000;
            });
        }

        // 2. Calculate new order based on neighbors in the "clean" list (excluding dragged task)
        const siblingsExcl = siblings.filter(t => t.id !== draggedTaskId);
        const targetIndex = siblingsExcl.findIndex(t => t.id === taskId);
        
        let newOrder;
        
        if (targetIndex !== -1) {
            const curr = siblingsExcl[targetIndex]; // targetTask
            
            if (isTop) {
                // Insert Before
                const prev = siblingsExcl[targetIndex - 1];
                if (prev) {
                    newOrder = ((prev.order || 0) + (curr.order || 0)) / 2;
                } else {
                    newOrder = (curr.order || 0) / 2; // Between 0 and curr
                }
            } else {
                // Insert After
                const next = siblingsExcl[targetIndex + 1];
                if (next) {
                    newOrder = ((curr.order || 0) + (next.order || 0)) / 2;
                } else {
                    newOrder = (curr.order || 0) + 100000;
                }
            }
            draggedTask.order = newOrder;
        }
        
        // Reset sort state to Manual if we reordered
        store.sortState = [];
        
    } else {
        // Nesting (Inside)
        draggedTask.parentId = taskId;
        
        const parentTask = store.tasks.find(t => t.id === taskId);
        if (parentTask) parentTask.collapsed = false;
        
        // Append to end of children
        const children = store.tasks.filter(t => t.parentId === taskId);
        if (children.length > 0) {
             const maxOrder = children.reduce((max, t) => Math.max(max, t.order || 0), -Infinity);
             draggedTask.order = maxOrder + 10000;
        } else {
            draggedTask.order = 0;
        }
    }
    
    store.saveData();
    updateUI();
    draggedTaskId = null;
};

window.handleDragEnd = (e) => {
    draggedTaskId = null;
    document.body.classList.remove('dragging-active'); // Remove global class
    const row = e.target.closest('tr');
    if (row) row.classList.remove('opacity-50');
    
    // Cleanup any stuck drop-targets
    document.querySelectorAll('.drop-target-inside, .drop-target-top, .drop-target-bottom').forEach(el => {
        el.classList.remove('drop-target-inside', 'drop-target-top', 'drop-target-bottom');
    });
    document.querySelectorAll('.drop-target-root').forEach(el => el.classList.remove('drop-target-root'));
};

// Container handlers (Move to Root)
window.handleContainerDragOver = (e) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    e.dataTransfer.dropEffect = 'move';
};

window.handleContainerDrop = (e) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    
    const task = store.tasks.find(t => t.id === draggedTaskId);
    if (task && task.parentId) {
        task.parentId = null; // Make root
        store.saveData();
        updateUI();
    }
    draggedTaskId = null;
};

// Global Root handlers (for #app)
window.handleRootDragOver = (e) => {
    // Only allow if dragging a task
    if (!draggedTaskId) return;
    
    // If the event target is inside a specific drop zone (like a task row),
    // the stopPropagation in handleDragOver should have prevented this.
    // So if we reach here, we are likely over "empty space".
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Optional: Visual feedback for root drop
    // Check if we are over the header
    const thead = e.target.closest('thead');
    if (thead) {
        thead.classList.add('drop-target-root');
    } else {
        // Clear header highlight if we moved out of it but still in root zone
        document.querySelectorAll('.drop-target-root').forEach(el => el.classList.remove('drop-target-root'));
    }
};

window.handleRootDrop = (e) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    
    const task = store.tasks.find(t => t.id === draggedTaskId);
    if (task && task.parentId) {
        task.parentId = null; // Make root
        store.saveData();
        updateUI();
    }
    draggedTaskId = null;
    document.querySelectorAll('.drop-target-root').forEach(el => el.classList.remove('drop-target-root'));
};
