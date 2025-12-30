import { store } from '../store.js';
import { memoryStore } from '../memory.js';
import { updateUI } from '../ui/core.js';

export function setupBackupListeners() {
    document.getElementById('btn-export')?.addEventListener('click', () => {
        // 升级：全量备份 (任务 + 配置 + 记忆)
        const backupData = {
            version: "2.0",
            timestamp: new Date().toISOString(),
            tasks: store.tasks,
            config: store.config,
            memory: memoryStore.exportData()
        };

        const data = JSON.stringify(backupData, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 更改文件名以体现全量备份
        a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    });

    document.getElementById('btn-import')?.addEventListener('click', () => {
        document.getElementById('file-import').click();
    });

    document.getElementById('file-import')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonContent = e.target.result;
                    const data = JSON.parse(jsonContent);
                    let importedSomething = false;
                    let msg = '导入报告：\n';

                    // 1. 识别全量备份格式 (v2.0)
                    if (data.version && (data.tasks || data.memory || data.config)) {
                        // 导入任务
                        if (data.tasks && Array.isArray(data.tasks)) {
                            store.importTasksFromData(data.tasks);
                            msg += `✅ 任务已合并\n`;
                            importedSomething = true;
                        }
                        
                        // 导入配置 (API, Prompt等)
                        if (data.config) {
                            if (confirm('检测到包含设置信息 (API Key, Prompt等)，是否覆盖当前设置？')) {
                                store.importConfigFromData(data.config);
                                msg += `✅ 设置已恢复\n`;
                                importedSomething = true;
                            } else {
                                msg += `⏹️ 设置未导入 (用户跳过)\n`;
                            }
                        }

                        // 导入记忆
                        if (data.memory) {
                            const memResult = memoryStore.importData(data.memory);
                            if (memResult.success) {
                                msg += `✅ 记忆与画像已恢复\n`;
                                importedSomething = true;
                            } else {
                                msg += `❌ 记忆导入失败: ${memResult.error}\n`;
                            }
                        }
                    } 
                    // 2. 兼容旧版 (纯任务数组)
                    else if (Array.isArray(data)) {
                        if (store.importTasksFromData(data)) {
                            msg += `✅ 任务列表已合并 (旧版格式)\n`;
                            importedSomething = true;
                        }
                    }
                    // 3. 尝试其他情况
                    else {
                        throw new Error('未知的文件格式');
                    }

                    if (importedSomething) {
                        alert(msg);
                        updateUI();
                    } else {
                        alert('未导入任何数据或格式不正确');
                    }
                } catch (err) {
                    console.error(err);
                    alert('导入失败: 文件格式错误或已损坏');
                }
            };
            reader.readAsText(file);
        }
        e.target.value = ''; // 重置 file input
    });
}
