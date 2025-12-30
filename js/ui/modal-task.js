import { store } from '../store.js';
import { getShanghaiInputValue, escapeHtml } from '../utils.js';
import { updateUI } from './core.js';

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

export function addRelationRow(type = 'depends_on', targetValue = '') {
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
}

export function openTaskModal(taskId) {
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
                            <input type="datetime-local" id="edit-start" value="${getShanghaiInputValue(task.startDate)}" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">截止时间</label>
                            <input type="datetime-local" id="edit-due" value="${getShanghaiInputValue(task.dueDate)}" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">提醒时间</label>
                            <input type="datetime-local" id="edit-reminder" value="${getShanghaiInputValue(task.reminderTime)}" class="w-full border border-gray-300 rounded-lg p-2 text-sm">
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
            addRelationRow(rel.type, rel.targetId);
        });
    } else {
        container.innerHTML = '<div class="text-xs text-gray-400 text-center py-2" id="no-relations-msg">暂无关联</div>';
    }
}

export function saveTaskEdit(id) {
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
        startDate: start ? new Date(start + '+08:00').toISOString() : null,
        dueDate: due ? new Date(due + '+08:00').toISOString() : null,
        reminderTime: reminder ? new Date(reminder + '+08:00').toISOString() : null,
        estimatedMinutes: estMin ? parseInt(estMin) : null,
        actualMinutes: actMin ? parseInt(actMin) : null,
        tags,
        parentId, relations
    });
    
    document.getElementById('modal-container').innerHTML = '';
    updateUI();
}

export function deleteTaskAndClose(id) {
    if(confirm('确定删除?')) {
        store.deleteTask(id);
        document.getElementById('modal-container').innerHTML = '';
        updateUI();
    }
}
