// 增加一个简单的计数器，防止同一毫秒内的冲突
let _uniqueCounter = 0;

export function generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    // 增加计数器后缀，确保绝对唯一
    const counter = (_uniqueCounter++).toString(36);
    return `t_${timestamp}_${counter}_${random}`;
}

export function formatFullDateTime(date) {
    const d = new Date(date);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    // Convert to Shanghai time for display parts
    const shanghaiDateStr = d.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
    const sd = new Date(shanghaiDateStr);
    
    return `${sd.getFullYear()}年${sd.getMonth()+1}月${sd.getDate()}日 ${weekdays[sd.getDay()]} ${String(sd.getHours()).padStart(2,'0')}:${String(sd.getMinutes()).padStart(2,'0')}`;
}

export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

export function sendNotification(title, body) {
    if (Notification.permission === "granted") {
        new Notification(title, { body, icon: '/favicon.ico' });
    }
}

// 提取文本中的引用 ID (支持 @#123 或 @123)
export function extractReferences(text) {
    if (!text) return [];
    const regex = /@#?(\d+)/g;
    const refs = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        refs.push(parseInt(match[1]));
    }
    return [...new Set(refs)]; // 去重
}

// 构建引用任务的上下文描述
export function buildReferencedTasksContext(shortIds, allTasks) {
    if (!shortIds || shortIds.length === 0) return '（用户未引用任何现有任务）';

    return shortIds.map(sid => {
        const task = allTasks.find(t => t.shortId === sid);
        if (!task) return null;

        // 简要描述子任务情况
        const children = allTasks.filter(t => t.parentId === task.id);
        const childrenText = children.length 
            ? ` (包含 ${children.length} 个子任务: ${children.map(c => '#' + c.shortId).join(', ')})` 
            : '';

        return `
任务 #${task.shortId}
- 标题: ${task.title}
- 状态: ${task.status}
- 优先级: 紧急${task.urgency}/重要${task.importance}
- 分类: ${task.category || '无'}
- 截止: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '无'}
${childrenText}
        `.trim();
    }).filter(Boolean).join('\n\n');
}