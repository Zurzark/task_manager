// js/api.js
import { store } from './store.js';
import { generateId, formatFullDateTime } from './utils.js';

// 修改：增加 customSystemPrompt 参数
export async function callAI(userMessage, purpose = 'parse', customSystemPrompt = null) {
    const apiConfig = store.getActiveApi();
    
    if (!apiConfig.url || !apiConfig.key) {
        throw new Error('请先在设置中配置当前选中的 API');
    }

    const now = new Date();
    
    // 逻辑修正：优先使用传入的包含上下文的 Prompt，否则使用全局配置
    let rawSystemPrompt = customSystemPrompt || store.config.prompt;
    
    // 替换时间变量
    const systemPrompt = rawSystemPrompt.replace(/{current_datetime}/g, formatFullDateTime(now));

    const startTime = Date.now();

    try {
        const response = await fetch(apiConfig.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.key}`
            },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: apiConfig.temperature !== undefined ? apiConfig.temperature : 0.3
            })
        });

        const data = await response.json();
        const endTime = Date.now();

        if (data.error) throw new Error(data.error.message);

        const inputPrice = apiConfig.costInput || 0;
        const outputPrice = apiConfig.costOutput || 0;

        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        const inputCost = (usage.prompt_tokens / 1000000) * inputPrice;
        const outputCost = (usage.completion_tokens / 1000000) * outputPrice;
        const totalCost = inputCost + outputCost;

        const log = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            purpose,
            model: apiConfig.model,
            apiName: apiConfig.name,
            input: userMessage.substring(0, 100),
            tokens: usage,
            cost: totalCost,
            duration: endTime - startTime
        };

        store.apiLogs.unshift(log);
        if (store.apiLogs.length > 100) store.apiLogs = store.apiLogs.slice(0, 100);
        store.saveLogs();

        return data.choices?.[0]?.message?.content;
    } catch (error) {
        console.error('AI Error:', error);
        throw error;
    }
}