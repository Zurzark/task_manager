// js/memory.js - AI记忆核心模块

import { generateId } from './utils.js';

// 记忆分类枚举
export const MEMORY_CATEGORIES = {
    WORK_RULE: 'work_rule',      // 工作规则
    PREFERENCE: 'preference',    // 偏好
    PERSON: 'person',            // 人物
    TERM: 'term',                // 术语
    HABIT: 'habit',              // 习惯
    KNOWLEDGE: 'knowledge',      // 知识
    OTHER: 'other'               // 其他
};

// 重要性级别
export const IMPORTANCE_LEVELS = {
    CRITICAL: 5,     // 关键
    HIGH: 4,         // 高
    MEDIUM: 3,       // 中
    LOW: 2,          // 低
    MINOR: 1         // 次要
};

// 默认用户画像
const DEFAULT_USER_PROFILE = {
    id: 'user_profile',
    version: 1,
    // 基础信息
    profession: '',           // 职业
    role: '',                 // 角色
    responsibilities: '',     // 工作职责
    // 沟通风格偏好
    communicationStyle: '',   // 沟通风格
    tonePreference: '',       // 语气偏好
    // 工作习惯
    workHours: '',            // 工作时间
    timezone: '',             // 时区
    // 其他
    goals: '',                // 目标
    constraints: '',          // 限制条件
    updatedAt: new Date().toISOString()
};

// 默认记忆配置
const DEFAULT_MEMORY_CONFIG = {
    id: 'memory_config',
    version: 1,
    // 注入策略
    injectionStrategy: 'smart', // 'all' | 'important' | 'smart' | 'none'
    // Token限制
    maxTokens: 1000,           // 最大Token数
    maxMemories: 10,           // 最大记忆条数
    // 智能注入规则
    smartRules: {
        minImportance: IMPORTANCE_LEVELS.MEDIUM, // 最小重要性
        recentDays: 30,                          // 最近天数
        categoryWeights: {                       // 分类权重
            [MEMORY_CATEGORIES.WORK_RULE]: 1.2,
            [MEMORY_CATEGORIES.PREFERENCE]: 1.1,
            [MEMORY_CATEGORIES.HABIT]: 1.0,
            [MEMORY_CATEGORIES.KNOWLEDGE]: 0.9,
            [MEMORY_CATEGORIES.PERSON]: 0.8,
            [MEMORY_CATEGORIES.TERM]: 0.7,
            [MEMORY_CATEGORIES.OTHER]: 0.5
        }
    },
    updatedAt: new Date().toISOString()
};

