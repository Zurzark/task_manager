import { store } from './store.js';
import { memoryStore } from './memory.js';
import { render } from './views.js';
import { generateId, escapeHtml, extractReferences, buildReferencedTasksContext, formatFullDateTime } from './utils.js';
import { callAI } from './api.js';

// ============ 初始化与UI更新 ============

document.addEventListener('DOMContentLoaded', () => {
    store.init();
    memoryStore.init();
    initUI();
    updateUI();
});

function initUI() {
    // 视图切换
    document.querySelectorAll('.view-switcher, .nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target || e.currentTarget.dataset.view;
            if (target) {
                if (['list', 'kanban', 'calendar', 'quadrant'].includes(target)) {
                    store.currentViewMode = target;
                } else if (['today', 'all', 'completed'].includes(target)) {
                    store.viewFilter = target;
                    // 重置选中状态
                    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('bg-gray-100', 'text-blue-600'));
                    e.currentTarget.classList.add('bg-gray-100', 'text-blue-600');
                }
                updateUI();
            }
        });
    });

    // AI 解析按钮
    const aiBtn = document.getElementById('btn-ai-parse');
    if (aiBtn) aiBtn.addEventListener('click', handleAIParse);

    // 快速添加按钮
    const addBtn = document.getElementById('btn-quick-add');
    if (addBtn) addBtn.addEventListener('click', handleQuickAdd);

    // 记忆按钮
    const memBtn = document.getElementById('btn-memory');
    if (memBtn) memBtn.addEventListener('click', openMemoryModal);

    // 导出/导入/设置/日志
    document.getElementById('btn-export')?.addEventListener('click', () => {
        const data = JSON.stringify(store.tasks, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    });

    document.getElementById('btn-import')?.addEventListener('click', () => {
        document.getElementById('file-import').click();
    });

    document.getElementById('file-import')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (store.importData(e.target.result)) {
                    alert('导入成功');
                    updateUI();
                } else {
                    alert('导入失败');
                }
            };
            reader.readAsText(file);
        }
    });

    // 渲染分类列表
    renderCategoryList();
}

function updateUI() {
    const view = store.currentViewMode || 'list';
    const container = document.getElementById('view-container');
    
    // 渲染主视图
    if (render[view]) {
        container.innerHTML = render[view]();
    }

    // 修复：更新视图切换按钮状态
    document.querySelectorAll('.view-switcher').forEach(btn => {
        const target = btn.dataset.target;
        if (target === view) {
            btn.classList.remove('text-gray-500', 'hover:text-gray-800');
            btn.classList.add('bg-white', 'shadow-sm', 'text-gray-800', 'font-medium');
        } else {
            btn.classList.add('text-gray-500', 'hover:text-gray-800');
            btn.classList.remove('bg-white', 'shadow-sm', 'text-gray-800', 'font-medium');
        }
    });

    // 更新标题
    const viewTitles = {
        'today': '今日焦点',
        'all': '全部任务',
        'completed': '已完成'
    };
    const titleEl = document.getElementById('view-title');
    if (titleEl) {
        titleEl.textContent = viewTitles[store.viewFilter] || '任务列表';
    }

    // 更新计数
    updateCounts();

    // 更新全选框状态
    const selectAll = document.getElementById('select-all-checkbox');
    if (selectAll) {
        selectAll.checked = store.tasks.length > 0 && store.selectedTaskIds.size === store.tasks.length;
    }

    // 批量操作栏显示
    const batchBar = document.getElementById('batch-action-bar');
    const countSpan = document.getElementById('selected-count');
    if (batchBar && countSpan) {
        if (store.selectedTaskIds.size > 0) {
            batchBar.classList.remove('hidden');
            countSpan.textContent = store.selectedTaskIds.size;
        } else {
            batchBar.classList.add('hidden');
        }
    }
}

function updateCounts() {
    const counts = {
        today: store.tasks.filter(t => t.status !== 'done' && (!t.dueDate || new Date(t.dueDate) < new Date(new Date().setDate(new Date().getDate()+1)))).length,
        all: store.tasks.length,
        completed: store.tasks.filter(t => t.status === 'done').length,
        memory: memoryStore.memories.filter(m => m.enabled).length
    };

    ['today', 'all', 'completed', 'memory'].forEach(key => {
        const el = document.getElementById(`${key}-count`);
        if (el) el.textContent = counts[key];
    });
}

