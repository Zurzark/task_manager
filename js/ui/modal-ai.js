import { store } from '../store.js';
import { generateId, escapeHtml, getShanghaiInputValue } from '../utils.js';
import { updateUI } from './core.js';

const PRIORITY_MAP = {
    'high': { label: '重要且紧急', class: 'ai-priority-urgent', textClass: 'ai-text-urgent', badgeClass: 'ai-badge-urgent' },
    'medium': { label: '重要不紧急', class: 'ai-priority-high', textClass: 'ai-text-high', badgeClass: 'ai-badge-high' },
    'low': { label: '不重要紧急', class: 'ai-priority-medium', textClass: 'ai-text-medium', badgeClass: 'ai-badge-medium' },
    'none': { label: '不重要不紧急', class: 'ai-priority-none', textClass: 'ai-text-none', badgeClass: 'ai-badge-none' }
};

const ACTION_MAP = {
    'NEXT': { label: '下一步', class: 'ai-action-next' },
    'WAITING': { label: '等待', class: 'ai-action-waiting' },
    'SOMEDAY': { label: '将来', class: 'ai-action-someday' }
};

export function openAIConfirmModal(tasks) {
    window._tempParsedTasks = tasks.map(t => ({
        ...t,
        _tempId: Math.random().toString(36).substr(2, 9),
        _selected: true,
        priority: t.priority || 'none',
        actionType: t.actionType || 'NEXT',
        isFrog: !!t.isFrog,
        tags: t.tags || [],
        relations: t.relations || []
    }));
    renderAIConfirmModal();
}

export function renderAIConfirmModal() {
    const tasks = window._tempParsedTasks;
    const selectedCount = tasks.filter(t => t._selected).length;
    
    // Check if modal container already has content to avoid full re-render if not needed
    // However, for initial open, we do need full render.
    // For updates, we should try to be smarter or just re-render the list part.
    // But since we are changing the structure to avoid flicker, let's keep the shell static and only update list if possible.
    // Actually, simple way to avoid flicker is to not destroy and recreate the whole modal HTML.
    
    const container = document.getElementById('modal-container');
    if (!container.innerHTML.trim()) {
        // Initial Render
        const modalHtml = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in">
                <div class="bg-white rounded-xl w-full max-w-4xl p-6 max-h-[90vh] flex flex-col shadow-2xl">
                    <!-- Modal Header -->
                    <div class="flex justify-between items-center mb-6 pb-4 border-b">
                        <h3 class="text-xl font-bold flex items-center gap-2 text-gray-800">
                            <i class="ri-magic-line text-purple-600 text-2xl"></i> 
                            AI 解析结果确认 
                            <span id="ai-task-count-badge" class="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full ml-2">已识别 ${tasks.length} 个任务</span>
                        </h3>
                        <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-100">
                            <i class="ri-close-line text-2xl"></i>
                        </button>
                    </div>
                    
                    <!-- Task List -->
                    <div id="ai-task-list" class="flex-1 overflow-y-auto space-y-4 p-2">
                        ${tasks.map((t, index) => renderTaskItem(t, index)).join('')}
                    </div>

                    <!-- Modal Footer -->
                    <div class="pt-6 mt-4 border-t flex justify-between items-center bg-white z-10">
                        <div class="text-sm text-gray-500">
                            <i class="ri-information-line"></i> 点击任务内容即可直接编辑
                        </div>
                        <div class="flex gap-3">
                            <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">取消</button>
                            <button id="ai-confirm-btn" onclick="window.confirmImportTasks()" class="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg font-medium transition flex items-center gap-2">
                                <i class="ri-check-double-line"></i> 确认导入 (${selectedCount})
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = modalHtml;
    } else {
        // Update only the list and counts
        const listEl = document.getElementById('ai-task-list');
        if (listEl) {
            // We could do full innerHTML replacement of list, which is faster/less flicker than full modal replacement
            // But if we want NO flicker on input, we should rely on input events not re-rendering everything.
            // However, the current architecture relies on re-rendering to update state (like priority colors).
            // A middle ground is replacing the list innerHTML which is fast enough usually.
            // If focus is lost, we need to handle that.
            // The user complaint is about "flickering" which usually means full modal rebuild.
            // Just updating the list container should be much better.
            
            // To preserve focus, we need to be careful. 
            // If we are typing in a text input, re-rendering will lose focus.
            // We should only re-render if structural changes or significant visual changes that require it.
            // For simple text input, maybe we don't need to re-render immediately?
            // But we need to update the data model.
            
            // Let's try re-rendering just the list first.
            const currentFocus = document.activeElement;
            const currentFocusId = currentFocus?.id; // We don't have IDs on inputs yet, maybe we should add them?
            
            // Re-render list
            listEl.innerHTML = tasks.map((t, index) => renderTaskItem(t, index)).join('');
            
            // Update counts
            const btn = document.getElementById('ai-confirm-btn');
            if (btn) btn.innerHTML = `<i class="ri-check-double-line"></i> 确认导入 (${selectedCount})`;
            
            // Attempt to restore focus if possible (tricky without unique IDs for every input)
            // A better approach for "no flicker" on input is NOT to re-render on every keystroke.
            // But we are using onchange/oninput.
            // Let's see updateTempTask implementation.
        }
    }
}

