
// 1. 初始化 Tag Input 组件
// 需要在全局作用域可访问，以便在 modal 中使用
window.initTagInput = function(containerId, initialTags, onChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let tags = [...initialTags];

    // 清空现有内容并创建基本结构
    container.innerHTML = `
        <div class="flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-lg bg-white min-h-[38px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all cursor-text" onclick="this.querySelector('input').focus()">
            <div id="${containerId}-list" class="flex flex-wrap gap-2"></div>
            <input type="text" id="${containerId}-input" class="flex-1 min-w-[60px] text-sm outline-none border-none p-0 bg-transparent placeholder-gray-400" placeholder="输入并回车...">
        </div>
    `;

    const listEl = document.getElementById(`${containerId}-list`);
    const inputEl = document.getElementById(`${containerId}-input`);

    // 渲染标签函数
    const renderTags = () => {
        listEl.innerHTML = tags.map((tag, index) => `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 group animate-in fade-in zoom-in duration-200">
                ${tag}
                <button type="button" data-index="${index}" class="text-blue-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-colors focus:outline-none">
                    <i class="ri-close-line"></i>
                </button>
            </span>
        `).join('');
        
        // 绑定删除事件
        listEl.querySelectorAll('button').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                tags.splice(idx, 1);
                renderTags();
                onChangeCallback(tags);
            };
        });
    };

    // 处理输入事件
    inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = inputEl.value.trim();
            if (val && !tags.includes(val)) {
                tags.push(val);
                renderTags();
                onChangeCallback(tags);
                inputEl.value = '';
            } else if (tags.includes(val)) {
                // 提示重复? 简单闪烁一下
                inputEl.classList.add('text-red-500');
                setTimeout(() => inputEl.classList.remove('text-red-500'), 300);
            }
        } else if (e.key === 'Backspace' && !inputEl.value && tags.length > 0) {
            // 删除最后一个
            tags.pop();
            renderTags();
            onChangeCallback(tags);
        }
    };
    
    // 失去焦点时也尝试添加
    inputEl.onblur = () => {
        const val = inputEl.value.trim();
        if (val && !tags.includes(val)) {
            tags.push(val);
            renderTags();
            onChangeCallback(tags);
            inputEl.value = '';
        }
        inputEl.value = ''; // Clear if duplicate or empty
    };

    // 初始渲染
    renderTags();
};

// 导出供 module 使用 (如果需要)
// export { initTagInput };
