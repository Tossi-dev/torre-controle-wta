@echo off
chcp 65001 >nul
REM ================================================================
REM  PUBLICAR O PAINEL WTA NO AR (Vercel)
REM
REM  Duplo-clique aqui sempre que quiser colocar as alteracoes no ar.
REM  Ele envia o codigo pro GitHub e o Vercel PUBLICA SOZINHO em ~1 min.
REM  Endereco do site: https://torre-controle-wta.vercel.app
REM
REM  (Faz exatamente o mesmo que o subir-github.bat - so tem o nome
REM   mais claro. Nao gasta nada, nao precisa do Claude.)
REM ================================================================
echo.
echo   Publicando o painel no ar...
echo   O site atualiza sozinho no Vercel em cerca de 1 minuto.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0subir-github.ps1"
echo.
echo   Pronto. Confira em: https://torre-controle-wta.vercel.app
echo   (se acabou de publicar, espere ~1 minuto e atualize a pagina)
echo.
pause
