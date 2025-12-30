import { store } from './store.js';
import { memoryStore } from './memory.js';
import { updateUI, renderCategoryList } from './ui/core.js';
import { handleAIParse } from './features/ai.js';
import { setupBackupListeners } from './features/backup.js';
import './actions.js'; // Import for window side-effects
import { openMemoryModal } from './ui/modal-memory.js';
import { openSettingsModal, openLogsModal } from './ui/modal-settings.js';
import { handleQuickAdd } from './actions.js';

// ============ 初始化与UI更新 ============

document.addEventListener('DOMContentLoaded', () => {
    store.init();
    memoryStore.init();
    initUI();
    updateUI();
});

function initUI() {
    // 视图切换
    document.querySelectorAll('.view-switcher, .nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target || e.currentTarget.dataset.view;
            if (target) {
                if (['list', 'kanban', 'calendar', 'quadrant'].includes(target)) {
                    store.currentViewMode = target;
                } else if (['today', 'all', 'completed', 'pending'].includes(target)) {
                    store.viewFilter = target;
                    // 重置选中状态
                    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('bg-gray-100', 'text-blue-600'));
                    e.currentTarget.classList.add('bg-gray-100', 'text-blue-600');
                }
                updateUI();
            }
        });
    });

    // AI 解析按钮
    const aiBtn = document.getElementById('btn-ai-parse');
    if (aiBtn) aiBtn.addEventListener('click', handleAIParse);

    // 快捷键: Ctrl+Enter 解析
    const taskInput = document.getElementById('task-input');
    if (taskInput) {
        taskInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleAIParse();
            }
        });
    }

    // 快速添加按钮
    const addBtn = document.getElementById('btn-quick-add');
    if (addBtn) addBtn.addEventListener('click', handleQuickAdd);

    // 记忆按钮
    const memBtn = document.getElementById('btn-memory');
    if (memBtn) memBtn.addEventListener('click', openMemoryModal);

    // 导出/导入/设置/日志
    setupBackupListeners();

    // 恢复丢失的监听器
    document.getElementById('btn-settings')?.addEventListener('click', openSettingsModal);
    document.getElementById('btn-logs')?.addEventListener('click', openLogsModal);

    // 渲染分类列表
    renderCategoryList();
    
    // 点击外部关闭下拉
    document.addEventListener('click', (e) => {
        // 状态下拉
        const statusContainer = document.getElementById('status-filter-container');
        const statusMenu = document.getElementById('status-filter-menu');
        if (statusContainer && !statusContainer.contains(e.target) && statusMenu && !statusMenu.classList.contains('hidden')) {
            statusMenu.classList.add('hidden');
        }
    
        // 创建时间下拉
        const createdPopover = document.getElementById('created-filter-popover');
        if (createdPopover && !createdPopover.classList.contains('hidden')) {
            if (!e.target.closest('#created-filter-popover') && !e.target.closest('.group\\/created button')) {
                createdPopover.classList.add('hidden');
            }
        }
    
        // 截止时间下拉
        const deadlinePopover = document.getElementById('deadline-filter-popover');
        if (deadlinePopover && !deadlinePopover.classList.contains('hidden')) {
            if (!e.target.closest('#deadline-filter-popover') && !e.target.closest('.group\\/deadline button')) {
                deadlinePopover.classList.add('hidden');
            }
        }
    });
}