// 辅助函数：根据 shortId 查找任务标题（先找现有任务，再找临时任务）
function findTaskTitleByShortId(shortId) {
    if (!shortId) return '未知任务';
    const sid = parseInt(shortId);
    
    // 1. 查找现有任务
    const existingTask = store.tasks.find(t => t.shortId === sid);
    if (existingTask) return existingTask.title;
    
    // 2. 查找本次解析的临时任务
    const tempTask = window._tempParsedTasks.find(t => t.shortId === sid);
    if (tempTask) return tempTask.title || '未命名任务';
    
    return '未知任务';
}

function renderRelationCapsule(label, targetShortId, typeClass) {
    return `
        <div class="group relative ai-relation-capsule ${typeClass}">
            <span class="font-bold opacity-75">${label}</span>
            <span class="font-mono font-bold">#${targetShortId}</span>
            <div class="ai-tooltip">
                ${escapeHtml(findTaskTitleByShortId(targetShortId))}
            </div>
        </div>
    `;
}

function renderTaskItem(t, index) {
    const priorityConfig = PRIORITY_MAP[t.priority] || PRIORITY_MAP['none'];
    const actionConfig = ACTION_MAP[t.actionType] || ACTION_MAP['NEXT'];
    const isSelected = t._selected;
    
    // 使用新定义的 CSS 类
    const cardClass = isSelected ? 'ai-task-selected' : 'ai-task-unselected';
    const priorityClass = priorityConfig.class; // 左侧边框色条
    const textClass = priorityConfig.textClass; // 标题文本颜色
    const badgeClass = priorityConfig.badgeClass; // 优先级徽章样式
    const actionBadgeClass = actionConfig.class; // 行动徽章样式
    
    // 截止日期处理
    const dateValue = t.dueDate ? getShanghaiInputValue(t.dueDate) : '';
    
    // Unique ID for inputs to help with focus restoration if needed (though we try to avoid re-render on input)
    const inputIdPrefix = `ai-input-${t._tempId}`;

    return `
        <div class="ai-modal-task-card ${cardClass} ${isSelected ? priorityClass : ''}" id="card-${t._tempId}">
            <!-- Header Row -->
            <div class="flex items-center gap-3 mb-3">
                <div class="flex items-center justify-center pt-1">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                        onchange="window.toggleTempTask('${t._tempId}')" 
                        class="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer">
                </div>
                
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <button onclick="window.updateTempTask('${t._tempId}', 'isFrog', ${!t.isFrog}, true)" 
                        class="ai-frog-btn ${t.isFrog ? 'opacity-100' : 'opacity-30 grayscale hover:grayscale-0'}"
                        title="切换青蛙任务">
                        🐸
                    </button>
                    <div class="ai-task-id">#${t.shortId || '?'}</div>
                    <input type="text" value="${escapeHtml(t.title || '')}" 
                        id="${inputIdPrefix}-title"
                        oninput="window.updateTempTask('${t._tempId}', 'title', this.value, false)"
                        class="ai-input-title ${isSelected ? textClass : ''}"
                        placeholder="任务名称">
                </div>

                <div class="flex items-center gap-2 shrink-0">
                    <!-- Action Type Selector -->
                    <div class="relative">
                        <select onchange="window.updateTempTask('${t._tempId}', 'actionType', this.value, true)"
                            class="appearance-none ${isSelected ? actionBadgeClass : 'bg-gray-100 text-gray-500'} text-xs font-bold py-1.5 pl-3 pr-8 rounded-full border focus:ring-2 focus:ring-purple-500 cursor-pointer transition-colors">
                            ${Object.entries(ACTION_MAP).map(([key, conf]) => `
                                <option value="${key}" ${t.actionType === key ? 'selected' : ''}>${conf.label}</option>
                            `).join('')}
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-current opacity-60">
                            <i class="ri-arrow-down-s-line"></i>
                        </div>
                    </div>

                    <!-- Priority Selector -->
                    <div class="relative">
                        <select onchange="window.updateTempTask('${t._tempId}', 'priority', this.value, true)"
                            class="appearance-none ${isSelected ? badgeClass : 'bg-gray-100 text-gray-500'} text-xs font-bold py-1.5 pl-3 pr-8 rounded-full border focus:ring-2 focus:ring-offset-1 cursor-pointer transition-colors">
                            ${Object.entries(PRIORITY_MAP).map(([key, conf]) => `
                                <option value="${key}" ${t.priority === key ? 'selected' : ''}>${conf.label}</option>
                            `).join('')}
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-current opacity-60">
                            <i class="ri-arrow-down-s-line"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Body Row -->
            <div class="ml-9 mb-3">
                <textarea oninput="window.updateTempTask('${t._tempId}', 'description', this.value, false)"
                    rows="1"
                    id="${inputIdPrefix}-desc"
                    class="w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-purple-400 text-sm text-gray-600 focus:ring-0 resize-y min-h-[1.5em] transition-colors"
                    placeholder="添加任务描述...">${escapeHtml(t.description || '')}</textarea>
            </div>

            <!-- Footer Row -->
            <div class="ml-9 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <!-- Due Date (datetime-local) -->
                <div class="flex items-center gap-1 group relative">
                    <i class="ri-calendar-event-line text-gray-400 group-hover:text-purple-500"></i>
                    <input type="datetime-local" value="${dateValue}" 
                        onchange="window.updateTempTask('${t._tempId}', 'dueDate', this.value, true)"
                        class="bg-transparent border-none p-0 text-xs text-gray-500 focus:ring-0 cursor-pointer hover:text-purple-600 font-medium font-mono">
                </div>

                <!-- Tags -->
                <div class="flex items-center gap-2">
                    ${t.tags.map((tag, i) => `
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                            <i class="ri-hashtag text-gray-400"></i> ${escapeHtml(tag)}
                            <button onclick="window.removeTempTaskTag('${t._tempId}', ${i})" class="hover:text-red-500 ml-0.5">
                                <i class="ri-close-line"></i>
                            </button>
                        </span>
                    `).join('')}
                </div>

                <!-- Relations Capsules -->
                <div class="flex items-center gap-2">
                    ${t.parentShortId ? renderRelationCapsule('父任务', t.parentShortId, 'ai-capsule-parent') : ''}
                    
                    ${t.relations && t.relations.length > 0 ? t.relations.map(r => {
                        // 简单的类型映射
                        const isDependency = r.type === 'depends_on' || r.type === 'blocked_by';
                        const label = isDependency ? '依赖' : '关联';
                        const cssClass = isDependency ? 'ai-capsule-dependency' : 'ai-capsule-relation';
                        return renderRelationCapsule(label, r.targetShortId, cssClass);
                    }).join('') : ''}
                </div>
            </div>
        </div>
    `;
}