function renderCategoryList() {
    const list = document.getElementById('category-list');
    if (!list) return;
    
    const categories = ['工作', '生活', '学习', '其他']; // 简单写死，或者从任务中提取
    list.innerHTML = categories.map(c => `
        <button onclick="window.filterByCategory('${c}')" class="w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition flex justify-between">
            <span># ${c}</span>
            <span class="text-xs bg-gray-100 text-gray-400 px-1.5 rounded-full">${store.tasks.filter(t => t.category === c).length}</span>
        </button>
    `).join('');
}

// ============ 辅助函数 ============

function extractJsonFromResponse(text) {
    if (!text) return null;
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/) || text.match(/\[[\s\S]*\]/);
    try {
        if (jsonMatch) {
            let jsonStr = jsonMatch[0];
            if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json\n/, '').replace(/\n```$/, '');
            return JSON.parse(jsonStr);
        }
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

// ============ AI 逻辑 ============

async function handleAIParse() {
    const input = document.getElementById('task-input');
    const text = input.value.trim();
    if (!text) return;

    const btn = document.getElementById('btn-ai-parse');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> 解析中...';
    btn.disabled = true;

    try {
        const refs = extractReferences(text);
        const refsContext = buildReferencedTasksContext(refs, store.tasks);
        const memoryContext = memoryStore.buildAIContext(text);
        
        let customSystemPrompt = store.config.prompt;
        
        if (customSystemPrompt.includes('{referenced_tasks}')) {
            customSystemPrompt = customSystemPrompt.replace('{referenced_tasks}', refsContext);
        } else {
            customSystemPrompt += `\n\n## 引用任务上下文\n${refsContext}`;
        }
        
        if (memoryContext) {
            customSystemPrompt += memoryContext;
        }

        const rawResult = await callAI(text, 'parse', customSystemPrompt);
        const parsedData = extractJsonFromResponse(rawResult);

        if (parsedData && Array.isArray(parsedData)) {
            const preparedTasks = parsedData.map(t => ({
                ...t,
                shortId: parseInt(t.shortId) || -1, 
                parentShortId: t.parentShortId ? parseInt(t.parentShortId) : null,
                relations: (t.relations || []).map(r => ({...r, targetShortId: parseInt(r.targetShortId)})),
                isFrog: t.is_frog !== undefined ? t.is_frog : false,
                actionType: t.action_type || 'NEXT'
            }));
            
            openAIConfirmModal(preparedTasks);
            input.value = '';
        } else {
            throw new Error('无法识别 JSON 数据');
        }
    } catch (e) {
        console.error(e);
        alert('解析失败: ' + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        // updateTotalCost(); // If implemented
    }
}

function openAIConfirmModal(tasks) {
    window._tempParsedTasks = tasks.map(t => ({
        ...t,
        _tempId: Math.random().toString(36).substr(2, 9),
        _selected: true
    }));
    renderAIConfirmModal();
}

