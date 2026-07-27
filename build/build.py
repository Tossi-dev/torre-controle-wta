#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Torre de Controle WTA — build do painel (auto-contido)
------------------------------------------------------
Pega o painel-fonte (src/shell.html), comprime com gzip e embute como base64
dentro de um index.html mínimo que se auto-descomprime no navegador
(atob -> DecompressionStream("gzip") -> document.write).

POR QUE assim: o deploy inline na Vercel (via MCP) reescreve sub-recursos
(ex.: /a1.dat) para o index.html, então dividir o painel em vários arquivos
.dat quebrava ("Failed to fetch"). Um único index.html sem sub-requisições é
imune a essa reescritura de rota. Ver docs/DEPLOY.md.

USO:
    python3 build/build.py            # src/shell.html -> dist/index.html
    python3 build/build.py <entrada.html> <saida.html>
"""
import sys, gzip, base64, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "src", "shell.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "dist", "index.html")

PRE = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width,initial-scale=1">'
       '<title>Torre de Controle WTA</title></head><body>\n<script>\nvar D="')
SUF = ('";\n(function(){var b=atob(D),a=new Uint8Array(b.length),i=0;'
       'for(;i<b.length;i++)a[i]=b.charCodeAt(i);\n'
       'new Response(new Blob([a]).stream().pipeThrough(new DecompressionStream("gzip")))'
       '.text().then(function(h){document.open();document.write(h);document.close();})'
       '.catch(function(e){document.body.innerHTML="<p style=font-family:sans-serif;padding:40px>Erro: "+e+"</p>";});})();\n'
       '</script>\n</body></html>')

def main():
    with open(SRC, "rb") as f:
        html = f.read()
    # mtime=0 => build determinístico (mesmo shell.html -> mesmo index.html)
    gz = gzip.compress(html, compresslevel=9, mtime=0)
    b64 = base64.b64encode(gz).decode("ascii")
    doc = PRE + b64 + SUF
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(doc)
    print("OK  ->", OUT)
    print("     fonte %d B -> gzip %d B -> base64 %d ch -> index %d B"
          % (len(html), len(gz), len(b64), len(doc)))
    if len(doc) > 4_000_000:
        print("AVISO: index > 4 MB — o deploy inline pode falhar. Considere enxugar o painel.")

if __name__ == "__main__":
    main()
