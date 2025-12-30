# 智能任务管理器 (Smart Task Manager) - AI Powered v3.1

## 项目概述
基于原生 JavaScript (ES Modules) 构建的现代化任务管理应用，集成 AI 智能解析、四象限管理、记忆库系统与本地隐私存储。本项目旨在提供轻量、高效且智能的任务管理体验。

## 核心功能
- **多视图交互**: 支持列表(List)、看板(Kanban)、日历(Calendar)、四象限(Quadrant)四种视图切换。
- **AI 智能解析**: 集成 LLM API，支持自然语言一键生成结构化任务（自动识别时间、优先级、子任务、关联关系）。
- **长期记忆库**: 内置 Memory 系统，记录用户偏好与工作习惯，辅助 AI 更精准地理解指令。
- **隐私优先**: 所有数据存储于浏览器 LocalStorage，支持全量 JSON 备份与恢复。
- **任务高级属性**: 支持青蛙任务(Frog)、行动项(Action Type)、子任务嵌套、任务依赖关系管理。

---

### 一、完整项目文件结构 (File Structure)

```text
d:\小工具\web_project\
├── index.html                  # [入口] 应用主页面，DOM 结构容器
├── css/
│   ├── style.css               # 全局自定义样式
│   └── remixicon.css           # 图标库样式
├── js/
│   ├── main.js                 # [入口] JS 主入口，负责初始化与模块装载
│   ├── actions.js              # [关键] 全局动作注册，将模块方法绑定到 window 对象 (适配 HTML onclick)
│   ├── store.js                # [核心] 任务数据状态管理 (Store)，负责 CRUD 与持久化
│   ├── memory.js               # [核心] AI 记忆库管理 (MemoryStore)，负责用户画像与记忆片段
│   ├── views.js                # [视图] 纯函数组件，根据数据生成各视图的 HTML 字符串
│   ├── api.js                  # [服务] LLM API 调用封装
│   ├── utils.js                # [工具] 通用辅助函数 (时间格式化、ID生成、JSON解析)
│   ├── ui/                     # [UI模块] 拆分自原 main.js
│   │   ├── core.js             # UI 核心逻辑 (updateUI, renderCategoryList)
│   │   ├── modal-task.js       # 任务编辑/详情弹窗逻辑
│   │   ├── modal-settings.js   # 设置与日志弹窗逻辑
│   │   ├── modal-memory.js     # 记忆库管理弹窗逻辑
│   │   └── modal-ai.js         # AI 解析结果确认弹窗逻辑
│   └── features/               # [功能模块] 独立业务逻辑
│       ├── ai.js               # AI 任务解析流程控制
│       └── backup.js           # 数据备份与恢复逻辑
└── README.md                   # 项目说明文档
```

---

### 二、整体代码核心逻辑梳理

#### 1. 主入口与执行流程
- **启动流程**: `index.html` 加载 `js/main.js` (type="module") -> `main.js` 初始化 `store` 和 `memoryStore` -> 加载 `initUI()` 绑定事件 -> 调用 `updateUI()` 首次渲染。
- **事件响应**: 用户点击 HTML 元素 (如 `onclick="window.handleQuickAdd()"`) -> 触发 `js/actions.js` 中绑定的全局函数 -> 调用对应模块 (如 `js/features/ai.js`) -> 更新 `store` 数据 -> 触发 `updateUI()` 重绘视图。

#### 2. 核心模块分工
- **Store (`js/store.js`)**: 
  - 单例模式，维护 `this.tasks` (任务列表) 和 `this.config` (配置)。
  - 提供 `addTask`, `updateTask`, `deleteTask` 等原子操作，操作后自动同步 LocalStorage。
  - 维护视图状态 (`currentViewMode`, `viewFilter`, `sortState`)。
- **Views (`js/views.js`)**: 
  - 包含 `list()`, `kanban()`, `calendar()`, `quadrant()` 四个渲染函数。
  - 接收过滤后的任务数据，返回 HTML 字符串，**不包含业务逻辑**。
- **UI Core (`js/ui/core.js`)**:
  - `updateUI()`: 整个应用的渲染引擎，根据当前状态调用对应的 View 函数并注入 DOM。
  - `updateCounts()`: 计算并更新侧边栏的任务统计数字。

#### 3. 关键业务规则
- **任务ID**: 使用 `t_{timestamp}_{counter}_{random}` 格式确保唯一性。
- **时间处理**: 所有时间存储为 ISO 字符串 (UTC)，显示时转换为东八区 (Shanghai) 时间。
- **AI 解析**: 用户输入 -> 构建 Prompt (含记忆+引用任务) -> 调用 LLM -> 解析返回的 JSON -> 弹出确认框 -> 用户确认后写入 Store。

---

### 三、本次全量代码&文件改动详情 (Refactoring Details)

**重构目标**: 将臃肿的 `main.js` (>1800行) 按功能拆分为模块化结构，提升可维护性，保持原有功能 100% 不变。

#### 1. 目录结构调整
- **新增** `js/ui/` 目录：存放所有 UI 交互与弹窗逻辑。
- **新增** `js/features/` 目录：存放独立的功能业务逻辑。

#### 2. 文件改动明细

