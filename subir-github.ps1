# Sobe o projeto Torre de Controle WTA para o GitHub.
# Da duplo-clique em subir-github.bat sempre que quiser subir uma alteracao.
# Roda tudo na SUA maquina. Nenhum token e digitado/colado aqui: o login e feito
# pelo navegador (Git Credential Manager ou GitHub CLI).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "=== Subir Torre de Controle WTA para o GitHub ===" -ForegroundColor Cyan

$repoUrl = "https://github.com/Tossi-dev/torre-controle-wta.git"

function Have($c){ return [bool](Get-Command $c -ErrorAction SilentlyContinue) }

# 1) Git (instala se faltar)
if(-not (Have git)){
  Write-Host "Instalando Git..." -ForegroundColor Yellow
  winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
  $env:Path += ";C:\Program Files\Git\cmd"
}
if(-not (Have git)){
  Write-Host "Git nao ficou no PATH desta janela. FECHE e rode o .bat de novo." -ForegroundColor Red
  Read-Host "Enter para sair"; exit 1
}

# 2) Se tiver GitHub CLI, usa o login dele pro git (ajuda no push, opcional)
if(Have gh){ gh auth setup-git 2>$null }

# 3) Limpa lock do git (OneDrive/processo travado costuma deixar isso pra tras)
if(Test-Path ".git\index.lock"){
  Get-Process git -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue
}

# 4) Inicializa o repo local se ainda nao existe
if(-not (Test-Path .git)){
  git init | Out-Null
  git config core.longpaths true
  git config core.autocrlf false
  if(-not (git config user.email)){ git config user.email "tossi-dev@users.noreply.github.com" }
  if(-not (git config user.name)){  git config user.name  "Tossi-dev" }
}
git branch -M main 2>$null

# 5) Aponta o remote pro repositorio certo
$remotes = git remote
if($remotes -notcontains "origin"){ git remote add origin $repoUrl }
else { git remote set-url origin $repoUrl }

# 6) Adiciona, confere e commita
git add -A
$staged = git diff --cached --name-only
if($staged){
  $msg = "sync: " + (Get-Date -Format "yyyy-MM-dd HH:mm")
  git commit -m $msg | Out-Null
  Write-Host ("Commit criado: " + $msg) -ForegroundColor Green
} else {
  Write-Host "Nada novo para commitar." -ForegroundColor Yellow
}

# 7) Envia (na 1a vez o navegador pode abrir pra voce logar no GitHub)
Write-Host "Enviando para o GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host "`n=== Concluido ===" -ForegroundColor Green
Write-Host ("Repositorio: " + $repoUrl.Replace(".git",""))
Read-Host "Enter para fechar"
