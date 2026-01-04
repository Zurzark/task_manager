import { store } from '../store.js';
import { memoryStore } from '../memory.js';
import { render } from '../views.js';
import { escapeHtml } from '../utils.js'; 
import '../ui/tag-input.js'; // 引入 Tag Input 逻辑

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
    // 侧边栏计数（统一东八区）
    const now = new Date();
    const shanghaiNowStr = now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
    const today = new Date(shanghaiNowStr); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7);

    // 今日焦点逻辑：
    // 1. 未完成
    // 2. 且 (是青蛙 或 重要且紧急 或 截止时间在未来7天内 或 今日创建的任务)
    const todayCount = store.tasks.filter(t => {
        if (t.status === 'done') return false;
        
        const isFrog = t.isFrog;
        const isUrgent = t.priority === 'urgent';
        let isComingSoon = false;
        let isCreatedToday = false;
        if (t.dueDate) {
            const d = new Date(t.dueDate);
            const sd = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
            isComingSoon = sd >= today && sd <= in7Days;
        }
        if (t.createdAt) {
            const c = new Date(t.createdAt);
            const sc = new Date(c.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
            isCreatedToday = sc >= today && sc < tomorrow;
        }
        
        return isFrog || isUrgent || isComingSoon || isCreatedToday;
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

/**
 * 监听输入框按键，触发 @ 选择器
 */
export function handleInputKeyup(e) {
    const input = e.target;
    const val = input.value;
    const cursorPos = input.selectionStart;
    
    // 检测光标前是否有 @
    const lastAtPos = val.lastIndexOf('@', cursorPos - 1);
    
    if (lastAtPos !== -1) {
        // 提取 @ 之后到光标之间的字符作为搜索词
        const query = val.substring(lastAtPos + 1, cursorPos);
        // 如果包含空格，认为已经结束引用输入，隐藏弹窗
        if (query.includes(' ')) {
            document.getElementById('task-picker').classList.add('hidden');
            return;
        }
        
        showTaskPicker(query, lastAtPos);
    } else {
        document.getElementById('task-picker').classList.add('hidden');
    }
}

/**
 * 显示任务选择弹窗
 */
function showTaskPicker(query, atIndex) {
    const picker = document.getElementById('task-picker');
    const list = document.getElementById('task-picker-list');
    
    // 1. 获取所有待办任务 (确保搜索范围是全量的)
    // 排除已完成 (done) 和 已取消 (cancelled)
    const allTasks = store.tasks.filter(t => t.status !== 'cancelled'); 
    
    // 2. 过滤逻辑：在所有待办任务中搜索
    const filtered = allTasks.filter(t => {
        // 如果没有关键词，返回所有任务（稍后会截取前几个）
        if (!query) return true;
        
        const search = query.toLowerCase();
        // 支持按 ID (#12) 或 标题搜索
        return t.shortId.toString().includes(search) || 
               t.title.toLowerCase().includes(search);
    });

    // 如果没有匹配项，隐藏弹窗
    if (filtered.length === 0) {
        picker.classList.add('hidden');
        return;
    }

    // 3. 截取展示：只展示前 10 个结果 (UI 限制)
    // 这样既保证了能搜到所有任务，又不会让下拉框太长
    const displayLimit = 10; 
    const displayList = filtered.slice(0, displayLimit);

    // 4. 渲染列表
    let html = displayList.map(t => `
        <div class="task-picker-item hover:bg-gray-100 p-2 rounded cursor-pointer flex items-center" 
             onclick="window.insertTaskRef(${t.shortId}, ${atIndex}, '${query}')">
            <span class="text-blue-500 font-mono font-bold mr-2">#${t.shortId}</span>
            <span class="text-sm text-gray-700 truncate flex-1">${escapeHtml(t.title)}</span>
            <span class="text-xs text-gray-400 ml-2 whitespace-nowrap">${t.category || ''}</span>
        </div>
    `).join('');

    // (可选) 如果搜索结果超过展示限制，显示提示
    if (filtered.length > displayLimit) {
        html += `
            <div class="p-2 text-xs text-center text-gray-400 border-t border-gray-100">
                还有 ${filtered.length - displayLimit} 个匹配项，请继续输入关键词...
            </div>
        `;
    }

    list.innerHTML = html;
    picker.classList.remove('hidden');
}

/**
 * 执行插入操作 (将被 actions.js 挂载到 window)
 */
export function insertTaskRef(shortId, atIndex, query) {
    const input = document.getElementById('task-input');
    const val = input.value;
    
    // 拼接字符串
    const before = val.substring(0, atIndex);
    const after = val.substring(atIndex + 1 + query.length);
    
    // 插入格式: @#12 (后面带一个空格)
    const insertion = `@#${shortId} `;
    
    input.value = before + insertion + after;
    
    // 关闭弹窗
    document.getElementById('task-picker').classList.add('hidden');
    input.focus();
    
    // 移动光标到插入内容之后
    const newCursorPos = atIndex + insertion.length;
    input.setSelectionRange(newCursorPos, newCursorPos);
}
