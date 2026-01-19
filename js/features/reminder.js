import { store } from '../store.js';
import { escapeHtml, sendNotification } from '../utils.js';

let reminderInterval = null;

export function initReminderCheck() {
    if ("Notification" in window && Notification.permission === "default") {
        // Passive check
    }

    if (reminderInterval) clearInterval(reminderInterval);
    reminderInterval = setInterval(checkReminders, 10000);
    checkReminders();
}

function checkReminders() {
    const now = new Date();
    const pendingReminders = store.tasks.filter(t => {
        if (!t.reminderTime) return false;
        if (t.status === 'done' || t.status === 'cancelled') return false;
        if (t.reminderDismissed) return false;
        
        const reminderTime = new Date(t.reminderTime);
        return now >= reminderTime;
    });

    if (pendingReminders.length > 0) {
        showReminderModal(pendingReminders);
        pendingReminders.forEach(t => {
             sendNotification('任务提醒', t.title);
        });
    } else {
        closeReminderModal();
    }
}

function calculateSnoozeTime(type) {
    const now = new Date();
    if (type === 'tomorrow') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const timeStr = store.config.snoozeTomorrowTime || '09:00';
        return new Date(`${y}-${m}-${day}T${timeStr}:00+08:00`);
    } else {
        const minutes = parseInt(type);
        return new Date(now.getTime() + minutes * 60000);
    }
}

function showReminderModal(tasks) {
    let wrapper = document.getElementById('reminder-modal-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'reminder-modal-wrapper';
        document.body.appendChild(wrapper);
    }
    
    // Generate options dynamically
    const presets = store.config.snoozePresets || [5, 15, 30, 60, 180];
    const tomorrowTime = store.config.snoozeTomorrowTime || '09:00';
    
    const optionsHtml = presets.map(min => {
        let label = min + ' 分钟后';
        if (min >= 60) {
            const h = Math.floor(min / 60);
            const m = min % 60;
            label = h + ' 小时' + (m > 0 ? m + ' 分钟' : '') + '后';
        }
        return `<option value="${min}">${label}</option>`;
    }).join('');
    
    const tomorrowOption = `<option value="tomorrow">明天 ${tomorrowTime}</option>`;
    const allOptions = `<option value="" disabled selected>稍后提醒...</option>` + optionsHtml + tomorrowOption;
    const allOptionsForBatch = `<option value="" disabled selected>全部稍后提醒...</option>` + optionsHtml + tomorrowOption;

    const listHtml = tasks.map(t => `
        <div class="group p-4 bg-white rounded-xl border border-gray-100 shadow-sm mb-3 hover:shadow-md transition-all hover:border-blue-100">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex-1">
                    <div class="font-bold text-gray-800 flex items-center gap-2 text-base">
                        <span class="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">#${t.shortId}</span>
                        <span class="line-clamp-1">${escapeHtml(t.title)}</span>
                    </div>
                    <div class="text-xs text-red-500 mt-1.5 flex items-center gap-1.5 font-medium bg-red-50 inline-flex px-2 py-0.5 rounded-full">
                        <i class="ri-alarm-warning-line"></i> 
                        ${new Date(t.reminderTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                    </div>
                </div>
            </div>
            
            <div class="flex items-center gap-3 pt-3 border-t border-gray-50">
                <div class="flex-1 relative group/select">
                    <div class="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 rounded-lg px-2 py-1.5 border border-gray-200 transition-colors cursor-pointer">
                        <i class="ri-zzz-line text-blue-500"></i>
                        <select onchange="window.snoozeReminder('${t.id}', this.value)" class="w-full bg-transparent border-none text-sm text-gray-600 focus:ring-0 cursor-pointer py-0 pl-0 appearance-none">
                            ${allOptions}
                        </select>
                        <i class="ri-arrow-down-s-line text-gray-400 text-xs pointer-events-none absolute right-2"></i>
                    </div>
                </div>
                <button onclick="window.dismissReminder('${t.id}')" class="px-4 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-800 text-sm transition font-medium whitespace-nowrap flex items-center gap-1 shadow-sm">
                    <i class="ri-check-line"></i> 知道了
                </button>
            </div>
        </div>
    `).join('');
    
    wrapper.innerHTML = `
        <div id="reminder-modal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] fade-in backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl transform transition-all scale-100 max-h-[90vh] flex flex-col border border-white/20">
                <!-- Header -->
                <div class="p-6 pb-4 flex items-center gap-4 border-b border-gray-50">
                    <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-200 flex-shrink-0">
                        <i class="ri-notification-3-fill text-2xl"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-gray-800 tracking-tight">任务提醒</h3>
                        <p class="text-sm text-gray-500 mt-0.5">你有 <span class="font-bold text-red-500">${tasks.length}</span> 个任务到达提醒时间</p>
                    </div>
                </div>
                
                <!-- List -->
                <div class="overflow-y-auto custom-scrollbar p-4 bg-gray-50/50 flex-1 min-h-[100px]">
                    ${listHtml}
                </div>
                
                <!-- Footer -->
                <div class="p-4 border-t border-gray-100 bg-white rounded-b-2xl flex items-center justify-between gap-3">
                     <div class="relative flex-1">
                        <div class="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2.5 transition-colors cursor-pointer group">
                            <i class="ri-timer-flash-line text-gray-500 group-hover:text-gray-700"></i>
                            <select onchange="window.snoozeAllReminders(this.value)" class="w-full bg-transparent border-none text-sm text-gray-600 font-medium focus:ring-0 cursor-pointer py-0 pl-0 appearance-none">
                                ${allOptionsForBatch}
                            </select>
                            <i class="ri-arrow-up-s-line text-gray-400 text-xs pointer-events-none absolute right-3"></i>
                        </div>
                    </div>

                    <button onclick="window.dismissAllReminders()" class="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition shadow-lg shadow-gray-200 flex items-center justify-center gap-2 font-medium">
                        <i class="ri-check-double-line"></i> 全部忽略
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Bind handlers
    window.dismissReminder = (id) => {
        store.updateTask(id, { reminderDismissed: true });
        checkReminders();
    };
    
    window.snoozeReminder = (id, type) => {
        if (!type) return;
        const newTime = calculateSnoozeTime(type);
        store.updateTask(id, { 
            reminderTime: newTime.toISOString(),
            reminderDismissed: false 
        });
        checkReminders();
    };

    window.snoozeAllReminders = (type) => {
        if (!type) return;
        const newTime = calculateSnoozeTime(type);
        const timeStr = newTime.toISOString();
        
        tasks.forEach(t => {
            store.updateTask(t.id, { 
                reminderTime: timeStr,
                reminderDismissed: false 
            });
        });
        checkReminders();
    };
    
    window.dismissAllReminders = () => {
        tasks.forEach(t => {
            store.updateTask(t.id, { reminderDismissed: true });
        });
        checkReminders();
    };
}

function closeReminderModal() {
    const wrapper = document.getElementById('reminder-modal-wrapper');
    if (wrapper) {
        wrapper.remove();
        delete window.dismissReminder;
        delete window.dismissAllReminders;
        delete window.snoozeReminder;
        delete window.snoozeAllReminders;
    }
}
