import { store } from './store.js';
import { escapeHtml } from './utils.js';

// 辅助：获取优先级配置 (Badge 模式) - 升级版
function getPriorityBadgeConfig(priority) {
    const config = {
        urgent: { 
            label: '重要且紧急', 
            class: 'bg-red-50 text-red-700 border border-red-200 priority-badge', 
            icon: 'ri-alarm-warning-fill',
            tooltip: 'Q1: 马上做 (Do Now)<br/><span class="opacity-75 text-xs">危机、急迫的问题、期限</span>'
        },
        high: { 
            label: '重要不紧急', 
            class: 'bg-orange-50 text-orange-700 border border-orange-200 priority-badge', 
            icon: 'ri-star-fill',
            tooltip: 'Q2: 计划做 (Schedule)<br/><span class="opacity-75 text-xs">规划、学习、健康、预防</span>'
        },
        medium: { 
            label: '不重要紧急', 
            class: 'bg-blue-50 text-blue-700 border border-blue-200 priority-badge', 
            icon: 'ri-user-shared-fill',
            tooltip: 'Q3: 授权做 (Delegate)<br/><span class="opacity-75 text-xs">会议、干扰、琐事</span>'
        },
        low: { 
            label: '不重要不紧急', 
            class: 'bg-gray-50 text-gray-600 border border-gray-200 priority-badge', 
            icon: 'ri-cup-line',
            tooltip: 'Q4: 稍后做 (Eliminate)<br/><span class="opacity-75 text-xs">浪费时间、娱乐、消遣</span>'
        }
    };
    return config[priority] || config.medium;
}

// 辅助：获取优先级配置 (Icon 模式，保留用于 Kanban 等)
function getPriorityConfig(priority) {
    const config = {
        urgent: { label: '紧急', color: 'bg-red-500', icon: 'ri-alarm-warning-fill', text: 'text-red-600', bg: 'bg-red-50' },
        high: { label: '高', color: 'bg-orange-500', icon: 'ri-arrow-up-double-fill', text: 'text-orange-600', bg: 'bg-orange-50' },
        medium: { label: '中', color: 'bg-yellow-500', icon: 'ri-subtract-line', text: 'text-yellow-600', bg: 'bg-yellow-50' },
        low: { label: '低', color: 'bg-green-500', icon: 'ri-arrow-down-line', text: 'text-green-600', bg: 'bg-green-50' }
    };
    return config[priority] || config.medium;
}

// 辅助：获取状态配置
function getStatusConfig(status) {
    const map = {
        pending: { label: '待开始', class: 'bg-gray-100 text-gray-600 border-gray-200' },
        active: { label: '进行中', class: 'bg-blue-100 text-blue-700 border-blue-200' },
        done: { label: '已完成', class: 'bg-green-100 text-green-700 border-green-200' },
        cancelled: { label: '已取消', class: 'bg-red-100 text-red-700 border-red-200 line-through' }
    };
    return map[status] || map.pending;
}

export function getFilteredTasks() {
    return store.getFilteredTasks();
}

// 辅助：渲染排序表头
function renderSortHeader(field, label) {
    const sortIdx = store.sortState.findIndex(s => s.field === field);
    const sortItem = sortIdx > -1 ? store.sortState[sortIdx] : null;
    
    let icon = 'ri-expand-up-down-fill text-gray-300';
    if (sortItem) {
        icon = sortItem.direction === 'asc' ? 'ri-arrow-up-line text-blue-600' : 'ri-arrow-down-line text-blue-600';
    }
    
    const badge = sortItem ? `<span class="sort-badge">${sortIdx + 1}</span>` : '';
    
    return `
        <th class="cursor-pointer hover:bg-gray-100 transition select-none" onclick="window.toggleSort('${field}')">
            <div class="flex items-center justify-center gap-1 text-gray-500 font-bold">
                ${label}
                <i class="${icon} text-xs"></i>
                ${badge}
            </div>
        </th>
    `;
}

// 辅助：渲染状态表头 (仅标题)
function renderStatusHeader() {
    return `
        <th class="text-center select-none text-gray-500 font-bold">
            状态
        </th>
    `;
}

// 构建树状结构
function buildTaskTree(tasks) {
    const taskMap = {};
    const roots = [];
    
    tasks.forEach(t => {
        taskMap[t.id] = { ...t, children: [] };
    });

    tasks.forEach(t => {
        if (t.parentId && taskMap[t.parentId]) {
            taskMap[t.parentId].children.push(taskMap[t.id]);
        } else {
            roots.push(taskMap[t.id]);
        }
    });

    return roots;
}

// 格式化日期 (带颜色逻辑，主要用于截止时间)
function formatDueDate(dateStr) {
    if (!dateStr) return '<span class="text-gray-300">-</span>';
    const date = new Date(dateStr);
    
    // Shift to Shanghai "virtual" time for comparison
    const sd = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const now = new Date();
    const nowSd = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    
    const isToday = sd.toDateString() === nowSd.toDateString();
    const isOverdue = sd < nowSd && !isToday;
    
    const timeStr = date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStrFormatted = `${sd.getMonth()+1}/${sd.getDate()}`;
    
    let colorClass = 'text-gray-500';
    if (isOverdue) colorClass = 'text-red-500 font-bold';
    else if (isToday) colorClass = 'text-orange-600 font-bold';

    return `<span class="${colorClass} text-xs flex items-center gap-1"><i class="ri-time-line"></i> ${isToday ? '今天' : dateStrFormatted} ${timeStr}</span>`;
}