function renderAIConfirmModal() {
    const tasks = window._tempParsedTasks;
    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in">
            <div class="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold flex items-center gap-2">
                        <i class="ri-magic-line text-purple-500"></i> AI 解析结果确认
                    </h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400"><i class="ri-close-line text-xl"></i></button>
                </div>
                
                <div class="flex-1 overflow-y-auto space-y-3 p-1">
                    ${tasks.map((t) => `
                        <div class="border rounded-lg p-3 ${t._selected ? 'border-purple-200 bg-purple-50' : 'border-gray-200 opacity-60'} transition">
                            <div class="flex items-start gap-3">
                                <input type="checkbox" checked onchange="window.toggleTempTask('${t._tempId}')" class="mt-1">
                                <div class="flex-1">
                                    <div class="flex justify-between">
                                        <span class="font-bold text-gray-800">#${t.shortId || '?'} ${escapeHtml(t.title || '未命名')}</span>
                                        <span class="text-xs px-2 py-0.5 rounded bg-white border">${t.priority || 'medium'}</span>
                                    </div>
                                    <p class="text-sm text-gray-600 mt-1">${escapeHtml(t.description || '无描述')}</p>
                                    <div class="flex gap-2 mt-2 text-xs text-gray-500">
                                        ${t.dueDate ? `<span>📅 ${t.dueDate}</span>` : ''}
                                        ${t.parentShortId ? `<span>⬆️ 父任务#${t.parentShortId}</span>` : ''}
                                        ${t.isFrog ? `<span class="text-green-600">🐸 青蛙</span>` : ''}
                                        <span class="bg-gray-100 px-1 rounded text-xs">${t.actionType || 'NEXT'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="pt-4 mt-4 border-t flex justify-end gap-3">
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
                    <button onclick="window.confirmImportTasks()" class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 shadow-sm">
                        确认导入 (${tasks.filter(t => t._selected).length})
                    </button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modal-container').innerHTML = modalHtml;
}

window.toggleTempTask = (tempId) => {
    const task = window._tempParsedTasks.find(t => t._tempId === tempId);
    if (task) {
        task._selected = !task._selected;
        renderAIConfirmModal();
    }
};

window.confirmImportTasks = () => {
    const toImport = window._tempParsedTasks.filter(t => t._selected);
    const tempIdMap = new Map();
    const createdTasks = [];
    let count = 0;

    toImport.forEach(t => {
        const newUuid = generateId();
        const newTask = store.addTask({
            ...t,
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
};

function handleQuickAdd() {
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

// ============ 弹窗与交互 ============

// 更新优先级
window.updatePriority = (id, priority) => {
    store.updateTask(id, { priority });
    updateUI();
};

// 简单的任务编辑弹窗
window.triggerEdit = (id) => {
    openTaskModal(id);
};

window.editTaskField = (id, field, event) => {
    openTaskModal(id);
};

function openTaskModal(taskId) {
    const task = store.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in">
            <div class="bg-white rounded-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-auto flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 class="text-lg font-bold flex items-center gap-2">
                        <span class="text-gray-400 font-mono">#${task.shortId}</span> 编辑任务
                    </h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400 hover:text-gray-600"><i class="ri-close-line text-xl"></i></button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">标题</label>
                        <input type="text" id="edit-title" value="${escapeHtml(task.title)}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">青蛙任务</label>
                            <select id="edit-frog" class="mt-1 block w-full rounded-md border-gray-300 border p-2">
                                <option value="false" ${!task.isFrog ? 'selected' : ''}>否</option>
                                <option value="true" ${task.isFrog ? 'selected' : ''}>是 (🐸)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">行动项</label>
                            <select id="edit-action" class="mt-1 block w-full rounded-md border-gray-300 border p-2">
                                <option value="NEXT" ${task.actionType === 'NEXT' ? 'selected' : ''}>下一步</option>
                                <option value="WAITING" ${task.actionType === 'WAITING' ? 'selected' : ''}>等待</option>
                                <option value="SOMEDAY" ${task.actionType === 'SOMEDAY' ? 'selected' : ''}>将来</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">截止时间</label>
                            <input type="datetime-local" id="edit-due" value="${task.dueDate ? task.dueDate.substring(0, 16) : ''}" class="mt-1 block w-full rounded-md border-gray-300 border p-2">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">优先级</label>
                            <select id="edit-priority" class="mt-1 block w-full rounded-md border-gray-300 border p-2">
                                <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>紧急</option>
                                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>高</option>
                                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>中</option>
                                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>低</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700">描述</label>
                        <textarea id="edit-desc" rows="3" class="mt-1 block w-full rounded-md border-gray-300 border p-2">${escapeHtml(task.description || '')}</textarea>
                    </div>

                    <div class="flex justify-end gap-2 pt-4 border-t">
                         <button onclick="window.deleteTaskAndClose('${task.id}')" class="px-4 py-2 text-red-600 hover:bg-red-50 rounded">删除</button>
                         <button onclick="window.saveTask('${task.id}')" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modal-container').innerHTML = modalHtml;
}

window.saveTask = (id) => {
    const updates = {
        title: document.getElementById('edit-title').value,
        description: document.getElementById('edit-desc').value,
        priority: document.getElementById('edit-priority').value,
        dueDate: document.getElementById('edit-due').value || null,
        isFrog: document.getElementById('edit-frog').value === 'true',
        actionType: document.getElementById('edit-action').value
    };
    store.updateTask(id, updates);
    document.getElementById('modal-container').innerHTML = '';
    updateUI();
};

window.deleteTaskAndClose = (id) => {
    if (confirm('确定删除?')) {
        store.deleteTask(id);
        document.getElementById('modal-container').innerHTML = '';
        updateUI();
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

document.addEventListener('click', () => {
    const el = document.getElementById('status-filter-dropdown');
    if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
});

// ============ 记忆相关 ============

window.openMemoryModal = () => {
    const memories = memoryStore.memories; // 简化展示
    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in">
             <div class="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
                <h3 class="text-lg font-bold mb-4">我的记忆 (${memories.length})</h3>
                <div class="flex-1 overflow-y-auto space-y-2">
                    ${memories.map(m => `
                        <div class="border p-2 rounded">
                            <div class="font-medium">${escapeHtml(m.content)}</div>
                            <div class="text-xs text-gray-500 mt-1">分类: ${m.category} | 重要性: ${m.importance}</div>
                            <button onclick="window.deleteMemory('${m.id}')" class="text-xs text-red-500 mt-1">删除</button>
                        </div>
                    `).join('')}
                </div>
                <div class="pt-4 border-t flex justify-end">
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-gray-100 rounded">关闭</button>
                </div>
             </div>
        </div>
    `;
    document.getElementById('modal-container').innerHTML = modalHtml;
};

window.deleteMemory = (id) => {
    if(confirm('删除?')) {
        memoryStore.deleteMemory(id);
        openMemoryModal();
    }
};

// ============ 新增：任务属性交互与筛选 ============

// 切换青蛙状态
window.toggleFrog = (id) => {
    const task = store.tasks.find(t => t.id === id);
    if (task) {
        store.updateTask(id, { isFrog: !task.isFrog });
        updateUI();
    }
};

// 更新行动项
window.updateActionType = (id, type) => {
    store.updateTask(id, { actionType: type });
    updateUI();
};

// 筛选：青蛙
window.toggleFrogFilter = (checked) => {
    store.frogFilter = checked;
    updateUI();
};

// 筛选：行动项
window.updateActionTypeFilter = (value) => {
    store.actionTypeFilter = value;
    updateUI();
};

// 筛选：状态 (多选逻辑)
window.toggleStatusDropdown = () => {
    const menu = document.getElementById('status-filter-menu');
    menu.classList.toggle('hidden');
    
    // 初始化勾选状态
    const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
    const current = store.statusFilter; // array
    
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
            current = []; // Empty implies all
        } else {
            // Unchecking 'all' does nothing or stays empty? 
            // Usually if you uncheck 'all', maybe it means 'none', but filtering 'none' is empty list.
            // Let's assume unchecking 'all' just keeps it empty (all).
            // Or better: clicking 'all' clears other filters.
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
    
    // UI Update for label
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
    
    // Refresh checkboxes visual if needed (optional, since onchange handles it)
    // But if 'all' was clicked, we need to uncheck others
    if (value === 'all' && checked) {
        const menu = document.getElementById('status-filter-menu');
        menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.value !== 'all') cb.checked = false;
        });
    } else if (value !== 'all' && checked) {
        // Uncheck 'all' if specific selected
        const menu = document.getElementById('status-filter-menu');
        const allCb = menu.querySelector('input[value="all"]');
        if (allCb) allCb.checked = false;
    }
    
    updateUI();
};

// 点击外部关闭下拉
document.addEventListener('click', (e) => {
    const container = document.getElementById('status-filter-container');
    const menu = document.getElementById('status-filter-menu');
    if (container && !container.contains(e.target) && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
    }
});

// 筛选：日期范围
window.updateDateRangeFilter = () => {
    const start = document.getElementById('filter-date-start').value;
    const end = document.getElementById('filter-date-end').value;
    
    if (start && end) {
        if (new Date(start) > new Date(end)) {
            alert('开始日期不能晚于结束日期');
            return;
        }
        store.dateRangeFilter = { start, end };
    } else {
        store.dateRangeFilter = null;
    }
    // 重置分页
    store.pagination.list.page = 1;
    updateUI();
};

// 清除日期筛选
window.clearDateFilter = () => {
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    store.dateRangeFilter = null;
    store.pagination.list.page = 1;
    updateUI();
};

// ============ 分页逻辑 ============

// 列表分页
window.changeListPage = (delta) => {
    const { page, pageSize } = store.pagination.list;
    const tasks = store.tasks; // 这里应该用 getFilteredTasks 获取总数，但为了性能简单处理，或者在 views 渲染时已经计算了 totalPages
    // 更好的方式是直接修改 page，视图层会处理边界
    const newPage = page + delta;
    if (newPage < 1) return;
    
    // 我们需要在 updateUI 中获取 filtered count 才能确切知道 limit
    // 但 store 中没有 filtered count。
    // 简单起见，允许增加，视图层渲染时会 clamp。
    // 为了体验更好，我们在 store 中保存 filtered count? 不，太麻烦。
    // 直接更新，视图层会处理 slice(start, end)。如果 start > total，显示空。
    // 但是 Next 按钮的 disabled 状态需要在渲染时判断。
    
    store.pagination.list.page = newPage;
    updateUI();
};

// 四象限分页
window.changeQuadrantPage = (priorityKey, delta) => {
    const current = store.pagination.quadrant[priorityKey];
    if (!current) return;
    const newPage = current.page + delta;
    if (newPage < 1) return;
    
    store.pagination.quadrant[priorityKey].page = newPage;
    updateUI();
};
