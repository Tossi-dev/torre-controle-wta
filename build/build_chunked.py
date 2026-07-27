#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Torre de Controle WTA — build em CHUNKS .js (para deploy inline confiável)
--------------------------------------------------------------------------
Igual ao build_v self-contained (gzip + base64 do painel), mas o base64 é
quebrado em arquivos b1.js..bN.js (cada um pequeno o suficiente para emitir
sem truncar). O index.html carrega os chunks por <script src> (arquivos .js
estáticos, servidos corretamente pela Vercel — ao contrário de .dat) e então
descomprime window.__D no navegador.

USO:  python3 build/build_chunked.py            # src/shell.html -> dist_chunked/
"""
import sys, gzip, base64, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "src", "shell.html")
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "dist_chunked")
CHUNK = 6600  # chars de base64 por arquivo .js

INDEX_HEAD = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
              '<meta name="viewport" content="width=device-width,initial-scale=1">'
              '<title>Torre de Controle WTA</title></head><body>\n')
BOOT = ('<script>(function(){var b=atob(window.__D||""),a=new Uint8Array(b.length),i=0;'
        'for(;i<b.length;i++)a[i]=b.charCodeAt(i);'
        'new Response(new Blob([a]).stream().pipeThrough(new DecompressionStream("gzip")))'
        '.text().then(function(h){document.open();document.write(h);document.close();})'
        '.catch(function(e){document.body.innerHTML="<p style=font-family:sans-serif;padding:40px>Erro: "+e+"</p>";});})();'
        '</script>\n</body></html>')

def main():
    with open(SRC, "rb") as f:
        html = f.read()
    gz = gzip.compress(html, compresslevel=9, mtime=0)
    b64 = base64.b64encode(gz).decode("ascii")
    chunks = [b64[i:i + CHUNK] for i in range(0, len(b64), CHUNK)]
    os.makedirs(OUTDIR, exist_ok=True)
    scripts = ""
    for i, ch in enumerate(chunks, 1):
        name = "b%d.js" % i
        with open(os.path.join(OUTDIR, name), "w", encoding="ascii") as f:
            f.write('window.__D=(window.__D||"")+"%s";' % ch)
        scripts += '<script src="./%s"></script>\n' % name
    index = INDEX_HEAD + scripts + BOOT
    with open(os.path.join(OUTDIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(index)
    print("OK -> %s" % OUTDIR)
    print("   fonte %d B -> gzip %d B -> base64 %d ch -> %d chunks de <=%d, index %d B"
          % (len(html), len(gz), len(b64), len(chunks), CHUNK, len(index)))
    for i, ch in enumerate(chunks, 1):
        print("   b%d.js: %d chars" % (i, len(ch)))

if __name__ == "__main__":
    main()