// 格式化普通日期 (无特殊颜色逻辑)
function formatDateSimple(dateStr) {
    if (!dateStr) return '<span class="text-gray-300">-</span>';
    const date = new Date(dateStr);
    const sd = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    
    const timeStr = date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStrFormatted = `${sd.getMonth()+1}/${sd.getDate()}`;
    return `<span class="text-gray-500 text-xs flex items-center gap-1">${dateStrFormatted} ${timeStr}</span>`;
}

// 辅助：获取行动项配置
function getActionTypeConfig(type) {
    const map = {
        'NEXT': { label: '下一步', class: 'bg-green-100 text-green-700 border-green-200' }, // 改为绿色
        'WAITING': { label: '等待', class: 'bg-red-100 text-red-700 border-red-200' }, // 改为红色
        'SOMEDAY': { label: '将来', class: 'bg-gray-100 text-gray-600 border-gray-200' }
    };
    return map[type] || map['NEXT'];
}

// 格式化日期：更智能的显示
function formatSmartDate(dateStr, isDueDate = false, isDone = false) {
    if (!dateStr) return '<span class="text-gray-300">-</span>';
    const date = new Date(dateStr);
    
    // Shift to Shanghai
    const sd = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const now = new Date();
    const nowSd = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    
    const todaySd = new Date(nowSd); todaySd.setHours(0,0,0,0);
    const targetSd = new Date(sd); targetSd.setHours(0,0,0,0);
    
    // Calculate difference in days
    const diffTime = targetSd - todaySd;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const m = (sd.getMonth() + 1).toString().padStart(2, '0');
    const d = sd.getDate().toString().padStart(2, '0');
    const time = sd.getHours().toString().padStart(2, '0') + ':' + sd.getMinutes().toString().padStart(2, '0');
    
    let colorClass = 'text-gray-600 font-bold'; // 默认加粗
    let icon = ''; 
    let text = `${m}/${d} ${time}`; 

    if (isDueDate) {
        if (isDone) {
            colorClass = 'text-gray-400 line-through font-bold';
            text = `${m}/${d}`; 
        } else {
            if (diffDays < 0) {
                // Overdue
                const overdueDays = Math.abs(diffDays);
                text = `已逾期 ${overdueDays}天`;
                colorClass = 'text-red-600 font-bold';
                icon = '🔥';
            } else if (diffDays === 0) {
                text = '今天';
                colorClass = 'text-orange-600 font-bold';
                icon = '⏰';
            } else if (diffDays === 1) {
                text = '明天';
                colorClass = 'text-blue-600 font-bold';
                icon = '🚀';
            } else if (diffDays === 2) {
                text = '后天';
                colorClass = 'text-blue-600 font-bold';
                icon = '🔭';
            } else if (diffDays >= 3 && diffDays <= 7) {
                // Determine This Week vs Next Week
                const dayOfWeek = sd.getDay(); // 0 (Sun) - 6 (Sat)
                const todayDayOfWeek = todaySd.getDay(); // 0 (Sun) - 6 (Sat)
                
                // Calculate week start dates (assuming Monday is start of week)
                // Actually easier: check if they are in the same ISO week
                // Or: Calculate "End of this week" (Sunday)
                // If target <= End of this week => "本周X"
                // Else => "下周X"
                
                // Adjust Sunday to be 7 for easier math if week starts Monday
                const todayDayAdjusted = todayDayOfWeek === 0 ? 7 : todayDayOfWeek;
                const daysUntilSunday = 7 - todayDayAdjusted;
                const endOfWeekSd = new Date(todaySd);
                endOfWeekSd.setDate(todaySd.getDate() + daysUntilSunday);
                
                const chineseDays = ['日', '一', '二', '三', '四', '五', '六'];
                const dayChar = chineseDays[dayOfWeek];
                
                if (targetSd <= endOfWeekSd) {
                    text = `本周${dayChar}`;
                    colorClass = 'text-blue-600 font-bold';
                } else {
                    text = `下周${dayChar}`;
                    colorClass = 'text-purple-600 font-bold'; // Distinct color for next week
                }

                icon = '📅';
            } else {
                // Future (> 7 days)
                text = `${sd.getMonth() + 1}月${sd.getDate()}日`;
                colorClass = 'text-gray-500 font-bold';
            }
        }
    } else {
        // CreatedAt, CompletedAt
        colorClass = 'text-gray-400';
    }
    
    return `<div class="flex items-center gap-1 ${colorClass} text-xs justify-center" title="${date.toLocaleString()}">
        ${icon ? `<span class="text-sm">${icon}</span>` : ''}
        <span>${text}</span>
    </div>`;
}

function formatTimeColumn(task) {
    const created = formatSmartDate(task.createdAt);
    let completed = '<span class="text-gray-300">-</span>';
    
    if (task.status === 'done' && task.completedAt) {
        completed = formatSmartDate(task.completedAt, false, true); // Use smart date logic
    }
    
    return `
        <div class="flex flex-col gap-1 items-center">
            <div title="创建时间">${created}</div>
            ${task.status === 'done' ? `<div title="完成时间" class="text-green-600">${completed}</div>` : ''}
        </div>
    `;
}