// Global functions for interaction
export function toggleTempTask(tempId) {
    const task = window._tempParsedTasks.find(t => t._tempId === tempId);
    if (task) {
        task._selected = !task._selected;
        renderAIConfirmModal(); // Checkbox toggle needs re-render to update UI state (opacity, etc)
    }
}

/**
 * Update task data.
 * @param {string} tempId 
 * @param {string} field 
 * @param {any} value 
 * @param {boolean} shouldRender - Whether to re-render the list. Default true. 
 *                                 Set to false for text inputs to avoid losing focus.
 */
export function updateTempTask(tempId, field, value, shouldRender = true) {
    const task = window._tempParsedTasks.find(t => t._tempId === tempId);
    if (task) {
        // 如果是日期字段，需要处理格式，确保回写的是 ISO 字符串
        if (field === 'dueDate' && value) {
             try {
                task[field] = new Date(value).toISOString();
             } catch(e) {
                console.error("Date parse error", e);
                task[field] = value; // Fallback
             }
        } else {
            task[field] = value;
        }
        
        if (shouldRender) {
            renderAIConfirmModal(); 
        } else {
            // For text inputs where we don't re-render, we might need to manually update 
            // dependent UI elements if any (like if title color depended on content, which it doesn't, 
            // but title color depends on priority which DOES re-render).
            // So for title/description text changes, we just update data.
        }
    }
}

