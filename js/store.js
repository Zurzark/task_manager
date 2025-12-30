// js/store.js

const DEFAULT_PROMPT = `你是一个专业的智能任务管理助手。

# Context
- **当前时间**: {current_datetime}
- **已有任务上下文** (格式 #ID):
{referenced_tasks}

# 核心规则 (Critical Rules)

## 1. ID 分配机制 (ID Allocation) - 最重要！
为了区分"引用已有任务"和"创建新任务"，请严格遵守以下 ID 规则：
- **引用已有任务**: 使用上下文中提供的 **正数 ID** (如 12, 45)。
- **创建新任务**: 必须使用 **负数 ID** 作为临时标识，从 -1 开始递减 (如 -1, -2, -3...)。
- **禁止**为新任务编造正数 ID。

## 2. 任务关系 (Relationships)
- **parentShortId / targetShortId**: 
  - 如果指向已有任务 -> 填正数 ID。
  - 如果指向本次拆解的其他新任务 -> 填对应的负数 ID。

## 3. 字段要求
- **title**: 简短精炼。
- **priority**: urgent, high, medium, low (基于四象限判断)。
- **category**: 工作, 生活, 学习, 其他。
- **is_frog**: boolean (true/false). 是否为"青蛙任务" (最困难/最重要的任务).
- **action_type**: 'NEXT', 'SOMEDAY', 'WAITING'. 默认 NEXT.

# Output Format
只返回 JSON 数组，不要 Markdown。

## JSON 结构示例
[
  {
    "shortId": -1,  // 新任务用负数
    "title": "新任务A",
    "is_frog": true,
    "action_type": "NEXT",
    "parentShortId": 12, // 归属于已有的 #12 任务
    "relations": []
  },
  {
    "shortId": -2, // 新任务用负数
    "title": "新任务B",
    "parentShortId": -1, // 归属于本次新建的 A 任务
    "relations": [{ "type": "depends_on", "targetShortId": -1 }] // 依赖 A
  }
]`;

const DEFAULT_CONFIG = {
    apis: [
        { 
            id: 'default', 
            name: 'Default API', 
            url: 'https://api.openai.com/v1/chat/completions', 
            key: '', 
            model: 'gpt-3.5-turbo',
            temperature: 0.3,
            costInput: 5.0, 
            costOutput: 15.0 
        }
    ],
    activeApiId: 'default',
    prompt: DEFAULT_PROMPT,
    nextShortId: 1 // 新增：用于 ShortId 自增
};