// 递归生成表格行
function renderTableRows(nodes, level = 0, parentIsLast = true) {
    let html = '';
    
    // Global helper for table menus
    if (!window.toggleTableMenu) {
        // ... (existing toggleTableMenu code) ...
        
        // --- Global Tooltip Logic ---
        let tooltipEl = null;
        let tooltipTimeout = null;

        window.showPriorityTooltip = (el, priority) => {
            if (tooltipTimeout) clearTimeout(tooltipTimeout);
            
            const config = getPriorityBadgeConfig(priority);
            if (!config || !config.tooltip) return;

            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.className = 'global-tooltip';
                document.body.appendChild(tooltipEl);
            }

            tooltipEl.innerHTML = config.tooltip;
            
            const rect = el.getBoundingClientRect();
            const tooltipRect = tooltipEl.getBoundingClientRect();
            
            // Default: Above
            let top = rect.top - tooltipRect.height - 8;
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            
            tooltipEl.classList.remove('tooltip-bottom');

            // Check if top is clipped
            if (top < 0) {
                // Show below
                top = rect.bottom + 8;
                tooltipEl.classList.add('tooltip-bottom');
            }

            tooltipEl.style.top = `${top}px`;
            tooltipEl.style.left = `${left}px`;
            
            // Show
            requestAnimationFrame(() => {
                tooltipEl.classList.add('visible');
            });
        };

        window.hidePriorityTooltip = () => {
            if (tooltipEl) {
                tooltipEl.classList.remove('visible');
                // Optional: remove from DOM after transition, but hiding is enough for perf
            }
        };
        // --- End Global Tooltip Logic ---

        window.toggleTableMenu = function(triggerEl) {
            // helper: restore floating menu to original parent
            const restoreMenu = (m) => {
                if (m.__parent) {
                    m.style.position = '';
                    m.style.left = '';
                    m.style.top = '';
                    m.style.zIndex = '';
                    m.__parent.appendChild(m);
                    m.__parent = null;
                }
            };

            // 1. Try to find menu in parent (closed state)
            let menu = triggerEl.parentElement.querySelector('.table-menu-dropdown');
            
            // 2. If not found, try to find in body (opened state)
            if (!menu) {
                const openedMenus = document.querySelectorAll('body > .table-menu-dropdown');
                for (let m of openedMenus) {
                    if (m.__parent === triggerEl.parentElement) {
                        menu = m;
                        break;
                    }
                }
            }

            if (!menu) return;

            // Check if THIS menu is already open (if it's in body, it's open)
            // Or if it doesn't have 'hidden' class (though floating ones might have hidden removed)
            const isAlreadyOpen = !menu.classList.contains('hidden');

            // Close ALL menus first (including this one if it's open)
            document.querySelectorAll('.table-menu-dropdown').forEach(el => {
                if (!el.classList.contains('hidden')) {
                    el.classList.add('hidden');
                    el.parentElement.classList.remove('z-[100]');
                    restoreMenu(el);
                }
            });
            
            // Expose helper to close all menus (for actions)
            window.closeAllTableMenus = () => {
                document.querySelectorAll('.table-menu-dropdown').forEach(el => {
                    if (!el.classList.contains('hidden')) {
                        el.classList.add('hidden');
                        el.parentElement.classList.remove('z-[100]');
                        restoreMenu(el);
                    }
                });
            };

            // If it was already open, we just closed it above, so we are done (toggle off behavior).
            // If it was closed, we open it now.
            if (!isAlreadyOpen) {
                // Open current
                menu.classList.remove('hidden');
                const parent = triggerEl.parentElement;

                // always ensure topmost by floating to body with fixed position
                menu.__parent = parent;
                document.body.appendChild(menu);
                const triggerRect = triggerEl.getBoundingClientRect();
                const container = triggerEl.closest('.overflow-auto');
                // measure height after moving
                const menuHeight = menu.offsetHeight || 0;
                let top = triggerRect.bottom + 4;
                if (container) {
                    const cr = container.getBoundingClientRect();
                    if (top + menuHeight > cr.bottom - 5) {
                        top = triggerRect.top - menuHeight - 4;
                    }
                } else {
                    if (top + menuHeight > window.innerHeight - 5) {
                        top = triggerRect.top - menuHeight - 4;
                    }
                }
                menu.style.position = 'fixed';
                menu.style.left = `${triggerRect.left}px`;
                menu.style.top = `${top}px`;
                menu.style.zIndex = '9999';
            }
        };

        // Close menus when clicking outside
        // Modification: We now close menus on ANY click that isn't inside a menu.
        // The trigger click is handled by stopPropagation in the HTML onclick, 
        // BUT to support "click trigger to close", we need the toggle logic above to handle the "already open" case.
        document.addEventListener('click', (e) => {
             // If click is inside a floating menu, do nothing (let menu item click handle it)
             if (e.target.closest('.table-menu-dropdown')) return;
             
             // Otherwise close all menus
             if (window.closeAllTableMenus) window.closeAllTableMenus();
        });
    }

    nodes.forEach((task, index) => {
        const isLastChild = index === nodes.length - 1;
        const isSelected = store.selectedTaskIds.has(task.id);
        const pBadgeConfig = getPriorityBadgeConfig(task.priority);
        const pConfig = getPriorityConfig(task.priority); // Keep for Kanban
        const sConfig = getStatusConfig(task.status);
        const aConfig = getActionTypeConfig(task.actionType || 'NEXT');
        const isDone = task.status === 'done';
        const isFrog = task.isFrog;
        
        // 状态背景色逻辑
        let rowBgClass = '';
        if (isSelected) rowBgClass = 'bg-blue-50';
        else if (task.status === 'done') rowBgClass = 'bg-gray-100/80 grayscale'; // 已完成：更深的灰，去色
        else if (task.status === 'cancelled') rowBgClass = 'bg-gray-100 opacity-60 line-through-gray'; // 已取消
        else if (isFrog) rowBgClass = 'task-frog-bg'; // 青蛙：新拟态渐变背景

        // 标题颜色逻辑
        let titleColorClass = 'text-gray-900 font-bold'; // 默认加粗
        if (task.priority === 'urgent') titleColorClass = 'text-red-700 font-bold';
        else if (task.priority === 'high') titleColorClass = 'text-yellow-700 font-bold';
        else if (task.priority === 'medium') titleColorClass = 'text-blue-700 font-bold';
        else if (task.priority === 'low') titleColorClass = 'text-green-700 font-bold';
        
        // 缩进计算 (每层 24px -> 32px 增加层次感)
        const indentStyle = `padding-left: ${level * 32}px`;
        
        // 树形连线 HTML (增强版)
        const treeConnector = level > 0 ? `
            <div class="absolute left-[-20px] top-0 bottom-0 w-6 flex items-center justify-center ${isLastChild ? 'is-last-child' : ''}">
                 <div class="h-full w-px bg-gray-200 group-hover:bg-gray-300"></div> <!-- 竖线 -->
                 <div class="absolute left-1/2 top-1/2 w-4 h-px bg-gray-200 group-hover:bg-gray-300"></div> <!-- 横线 -->
            </div>
        ` : '';

        // 折叠图标 (增强版)
        const hasChildren = task.children && task.children.length > 0;
        const toggleIcon = hasChildren 
            ? `<button onclick="event.stopPropagation(); window.toggleCollapse('${task.id}')" class="mr-2 text-gray-400 hover:text-blue-500 z-10 relative transition-transform ${task.collapsed ? '-rotate-90' : 'rotate-0'}"><i class="ri-arrow-down-s-fill text-lg"></i></button>`
            : `<span class="w-6 mr-2 inline-block flex justify-center"><i class="ri-checkbox-blank-circle-fill text-[4px] text-gray-300"></i></span>`; // 叶子节点显示小点

        html += `
            <tr class="group transition-colors ${rowBgClass}"
                draggable="true"
                ondragstart="window.handleDragStart(event, '${task.id}')"
                ondragover="window.handleDragOver(event, '${task.id}')"
                ondragleave="window.handleDragLeave(event, '${task.id}')"
                ondrop="window.handleDrop(event, '${task.id}')"
                ondragend="window.handleDragEnd(event)">
                <!-- 1. 选择列 -->
                <td class="w-10 text-center">
                    <input type="checkbox" 
                        onchange="window.toggleSelection('${task.id}')" 
                        ${isSelected ? 'checked' : ''}
                        class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-1">
                </td>

                <!-- 2. 青蛙列 (新增) -->
                <td class="w-12 text-center">
                    <button onclick="event.stopPropagation(); window.toggleFrog('${task.id}')" 
                        class="text-lg transition hover:scale-110 ${isFrog ? 'opacity-100' : 'opacity-20 grayscale hover:opacity-50'}">
                        🐸
                    </button>
                </td>

                <!-- 3. 行动项 (新位置) -->
                <td class="w-20 text-center">
                    <div class="relative group/action flex justify-center z-20 hover:z-50">
                        <span onclick="event.stopPropagation(); window.toggleTableMenu(this)" 
                            class="px-1.5 py-0.5 rounded text-xs scale-90 border cursor-pointer select-none whitespace-nowrap ${aConfig.class}">
                            ${aConfig.label}
                        </span>
                        <!-- 简易下拉菜单 -->
                        <div class="hidden table-menu-dropdown absolute left-0 top-full mt-1 w-24 bg-white shadow-lg rounded border z-50 text-left py-1">
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-green-600" onclick="window.updateActionType('${task.id}', 'NEXT')">下一步</div>
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-red-600" onclick="window.updateActionType('${task.id}', 'WAITING')">等待</div>
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-gray-600" onclick="window.updateActionType('${task.id}', 'SOMEDAY')">将来</div>
                        </div>
                    </div>
                </td>

                <!-- 4. 任务详情 (核心列) -->
                <td class="min-w-[300px] border-r border-transparent group-hover:border-gray-100 transition relative overflow-hidden">
                    ${isFrog ? '<div class="task-frog-watermark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg></div>' : ''}
                    <div style="${indentStyle}" class="relative z-10">
                        ${treeConnector}
                        <div class="flex items-start table-tree-node py-2">
                            ${toggleIcon}
                            <div class="flex-1 cursor-pointer" onclick="window.triggerEdit('${task.id}')">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-xs font-mono text-gray-400 select-none">#${task.shortId}</span>
                                    <span class="font-medium ${isDone ? 'line-through text-gray-400' : titleColorClass} ${isFrog ? 'font-bold' : ''}">${escapeHtml(task.title)}</span>
                                    ${task.category ? `<span class="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">#${escapeHtml(task.category)}</span>` : ''}
                                    ${(task.tags || []).map(tag => `<span class="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">@${escapeHtml(tag)}</span>`).join('')}
                                    ${(task.assignees || []).map(p => `<span class="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i class="ri-user-line"></i>${escapeHtml(p)}</span>`).join('')}
                                </div>
                                <div class="flex gap-3 mt-1 items-center">
                                    ${task.description ? `<p class="text-xs text-gray-500 flex-1" title="${escapeHtml(task.description)}">${escapeHtml(task.description.length > 20 ? task.description.substring(0, 20) + '...' : task.description)}</p>` : ''}
                                </div>
                                
                                ${(task.relations && task.relations.length > 0) ? `
                                    <div class="flex gap-2 mt-1">
                                        ${task.relations.map(r => {
                                            const icon = r.type === 'depends_on' ? 'ri-lock-2-line' : 'ri-links-line';
                                            return `<span class="text-[10px] text-gray-400 flex items-center gap-0.5"><i class="${icon}"></i>#${r.targetShortId || '?'}</span>`;
                                        }).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </td>

                <!-- 5. 优先级 (Badge) -->
                <td class="w-24 text-center">
                     <div class="relative group/priority flex justify-center z-20 hover:z-50">
                        <span onclick="event.stopPropagation(); window.toggleTableMenu(this)" 
                             onmouseenter="window.showPriorityTooltip(this, '${task.priority}')"
                             onmouseleave="window.hidePriorityTooltip()"
                             class="${pBadgeConfig.class} cursor-pointer select-none whitespace-nowrap scale-90 text-xs">
                             <i class="${pBadgeConfig.icon} text-sm"></i>
                             <span class="ml-1">${pBadgeConfig.label}</span>
                        </span>
                        
                        <!-- 优先级下拉菜单 -->
                        <div class="hidden table-menu-dropdown absolute left-0 top-full mt-1 w-28 bg-white shadow-lg rounded border z-50 text-left py-1">
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-red-600" onclick="window.updatePriority('${task.id}', 'urgent'); if(window.closeAllTableMenus) window.closeAllTableMenus()">重要且紧急</div>
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-orange-600" onclick="window.updatePriority('${task.id}', 'high'); if(window.closeAllTableMenus) window.closeAllTableMenus()">重要不紧急</div>
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-blue-600" onclick="window.updatePriority('${task.id}', 'medium'); if(window.closeAllTableMenus) window.closeAllTableMenus()">不重要紧急</div>
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-green-600" onclick="window.updatePriority('${task.id}', 'low'); if(window.closeAllTableMenus) window.closeAllTableMenus()">不重要不紧急</div>
                        </div>
                    </div>
                </td>

                <!-- 创建/完成时间 (修改列) -->
                <td class="w-32 whitespace-nowrap text-center">
                    ${formatTimeColumn(task)}
                </td>

                <!-- 6. 截止时间 (含开始时间) -->
                <td class="w-32 whitespace-nowrap editable-cell text-center" onclick="event.stopPropagation(); window.editTaskField('${task.id}', 'dueDate', event)">
                     ${formatSmartDate(task.dueDate, true, isDone)}
                </td>

                <!-- 7. 状态 -->
                <td class="w-24 text-center whitespace-nowrap">
                    <div class="relative group/status flex justify-center z-20 hover:z-50">
                        <span onclick="event.stopPropagation(); window.toggleTableMenu(this)" 
                            class="px-1.5 py-0.5 rounded text-xs scale-90 border cursor-pointer select-none whitespace-nowrap ${sConfig.class}">
                            ${sConfig.label}
                        </span>
                        <!-- 状态下拉菜单 -->
                        <div class="hidden table-menu-dropdown absolute left-0 top-full mt-1 w-24 bg-white shadow-lg rounded border z-50 text-left py-1">
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-gray-600" onclick="window.saveTaskField('${task.id}', 'status', 'pending')">待开始</div>
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-blue-600" onclick="window.saveTaskField('${task.id}', 'status', 'active')">进行中</div>
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-green-600" onclick="window.saveTaskField('${task.id}', 'status', 'done')">已完成</div>
                            <div class="px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs text-red-600" onclick="window.saveTaskField('${task.id}', 'status', 'cancelled')">已取消</div>
                        </div>
                    </div>
                </td>

                <!-- 8. 操作 -->
                <td class="w-24 text-center">
                    <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition">
                         <button onclick="event.stopPropagation(); window.toggleTaskComplete('${task.id}')" 
                            class="p-1 rounded hover:bg-gray-100 text-blue-600 transition" title="${isDone ? '重做' : '完成'}">
                            <i class="${isDone ? 'ri-refresh-line' : 'ri-check-line'} text-lg"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.deleteTaskAndClose('${task.id}')" 
                            class="p-1 rounded hover:bg-gray-100 text-red-500 transition" title="删除">
                            <i class="ri-delete-bin-line text-lg"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;

        // 递归渲染子任务
        if (hasChildren && !task.collapsed) {
            html += renderTableRows(task.children, level + 1, isLastChild);
        }
    });
    
    return html;
}

