@echo off
REM 启用变量延迟扩展
SETLOCAL ENABLEDELAYEDEXPANSION
chcp 65001 > nul

REM 设置要检查的端口和URL
set PORT=8000
set URL=http://localhost:%PORT%/index.html

echo 检查是否已有Python HTTP服务器在端口 %PORT% 运行

netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul

IF !ERRORLEVEL! EQU 0 (
    REM ... IF 块内容 ...
	start "" %URL%
) ELSE (
    REM ... ELSE 块内容 ...
	start "" python -m http.server %PORT%
	echo 等待服务器启动...
	timeout /t 3 /nobreak >nul
	echo 正在打开 %URL% ...
	start "" %URL%
)

echo 脚本执行完毕。
exit /b 0
