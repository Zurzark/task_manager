import { store } from '../store.js';
import { memoryStore } from '../memory.js';
import { callAI } from '../api.js';
import { extractReferences, buildReferencedTasksContext, extractJsonFromResponse } from '../utils.js';
import { openAIConfirmModal } from '../ui/modal-ai.js';

export async function handleAIParse() {
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
        
        // 更新总费用
        const totalCost = store.apiLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
        const costEl = document.getElementById('total-cost');
        if (costEl) costEl.textContent = `¥${totalCost.toFixed(2)}`;
    }
}