export const render = {
    list() {
        const tasks = getFilteredTasks();
        // 1. 新增：计算是否已全选 (用于控制复选框的 checked 属性)
        const isAllSelected = tasks.length > 0 && tasks.every(t => store.selectedTaskIds.has(t.id));
        // 分页逻辑
        const { page, pageSize } = store.pagination.list;
        // 修正：对于列表视图，分页应该基于顶层任务（树根），否则会打断父子关系
        // 1. 先构建完整的树
        const fullTreeRoots = buildTaskTree(tasks);
        
        // 2. 基于树根进行分页
        // totalItems 应该展示筛选出的实际任务总数 (包括子任务)，但分页计算基于 root 数量
        const totalItems = tasks.length; 
        const totalRootItems = fullTreeRoots.length;
        
        const totalPages = Math.ceil(totalRootItems / pageSize) || 1;
        const currentPage = Math.min(page, totalPages);
        
        const startIdx = (currentPage - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pagedTreeRoots = fullTreeRoots.slice(startIdx, endIdx);
        
        return `
            <div class="task-table-container flex-1 flex flex-col">
                <div class="flex-1 overflow-auto">
                    <table class="w-full task-table border-collapse">
                        <thead>
                            <tr>
                                <th class="w-10 text-center">
                                    <input type="checkbox" id="select-all-checkbox-table" 
                                        onchange="window.toggleSelectAll(this.checked)"
                                        ${isAllSelected ? 'checked' : ''}
                                        class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
                                </th>
                                <th class="w-12 text-center text-gray-500 font-bold">青蛙</th>
                                <th class="w-20 text-center text-gray-500 font-bold">行动</th>
                                
                                <th class="text-gray-500 font-bold">任务详情</th>
                                <th class="w-24 text-center cursor-pointer select-none" onclick="window.toggleSort('priority')">
                                    <div class="flex items-center justify-center gap-1 text-gray-500 font-bold">
                                        优先级 ${store.sortState.find(s=>s.field==='priority') ? (store.sortState.find(s=>s.field==='priority').direction==='asc'?'<i class="ri-arrow-up-line text-blue-600 text-xs"></i>':'<i class="ri-arrow-down-line text-blue-600 text-xs"></i>') : '<i class="ri-expand-up-down-fill text-gray-300 text-xs"></i>'}
                                    </div>
                                </th>
                                
                                <th class="w-32 text-center text-gray-500 font-bold">创建/完成时间</th>
                                ${renderSortHeader('dueDate', '截止时间')}
                                
                                ${renderStatusHeader()}
                                <th class="text-center w-24 text-gray-500 font-bold">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pagedTreeRoots.length === 0 ? '<tr><td colspan="10" class="text-center text-gray-400 py-8">列表为空</td></tr>' : renderTableRows(pagedTreeRoots)}
                        </tbody>
                    </table>
                </div>
                
                <!-- 分页控件 -->
                <div class="flex justify-between items-center px-4 py-3 border-t bg-gray-50">
                    <div class="flex items-center gap-4">
                        <div class="text-xs text-gray-500">
                            共 ${totalItems} 项 (其中父任务 ${pagedTreeRoots.length} 个)，第 ${currentPage}/${totalPages} 页
                        </div>
                        <div class="flex items-center gap-2 text-xs text-gray-500">
                            <span>每页:</span>
                            <select onchange="window.changeListPageSize(this.value)" class="border border-gray-200 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-blue-500 cursor-pointer">
                                <option value="5" ${pageSize===5?'selected':''}>5</option>
                                <option value="10" ${pageSize===10?'selected':''}>10</option>
                                <option value="20" ${pageSize===20?'selected':''}>20</option>
                                <option value="50" ${pageSize===50?'selected':''}>50</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button onclick="window.changeListPage(-1)" ${currentPage === 1 ? 'disabled' : ''} class="px-2 py-1 border rounded text-xs hover:bg-white disabled:opacity-50 transition">上一页</button>
                        
                        <!-- 快速页码 (只显示部分) -->
                        <div class="flex gap-1">
                            ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                                // 简单的逻辑：显示前5页，实际应更复杂
                                // 这里做一个简单的滑动窗口：显示当前页附近的页码
                                let p = i + 1;
                                if (totalPages > 5) {
                                    if (currentPage > 3) p = currentPage - 2 + i;
                                    if (p > totalPages) p = totalPages - (4 - i);
                                }
                                if (p < 1) p = 1; // Safety
                                
                                return `<button onclick="window.goToListPage(${p})" class="px-2 py-1 border rounded text-xs transition ${p === currentPage ? 'bg-blue-50 text-blue-600 border-blue-200 font-bold' : 'hover:bg-white text-gray-600'}">${p}</button>`;
                            }).join('')}
                        </div>

                        <button onclick="window.changeListPage(1)" ${currentPage === totalPages ? 'disabled' : ''} class="px-2 py-1 border rounded text-xs hover:bg-white disabled:opacity-50 transition">下一页</button>
                    </div>
                </div>
            </div>
        `;
    },

    kanban() {
        const tasks = getFilteredTasks();
        const columns = [
            { id: 'urgent', title: '🔥重要且紧急', items: [] },
            { id: 'high', title: '🌱重要不紧急', items: [] },
            { id: 'medium', title: '🏃不重要紧急', items: [] },
            { id: 'low', title: '🍵不重要不紧急', items: [] }
        ];

        tasks.forEach(t => {
            const col = columns.find(c => c.id === t.priority);
            if (col) col.items.push(t);
        });

        return `
            <div class="flex gap-4 h-full overflow-x-auto pb-4 px-2">
                ${columns.map(col => `
                    <div class="kanban-col bg-gray-100 rounded-lg p-3 flex flex-col h-full w-full min-w-[280px] flex-1"
                         data-group="${col.id}"
                         ondragover="window.handleKanbanDragOver(event)"
                         ondrop="window.handleKanbanDrop(event)">
                        <h3 class="font-bold text-gray-700 mb-3 flex justify-between">
                            ${col.title} <span class="bg-gray-200 px-2 rounded text-xs py-1">${col.items.length}</span>
                        </h3>
                        <div class="flex-1 overflow-y-auto pr-1 space-y-2">
                            ${col.items.map(t => `
                                <div class="kanban-card bg-white p-3 rounded shadow-sm border-l-4 ${this._getBorderClass(t.priority)} cursor-pointer hover:shadow-md" 
                                     draggable="true"
                                     data-id="${t.id}"
                                     ondragstart="window.handleDragStart(event, '${t.id}')"
                                     ondragend="window.handleDragEnd(event)"
                                     onclick="window.triggerEdit('${t.id}')">
                                    <div class="font-medium text-sm mb-1 pointer-events-none">${escapeHtml(t.title)}</div>
                                    <div class="text-xs text-gray-500 flex justify-between pointer-events-none">
                                        <span>${t.category || ''}</span>
                                        ${t.dueDate ? `<span>${new Date(t.dueDate).toLocaleDateString()}</span>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    quadrant() {
        const tasks = getFilteredTasks();
        const q1 = tasks.filter(t => t.priority === 'urgent');
        const q2 = tasks.filter(t => t.priority === 'high');
        const q3 = tasks.filter(t => t.priority === 'medium');
        const q4 = tasks.filter(t => t.priority === 'low');

        const renderCell = (title, list, colorClass, priorityKey) => {
            const { page, pageSize } = store.pagination.quadrant[priorityKey];
            const totalItems = list.length;
            const totalPages = Math.ceil(totalItems / pageSize) || 1;
            const currentPage = Math.min(page, totalPages);
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            const pagedList = list.slice(start, end);

            return `
            <div class="quadrant-cell ${colorClass} flex flex-col"
                 data-group="${priorityKey}"
                 ondragover="window.handleQuadrantDragOver(event)"
                 ondrop="window.handleQuadrantDrop(event)">
                <h3 class="font-bold mb-2 text-gray-700 border-b pb-2 flex justify-between">
                    ${title} <span class="text-xs bg-white px-2 rounded border">${list.length}</span>
                </h3>
                <div class="overflow-y-auto flex-1 pr-1 space-y-2">
                    ${pagedList.map(t => `
                        <div class="quadrant-card bg-white p-2 rounded border shadow-sm cursor-pointer hover:bg-gray-50" 
                             draggable="true"
                             data-id="${t.id}"
                             ondragstart="window.handleDragStart(event, '${t.id}')"
                             ondragend="window.handleDragEnd(event)"
                             onclick="window.triggerEdit('${t.id}')">
                            <div class="text-sm font-medium pointer-events-none">${escapeHtml(t.title)}</div>
                            ${t.dueDate ? `<div class="text-xs text-gray-400 mt-1 pointer-events-none"><i class="ri-time-line"></i> ${new Date(t.dueDate).toLocaleDateString()}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
                <!-- Mini 分页 -->
                <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-200/50">
                    <span class="text-[10px] text-gray-400">${currentPage}/${totalPages}</span>
                    <div class="flex gap-1">
                        <button onclick="window.changeQuadrantPage('${priorityKey}', -1)" ${currentPage===1?'disabled':''} class="px-1.5 py-0.5 bg-white border rounded text-[10px] hover:bg-gray-50 disabled:opacity-50"><i class="ri-arrow-left-s-line"></i></button>
                        <button onclick="window.changeQuadrantPage('${priorityKey}', 1)" ${currentPage===totalPages?'disabled':''} class="px-1.5 py-0.5 bg-white border rounded text-[10px] hover:bg-gray-50 disabled:opacity-50"><i class="ri-arrow-right-s-line"></i></button>
                    </div>
                </div>
            </div>
            `;
        };

        return `
            <div class="quadrant-grid pb-4">
                ${renderCell('Q1: 重要且紧急 (马上做)', q1, 'border-red-200 bg-red-50', 'urgent')}
                ${renderCell('Q2: 重要不紧急 (计划做)', q2, 'border-orange-200 bg-orange-50', 'high')}
                ${renderCell('Q3: 不重要紧急 (授权做)', q3, 'border-blue-200 bg-blue-50', 'medium')}
                ${renderCell('Q4: 不重要不紧急 (稍后做)', q4, 'border-green-200 bg-green-50', 'low')}
            </div>
        `;
    },

    calendar() {
        const tasks = getFilteredTasks();
        // 筛选逻辑：展示除“不重要不紧急”外的所有任务 (保留青蛙任务)
        const filteredTasks = tasks.filter(t => t.isFrog || t.priority !== 'low');

        const current = store.calendarDate || new Date();
        const year = current.getFullYear();
        const month = current.getMonth();
        
        let headerTitle = '';
        let dateCells = [];
        let colCount = 7;
        let dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

        if (store.calendarView === 'week') {
            // 周视图逻辑
            const currDay = current.getDay(); // 0-6
            const weekStart = new Date(current);
            weekStart.setDate(current.getDate() - currDay);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            headerTitle = `${weekStart.getFullYear()}年${weekStart.getMonth()+1}月${weekStart.getDate()}日 - ${weekEnd.getMonth()+1}月${weekEnd.getDate()}日`;
            
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                dateCells.push({ date: d, isCurrentMonth: true }); // 周视图都是“当前”显示的
            }
        } else {
            // 月视图逻辑
            headerTitle = `${year}年 ${month + 1}月`;
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startDayOfWeek = firstDay.getDay();

            // 补全前面的空白
            for (let i = 0; i < startDayOfWeek; i++) {
                dateCells.push({ date: null });
            }
            // 当月日期
            for (let d = 1; d <= daysInMonth; d++) {
                dateCells.push({ date: new Date(year, month, d), isCurrentMonth: true });
            }
        }

        const renderTaskItem = (t) => {
            const isFrog = t.isFrog;
            let bgClass = '';
            let icon = '';

            if (isFrog) {
                bgClass = 'bg-green-100 text-green-800 border-green-200';
                icon = '🐸';
            } else {
                switch (t.priority) {
                    case 'urgent': // 重要且紧急
                        bgClass = 'bg-red-100 text-red-800 border-red-200';
                        icon = '🔥';
                        break;
                    case 'high': // 重要不紧急
                        bgClass = 'bg-orange-100 text-orange-800 border-orange-200';
                        icon = '🌱';
                        break;
                    case 'medium': // 不重要紧急
                        bgClass = 'bg-blue-100 text-blue-800 border-blue-200';
                        icon = '🏃';
                        break;
                    case 'low': // 不重要不紧急
                        bgClass = 'bg-gray-100 text-gray-800 border-gray-200';
                        icon = '🍵';
                        break;
                    default:
                        bgClass = 'bg-gray-100 text-gray-800 border-gray-200';
                        icon = '📝';
                }
            }
            
            // 已完成样式叠加
            if (t.status === 'done') {
                bgClass += ' opacity-50 line-through grayscale';
            }

            return `
                <div class="text-[10px] px-1.5 py-0.5 rounded border mb-1 cursor-pointer truncate ${bgClass} hover:opacity-80 transition"
                     onclick="event.stopPropagation(); window.triggerEdit('${t.id}')"
                     title="${escapeHtml(t.title)}">
                    <span class="mr-0.5">${icon}</span>${escapeHtml(t.title)}
                </div>
            `;
        };

        return `
            <div class="h-full flex flex-col bg-white rounded-lg shadow overflow-hidden">
                <!-- 头部控制栏 -->
                <div class="p-3 border-b flex justify-between items-center bg-gray-50">
                    <div class="flex items-center gap-2">
                         <div class="flex bg-white rounded border overflow-hidden p-0.5 text-xs">
                            <button onclick="window.setCalendarView('month')" class="px-2 py-1 rounded ${store.calendarView==='month' ? 'bg-blue-100 text-blue-600 font-bold' : 'hover:bg-gray-100'}">月</button>
                            <button onclick="window.setCalendarView('week')" class="px-2 py-1 rounded ${store.calendarView==='week' ? 'bg-blue-100 text-blue-600 font-bold' : 'hover:bg-gray-100'}">周</button>
                        </div>
                        <div class="font-bold text-gray-700 text-sm ml-2">${headerTitle}</div>
                    </div>
                    <div class="flex items-center gap-1 text-xs">
                        <button onclick="window.moveCalendar(-1)" class="p-1 hover:bg-white rounded border"><i class="ri-arrow-left-s-line"></i></button>
                        <button onclick="window.resetCalendar()" class="px-2 py-1 hover:bg-white rounded border">今天</button>
                        <button onclick="window.moveCalendar(1)" class="p-1 hover:bg-white rounded border"><i class="ri-arrow-right-s-line"></i></button>
                    </div>
                </div>

                <!-- 星期表头 -->
                <div class="grid grid-cols-7 border-b bg-gray-50">
                    ${dayHeaders.map(h => `<div class="text-center text-xs text-gray-500 py-1 font-medium">${h}</div>`).join('')}
                </div>

                <!-- 日历网格 -->
                <div class="flex-1 overflow-y-auto bg-gray-100 p-1">
                    <div class="grid grid-cols-7 gap-1 min-h-full auto-rows-fr">
                        ${dateCells.map(cell => {
                            if (!cell.date) return `<div class="bg-transparent"></div>`;
                            
                            const dStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`;
                            const isToday = new Date().toDateString() === cell.date.toDateString();
                            
                            // 修正：使用东八区时间进行匹配
                            const dayTasks = filteredTasks.filter(t => {
                                if (!t.dueDate) return false;
                                const d = new Date(t.dueDate);
                                // 转换为东八区时间对象
                                const sd = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
                                const tStr = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
                                return tStr === dStr;
                            });
                            
                            return `
                                <div class="bg-white rounded shadow-sm p-1 flex flex-col min-h-[100px] ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}">
                                    <div class="text-xs text-gray-400 mb-1 flex justify-between">
                                        <span class="${isToday ? 'text-blue-600 font-bold' : ''}">${cell.date.getDate()}</span>
                                        <span class="text-[10px] bg-gray-100 px-1 rounded text-gray-400">${dayTasks.length}</span>
                                    </div>
                                    <div class="space-y-0.5 overflow-y-auto flex-1 custom-scrollbar">
                                        ${dayTasks.map(renderTaskItem).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    _getBorderClass(priority) {
        const map = { urgent: 'border-l-red-500', high: 'border-l-orange-500', medium: 'border-l-yellow-500', low: 'border-l-green-500' };
        return map[priority] || 'border-l-gray-300';
    }
};
