@echo off
setlocal
title CompassZha ������

rem ============================================================
rem  CompassZha �����Ǳ��� �� ������һ������ (v1)
rem  ˫�����ļ����ɣ����� CompassZha ����Ӧ�ã�Tauri ���ڣ���
rem
rem  ʹ��˵����
rem   - �״�������Ҫ���� Rust �ںˣ�����Ҫ�ȼ����ӣ�����������
rem     ֮��ÿ�����������ܶࡣ
rem   - �����󱾴��ڻᱣ�����У������� = Ӧ�ÿ��ã�
rem     �ص������� = �˳�Ӧ�á�
rem   - ������棺�Ҽ����ļ� �� ���͵� �� �����ݷ�ʽ��
rem   - ��Ҫ˫�� src-tauri\target\debug ��� exe�����ǵ��Բ����
rem   - ע�⣺���ļ����뱣�� ANSI(GBK) ����� CRLF ��β��
rem     �ñ༭���򿪺���������Ϊ UTF-8 �����β������˫����ʧЧ��
rem ============================================================

cd /d "%~dp0"

rem ---- 1. ��� Node.js ----
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo  [����] δ��⵽ Node.js��
    echo  ���Ȱ�װ Node.js��https://nodejs.org�������ԡ�
    echo.
    pause
    exit /b 1
)

rem ---- 2. ��� Rust/cargo��Ĭ�ϰ�װλ���Զ��� PATH�� ----
where cargo >nul 2>nul
if errorlevel 1 set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
where cargo >nul 2>nul
if errorlevel 1 (
    echo.
    echo  [����] δ��⵽ Rust��cargo����
    echo  ���Ȱ�װ Rust��https://rustup.rs�������ԡ�
    echo.
    pause
    exit /b 1
)

rem ---- 3. �˿� 1420 ��ռ�� = ������ʵ������ ----
netstat -ano | findstr ":1420" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
    echo.
    echo  [��ʾ] �˿� 1420 �ѱ�ռ�ã�Ӧ�ÿ����������У�
    echo  ��ɵ�ԭ����������񻹿��ţ���ص���Ӧ���ں����ԣ���
    echo.
    pause
    exit /b 0
)

rem ---- 4. ����ȱʧʱ�Զ���װ��ֻ���״λ�������ʧʱ������ ----
if not exist "node_modules\.bin\vite.cmd" (
    echo  ���������ڣ������Զ���װ...
    call npm install
    if errorlevel 1 (
        echo.
        echo  [����] ������װʧ�ܣ���ѱ��������ݽ�ͼ���������ߡ�
        echo.
        pause
        exit /b 1
    )
)

rem ---- 5. ��������Ӧ�� ----
echo  �������� CompassZha ����Ӧ��...
echo  �״�������Ҫ���� Rust �ںˣ������ĵȴ��������ӣ�...
call npm run tauri dev
if errorlevel 1 (
    echo.
    echo  [����] Ӧ������ʧ�ܣ���ѱ��������ݽ�ͼ���������ߡ�
    echo.
    pause
    exit /b 1
)
exit /b 0