// 记忆存储服务
export const memoryStore = {
    // 数据
    userProfile: { ...DEFAULT_USER_PROFILE },
    memories: [],
    config: { ...DEFAULT_MEMORY_CONFIG },
    
    // 初始化
    init() {
        this.loadUserProfile();
        this.loadMemories();
        this.loadConfig();
    },
    
    // ============ 用户画像操作 ============
    loadUserProfile() {
        const saved = localStorage.getItem('memory_user_profile');
        if (saved) {
            try {
                const profile = JSON.parse(saved);
                // 版本兼容性检查
                if (profile.version === DEFAULT_USER_PROFILE.version) {
                    this.userProfile = { ...DEFAULT_USER_PROFILE, ...profile };
                } else {
                    // 未来可以添加版本迁移逻辑
                    this.userProfile = { ...DEFAULT_USER_PROFILE, ...profile };
                }
            } catch (e) {
                console.error('Failed to load user profile:', e);
                this.userProfile = { ...DEFAULT_USER_PROFILE };
            }
        }
    },
    
    saveUserProfile() {
        this.userProfile.updatedAt = new Date().toISOString();
        localStorage.setItem('memory_user_profile', JSON.stringify(this.userProfile));
    },
    
    updateUserProfile(updates) {
        this.userProfile = { ...this.userProfile, ...updates };
        this.saveUserProfile();
    },
    
    // ============ 记忆碎片操作 ============
    loadMemories() {
        const saved = localStorage.getItem('memory_fragments');
        if (saved) {
            try {
                this.memories = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load memories:', e);
                this.memories = [];
            }
        }
    },
    
    saveMemories() {
        localStorage.setItem('memory_fragments', JSON.stringify(this.memories));
    },
    
    // 添加记忆
    addMemory(memoryData) {
        const newMemory = {
            id: generateId(),
            content: memoryData.content || '',
            category: memoryData.category || MEMORY_CATEGORIES.OTHER,
            tags: memoryData.tags || [],
            importance: memoryData.importance || IMPORTANCE_LEVELS.MEDIUM,
            enabled: memoryData.enabled !== undefined ? memoryData.enabled : true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usageCount: 0,
            lastUsedAt: null
        };
        
        this.memories.push(newMemory);
        this.saveMemories();
        return newMemory;
    },
    
    // 更新记忆
    updateMemory(id, updates) {
        const index = this.memories.findIndex(m => m.id === id);
        if (index !== -1) {
            this.memories[index] = {
                ...this.memories[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveMemories();
            return this.memories[index];
        }
        return null;
    },
    
    // 删除记忆
    deleteMemory(id) {
        const index = this.memories.findIndex(m => m.id === id);
        if (index !== -1) {
            this.memories.splice(index, 1);
            this.saveMemories();
            return true;
        }
        return false;
    },
    
    // 切换记忆启用状态
    toggleMemory(id) {
        const memory = this.memories.find(m => m.id === id);
        if (memory) {
            memory.enabled = !memory.enabled;
            memory.updatedAt = new Date().toISOString();
            this.saveMemories();
            return memory;
        }
        return null;
    },
    
    // 获取启用的记忆
    getEnabledMemories() {
        return this.memories.filter(m => m.enabled);
    },
    
    // 根据重要性筛选记忆
    getMemoriesByImportance(minImportance = IMPORTANCE_LEVELS.LOW) {
        return this.getEnabledMemories().filter(m => m.importance >= minImportance);
    },
    
    // 根据分类筛选记忆
    getMemoriesByCategory(category) {
        return this.getEnabledMemories().filter(m => m.category === category);
    },
    
    // 搜索记忆
    searchMemories(query) {
        const lowerQuery = query.toLowerCase();
        return this.getEnabledMemories().filter(m => 
            m.content.toLowerCase().includes(lowerQuery) ||
            m.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    },
    
    // 记录记忆使用
    recordMemoryUsage(id) {
        const memory = this.memories.find(m => m.id === id);
        if (memory) {
            memory.usageCount = (memory.usageCount || 0) + 1;
            memory.lastUsedAt = new Date().toISOString();
            this.saveMemories();
        }
    },
    
    // ============ 配置操作 ============
    loadConfig() {
        const saved = localStorage.getItem('memory_config');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                if (config.version === DEFAULT_MEMORY_CONFIG.version) {
                    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
                } else {
                    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
                }
            } catch (e) {
                console.error('Failed to load memory config:', e);
                this.config = { ...DEFAULT_MEMORY_CONFIG };
            }
        }
    },
    
    saveConfig() {
        this.config.updatedAt = new Date().toISOString();
        localStorage.setItem('memory_config', JSON.stringify(this.config));
    },
    
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    },
    
    // ============ AI上下文构建 ============
    
    // 构建用户画像上下文
    buildProfileContext() {
        const profile = this.userProfile;
        
        // 检查是否有任何字段有值
        const hasValue = Object.keys(profile).some(key => {
            if (key === 'id' || key === 'version' || key === 'updatedAt') return false;
            return profile[key] && profile[key].toString().trim() !== '';
        });
        
        if (!hasValue) {
            return '';
        }
        
        let context = '## 用户画像\n';
        if (profile.profession && profile.profession.trim()) context += `- 职业: ${profile.profession}\n`;
        if (profile.role && profile.role.trim()) context += `- 角色: ${profile.role}\n`;
        if (profile.responsibilities && profile.responsibilities.trim()) context += `- 工作职责: ${profile.responsibilities}\n`;
        if (profile.communicationStyle && profile.communicationStyle.trim()) context += `- 沟通风格: ${profile.communicationStyle}\n`;
        if (profile.tonePreference && profile.tonePreference.trim()) context += `- 语气偏好: ${profile.tonePreference}\n`;
        if (profile.workHours && profile.workHours.trim()) context += `- 工作时间: ${profile.workHours}\n`;
        if (profile.timezone && profile.timezone.trim()) context += `- 时区: ${profile.timezone}\n`;
        if (profile.goals && profile.goals.trim()) context += `- 目标: ${profile.goals}\n`;
        if (profile.constraints && profile.constraints.trim()) context += `- 限制条件: ${profile.constraints}\n`;
        
        return context;
    },
    
    // 构建记忆上下文（智能选择）
    buildMemoryContext(userMessage = '') {
        const enabledMemories = this.getEnabledMemories();
        if (enabledMemories.length === 0) {
            return '';
        }
        
        let selectedMemories = [];
        
        // 根据配置策略选择记忆
        switch (this.config.injectionStrategy) {
            case 'all':
                selectedMemories = enabledMemories;
                break;
                
            case 'important':
                selectedMemories = this.getMemoriesByImportance(this.config.smartRules.minImportance);
                break;
                
            case 'smart':
                selectedMemories = this.selectSmartMemories(enabledMemories, userMessage);
                break;
                
            case 'none':
            default:
                return '';
        }
        
        // 应用Token和数量限制
        selectedMemories = this.applyLimits(selectedMemories);
        
        if (selectedMemories.length === 0) {
            return '';
        }
        
        // 构建上下文文本
        let context = '## 用户记忆\n';
        selectedMemories.forEach((memory, index) => {
            const categoryLabel = Object.keys(MEMORY_CATEGORIES).find(key => MEMORY_CATEGORIES[key] === memory.category) || '其他';
            const importanceStars = '★'.repeat(memory.importance);
            
            context += `${index + 1}. [${categoryLabel}] ${memory.content}`;
            if (memory.tags.length > 0) {
                context += ` (标签: ${memory.tags.join(', ')})`;
            }
            context += ` ${importanceStars}\n`;
            
            // 记录使用
            this.recordMemoryUsage(memory.id);
        });
        
        return context;
    },
    
    // 智能选择记忆（基于相关性）
    selectSmartMemories(memories, userMessage) {
        const lowerMessage = userMessage.toLowerCase();
        
        // 计算相关性分数
        const scoredMemories = memories.map(memory => {
            let score = 0;
            
            // 1. 重要性基础分
            score += memory.importance * 10;
            
            // 2. 分类权重
            const categoryWeight = this.config.smartRules.categoryWeights[memory.category] || 1.0;
            score *= categoryWeight;
            
            // 3. 内容相关性
            if (memory.content.toLowerCase().includes(lowerMessage)) {
                score += 50;
            }
            
            // 4. 标签相关性
            const matchingTags = memory.tags.filter(tag => 
                lowerMessage.includes(tag.toLowerCase())
            ).length;
            score += matchingTags * 20;
            
            // 5. 使用频率（鼓励常用记忆）
            score += Math.min(memory.usageCount || 0, 10) * 2;
            
            // 6. 新鲜度（最近使用）
            if (memory.lastUsedAt) {
                const daysSinceLastUse = (Date.now() - new Date(memory.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceLastUse < 7) {
                    score += 15;
                } else if (daysSinceLastUse < 30) {
                    score += 5;
                }
            }
            
            return { memory, score };
        });
        
        // 按分数排序
        scoredMemories.sort((a, b) => b.score - a.score);
        
        return scoredMemories.map(item => item.memory);
    },
    
    // 应用Token和数量限制
    applyLimits(memories) {
        // 先按重要性排序
        const sorted = [...memories].sort((a, b) => b.importance - a.importance);
        
        // 应用数量限制
        const limitedByCount = sorted.slice(0, this.config.maxMemories);
        
        // 简单Token估算（假设每个字符约0.3个Token）
        let totalChars = 0;
        const result = [];
        
        for (const memory of limitedByCount) {
            const memoryChars = memory.content.length + (memory.tags.join(', ').length);
            if (totalChars + memoryChars <= this.config.maxTokens * 3) { // 乘以3是粗略估算
                result.push(memory);
                totalChars += memoryChars;
            } else {
                break;
            }
        }
        
        return result;
    },
    
    // 构建完整的AI上下文
    buildAIContext(userMessage = '') {
        const profileContext = this.buildProfileContext();
        const memoryContext = this.buildMemoryContext(userMessage);
        
        if (!profileContext && !memoryContext) {
            return '';
        }
        
        let context = '\n\n---\n';
        context += '# 个性化上下文\n';
        
        if (profileContext) {
            context += profileContext + '\n';
        }
        
        if (memoryContext) {
            context += memoryContext + '\n';
        }
        
        context += '---\n\n';
        context += '请基于以上用户画像和记忆背景来理解和处理用户的任务请求。';
        
        return context;
    },
    
    // ============ AI整理功能 ============
    
    // 生成AI整理提示
    generateOrganizationPrompt() {
        const memories = this.getEnabledMemories();
        if (memories.length === 0) {
            return '暂无需要整理的记忆。';
        }
        
        const memoryText = memories.map((m, i) => 
            `${i + 1}. ${m.content} (分类: ${m.category}, 重要性: ${m.importance})`
        ).join('\n');
        
        return `请分析以下用户记忆碎片，进行智能整理：

${memoryText}

请完成以下任务：
1. 识别并合并重复或相似的记忆
2. 优化表达，使其更清晰简洁
3. 建议更合适的分类（从以下选项中选择：${Object.values(MEMORY_CATEGORIES).join(', ')}）
4. 调整重要性评分（1-5分）
5. 提取关键词作为标签
6. 生成一份结构化的总结报告

请以JSON格式返回整理结果，包含以下字段：
- mergedMemories: 合并后的记忆数组（每个包含content, category, importance, tags）
- deletedMemoryIds: 建议删除的重复记忆ID数组
- summary: 文字总结报告
- suggestions: 改进建议数组`;
    },
    
    // 应用AI整理结果
    applyOrganizationResult(result) {
        try {
            const data = typeof result === 'string' ? JSON.parse(result) : result;
            
            // 删除重复记忆
            if (data.deletedMemoryIds && Array.isArray(data.deletedMemoryIds)) {
                data.deletedMemoryIds.forEach(id => {
                    this.deleteMemory(id);
                });
            }
            
            // 更新或添加合并后的记忆
            if (data.mergedMemories && Array.isArray(data.mergedMemories)) {
                data.mergedMemories.forEach(memoryData => {
                    // 检查是否有对应的现有记忆
                    const existing = this.memories.find(m => 
                        m.content.toLowerCase() === memoryData.content.toLowerCase()
                    );
                    
                    if (existing) {
                        // 更新现有记忆
                        this.updateMemory(existing.id, {
                            category: memoryData.category || existing.category,
                            importance: memoryData.importance || existing.importance,
                            tags: memoryData.tags || existing.tags
                        });
                    } else {
                        // 添加新记忆
                        this.addMemory(memoryData);
                    }
                });
            }
            
            return {
                success: true,
                summary: data.summary || '记忆整理完成',
                suggestions: data.suggestions || []
            };
            
        } catch (error) {
            console.error('Failed to apply organization result:', error);
            return {
                success: false,
                error: '解析整理结果失败'
            };
        }
    },
    
    // ============ 统计信息 ============
    getStats() {
        const enabled = this.getEnabledMemories();
        const disabled = this.memories.filter(m => !m.enabled);
        
        const byCategory = {};
        Object.values(MEMORY_CATEGORIES).forEach(category => {
            byCategory[category] = enabled.filter(m => m.category === category).length;
        });
        
        return {
            total: this.memories.length,
            enabled: enabled.length,
            disabled: disabled.length,
            byCategory,
            averageImportance: enabled.length > 0 
                ? enabled.reduce((sum, m) => sum + m.importance, 0) / enabled.length 
                : 0,
            totalUsage: enabled.reduce((sum, m) => sum + (m.usageCount || 0), 0)
        };
    },
    
    // ============ 导入/导出 ============
    exportData() {
        return {
            version: 1,
            timestamp: new Date().toISOString(),
            userProfile: this.userProfile,
            memories: this.memories,
            config: this.config
        };
    },
    
    importData(data) {
        try {
            if (data.userProfile) {
                this.userProfile = { ...DEFAULT_USER_PROFILE, ...data.userProfile };
                this.saveUserProfile();
            }
            
            if (data.memories && Array.isArray(data.memories)) {
                this.memories = data.memories;
                this.saveMemories();
            }
            
            if (data.config) {
                this.config = { ...DEFAULT_MEMORY_CONFIG, ...data.config };
                this.saveConfig();
            }
            
            return { success: true };
        } catch (error) {
            console.error('Failed to import memory data:', error);
            return { success: false, error: error.message };
        }
    }
};