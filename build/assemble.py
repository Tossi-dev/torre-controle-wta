#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Torre de Controle WTA — remonta src/shell.html a partir dos componentes.
Troca 3 coisas (idempotente):
  1. o seed embutido  <- etl/payload_seed.json
  2. o corpo do APP() <- src/app.js  (envolto em function APP(){ ... window.fechar=fechar; })
  3. injeta a regra CSS .card.clk (só se ainda não existir)

Depois rode build/build.py para gerar dist/index.html.
USO:  python3 build/assemble.py
"""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
shell = os.path.join(ROOT, "src", "shell.html")
html = open(shell, encoding="utf-8").read()

seed = open(os.path.join(ROOT, "etl", "payload_seed.json"), encoding="utf-8").read().strip()
appjs = open(os.path.join(ROOT, "src", "app.js"), encoding="utf-8").read().rstrip("\n")
wrapped = "function APP(){\n" + appjs + "\nwindow.fechar=fechar;\n}"

# 1) seed (até o primeiro ;</script>, contíguo — não casa com o boot que tem \n antes)
html, n1 = re.subn(r"window\.__SEED=.*?;</script>",
                   lambda m: "window.__SEED=" + seed + ";</script>", html, count=1, flags=re.S)
# 2) corpo do APP()
html, n2 = re.subn(r"function APP\(\)\{.*?\n\}\n</script>",
                   lambda m: wrapped + "\n</script>", html, count=1, flags=re.S)
# 3) CSS clicável (idempotente)
n3 = 0
if ".card.clk{" not in html:
    css = (".card.clk{cursor:pointer}\n"
           ".card.clk .vo{margin-top:12px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;"
           "color:var(--brand);font-weight:700;display:inline-flex;align-items:center;gap:6px;"
           "transition:gap .2s var(--ease)}\n"
           ".card.clk:hover .vo{gap:9px}\n")
    html = html.replace("</style>", css + "</style>", 1)
    n3 = 1

assert n1 == 1, "seed nao encontrado"
assert n2 == 1, "corpo do APP() nao encontrado"
open(shell, "w", encoding="utf-8").write(html)
print("shell.html remontado: %d bytes (seed=%d, app=%d, css=%d)" % (len(html), n1, n2, n3))
