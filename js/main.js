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

    // 恢复丢失的监听器
    document.getElementById('btn-settings')?.addEventListener('click', openSettingsModal);
    document.getElementById('btn-logs')?.addEventListener('click', openLogsModal);

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
    // 1. 尝试匹配 ```json ... ``` (最常见)
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch) try { return JSON.parse(markdownMatch[1]); } catch (e) {}
    
    // 2. 尝试匹配 ``` ... ``` (未标记语言)
    const codeMatch = text.match(/```\s*([\s\S]*?)\s*```/);
    if (codeMatch) try { return JSON.parse(codeMatch[1]); } catch (e) {}
    
    // 3. 尝试匹配纯数组 [...]
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) try { return JSON.parse(arrayMatch[0]); } catch (e) {}
    
    // 4. 尝试直接解析
    try { return JSON.parse(text); } catch (e) { return null; }
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
                                        ${t.relations?.length ? `<span>🔗 ${t.relations.length} 关联</span>` : ''}
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

// 辅助：获取状态颜色
function getStatusColor(status) {
    const map = {
        pending: 'text-gray-600',
        active: 'text-blue-600',
        done: 'text-green-600',
        cancelled: 'text-red-400 line-through'
    };
    return map[status] || '';
}

// 辅助：添加关联行
window.addRelationRow = (type = 'depends_on', targetValue = '') => {
    const container = document.getElementById('relations-container');
    const msg = document.getElementById('no-relations-msg');
    if (msg) msg.remove();

    const template = document.getElementById('relation-row-template');
    const clone = template.content.cloneNode(true);
    
    const typeSelect = clone.querySelector('.relation-type');
    const targetSelect = clone.querySelector('.relation-target');
    
    typeSelect.value = type;
    if (targetValue) {
        const isId = store.tasks.some(t => t.id === targetValue);
        if (isId) targetSelect.value = targetValue;
        else {
            const match = store.tasks.find(t => t.title === targetValue);
            if (match) targetSelect.value = match.id;
        }
    }
    container.appendChild(clone);
};

// 触发编辑
window.triggerEdit = (id) => {
    openTaskModal(id);
};

