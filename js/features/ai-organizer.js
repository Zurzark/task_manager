import { store } from '../store.js';
import { callAI } from '../api.js';
import { updateUI } from '../ui/core.js';
import { escapeHtml } from '../utils.js';

let analysisResult = null;
let selectedDuplicates = new Set();
let selectedRelations = new Set();
let selectedHierarchy = new Set();

export async function startOrganizer() {
    // 1. Strictly use Selected Tasks
    if (store.selectedTaskIds.size === 0) {
        alert('请先勾选需要整理的任务！');
        return;
    }

    const tasksToAnalyze = store.tasks
        .filter(t => store.selectedTaskIds.has(t.id))
        .map(t => ({
            id: t.id,
            shortId: t.shortId,
            title: t.title,
            description: t.description,
            tags: t.tags
        }));

    if (tasksToAnalyze.length < 2) {
        alert('请至少选择 2 个任务进行整理');
        return;
    }

    // 2. Prepare Prompt
    const systemPrompt = store.config.organizerPrompt;
    const userMessage = JSON.stringify(tasksToAnalyze);

    // Show loading state
    const btn = document.getElementById('btn-batch-organize'); 
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>';
        btn.disabled = true;
    }

    try {
        // 3. Call AI
        const response = await callAI(userMessage, 'organize', systemPrompt);
        
        // 4. Parse Response
        let result;
        try {
            // Clean up markdown code blocks if present
            const cleanJson = response.replace(/```json\n?|\n?```/g, '').trim();
            result = JSON.parse(cleanJson);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            throw new Error('AI 响应格式错误');
        }

        // Validate structure
        if (!result.duplicates) result.duplicates = [];
        if (!result.relations) result.relations = [];
        if (!result.parentChild) result.parentChild = [];

        analysisResult = result;
        
        // Initialize selections (select all by default)
        selectedDuplicates = new Set(result.duplicates.map((_, i) => i));
        selectedRelations = new Set(result.relations.map((_, i) => i));
        selectedHierarchy = new Set(result.parentChild.map((_, i) => i));

        // 5. Show Modal
        renderOrganizerModal();

    } catch (error) {
        console.error('Organizer Error:', error);
        alert('整理失败: ' + error.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

function findTask(id) {
    return store.tasks.find(t => t.id === id);
}

function renderOrganizerModal() {
    const hierarchyHtml = analysisResult.parentChild.length === 0
        ? '<div class="text-gray-400 text-center py-4">无层级建议</div>'
        : analysisResult.parentChild.map((item, index) => {
            const parent = findTask(item.parentId);
            const child = findTask(item.childId);
            if (!parent || !child) return '';

            const isSelected = selectedHierarchy.has(index);

            return `
                <div class="border rounded-lg p-3 mb-3 ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200'} cursor-pointer" onclick="window.toggleOrganizerItem('hierarchy', ${index})">
                    <div class="flex items-start gap-3">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} class="mt-1 rounded text-orange-600 focus:ring-orange-500 pointer-events-none">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="bg-orange-100 text-orange-700 text-xs px-1.5 rounded">父任务</span>
                                <span class="font-bold text-sm text-gray-800">#${parent.shortId} ${escapeHtml(parent.title)}</span>
                            </div>
                            <div class="flex items-center gap-2 mb-2">
                                <span class="bg-gray-100 text-gray-700 text-xs px-1.5 rounded">子任务</span>
                                <span class="text-sm text-gray-600">#${child.shortId} ${escapeHtml(child.title)}</span>
                            </div>
                            <p class="text-xs text-gray-500 bg-white p-2 rounded border border-gray-100">
                                <i class="ri-information-line"></i> ${escapeHtml(item.reason)}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    const duplicatesHtml = analysisResult.duplicates.length === 0 
        ? '<div class="text-gray-400 text-center py-4">无重复任务</div>' 
        : analysisResult.duplicates.map((item, index) => {
            const keep = findTask(item.keepId);
            const merge = findTask(item.mergeId);
            if (!keep || !merge) return ''; // Skip if task not found

            const isSelected = selectedDuplicates.has(index);

            return `
                <div class="border rounded-lg p-3 mb-3 ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200'} cursor-pointer" onclick="window.toggleOrganizerItem('dup', ${index})">
                    <div class="flex items-start gap-3">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} class="mt-1 rounded text-purple-600 focus:ring-purple-500 pointer-events-none">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="bg-green-100 text-green-700 text-xs px-1.5 rounded">保留</span>
                                <span class="font-bold text-sm text-gray-800">#${keep.shortId} ${escapeHtml(keep.title)}</span>
                            </div>
                            <div class="flex items-center gap-2 mb-2">
                                <span class="bg-red-100 text-red-700 text-xs px-1.5 rounded">合并</span>
                                <span class="text-sm text-gray-500 line-through">#${merge.shortId} ${escapeHtml(merge.title)}</span>
                            </div>
                            <p class="text-xs text-gray-500 bg-white p-2 rounded border border-gray-100">
                                <i class="ri-information-line"></i> ${escapeHtml(item.reason)}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    const relationsHtml = analysisResult.relations.length === 0
        ? '<div class="text-gray-400 text-center py-4">无关联建议</div>'
        : analysisResult.relations.map((item, index) => {
            const source = findTask(item.sourceId);
            const target = findTask(item.targetId);
            if (!source || !target) return '';

            const isSelected = selectedRelations.has(index);

            return `
                <div class="border rounded-lg p-3 mb-3 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} cursor-pointer" onclick="window.toggleOrganizerItem('rel', ${index})">
                    <div class="flex items-start gap-3">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} class="mt-1 rounded text-blue-600 focus:ring-blue-500 pointer-events-none">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 flex-wrap text-sm">
                                <span class="font-bold text-gray-800">#${source.shortId} ${escapeHtml(source.title)}</span>
                                <i class="ri-arrow-right-line text-gray-400"></i>
                                <span class="font-bold text-gray-800">#${target.shortId} ${escapeHtml(target.title)}</span>
                            </div>
                            <div class="mt-1">
                                <span class="text-xs bg-gray-200 text-gray-600 px-1.5 rounded">${item.type === 'depends_on' ? '依赖' : '关联'}</span>
                                <span class="text-xs text-gray-500 ml-1">${escapeHtml(item.reason)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in">
            <div class="bg-white rounded-xl w-full max-w-4xl p-6 max-h-[90vh] flex flex-col shadow-2xl">
                <div class="flex justify-between items-center mb-6 pb-4 border-b">
                    <h3 class="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <i class="ri-magic-line text-purple-600"></i> 
                        智能整理结果
                    </h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400 hover:text-gray-600 transition">
                        <i class="ri-close-line text-2xl"></i>
                    </button>
                </div>
                
                <div class="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Column 1: Duplicates -->
                    <div class="flex flex-col min-h-0">
                        <h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <i class="ri-file-copy-2-line text-orange-500"></i> 重复任务建议
                        </h4>
                        <div class="overflow-y-auto flex-1 pr-2">
                            ${duplicatesHtml}
                        </div>
                    </div>

                    <!-- Column 2: Relations -->
                    <div class="flex flex-col min-h-0 border-l pl-6 border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <i class="ri-links-line text-blue-500"></i> 关联任务建议
                        </h4>
                        <div class="overflow-y-auto flex-1 pr-2">
                            ${relationsHtml}
                        </div>
                    </div>
                </div>

                <div class="pt-6 mt-4 border-t flex justify-end gap-3">
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">取消</button>
                    <button onclick="window.executeOrganization()" class="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg font-medium transition flex items-center gap-2">
                        <i class="ri-check-double-line"></i> 一键执行
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modal-container').innerHTML = modalHtml;
}

export function toggleOrganizerItem(type, index) {
    if (type === 'dup') {
        if (selectedDuplicates.has(index)) selectedDuplicates.delete(index);
        else selectedDuplicates.add(index);
    } else {
        if (selectedRelations.has(index)) selectedRelations.delete(index);
        else selectedRelations.add(index);
    }
    renderOrganizerModal();
}

export function executeOrganization() {
    let changeCount = 0;

    // 1. Process Duplicates
    selectedDuplicates.forEach(index => {
        const item = analysisResult.duplicates[index];
        const keepTask = findTask(item.keepId);
        const mergeTask = findTask(item.mergeId);

        if (keepTask && mergeTask) {
            // Append notes to keepTask
            const mergeNote = `\n\n> **已合并任务 #${mergeTask.shortId}**: ${mergeTask.title}\n> ${mergeTask.description || ''}`;
            const newDesc = (keepTask.description || '') + mergeNote;
            
            store.updateTask(keepTask.id, { description: newDesc });
            
            // Cancel mergeTask
            store.updateTask(mergeTask.id, { status: 'cancelled' });
            
            changeCount++;
        }
    });

    // 3. Process Relations
    selectedRelations.forEach(index => {
        const item = analysisResult.relations[index];
        const sourceTask = findTask(item.sourceId);
        const targetTask = findTask(item.targetId);

        if (sourceTask && targetTask) {
            const existingRelations = sourceTask.relations || [];
            // Check if already exists
            const exists = existingRelations.some(r => r.targetId === targetTask.id);
            
            if (!exists) {
                const newRelations = [
                    ...existingRelations,
                    {
                        type: item.type, // depends_on or related_to
                        targetId: targetTask.id,
                        targetShortId: targetTask.shortId
                    }
                ];
                store.updateTask(sourceTask.id, { relations: newRelations });
                changeCount++;
            }
        }
    });

    document.getElementById('modal-container').innerHTML = '';
    updateUI();
    alert(`整理完成！共执行了 ${changeCount} 项变更。`);
}

// Bind to window for HTML events
window.toggleOrganizerItem = toggleOrganizerItem;
window.executeOrganization = executeOrganization;
window.startOrganizer = startOrganizer;