export const store = {
    tasks: [],
    apiLogs: [],
    config: { ...DEFAULT_CONFIG },
    viewFilter: 'today',
    categoryFilter: null,
    frogFilter: false, // 新增：青蛙筛选
    actionTypeFilter: 'all', // 新增：行动项筛选
    dateRangeFilter: null, // 新增：日期范围筛选 { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
    createdAtRangeFilter: null, // 新增：创建时间筛选 { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
    currentViewMode: 'list',
    selectedTaskIds: new Set(),
    sortState: [{ field: 'priority', direction: 'desc' }],
    statusFilter: [], // 改为数组，支持多选. 空数组表示全部
    
    // 分页状态
    pagination: {
        list: { page: 1, pageSize: 10 },
        quadrant: {
            urgent: { page: 1, pageSize: 5 },
            high: { page: 1, pageSize: 5 },
            medium: { page: 1, pageSize: 5 },
            low: { page: 1, pageSize: 5 }
        }
    },

    // 新增内部辅助方法：重新计算 NextShortId
    _recalcNextShortId() {
        if (this.tasks.length === 0) {
            this.config.nextShortId = 1;
        } else {
            // 找到当前最大的 shortId
            const maxId = this.tasks.reduce((max, t) => Math.max(max, t.shortId || 0), 0);
            this.config.nextShortId = maxId + 1;
        }
        this.saveConfig();
    },
    
    init() {
        this.loadConfig();
        this.loadData();
        if (!Array.isArray(this.sortState)) {
            this.sortState = [{ field: 'priority', direction: 'desc' }];
        }
    },

    loadData() {
        const savedTasks = localStorage.getItem('tasks_v3');
        if (savedTasks) {
            this.tasks = JSON.parse(savedTasks);
            this.migrateData();
        }
        const savedLogs = localStorage.getItem('api_logs_v3');
        if (savedLogs) this.apiLogs = JSON.parse(savedLogs);
    },

    migrateData() {
        let maxShortId = 0;
        let hasChanges = false;

        this.tasks.forEach(t => {
            if (t.completed !== undefined) {
                t.status = t.completed ? 'done' : 'pending';
                delete t.completed;
                hasChanges = true;
            } else if (!t.status) {
                t.status = 'pending';
                hasChanges = true;
            }

            if (!t.shortId) {
                t.shortId = this.config.nextShortId++;
                hasChanges = true;
            }
            if (t.shortId > maxShortId) maxShortId = t.shortId;

            if (!t.urgency) { t.urgency = 2; t.importance = 2; hasChanges = true; }
            
            // 修复旧数据结构
            t.tags = t.tags || [];
            t.collapsed = t.collapsed || false;
            t.order = t.order || 0;
        });

        if (maxShortId >= this.config.nextShortId) {
            this.config.nextShortId = maxShortId + 1;
            this.saveConfig();
        }

        if (hasChanges) this.saveData();
    },

    saveData() { localStorage.setItem('tasks_v3', JSON.stringify(this.tasks)); },
    saveLogs() { localStorage.setItem('api_logs_v3', JSON.stringify(this.apiLogs)); },
    
    loadConfig() {
        const saved = localStorage.getItem('config_v3');
        if (saved) {
            const savedConfig = JSON.parse(saved);
            this.config = { ...this.config, ...savedConfig };
            if (!this.config.nextShortId) this.config.nextShortId = 1;
            
            // 强制更新 Prompt 到最新版本 (包含负数ID规则)
            if (!this.config.prompt.includes('负数 ID')) {
                this.config.prompt = DEFAULT_PROMPT;
            }
        }
    },
    
    saveConfig() { localStorage.setItem('config_v3', JSON.stringify(this.config)); },
    getActiveApi() { return this.config.apis.find(api => api.id === this.config.activeApiId) || this.config.apis[0]; },

    // 修改：addTask 强制由系统分配 ID，忽略传入的 shortId (除非是导入模式)
    addTask(taskData, isImport = false) {
        let finalShortId;

        // 只有在明确是导入且 ID 为正数时，才允许覆盖系统 ID
        // AI 解析传入的 shortId 是负数，所以会走 else 分支 -> 分配新 ID
        if (isImport && taskData.shortId && taskData.shortId > 0) {
            finalShortId = taskData.shortId;
            if (finalShortId >= this.config.nextShortId) {
                this.config.nextShortId = finalShortId + 1;
            }
        } else {
            // 正常创建 / AI 解析入库
            finalShortId = this.config.nextShortId++;
        }

        const newTask = {
            ...taskData,
            // 确保使用传入的 UUID (如果 main.js 生成了)，否则生成新的
            // 注意：这里不引用 utils.js 的 generateId 以免循环依赖，
            // 依赖 main.js 传入 id，或者在这里简单生成
            id: taskData.id || ('t_' + Date.now() + Math.random()), 
            shortId: finalShortId,
            status: taskData.status || 'pending',
            urgency: taskData.urgency || 2,
            importance: taskData.importance || 2,
            isFrog: taskData.isFrog !== undefined ? taskData.isFrog : false,
            actionType: taskData.actionType || 'NEXT',
            tags: taskData.tags || [],
            relations: taskData.relations || [],
            collapsed: false,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.tasks.push(newTask);
        this.saveData();
        this.saveConfig();
        return newTask;
    },

    updateTask(id, updates) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            const oldTask = this.tasks[index];
            const updatedTask = { ...oldTask, ...updates, updatedAt: new Date().toISOString() };
            
            if (updatedTask.status === 'done' && oldTask.status !== 'done') {
                updatedTask.completedAt = new Date().toISOString();
            } else if (updatedTask.status !== 'done') {
                updatedTask.completedAt = null;
            }

            // 兼容旧视图
            if (updates.urgency || updates.importance) {
                const u = updatedTask.urgency;
                const i = updatedTask.importance;
                if (u >= 4 && i >= 4) updatedTask.priority = 'urgent';
                else if (i >= 4) updatedTask.priority = 'high';
                else if (u >= 4) updatedTask.priority = 'medium';
                else updatedTask.priority = 'low';
            }

            this.tasks[index] = updatedTask;
            this.saveData();
        }
    },

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.selectedTaskIds.delete(id);
        
        // 清理关联
        this.tasks.forEach(t => {
            if (t.relations) {
                t.relations = t.relations.filter(r => r.targetId !== id);
            }
        });
        
        // 核心修改：删除后重新计算 ID 计数器
        this._recalcNextShortId();
        
        this.saveData();
    },
    
    batchDelete() {
        this.tasks = this.tasks.filter(t => !this.selectedTaskIds.has(t.id));
        
        // 清理关联
        const deletedIds = Array.from(this.selectedTaskIds);
        this.tasks.forEach(t => {
            if (t.relations) {
                t.relations = t.relations.filter(r => !deletedIds.includes(r.targetId));
            }
            if (deletedIds.includes(t.parentId)) {
                t.parentId = null;
            }
        });
        
        this.selectedTaskIds.clear();
        
        // 核心修改：批量删除后重新计算 ID 计数器
        this._recalcNextShortId();
        
        this.saveData();
    },

    batchComplete() {
        const now = new Date().toISOString();
        this.tasks.forEach(t => {
            if (this.selectedTaskIds.has(t.id)) {
                t.status = 'done';
                t.completedAt = now;
            }
        });
        this.selectedTaskIds.clear();
        this.saveData();
    },

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (Array.isArray(data)) {
                let count = 0;
                data.forEach(newTask => {
                    if (!this.tasks.find(t => t.id === newTask.id)) {
                        this.tasks.push(newTask);
                        count++;
                    }
                });
                this.saveData();
                return true;
            }
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
        return false;
    }
};