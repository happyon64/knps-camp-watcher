@echo off
chcp 65001 >nul
set /p KAKAO_REST_API_KEY=카카오 REST API 키를 입력하세요: 
set /p KAKAO_CLIENT_SECRET=Client Secret을 입력하세요 (사용하지 않으면 Enter): 
"C:\Users\yoons\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "%~dp0tools\kakao-setup.mjs"
pause
