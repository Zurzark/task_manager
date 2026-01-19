import { store } from '../store.js';
import { generateId, escapeHtml } from '../utils.js';

let editingApiId = null;
let settingsTab = 'api';

export function openSettingsModal() {
    editingApiId = null;
    settingsTab = 'api';
    renderSettingsModalContent();
}

export function renderSettingsModalContent() {
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
                    <button onclick="window.switchSettingsTab('general')" class="pb-2 px-1 ${settingsTab === 'general' ? 'border-b-2 border-blue-500 text-blue-600 font-bold' : 'text-gray-500'}">常规设置</button>
                    <button onclick="window.switchSettingsTab('api')" class="pb-2 px-1 ${settingsTab === 'api' ? 'border-b-2 border-blue-500 text-blue-600 font-bold' : 'text-gray-500'}">API 配置</button>
                    <button onclick="window.switchSettingsTab('prompt')" class="pb-2 px-1 ${settingsTab === 'prompt' ? 'border-b-2 border-blue-500 text-blue-600 font-bold' : 'text-gray-500'}">Prompt 设置</button>
                </div>

                <div class="${settingsTab === 'general' ? '' : 'hidden'}">
                    <h4 class="font-bold mb-4 text-gray-700">工作时间设置</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">工作开始时间</label>
                            <input type="time" id="setting-work-start" value="${store.config.workHours?.start || '09:00'}" class="w-full border rounded p-2 text-sm">
                            <p class="text-xs text-gray-500 mt-1">每天工作的开始时间</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">工作结束时间</label>
                            <input type="time" id="setting-work-end" value="${store.config.workHours?.end || '18:15'}" class="w-full border rounded p-2 text-sm">
                            <p class="text-xs text-gray-500 mt-1">每天工作的结束时间 (默认截止时间)</p>
                        </div>
                    </div>
                    <div class="border-t my-6 border-gray-100"></div>

                    <h4 class="font-bold mb-4 text-gray-700">智能延时设置</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">延时选项 (分钟)</label>
                            <input type="text" id="setting-snooze-presets" value="${(store.config.snoozePresets || [5, 15, 30, 60, 180]).join(', ')}" class="w-full border rounded p-2 text-sm" placeholder="如: 5, 15, 30">
                            <p class="text-xs text-gray-500 mt-1">自定义"稍后提醒"的时间间隔，用逗号分隔</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">明天提醒时间</label>
                            <input type="time" id="setting-snooze-tomorrow" value="${store.config.snoozeTomorrowTime || '09:00'}" class="w-full border rounded p-2 text-sm">
                            <p class="text-xs text-gray-500 mt-1">"明天提醒"选项的具体时间点</p>
                        </div>
                    </div>

                    <div class="flex justify-end">
                        <button onclick="window.saveGeneralSettings()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存设置</button>
                    </div>
                </div>

                <div class="${settingsTab === 'api' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'hidden'}">
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
                    <label class="block text-sm font-bold text-gray-700 mb-1">通用解析 Prompt</label>
                    <textarea id="settings-prompt" rows="8" class="w-full border rounded p-3 text-sm font-mono bg-gray-50 mb-4">${store.config.prompt}</textarea>
                    
                    <label class="block text-sm font-bold text-gray-700 mb-1">智能整理 Prompt</label>
                    <textarea id="settings-organizer-prompt" rows="8" class="w-full border rounded p-3 text-sm font-mono bg-gray-50">${store.config.organizerPrompt || ''}</textarea>

                    <div class="mt-4 flex justify-end">
                        <button onclick="window.savePrompt()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存 Prompt</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modal-container').innerHTML = modalHtml;
}

export function switchSettingsTab(tab) {
    settingsTab = tab;
    renderSettingsModalContent();
}

export function saveGeneralSettings() {
    const start = document.getElementById('setting-work-start').value;
    const end = document.getElementById('setting-work-end').value;
    
    const snoozePresetsStr = document.getElementById('setting-snooze-presets').value;
    const snoozeTomorrow = document.getElementById('setting-snooze-tomorrow').value;

    if (!start || !end) return alert('请填写完整的时间');
    
    // Parse presets
    const presets = snoozePresetsStr.split(/[,，]/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    
    if (presets.length === 0) return alert('请至少配置一个延时选项');
    if (!snoozeTomorrow) return alert('请配置明天提醒时间');
    
    store.config.workHours = { start, end };
    store.config.snoozePresets = presets;
    store.config.snoozeTomorrowTime = snoozeTomorrow;
    
    store.saveConfig();
    alert('设置已保存');
}

export function savePrompt() {
    const newPrompt = document.getElementById('settings-prompt').value;
    const newOrganizerPrompt = document.getElementById('settings-organizer-prompt').value;
    
    store.config.prompt = newPrompt;
    store.config.organizerPrompt = newOrganizerPrompt;
    
    store.saveConfig();
    alert('Prompt 已保存');
}

export function setActiveApi(id) { store.config.activeApiId = id; store.saveConfig(); renderSettingsModalContent(); }
export function editApi(id) { editingApiId = id; renderSettingsModalContent(); }
export function resetEditForm() { editingApiId = null; renderSettingsModalContent(); }

export function deleteApi(id) {
    if (store.config.apis.length <= 1) return alert('至少保留一个配置');
    store.config.apis = store.config.apis.filter(a => a.id !== id);
    if (store.config.activeApiId === id) store.config.activeApiId = store.config.apis[0].id;
    store.saveConfig();
    if (editingApiId === id) editingApiId = null;
    renderSettingsModalContent();
}

export function saveApiForm() {
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
}

export function openLogsModal() {
    const modalHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in">
            <div class="bg-white rounded-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold">API 调用记录</h3>
                    <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-gray-400"><i class="ri-close-line text-xl"></i></button>
                </div>
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-50 text-gray-600"><tr><th class="p-2">时间</th><th class="p-2">模型</th><th class="p-2">Tokens</th><th class="p-2">费用</th><th class="p-2">耗时</th></tr></thead>
                    <tbody class="divide-y">${store.apiLogs.map(log => `<tr><td class="p-2 text-gray-500">${new Date(log.timestamp).toLocaleString()}</td><td class="p-2">${escapeHtml(log.model)}</td><td class="p-2">${log.tokens.total_tokens}</td><td class="p-2 font-bold text-orange-500">¥${log.cost.toFixed(4)}</td><td class="p-2 text-gray-400">${log.duration} ms</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('modal-container').innerHTML = modalHtml;
}
