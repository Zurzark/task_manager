import { store } from '../store.js';
import { memoryStore } from '../memory.js';
import { render } from '../views.js';

export function updateUI() {
    const view = store.currentViewMode || 'list';
    const container = document.getElementById('view-container');
    
    // 渲染主视图
    if (render[view]) {
        container.innerHTML = render[view]();
    }

    // 更新视图切换按钮状态
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
        'completed': '已完成',
        'pending': '未完成'
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

export function updateCounts() {
    // 侧边栏计数
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7);

    // 今日焦点逻辑：
    // 1. 未完成
    // 2. 且 (是青蛙 或 重要且紧急 或 截止时间在未来7天内)
    const todayCount = store.tasks.filter(t => {
        if (t.status === 'done') return false;
        
        const isFrog = t.isFrog;
        const isUrgent = t.priority === 'urgent';
        let isComingSoon = false;
        if (t.dueDate) {
            const d = new Date(t.dueDate);
            isComingSoon = d >= today && d <= in7Days;
        }
        
        return isFrog || isUrgent || isComingSoon;
    }).length;

    const allCount = store.tasks.length;
    const completedCount = store.tasks.filter(t => t.status === 'done').length;
    const pendingCount = store.tasks.filter(t => t.status !== 'done').length;
    
    document.getElementById('today-count').textContent = todayCount;
    document.getElementById('all-count').textContent = allCount;
    document.getElementById('completed-count').textContent = completedCount;
    const pendingEl = document.getElementById('pending-count');
    if (pendingEl) pendingEl.textContent = pendingCount;
    
    // 记忆库计数
    const memCount = memoryStore.memories.length;
    const memEl = document.getElementById('memory-count');
    if (memEl) memEl.textContent = memCount;

    // 费用显示
    const totalCost = store.apiLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const costEl = document.getElementById('total-cost');
    if (costEl) costEl.textContent = `¥${totalCost.toFixed(2)}`;
}

export function renderCategoryList() {
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