export function removeTempTaskTag(tempId, index) {
    const task = window._tempParsedTasks.find(t => t._tempId === tempId);
    if (task && task.tags) {
        task.tags.splice(index, 1);
        renderAIConfirmModal();
    }
}

export function confirmImportTasks() {
    const toImport = window._tempParsedTasks.filter(t => t._selected);
    const tempIdMap = new Map();
    const createdTasks = [];
    let count = 0;

    toImport.forEach(t => {
        const newUuid = generateId();
        const newTask = store.addTask({
            title: t.title,
            description: t.description,
            priority: t.priority,
            actionType: t.actionType,
            isFrog: t.isFrog,
            dueDate: t.dueDate,
            tags: t.tags,
            // System fields
            id: newUuid,
            parentId: null, 
            relations: [],  
            status: 'pending',
            completed: false,
            createdAt: new Date().toISOString()
        });
        
        if (t.shortId && t.shortId < 0) {
            tempIdMap.set(t.shortId, newTask.id);
        }
        
        createdTasks.push({ task: newTask, raw: t });
        count++;
    });

    createdTasks.forEach(({ task, raw }) => {
        let updates = {};
        if (raw.parentShortId) {
            const pSid = parseInt(raw.parentShortId);
            if (pSid < 0) {
                if (tempIdMap.has(pSid)) updates.parentId = tempIdMap.get(pSid);
            } else {
                const parent = store.tasks.find(x => x.shortId === pSid);
                if (parent) updates.parentId = parent.id;
            }
        }

        if (raw.relations && raw.relations.length > 0) {
            updates.relations = raw.relations.map(rel => {
                const tSid = parseInt(rel.targetShortId);
                let targetId = null;
                let finalTargetShortId = null;

                if (tSid < 0) {
                    if (tempIdMap.has(tSid)) {
                        targetId = tempIdMap.get(tSid);
                        const targetTask = store.tasks.find(x => x.id === targetId);
                        if (targetTask) finalTargetShortId = targetTask.shortId;
                    }
                } else {
                    const target = store.tasks.find(x => x.shortId === tSid);
                    if (target) {
                        targetId = target.id;
                        finalTargetShortId = target.shortId;
                    }
                }

                return targetId ? { 
                    type: rel.type, 
                    targetId: targetId, 
                    targetShortId: finalTargetShortId 
                } : null;
            }).filter(Boolean);
        }

        if (Object.keys(updates).length > 0) {
            store.updateTask(task.id, updates);
        }
    });

    document.getElementById('modal-container').innerHTML = '';
    updateUI();
    alert(`成功导入 ${count} 个任务`);
}

// Assign to window for HTML inline events
window.toggleTempTask = toggleTempTask;
window.updateTempTask = updateTempTask;
window.removeTempTaskTag = removeTempTaskTag;
window.confirmImportTasks = confirmImportTasks;