// 任务详情弹窗 (增强版 + Frog/Action)
function openTaskModal(taskId) {
    const task = store.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const potentialParents = store.tasks.filter(t => t.id !== task.id);
    const relationOptions = store.tasks.filter(t => t.id !== task.id).map(t => 
        `<option value="${t.id}">#${t.shortId} ${escapeHtml(t.title)}</option>`
    ).join('');

    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in">
            <div class="bg-white rounded-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-auto flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 class="text-lg font-bold flex items-center gap-2">
                        <span class="text-gray-400 font-mono">#${task.shortId}</span> 编辑任务
                    </h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400 hover:text-gray-600"><i class="ri-close-line text-xl"></i></button>
                </div>
                
                <div class="space-y-5 flex-1 overflow-y-auto pr-2">
                    <!-- 1. 核心信息 -->
                    <div class="grid grid-cols-4 gap-4">
                        <div class="col-span-3">
                            <label class="block text-xs font-bold text-gray-500 mb-1">标题</label>
                            <input type="text" id="edit-title" value="${escapeHtml(task.title)}" class="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">状态</label>
                            <select id="edit-status" class="w-full border border-gray-300 rounded-lg p-2.5 bg-white font-medium ${getStatusColor(task.status)}">
                                <option value="pending" ${task.status==='pending'?'selected':''}>📅 待开始</option>
                                <option value="active" ${task.status==='active'?'selected':''}>🚀 进行中</option>
                                <option value="done" ${task.status==='done'?'selected':''}>✅ 已完成</option>
                                <option value="cancelled" ${task.status==='cancelled'?'selected':''}>❌ 已取消</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">描述</label>
                        <textarea id="edit-desc" rows="3" class="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm">${escapeHtml(task.description || '')}</textarea>
                    </div>

                    <!-- 2. 属性: 四象限、分类、青蛙、行动 -->
                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                         <div class="grid grid-cols-2 gap-4 mb-3">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">重要性 (1-4)</label>
                                <div class="flex items-center gap-2">
                                    <input type="range" id="edit-importance" min="1" max="4" value="${task.importance || 2}" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" oninput="this.nextElementSibling.value = this.value">
                                    <output class="text-xs font-bold text-blue-600 w-4 text-center">${task.importance || 2}</output>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">紧急度 (1-4)</label>
                                <div class="flex items-center gap-2">
                                    <input type="range" id="edit-urgency" min="1" max="4" value="${task.urgency || 2}" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500" oninput="this.nextElementSibling.value = this.value">
                                    <output class="text-xs font-bold text-red-600 w-4 text-center">${task.urgency || 2}</output>
                                </div>
                            </div>
                         </div>
                         <div class="grid grid-cols-3 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">分类</label>
                                <input type="text" id="edit-category" value="${escapeHtml(task.category || '')}" list="category-suggestions" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                                <datalist id="category-suggestions">
                                    ${[...new Set(store.tasks.map(t=>t.category).filter(Boolean))].map(c=>`<option value="${c}">`).join('')}
                                </datalist>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">青蛙任务</label>
                                <select id="edit-frog" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                                    <option value="false" ${!task.isFrog ? 'selected' : ''}>否</option>
                                    <option value="true" ${task.isFrog ? 'selected' : ''}>🐸 是</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">行动项</label>
                                <select id="edit-action" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                                    <option value="NEXT" ${task.actionType === 'NEXT' ? 'selected' : ''}>➡️ 下一步</option>
                                    <option value="WAITING" ${task.actionType === 'WAITING' ? 'selected' : ''}>⏳ 等待</option>
                                    <option value="SOMEDAY" ${task.actionType === 'SOMEDAY' ? 'selected' : ''}>📅 将来</option>
                                </select>
                            </div>
                         </div>
                    </div>

                    <!-- 3. 时间管理 -->
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">开始时间</label>
                            <input type="datetime-local" id="edit-start" value="${task.startDate ? task.startDate.slice(0,16) : ''}" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">截止时间</label>
                            <input type="datetime-local" id="edit-due" value="${task.dueDate ? task.dueDate.slice(0,16) : ''}" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">提醒时间</label>
                            <input type="datetime-local" id="edit-reminder" value="${task.reminderTime ? task.reminderTime.slice(0,16) : ''}" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                        </div>
                    </div>

                    <!-- 4. 耗时与标签 -->
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">预估耗时 (分)</label>
                            <input type="number" id="edit-est-min" value="${task.estimatedMinutes || ''}" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">实际耗时 (分)</label>
                            <input type="number" id="edit-act-min" value="${task.actualMinutes || ''}" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">标签 (逗号分隔)</label>
                            <input type="text" id="edit-tags" value="${(task.tags || []).join(', ')}" placeholder="tag1, tag2" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                        </div>
                    </div>

                    <!-- 5. 关系管理 -->
                    <div class="border-t pt-4">
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1">父任务</label>
                                <select id="edit-parent" class="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white">
                                    <option value="">(无父任务)</option>
                                    ${potentialParents.map(p => `<option value="${p.id}" ${task.parentId === p.id ? 'selected' : ''}>#${p.shortId} ${escapeHtml(p.title)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="flex items-end justify-end">
                                <button onclick="window.addRelationRow()" class="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2">
                                    <i class="ri-add-circle-line"></i> 添加关联/依赖
                                </button>
                            </div>
                        </div>
                        
                        <div id="relations-container" class="space-y-2 bg-gray-50 p-3 rounded-lg min-h-[50px]"></div>
                        
                        <template id="relation-row-template">
                            <div class="flex gap-2 items-center relation-row">
                                <select class="relation-type border rounded p-1.5 text-sm bg-white w-24">
                                    <option value="depends_on">依赖于</option>
                                    <option value="related_to">关联</option>
                                </select>
                                <select class="relation-target border rounded p-1.5 text-sm bg-white flex-1">
                                    <option value="">选择任务...</option>
                                    ${relationOptions}
                                </select>
                                <button onclick="this.parentElement.remove()" class="text-red-500 hover:bg-red-100 p-1 rounded"><i class="ri-delete-bin-line"></i></button>
                            </div>
                        </template>
                    </div>
                </div>

                <div class="mt-4 pt-4 border-t flex justify-between items-center">
                    <button onclick="window.deleteTaskAndClose('${task.id}')" class="text-red-500 hover:bg-red-50 px-3 py-2 rounded transition flex items-center gap-1">
                        <i class="ri-delete-bin-line"></i> 删除
                    </button>
                    <div class="flex gap-3">
                        <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                        <button onclick="window.saveTaskEdit('${task.id}')" class="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modal-container').innerHTML = modalHtml;

    // 初始化关联
    const container = document.getElementById('relations-container');
    if (task.relations && task.relations.length > 0) {
        task.relations.forEach(rel => {
            window.addRelationRow(rel.type, rel.targetId);
        });
    } else {
        container.innerHTML = '<div class="text-xs text-gray-400 text-center py-2" id="no-relations-msg">暂无关联</div>';
    }
}

window.saveTaskEdit = (id) => {
    // 收集基础字段
    const title = document.getElementById('edit-title').value;
    const desc = document.getElementById('edit-desc').value;
    const status = document.getElementById('edit-status').value;
    const category = document.getElementById('edit-category').value;
    
    // 收集四象限
    const urgency = parseInt(document.getElementById('edit-urgency').value);
    const importance = parseInt(document.getElementById('edit-importance').value);
    
    // 收集 Frog/Action
    const isFrog = document.getElementById('edit-frog').value === 'true';
    const actionType = document.getElementById('edit-action').value;

    // 收集时间
    const start = document.getElementById('edit-start').value;
    const due = document.getElementById('edit-due').value;
    const reminder = document.getElementById('edit-reminder').value;
    
    // 收集耗时与标签
    const estMin = document.getElementById('edit-est-min').value;
    const actMin = document.getElementById('edit-act-min').value;
    const tagsStr = document.getElementById('edit-tags').value;
    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    
    // 收集父任务
    const parentId = document.getElementById('edit-parent').value || null;

    // 收集关联
    const relationRows = document.querySelectorAll('.relation-row');
    const relations = [];
    relationRows.forEach(row => {
        const type = row.querySelector('.relation-type').value;
        const targetId = row.querySelector('.relation-target').value;
        if (targetId) {
            const targetTask = store.tasks.find(t => t.id === targetId);
            relations.push({ 
                type, 
                targetId,
                targetShortId: targetTask ? targetTask.shortId : null 
            });
        }
    });

    store.updateTask(id, { 
        title, description: desc, status, category,
        urgency, importance,
        isFrog, actionType,
        startDate: start ? new Date(start).toISOString() : null,
        dueDate: due ? new Date(due).toISOString() : null,
        reminderTime: reminder ? new Date(reminder).toISOString() : null,
        estimatedMinutes: estMin ? parseInt(estMin) : null,
        actualMinutes: actMin ? parseInt(actMin) : null,
        tags,
        parentId, relations
    });
    
    document.getElementById('modal-container').innerHTML = '';
    updateUI();
};

window.deleteTaskAndClose = (id) => {
    if(confirm('确定删除?')) {
        store.deleteTask(id);
        document.getElementById('modal-container').innerHTML = '';
        updateUI();
    }
};

// 恢复 Inline Edit 支持 (views.js 需要)
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
        let dateVal = '';
        if (currentVal) {
            const d = new Date(currentVal);
            const offset = d.getTimezoneOffset() * 60000;
            dateVal = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        }
        inputHtml = `<input type="datetime-local" class="text-xs border rounded p-1 w-full" value="${dateVal}" onblur="window.saveTaskField('${taskId}', '${field}', this.value)" onkeydown="if(event.key==='Enter') this.blur()" onclick="event.stopPropagation()">`;
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
                 newVal = new Date(value).toISOString();
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

// ============ 设置弹窗 ============
let editingApiId = null;
let settingsTab = 'api';

function openSettingsModal() {
    editingApiId = null;
    settingsTab = 'api';
    renderSettingsModalContent();
}

function renderSettingsModalContent() {
    const isEditing = !!editingApiId;
    let editData = { name: '', url: '', key: '', model: '', temperature: 0.3, costInput: 5.0, costOutput: 15.0 };
    
    if (isEditing) {
        const api = store.config.apis.find(a => a.id === editingApiId);
        if (api) editData = { ...api };
    }

    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in" onclick="if(event.target === this) document.getElementById('modal-container').innerHTML=''">
            <div class="bg-white rounded-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-auto flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 class="text-lg font-bold">设置</h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400"><i class="ri-close-line text-xl"></i></button>
                </div>
                
                <div class="flex gap-4 mb-4 border-b">
                    <button onclick="window.switchSettingsTab('api')" class="pb-2 px-1 ${settingsTab === 'api' ? 'border-b-2 border-blue-500 text-blue-600 font-bold' : 'text-gray-500'}">API 配置</button>
                    <button onclick="window.switchSettingsTab('prompt')" class="pb-2 px-1 ${settingsTab === 'prompt' ? 'border-b-2 border-blue-500 text-blue-600 font-bold' : 'text-gray-500'}">Prompt 设置</button>
                </div>

                <div class="${settingsTab === 'api' ? '' : 'hidden'} grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="border-r pr-4">
                        <div class="space-y-2 max-h-96 overflow-y-auto">
                            ${store.config.apis.map(api => `
                                <div class="p-3 border rounded-lg hover:bg-gray-50 transition group ${store.config.activeApiId === api.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}">
                                    <div class="flex justify-between items-start">
                                        <div class="flex items-center gap-2 cursor-pointer" onclick="window.setActiveApi('${api.id}')">
                                            <div class="w-4 h-4 rounded-full border flex items-center justify-center ${store.config.activeApiId === api.id ? 'border-blue-500' : 'border-gray-300'}">
                                                ${store.config.activeApiId === api.id ? '<div class="w-2 h-2 bg-blue-500 rounded-full"></div>' : ''}
                                            </div>
                                            <div>
                                                <div class="font-bold text-sm text-gray-800">${escapeHtml(api.name)}</div>
                                                <div class="text-xs text-gray-500">${escapeHtml(api.model)} (Temp: ${api.temperature})</div>
                                            </div>
                                        </div>
                                        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                            <button onclick="window.editApi('${api.id}')" class="text-blue-500 hover:bg-blue-100 p-1 rounded"><i class="ri-edit-line"></i></button>
                                            <button onclick="window.deleteApi('${api.id}')" class="text-red-500 hover:bg-red-100 p-1 rounded"><i class="ri-delete-bin-line"></i></button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button onclick="window.resetEditForm()" class="mt-4 w-full py-2 border border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-500 hover:text-blue-500 transition text-sm">+ 添加新 API</button>
                    </div>

                    <div>
                        <h4 class="font-medium mb-3 text-sm text-gray-500 uppercase">${isEditing ? '编辑 API' : '添加新 API'}</h4>
                        <div class="space-y-3">
                            <input type="text" id="form-name" value="${escapeHtml(editData.name)}" placeholder="名称 (如: GPT-4)" class="w-full border rounded p-2 text-sm">
                            <input type="text" id="form-url" value="${escapeHtml(editData.url)}" placeholder="API URL" class="w-full border rounded p-2 text-sm">
                            <input type="password" id="form-key" value="${escapeHtml(editData.key)}" placeholder="API Key" class="w-full border rounded p-2 text-sm">
                            <div class="grid grid-cols-2 gap-2">
                                <input type="text" id="form-model" value="${escapeHtml(editData.model)}" placeholder="Model" class="w-full border rounded p-2 text-sm">
                                <div class="flex items-center border rounded px-2">
                                    <span class="text-xs text-gray-500 mr-2">温度:</span>
                                    <input type="number" id="form-temp" value="${editData.temperature}" step="0.1" min="0" max="2" class="w-full text-sm outline-none">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <input type="number" id="form-cost-input" value="${editData.costInput}" placeholder="输入价格" class="w-full border rounded p-2 text-sm">
                                <input type="number" id="form-cost-output" value="${editData.costOutput}" placeholder="输出价格" class="w-full border rounded p-2 text-sm">
                            </div>
                            <div class="pt-2 flex justify-end gap-2">
                                ${isEditing ? `<button onclick="window.resetEditForm()" class="px-3 py-1 text-sm text-gray-600">取消</button>` : ''}
                                <button onclick="window.saveApiForm()" class="px-3 py-1 text-sm bg-blue-500 text-white rounded">保存</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="${settingsTab === 'prompt' ? '' : 'hidden'}">
                    <p class="text-sm text-gray-500 mb-2">自定义 AI 解析任务的系统提示词。请保留 JSON 格式要求。</p>
                    <textarea id="settings-prompt" rows="12" class="w-full border rounded p-3 text-sm font-mono bg-gray-50">${store.config.prompt}</textarea>
                    <div class="mt-4 flex justify-end">
                        <button onclick="window.savePrompt()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存 Prompt</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modal-container').innerHTML = modalHtml;
}

window.switchSettingsTab = (tab) => {
    settingsTab = tab;
    renderSettingsModalContent();
};

window.savePrompt = () => {
    const newPrompt = document.getElementById('settings-prompt').value;
    store.config.prompt = newPrompt;
    store.saveConfig();
    alert('Prompt 已保存');
};

window.setActiveApi = (id) => { store.config.activeApiId = id; store.saveConfig(); renderSettingsModalContent(); };
window.editApi = (id) => { editingApiId = id; renderSettingsModalContent(); };
window.resetEditForm = () => { editingApiId = null; renderSettingsModalContent(); };
window.deleteApi = (id) => {
    if (store.config.apis.length <= 1) return alert('至少保留一个配置');
    store.config.apis = store.config.apis.filter(a => a.id !== id);
    if (store.config.activeApiId === id) store.config.activeApiId = store.config.apis[0].id;
    store.saveConfig();
    if (editingApiId === id) editingApiId = null;
    renderSettingsModalContent();
};
window.saveApiForm = () => {
    const name = document.getElementById('form-name').value;
    const url = document.getElementById('form-url').value;
    const key = document.getElementById('form-key').value;
    const model = document.getElementById('form-model').value;
    const temp = parseFloat(document.getElementById('form-temp').value) || 0.3;
    const costInput = parseFloat(document.getElementById('form-cost-input').value) || 0;
    const costOutput = parseFloat(document.getElementById('form-cost-output').value) || 0;

    if (!name || !url || !key) return alert('请填写必要信息');

    const data = { name, url, key, model, temperature: temp, costInput, costOutput };
    
    if (editingApiId) {
        const idx = store.config.apis.findIndex(a => a.id === editingApiId);
        if (idx !== -1) store.config.apis[idx] = { ...store.config.apis[idx], ...data };
    } else {
        const newId = generateId();
        store.config.apis.push({ id: newId, ...data });
        store.config.activeApiId = newId;
    }
    store.saveConfig();
    editingApiId = null;
    renderSettingsModalContent();
};

function openLogsModal() {
    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in">
            <div class="bg-white rounded-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold">API 调用记录</h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400"><i class="ri-close-line text-xl"></i></button>
                </div>
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-50 text-gray-600"><tr><th class="p-2">时间</th><th class="p-2">模型</th><th class="p-2">Tokens</th><th class="p-2">费用</th><th class="p-2">耗时</th></tr></thead>
                    <tbody class="divide-y">${store.apiLogs.map(log => `<tr><td class="p-2 text-gray-500">${new Date(log.timestamp).toLocaleString()}</td><td class="p-2">${escapeHtml(log.model)}</td><td class="p-2">${log.tokens.total_tokens}</td><td class="p-2 font-bold text-orange-500">¥${log.cost.toFixed(4)}</td><td class="p-2 text-gray-400">${log.duration}ms</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('modal-container').innerHTML = modalHtml;
}

// ============ 记忆相关 ============

window.openMemoryModal = () => {
    const stats = memoryStore.getStats();
    const profile = memoryStore.userProfile;
    const memories = memoryStore.memories;
    
    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in" onclick="if(event.target === this) document.getElementById('modal-container').innerHTML=''">
            <div class="bg-white rounded-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-auto flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 class="text-lg font-bold">我的记忆</h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400"><i class="ri-close-line text-xl"></i></button>
                </div>
                
                <div class="flex gap-4 mb-4 border-b">
                    <button onclick="window.switchMemoryTab('profile')" class="pb-2 px-1 border-b-2 border-blue-500 text-blue-600 font-bold">用户画像</button>
                    <button onclick="window.switchMemoryTab('memories')" class="pb-2 px-1 text-gray-500">记忆碎片</button>
                    <button onclick="window.switchMemoryTab('config')" class="pb-2 px-1 text-gray-500">配置</button>
                    <button onclick="window.switchMemoryTab('stats')" class="pb-2 px-1 text-gray-500">统计</button>
                </div>
                
                <!-- 用户画像标签 -->
                <div id="memory-profile-tab" class="space-y-4">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-2">职业背景</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">职业</label>
                                <input type="text" id="memory-profession" value="${profile.profession || ''}" class="w-full border rounded p-2">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">角色</label>
                                <input type="text" id="memory-role" value="${profile.role || ''}" class="w-full border rounded p-2">
                            </div>
                        </div>
                        <div class="mt-3">
                            <label class="block text-sm text-gray-600 mb-1">工作职责</label>
                            <textarea id="memory-responsibilities" rows="3" class="w-full border rounded p-2">${profile.responsibilities || ''}</textarea>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-2">沟通风格偏好</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">沟通风格</label>
                                <input type="text" id="memory-communication-style" value="${profile.communicationStyle || ''}" class="w-full border rounded p-2" placeholder="例如：直接、委婉、正式">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">语气偏好</label>
                                <input type="text" id="memory-tone-preference" value="${profile.tonePreference || ''}" class="w-full border rounded p-2" placeholder="例如：专业、友好、简洁">
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-2">工作习惯</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">工作时间</label>
                                <input type="text" id="memory-work-hours" value="${profile.workHours || ''}" class="w-full border rounded p-2" placeholder="例如：9:00-18:00">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">时区</label>
                                <input type="text" id="memory-timezone" value="${profile.timezone || ''}" class="w-full border rounded p-2" placeholder="例如：UTC+8">
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-2">
                        <button onclick="window.saveMemoryProfile()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存画像</button>
                    </div>
                </div>
                
                <!-- 记忆碎片标签 -->
                <div id="memory-memories-tab" class="hidden space-y-4">
                    <div class="flex justify-between items-center">
                        <h4 class="font-medium">记忆碎片 (${stats.enabled}个启用/${stats.total}个总数)</h4>
                        <div class="flex gap-2">
                            <button onclick="window.openAddMemoryModal()" class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 flex items-center gap-1">
                                <i class="ri-add-line"></i> 添加记忆
                            </button>
                            <button onclick="window.organizeMemories()" class="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 flex items-center gap-1">
                                <i class="ri-magic-line"></i> AI整理
                            </button>
                        </div>
                    </div>
                    
                    <div id="memory-list" class="space-y-2">
                        ${memories.map((memory, index) => `
                            <div class="memory-item border rounded-lg p-3 ${memory.enabled ? 'hover:bg-gray-50' : 'opacity-60 bg-gray-50'} transition" data-id="${memory.id}">
                                <div class="flex justify-between items-start">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="text-xs px-2 py-0.5 ${memory.enabled ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'} rounded">${memory.category}</span>
                                            <span class="text-xs ${memory.enabled ? 'text-gray-400' : 'text-gray-300'}">${'★'.repeat(memory.importance)}</span>
                                            ${memory.tags.map(tag => `<span class="text-xs px-2 py-0.5 ${memory.enabled ? 'bg-blue-100 text-blue-600' : 'bg-blue-50 text-blue-400'} rounded">${tag}</span>`).join('')}
                                            ${!memory.enabled ? '<span class="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded">已禁用</span>' : ''}
                                        </div>
                                        <p class="${memory.enabled ? 'text-gray-800' : 'text-gray-500'}">${memory.content}</p>
                                    </div>
                                    <div class="flex gap-1 ml-2">
                                        <button onclick="window.toggleMemory('${memory.id}')" class="text-xs px-2 py-1 rounded ${memory.enabled ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
                                            ${memory.enabled ? '禁用' : '启用'}
                                        </button>
                                        <button onclick="window.editMemory('${memory.id}')" class="text-xs px-2 py-1 ${memory.enabled ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-blue-50 text-blue-400 hover:bg-blue-100'} rounded">编辑</button>
                                        <button onclick="window.deleteMemory('${memory.id}')" class="text-xs px-2 py-1 ${memory.enabled ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-red-50 text-red-400 hover:bg-red-100'} rounded">删除</button>
                                    </div>
                                </div>
                                <div class="text-xs ${memory.enabled ? 'text-gray-400' : 'text-gray-300'} mt-1">
                                    创建: ${new Date(memory.createdAt).toLocaleDateString()} | 
                                    使用: ${memory.usageCount || 0}次
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- 配置标签 -->
                <div id="memory-config-tab" class="hidden space-y-4">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-3">记忆注入策略</h4>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">注入策略</label>
                                <select id="memory-injection-strategy" class="w-full border rounded p-2">
                                    <option value="smart" ${memoryStore.config.injectionStrategy === 'smart' ? 'selected' : ''}>智能注入 (推荐)</option>
                                    <option value="all" ${memoryStore.config.injectionStrategy === 'all' ? 'selected' : ''}>全部注入</option>
                                    <option value="important" ${memoryStore.config.injectionStrategy === 'important' ? 'selected' : ''}>仅重要记忆</option>
                                    <option value="none" ${memoryStore.config.injectionStrategy === 'none' ? 'selected' : ''}>不注入</option>
                                </select>
                                <p class="text-xs text-gray-500 mt-1">智能注入会根据用户输入内容的相关性自动选择记忆</p>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm text-gray-600 mb-1">最大记忆条数</label>
                                    <input type="number" id="memory-max-memories" value="${memoryStore.config.maxMemories}" min="1" max="50" class="w-full border rounded p-2">
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-600 mb-1">最大Token数</label>
                                    <input type="number" id="memory-max-tokens" value="${memoryStore.config.maxTokens}" min="100" max="5000" class="w-full border rounded p-2">
                                    <p class="text-xs text-gray-500 mt-1">约 ${Math.floor(memoryStore.config.maxTokens / 3)} 字符</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-2">
                        <button onclick="window.saveMemoryConfig()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存配置</button>
                    </div>
                </div>
                
                <!-- 统计标签 -->
                <div id="memory-stats-tab" class="hidden space-y-4">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-3">记忆统计</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-white p-3 rounded border">
                                <div class="text-2xl font-bold text-blue-600">${stats.total}</div>
                                <div class="text-sm text-gray-600">总记忆数</div>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <div class="text-2xl font-bold text-green-600">${stats.enabled}</div>
                                <div class="text-sm text-gray-600">启用记忆</div>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <div class="text-2xl font-bold text-purple-600">${stats.totalUsage}</div>
                                <div class="text-sm text-gray-600">总使用次数</div>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <div class="text-2xl font-bold text-orange-600">${stats.averageImportance.toFixed(1)}</div>
                                <div class="text-sm text-gray-600">平均重要性</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-3">分类分布</h4>
                        <div class="space-y-2">
                            ${Object.entries(stats.byCategory).map(([category, count]) => `
                                <div class="flex justify-between items-center">
                                    <span class="text-sm">${category}</span>
                                    <span class="text-sm font-medium">${count} 条</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').innerHTML = modalHtml;
}

// 切换记忆标签
window.switchMemoryTab = (tab) => {
    // 隐藏所有标签
    ['profile', 'memories', 'config', 'stats'].forEach(t => {
        const element = document.getElementById(`memory-${t}-tab`);
        if (element) element.classList.add('hidden');
    });
    
    // 显示目标标签
    const targetElement = document.getElementById(`memory-${tab}-tab`);
    if (targetElement) targetElement.classList.remove('hidden');
    
    // 更新标签按钮状态
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        const tabButtons = modalContainer.querySelectorAll('[onclick*="switchMemoryTab"]');
        tabButtons.forEach(btn => {
            const btnTab = btn.getAttribute('onclick').match(/switchMemoryTab\('(.+?)'\)/)?.[1];
            if (btnTab === tab) {
                btn.classList.add('border-b-2', 'border-blue-500', 'text-blue-600', 'font-bold');
                btn.classList.remove('text-gray-500');
            } else {
                btn.classList.remove('border-b-2', 'border-blue-500', 'text-blue-600', 'font-bold');
                btn.classList.add('text-gray-500');
            }
        });
    }
};

// 保存用户画像
window.saveMemoryProfile = () => {
    const updates = {
        profession: document.getElementById('memory-profession').value,
        role: document.getElementById('memory-role').value,
        responsibilities: document.getElementById('memory-responsibilities').value,
        communicationStyle: document.getElementById('memory-communication-style').value,
        tonePreference: document.getElementById('memory-tone-preference').value,
        workHours: document.getElementById('memory-work-hours').value,
        timezone: document.getElementById('memory-timezone').value
    };
    
    memoryStore.updateUserProfile(updates);
    alert('用户画像已保存');
};

// 保存记忆配置
window.saveMemoryConfig = () => {
    const updates = {
        injectionStrategy: document.getElementById('memory-injection-strategy').value,
        maxMemories: parseInt(document.getElementById('memory-max-memories').value) || 10,
        maxTokens: parseInt(document.getElementById('memory-max-tokens').value) || 1000
    };
    
    memoryStore.updateConfig(updates);
    alert('记忆配置已保存');
};

// 打开添加记忆模态框
window.openAddMemoryModal = () => {
    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in" onclick="if(event.target === this) document.getElementById('modal-container').innerHTML=''">
            <div class="bg-white rounded-xl w-full max-w-md p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold">添加记忆</h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400"><i class="ri-close-line text-xl"></i></button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-600 mb-1">记忆内容</label>
                        <textarea id="new-memory-content" rows="3" class="w-full border rounded p-2" placeholder="例如：周报需要在周五下午3点前发出"></textarea>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">分类</label>
                            <select id="new-memory-category" class="w-full border rounded p-2">
                                <option value="work_rule">工作规则</option>
                                <option value="preference">偏好</option>
                                <option value="habit">习惯</option>
                                <option value="knowledge">知识</option>
                                <option value="person">人物</option>
                                <option value="term">术语</option>
                                <option value="other">其他</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">重要性</label>
                            <select id="new-memory-importance" class="w-full border rounded p-2">
                                <option value="1">★ 次要</option>
                                <option value="2">★★ 低</option>
                                <option value="3" selected>★★★ 中</option>
                                <option value="4">★★★★ 高</option>
                                <option value="5">★★★★★ 关键</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm text-gray-600 mb-1">标签 (用逗号分隔)</label>
                        <input type="text" id="new-memory-tags" class="w-full border rounded p-2" placeholder="例如：周报, 截止时间, 周五">
                    </div>
                </div>
                
                <div class="mt-6 flex justify-end gap-2">
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
                    <button onclick="window.saveNewMemory()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').innerHTML = modalHtml;
};

// 保存新记忆
window.saveNewMemory = () => {
    const content = document.getElementById('new-memory-content').value.trim();
    if (!content) {
        alert('请输入记忆内容');
        return;
    }
    
    const memoryData = {
        content,
        category: document.getElementById('new-memory-category').value,
        importance: parseInt(document.getElementById('new-memory-importance').value),
        tags: document.getElementById('new-memory-tags').value.split(',').map(t => t.trim()).filter(Boolean)
    };
    
    memoryStore.addMemory(memoryData);
    document.getElementById('modal-container').innerHTML = '';
    openMemoryModal(); // 重新打开记忆模态框以刷新列表
};

// 切换记忆启用状态
window.toggleMemory = (id) => {
    memoryStore.toggleMemory(id);
    openMemoryModal(); // 刷新界面
};

// 编辑记忆
window.editMemory = (id) => {
    const memory = memoryStore.memories.find(m => m.id === id);
    if (!memory) return;
    
    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in" onclick="if(event.target === this) document.getElementById('modal-container').innerHTML=''">
            <div class="bg-white rounded-xl w-full max-w-md p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold">编辑记忆</h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400"><i class="ri-close-line text-xl"></i></button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-600 mb-1">记忆内容</label>
                        <textarea id="edit-memory-content" rows="3" class="w-full border rounded p-2">${memory.content}</textarea>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">分类</label>
                            <select id="edit-memory-category" class="w-full border rounded p-2">
                                <option value="work_rule" ${memory.category === 'work_rule' ? 'selected' : ''}>工作规则</option>
                                <option value="preference" ${memory.category === 'preference' ? 'selected' : ''}>偏好</option>
                                <option value="habit" ${memory.category === 'habit' ? 'selected' : ''}>习惯</option>
                                <option value="knowledge" ${memory.category === 'knowledge' ? 'selected' : ''}>知识</option>
                                <option value="person" ${memory.category === 'person' ? 'selected' : ''}>人物</option>
                                <option value="term" ${memory.category === 'term' ? 'selected' : ''}>术语</option>
                                <option value="other" ${memory.category === 'other' ? 'selected' : ''}>其他</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-600 mb-1">重要性</label>
                            <select id="edit-memory-importance" class="w-full border rounded p-2">
                                <option value="1" ${memory.importance === 1 ? 'selected' : ''}>★ 次要</option>
                                <option value="2" ${memory.importance === 2 ? 'selected' : ''}>★★ 低</option>
                                <option value="3" ${memory.importance === 3 ? 'selected' : ''}>★★★ 中</option>
                                <option value="4" ${memory.importance === 4 ? 'selected' : ''}>★★★★ 高</option>
                                <option value="5" ${memory.importance === 5 ? 'selected' : ''}>★★★★★ 关键</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm text-gray-600 mb-1">标签 (用逗号分隔)</label>
                        <input type="text" id="edit-memory-tags" class="w-full border rounded p-2" value="${memory.tags.join(', ')}">
                    </div>
                    
                    <div>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="edit-memory-enabled" ${memory.enabled ? 'checked' : ''}>
                            <span class="text-sm text-gray-600">启用此记忆</span>
                        </label>
                    </div>
                </div>
                
                <div class="mt-6 flex justify-end gap-2">
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
                    <button onclick="window.saveEditedMemory('${id}')" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').innerHTML = modalHtml;
};

// 保存编辑的记忆
window.saveEditedMemory = (id) => {
    const content = document.getElementById('edit-memory-content').value.trim();
    if (!content) {
        alert('请输入记忆内容');
        return;
    }
    
    const updates = {
        content,
        category: document.getElementById('edit-memory-category').value,
        importance: parseInt(document.getElementById('edit-memory-importance').value),
        tags: document.getElementById('edit-memory-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        enabled: document.getElementById('edit-memory-enabled').checked
    };
    
    memoryStore.updateMemory(id, updates);
    document.getElementById('modal-container').innerHTML = '';
    openMemoryModal(); // 重新打开记忆模态框以刷新列表
};

// 删除记忆
window.deleteMemory = (id) => {
    if (confirm('确定删除这条记忆吗？')) {
        memoryStore.deleteMemory(id);
        openMemoryModal(); // 刷新界面
    }
};

// AI整理记忆
window.organizeMemories = async () => {
    try {
        const prompt = memoryStore.generateOrganizationPrompt();
        const result = await callAI(prompt, 'organize_memories');
        
        // 尝试解析JSON
        let jsonResult;
        try {
            // 提取JSON部分
            const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/) || result.match(/{[\s\S]*}/);
            if (jsonMatch) {
                jsonResult = JSON.parse(jsonMatch[0].includes('```') ? jsonMatch[1] : jsonMatch[0]);
            } else {
                jsonResult = JSON.parse(result);
            }
        } catch (e) {
            // 如果解析失败，显示原始结果
            alert('AI整理完成，但返回格式有误。请手动检查结果。\n\n' + result.substring(0, 500) + '...');
            return;
        }
        
        const applyResult = memoryStore.applyOrganizationResult(jsonResult);
        if (applyResult.success) {
            alert(`记忆整理完成！\n\n总结：${applyResult.summary}\n\n建议：${applyResult.suggestions.join('; ')}`);
            openMemoryModal(); // 刷新界面
        } else {
            alert('应用整理结果失败：' + applyResult.error);
        }
    } catch (error) {
        console.error('AI整理失败:', error);
        alert('AI整理失败：' + error.message);
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
    // 状态下拉
    const statusContainer = document.getElementById('status-filter-container');
    const statusMenu = document.getElementById('status-filter-menu');
    if (statusContainer && !statusContainer.contains(e.target) && statusMenu && !statusMenu.classList.contains('hidden')) {
        statusMenu.classList.add('hidden');
    }

    // 创建时间下拉
    const createdContainer = document.querySelector('.group\\/created'); // Selector might be tricky with slash
    const createdPopover = document.getElementById('created-filter-popover');
    // 使用更通用的查找方式
    if (createdPopover && !createdPopover.classList.contains('hidden')) {
        // 如果点击的不是 popover 内部，也不是触发按钮
        if (!e.target.closest('#created-filter-popover') && !e.target.closest('.group\\/created button')) {
            createdPopover.classList.add('hidden');
        }
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

// 筛选：创建时间
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

// ============ 分页逻辑 ============

// 列表分页大小
window.changeListPageSize = (size) => {
    store.pagination.list.pageSize = parseInt(size);
    store.pagination.list.page = 1; // 重置到第一页
    updateUI();
};

// 跳转到指定页
window.goToListPage = (page) => {
    store.pagination.list.page = page;
    updateUI();
};

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
