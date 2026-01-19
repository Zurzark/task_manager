// js/store.js

const DEFAULT_PROMPT = `# Role
你是一个专业的智能任务管理助手。你的目标是将用户的自然语言输入解析为结构清晰、逻辑严谨的 JSON 任务数据。

# Context
- **当前时间**: {current_datetime}
- **已有任务上下文** (格式 #ID):
{referenced_tasks}

# Processing Rules (核心处理逻辑)

## 1. 内容润色与提炼 (NLP Polishing)
- **Title**: 必须简短精炼（建议 5-15 字）。提取核心动词+名词（如“修复登录Bug”、“撰写Q1报告”）。
- **Description**: 将输入中冗长的背景信息、具体细节、备注内容进行润色后放入此处（润色的要求是逻辑通顺，阅读顺畅，保留必要信息）。如果用户输入非常简短，此项可为空。

## 2. 智能分类与标签 (Classification & Tagging)
- **Category**: 基于语境必须归类为以下之一：
  - '工作' (默认), '生活', '问题反馈', '学习', '其他'
- **Tags**: 谨慎打标签。仅提取具有**复用价值**、**概括性**的名词（如项目名、技术栈、模块名）。避免使用动词或过于琐碎的词。
  - *Good*: "后端", "Q1规划", "API"
  - *Bad*: "去", "做", "紧急"

## 3. 优先级判断 (Priority Matrix)
基于任务性质判断：
- **Priority**: 综合推断：
  - 'urgent': 重要且紧急
  - 'high': 重要不紧急
  - 'medium': 不重要紧急
  - 'low': 不重要不紧急
- **is_frog**: boolean (true/false). 是否为"青蛙任务" (最困难/最重要的任务，或者当前最应该关注的问题).
- **action_type**: 'NEXT', 'SOMEDAY', 'WAITING'. 默认 NEXT.（NEXT是接下来马上就可以去做的，SOMEDAY是过一段时间再去做，WAITING是需要等待）
- **assignees**: [String]. 相关人/责任人姓名.
- **startDate**: "ISO String" (任务预计开始时间)
- **dueDate**: "ISO String" (任务预计截止时间)
- **reminderTime**: "ISO String" (提醒时间)

## 4. 时间解析 (Time Extraction)
基于当前时间推断绝对时间 (ISO 8601格式)。如果提取不到则忽略该字段：
- **startDate**: “明天开始”、“下周一做”
- **dueDate**: “截止到...”、“周五前完成”
- **reminderTime**: “提醒我...”、“下午3点通知”
- **estimatedMinutes**: 提取时长描述（如“开会1小时” -> 60）

## 5. ID分配机制
为了区分"引用已有任务"和"创建新任务"，请严格遵守以下 ID 规则：
- **引用已有任务**: 使用上下文中提供的 **正数 ID** (如 12, 45)
- **创建新任务**: 必须使用 **负数 ID** 作为临时标识，从 -1 开始递减 (如 -1, -2, -3...)
- **禁止**为新任务编造正数 ID
- **parentShortId / targetShortId**: 
  - 如果指向已有任务 -> 填正数 ID
  - 如果指向本次拆解的其他新任务 -> 填对应的负数 ID

## 6. 任务关系 (Relationships)
识别 #ID 并按以下优先级判断：
1. **父/子任务**: 用户明确层级（“父任务是”、“拆分为”） -> 'parentShortId' / 'childShortIds'
2. **依赖**: 有先后顺序（“阻塞”、“依赖”、“先...后...”） -> 'relations: [{type: "depends_on"}]'
3. **关联**: 仅提及或语境相关 -> 'relations: [{type: "related_to"}]'

# Output Format
**必须**仅输出一个符合 JSON 语法的数组。不要包含 Markdown 代码块标记（json）。

## JSON字段定义
[
  {
    "shortId": Number,  // 新任务用负数
    "title": "String", //核心任务名",
    "description": "String", //详情描述",
    "category": "String", //枚举值",
    "tags": ["String", "标签"],
    "is_frog":boolean, //true false
    "action_type":"NEXT|SOMEDAY|WAIING",
    "priority": "urgent|high|medium|low",
    "assignees": ["String"],
    "startDate": "ISO String",
    "dueDate": "ISO String",
    "reminderTime": "ISO String",
    "estimatedMinutes": Number,
    "parentShortId": Number,
    "childShortIds": [Number],
    "relations": [
      { "type": "depends_on|related_to", "targetShortId": Number }
    ]
  }
]
`;

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
    nextShortId: 1, // 新增：用于 ShortId 自增
    workHours: { start: '09:00', end: '18:15' } // 工作时间设置
};

