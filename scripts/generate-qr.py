# Optional development helper; runtime uses committed SVGs. Requires reportlab.
from pathlib import Path
from reportlab.graphics.barcode.qr import QrCodeWidget
for payload in ['TKY1', 'TKY4', 'BEAR']:
    widget = QrCodeWidget(payload, barLevel='M')
    widget.qr.make()
    qr = widget.qr.modules
    n = len(qr)
    squares = ''.join(f'<rect x="{x+4}" y="{y+4}" width="1" height="1"/>' for y,row in enumerate(qr) for x,on in enumerate(row) if on)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n+8} {n+8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">{squares}</g></svg>'
    Path('public/qr', payload + '.svg').write_text(svg)
