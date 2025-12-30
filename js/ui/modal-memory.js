import { memoryStore } from '../memory.js';
import { callAI } from '../api.js';

export function openMemoryModal() {
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

export function switchMemoryTab(tab) {
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
}

export function saveMemoryProfile() {
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
}

export function saveMemoryConfig() {
    const updates = {
        injectionStrategy: document.getElementById('memory-injection-strategy').value,
        maxMemories: parseInt(document.getElementById('memory-max-memories').value) || 10,
        maxTokens: parseInt(document.getElementById('memory-max-tokens').value) || 1000
    };
    
    memoryStore.updateConfig(updates);
    alert('记忆配置已保存');
}

export function openAddMemoryModal() {
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
}

export function saveNewMemory() {
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
}

export function toggleMemory(id) {
    memoryStore.toggleMemory(id);
    openMemoryModal(); // 刷新界面
}

export function editMemory(id) {
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
}

export function saveEditedMemory(id) {
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
}

export function deleteMemory(id) {
    if (confirm('确定删除这条记忆吗？')) {
        memoryStore.deleteMemory(id);
        openMemoryModal(); // 刷新界面
    }
}

export async function organizeMemories() {
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
}