export const store = {
    tasks: [],
    apiLogs: [],
    config: { ...DEFAULT_CONFIG },
    viewFilter: 'today',
    categoryFilter: null,
    keywordFilter: '', // 新增：关键词搜索
    frogFilter: false, // 新增：青蛙筛选
    actionTypeFilter: 'all', // 新增：行动项筛选
    dateRangeFilter: null, // 新增：日期范围筛选 { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
    createdAtRangeFilter: null, // 新增：创建时间筛选 { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
    calendarView: 'month', // 'month' | 'week'
    calendarDate: new Date(),
    currentViewMode: 'list',
    selectedTaskIds: new Set(),
    sortState: [],
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
            this.sortState = [];
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

            // 移除旧属性
            if (t.urgency !== undefined) { delete t.urgency; hasChanges = true; }
            if (t.importance !== undefined) { delete t.importance; hasChanges = true; }
            
            // 修复旧数据结构
            t.tags = t.tags || [];
            t.assignees = t.assignees || [];
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
            
            // 强制更新 Prompt 到最新版本 (包含负数ID规则 和 is_frog)
            if (!this.config.prompt.includes('负数 ID') || !this.config.prompt.includes('is_frog')) {
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
            isFrog: taskData.isFrog !== undefined ? taskData.isFrog : false,
            actionType: taskData.actionType || 'NEXT',
            tags: taskData.tags || [],
            assignees: taskData.assignees || [],
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

    // 导入数据 (支持 JSON 字符串或对象)
    importData(input) {
        try {
            const data = typeof input === 'string' ? JSON.parse(input) : input;
            
            // 兼容旧版：纯数组认为是任务列表
            if (Array.isArray(data)) {
                return this.importTasksFromData(data);
            }
            
            return false;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    },

    // 核心导入逻辑：导入任务数组
    importTasksFromData(tasksArray) {
        if (!Array.isArray(tasksArray)) return false;
        
        let count = 0;
        tasksArray.forEach(newTask => {
            if (!this.tasks.find(t => t.id === newTask.id)) {
                this.tasks.push(newTask);
                count++;
            }
        });
        
        if (count > 0) {
            // 重新计算 nextShortId 以防冲突
            this._recalcNextShortId();
            this.saveData();
            return true;
        }
        return true; // 虽然没有新任务，但操作是成功的
    },

    // 导入配置
    importConfigFromData(configData) {
        if (!configData) return false;
        
        // 保护性合并：保留当前的某些状态可能更好，但作为备份恢复，应该覆盖
        // 特殊处理 apis: 避免丢失当前 key，但如果是完整恢复，应该信任备份
        // 这里选择合并策略：
        // 1. Prompt, ActiveId 直接覆盖
        // 2. APIs: 既然是备份，假设用户想恢复到备份的状态，所以直接覆盖 apis 列表是合理的
        //    但也可能用户只想导入 prompt。
        //    根据需求 "支持导出...设置（大模型api、prompt等）"，导入时应恢复这些。
        
        this.config = {
            ...this.config,
            ...configData,
            // 确保 nextShortId 取最大值，避免 ID 冲突
            nextShortId: Math.max(this.config.nextShortId, configData.nextShortId || 1)
        };
        
        this.saveConfig();
        return true;
    }
};