| 文件路径 | 改动类型 | 改动核心内容 | 目的/解决问题 |
| :--- | :--- | :--- | :--- |
| `js/main.js` | **重构** | 移除所有业务逻辑，仅保留 `init()` 调用、事件监听绑定和模块导入。代码量从 1800+ 降至 ~100 行。 | 作为纯粹的入口文件，解耦逻辑。 |
| `js/actions.js` | **新增** | 引入所有业务模块方法，并将其赋值给 `window` 对象 (e.g., `window.toggleTaskComplete = ...`)。 | **关键**：解决 ES Module 作用域隔离导致 HTML 中 `onclick` 无法访问函数的问题。 |
| `js/ui/core.js` | **新增** | 包含 `updateUI`, `updateCounts`, `renderCategoryList`。 | 集中管理 UI 渲染与更新逻辑。 |
| `js/ui/modal-task.js` | **新增** | 包含 `openTaskModal`, `saveTaskEdit`, `deleteTaskAndClose`, `addRelationRow`。 | 封装任务编辑弹窗的复杂 DOM 操作与数据收集逻辑。 |
| `js/ui/modal-settings.js` | **新增** | 包含设置弹窗、API 配置管理、日志查看逻辑。 | 独立管理配置相关 UI。 |
| `js/ui/modal-memory.js` | **新增** | 包含记忆库的增删改查 UI 逻辑及 AI 整理功能调用。 | 独立管理记忆模块 UI。 |
| `js/ui/modal-ai.js` | **新增** | 包含 `openAIConfirmModal`, `confirmImportTasks`。 | 处理 AI 解析结果的确认交互。 |
| `js/features/ai.js` | **新增** | 包含 `handleAIParse` 核心流程。 | 封装 AI 调用、Context 构建、结果解析流程。 |
| `js/features/backup.js` | **新增** | 包含 `setupBackupListeners` (导出/导入)。 | 独立管理数据备份逻辑。 |
| `js/utils.js` | **修改** | 新增 `getShanghaiInputValue` (时间转换), `extractJsonFromResponse` (AI 响应清洗)。 | 提取复用逻辑，减少代码重复。 |

---

### 四、核心文件/关键函数 详细说明

#### 1. `js/actions.js` (The Bridge)
由于本项目使用原生 ES Modules (`<script type="module">`)，模块内的函数不再自动暴露到全局作用域。为了兼容现有的 HTML `onclick="window.func()"` 写法，`actions.js` 显式地将模块导出的函数挂载到 `window` 对象上。
- **注意**: 任何在 HTML 中被调用的函数，**必须**在此文件中注册。

#### 2. `js/features/ai.js` (AI Core)
- **`handleAIParse()`**:
    1. 获取用户输入。
    2. `extractReferences()`: 识别 `@#ID` 引用。
    3. `memoryStore.buildAIContext()`: 检索相关记忆。
    4. 构建最终 Prompt。
    5. `callAI()`: 请求 LLM。
    6. `openAIConfirmModal()`: 展示结果供用户确认。

#### 3. `js/ui/modal-task.js` (Task Editor)
- **`openTaskModal(id)`**: 动态生成模态框 HTML，回显任务数据。处理复杂的表单状态（如滑块、日期选择器、关联任务下拉框）。
- **`saveTaskEdit(id)`**: 从 DOM 元素收集所有字段值，进行类型转换（如日期转 ISO），调用 `store.updateTask()`。

---

### 五、项目依赖与环境说明
- **运行环境**: 现代浏览器 (Chrome/Edge/Firefox)，需支持 ES Modules。
- **依赖库**: 
  - 无 Node.js 依赖，无构建步骤 (No Build Step)。
  - `tailwindcss.js` (CDN/Local): 样式引擎。
  - `remixicon.css`: 图标库。
- **服务器**: 建议使用 Live Server 或类似工具运行，避免 file:// 协议跨域限制 (虽然本项目主要依赖 LocalStorage，但 Module 加载可能受限)。

---

### 六、代码注意事项 & 风险点 & 待优化项

#### 1. 注意事项
- **全局污染**: `js/actions.js` 有意污染了全局作用域 (`window`)，这是为了保持 HTML 结构的简洁性（避免重写所有事件监听）。在新增功能时，请遵循此模式。
- **时区问题**: 存储层统一使用 UTC (ISO String)，展示层和输入层统一强制转换为 Asia/Shanghai。修改时间处理逻辑时需小心。

#### 2. 潜在风险
- **LocalStorage 限制**: 数据量过大（如数万条任务或大量记忆）可能触达 5MB 限制。建议定期通过备份功能导出数据。
- **AI Token 消耗**: `memoryStore` 会在每次 AI 请求中注入相关记忆，若记忆库过大且策略配置不当，可能导致 Token 消耗激增。

#### 3. 待优化项
- **虚拟列表**: 目前列表视图为全量渲染（虽有分页），任务数极多时 DOM 操作可能有性能瓶颈。
- **移动端适配**: 虽然使用了 Tailwind 响应式类，但部分复杂弹窗在移动端体验仍有优化空间。

---

### 七、Cursor 适配提示 (For AI Assistant)

- **UI 修改**: 若需修改弹窗样式或逻辑，请直接定位到 `js/ui/` 下对应的 `modal-*.js` 文件。
- **业务逻辑**: 若需修改数据结构或 CRUD 逻辑，请关注 `js/store.js`；若涉及 AI 流程，请关注 `js/features/ai.js`。
- **新增交互**: 若在 HTML 中添加了新的 `onclick` 事件，**务必**在 `js/actions.js` 中添加对应的 `window` 绑定，否则会报错 "function is not defined"。
- **代码风格**: 保持 ES Modules 风格，不使用 CommonJS。保持无构建流程的特性。
