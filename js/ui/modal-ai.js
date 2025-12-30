import { store } from '../store.js';
import { generateId, escapeHtml } from '../utils.js';
import { updateUI } from './core.js';

export function openAIConfirmModal(tasks) {
    window._tempParsedTasks = tasks.map(t => ({
        ...t,
        _tempId: Math.random().toString(36).substr(2, 9),
        _selected: true
    }));
    renderAIConfirmModal();
}

export function renderAIConfirmModal() {
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

export function toggleTempTask(tempId) {
    const task = window._tempParsedTasks.find(t => t._tempId === tempId);
    if (task) {
        task._selected = !task._selected;
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
}
