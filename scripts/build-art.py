"""Build the original, self-contained vector art. No runtime dependencies."""
from pathlib import Path
from random import Random

DEST = Path(__file__).resolve().parents[1] / 'public' / 'assets'
DEST.mkdir(parents=True, exist_ok=True)

def save(name, body, view='0 0 1000 1000', defs=''):
    (DEST / f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}"><defs>{defs}</defs>{body}</svg>\n')

def ellipse(x,y,rx,ry,color):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{color}"/>'

def path(d,color,stroke='',width=8):
    return f'<path d="{d}" fill="{color}"'+(f' stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"' if stroke else '')+'/>'

def rect(x,y,w,h,color,r=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{color}"/>'

def snowflake(x,y,size,color):
    return f'<g transform="translate({x} {y}) scale({size})" stroke="{color}" stroke-width="3" stroke-linecap="round"><path d="M-12 0h24M-6-10 6 10M-6 10 6-10M-9-4v4l-3 3M9 4V0l3-3M-2-9l-4-1v-4M2 9l4 1v4"/></g>'

# The square white QR panel sits over the torso at x=260, y=390, size=480.
# Art is never masked, clipped, or filtered through that panel.
snow = ellipse(515,945,270,22,'#163d6630')
snow += path('M278 455 135 344 66 351M135 344 112 281M138 347 180 297','none','#6e493d',22)
snow += path('M741 440 848 326 929 300M848 326 851 257M849 326 918 365','none','#6e493d',22)
snow += ellipse(510,678,304,276,'#c0dfe9')+ellipse(488,654,287,263,'#f5faf1')
snow += ellipse(507,326,178,167,'#bedee7')+ellipse(488,310,166,157,'#f8faf2')
snow += path('M344 204q25-126 166-139 111-7 154 138Z','#b9303f')
snow += path('M372 161q102-76 236-39l-35-44Q428 45 372 161','#d24a52')
snow += rect(327,182,350,57,'#f7e8c9',27)+ellipse(568,66,39,37,'#fff6de')
snow += path('M347 416q151-57 318-5l-8 67q-164-49-311 6Z','#1e7369')
snow += path('m633 442 76 37-12 177-63-21-19-161Z','#237f70')
snow += path('m637 598 58 18-3 21-58-18Z','#edca80')
snow += ellipse(435,300,13,15,'#243947')+ellipse(552,294,13,15,'#243947')
snow += path('m487 320 102 26-102 19Z','#e69449')
snow += path('M425 366q54 38 110 0','none','#40535c',8)
snow += ellipse(388,340,24,11,'#edafa1')+ellipse(592,336,24,11,'#edafa1')
snow += ellipse(264,833,49,42,'#fffaf0')+ellipse(759,827,47,43,'#d9eaf0')
save('snowman',snow)

gift = ellipse(500,940,299,24,'#1c37552b')
gift += path('m207 364-43 451 126 114 515-67 23-466Z','#a96f2a')
gift += path('m204 355 581-12-17 532-573 15Z','#e9b951')
gift += path('m230 380 511-7-13 475-511 13Z','#f4cd69')
gift += path('m154 321 651-9 29 116-682 14Z','#f6cf70')
gift += path('m156 321 53-34 555-3 41 28Z','#ffe4a3')
gift += path('m435 319 125-2 3 569-125 2Z','#bc3544')
gift += path('m435 322 45-1-3 562-39 1Z','#d95155')
gift += path('M508 303C208 342 196 70 334 97q110 18 174 206Z','#c13c49')
gift += path('M498 301C763 344 838 80 680 94q-103 5-182 207Z','#b12e40')
gift += path('M468 266C283 275 276 129 343 153q71 25 125 113Z','#ec7b72')
gift += path('M546 264c196 6 208-142 130-107q-80 35-130 107Z','#e87570')
gift += path('M459 263q49-39 100 0l1 78-104 6Z','#d34e54')
gift += path('m425 342-81 85 40-4 12 35 75-108M547 343l65 98 8-32 43 2-66-69','#b93243')
gift += rect(247,377,506,506,'#ead18b',20)
gift += snowflake(294,463,1.1,'#fff1c6')+snowflake(704,809,1.1,'#fff1c6')
save('gift',gift)

santa = ellipse(508,954,294,21,'#163d662b')
santa += path('M280 441Q140 452 145 668l100 21 94-158M723 439q140 6 140 213l-107 43-88-180','#b62f42')
santa += ellipse(182,671,50,60,'#f4e8d2')+ellipse(815,672,49,61,'#f4e8d2')
santa += path('m315 795-11 126-53 23q-34 42 91 39l112-6-8-177M573 797l-11 173 120 10q116 2 91-40l-65-20-6-122','#273d4a')
santa += path('M330 382q169-45 342 1 126 134 103 462-267 112-540-2-16-306 95-461Z','#c43a4b')
santa += path('m249 786 517-6 3 59-535 7Z','#253946')+rect(460,773,100,82,'#eccb77',9)+rect(477,788,65,52,'#273d4a',3)
santa += path('M344 343q144-83 299-4l43 147-363-6Z','#f5eedb')
santa += ellipse(500,271,139,150,'#eab49b')+ellipse(484,265,126,136,'#f3c7aa')
santa += path('M358 225q-14-183 194-172 138 8 172 173l-83 30-46-98-63 91Z','#bd3041')
santa += ellipse(721,229,46,43,'#fff2dc')
santa += path('M348 195q147-51 293 10l-9 56q-153-48-288-2Z','#fcf3df')
santa += path('M361 289q16 37 63 27 48 7 70 27 40-45 138-48l26 82q-23 119-158 146-145-39-161-156Z','#fff7e3')
santa += ellipse(448,283,9,11,'#253e49')+ellipse(548,283,9,11,'#253e49')
santa += path('M430 263q18-12 34-2M533 260q19-10 34 4','none','#fff7e3',13)
santa += ellipse(499,321,27,21,'#e6a88e')
santa += path('M482 345q-40-20-74 8 51 26 82 6 34 21 87-5-39-31-77-9Z','#fffaf0')
santa += path('m252 840q246 65 506-1l-2 41q-248 68-513-1Z','#f6ead3')
# Santa carries a large snowy parcel; its label holds the QR.
santa += rect(242,373,516,516,'#2b756a',26)+rect(260,391,480,480,'#f1e9d6',7)
santa += ellipse(248,594,40,60,'#c73849')+ellipse(752,594,40,60,'#c73849')
save('santa',santa)

deer = ellipse(510,958,298,21,'#163d662b')
deer += path('M342 283 305 152 244 98 239 38M304 151l8-89M277 128l-72-8M632 285l59-137 63-38 22-73M689 151l-6-83M720 129l80-8','none','#77503e',19)
deer += path('M372 293q-89-128-155-91 0 94 137 129M602 293q104-133 168-82-18 97-151 123','#a66e49')
deer += path('M354 293q-82-67-106-68 26 55 98 82M620 293q70-68 115-64-39 54-112 82','#d4aa7e')
deer += path('M343 773 310 939q29 31 88 5l62-165M574 783l34 164q43 23 87-4l-11-169','#906047')
deer += path('m309 923-12 30q42 24 100-2l4-24M605 928l6 26q50 20 92-6l-12-22','#3b4148')
deer += ellipse(504,626,287,267,'#ac794f')+ellipse(489,651,237,231,'#c49265')
deer += path('M304 444q177-60 377-2l64 430q-245 78-493-1Z','#ebdfc8')
deer += ellipse(496,300,139,146,'#b48054')
deer += path('M440 222q52 58 106-3l24 138q-81 104-148-4Z','#d0a377')
deer += ellipse(426,298,12,16,'#233c48')+ellipse(559,298,12,16,'#233c48')
deer += ellipse(497,363,65,44,'#e8c8a0')+ellipse(498,341,31,23,'#6a4739')
deer += ellipse(488,335,10,6,'#b08865')
deer += path('M498 368v13m0-1q-16 16-32 0m32 0q17 16 33 0','none','#694b3c',5)
deer += path('M352 412q152-42 294 1l-7 64q-146-46-288 3Z','#b93448')
deer += path('m620 447 60 16 28 173-56-6Z','#c94152')
deer += ellipse(500,446,20,23,'#e6c173')
save('reindeer',deer)

rng = Random(12)
stars=''.join(ellipse(rng.randrange(1920),rng.randrange(590),rng.choice([1,1,2]),rng.choice([1,2]),'#f9f0d1') for _ in range(125))
defs='''<linearGradient id="sky" x2=".2" y2="1"><stop stop-color="#11243c"/><stop offset=".58" stop-color="#294c65"/><stop offset="1" stop-color="#5c8b98"/></linearGradient>
<linearGradient id="snow" x2=".2" y2="1"><stop stop-color="#dae9e8"/><stop offset="1" stop-color="#81a9bb"/></linearGradient>
<radialGradient id="halo"><stop stop-color="#f7e8bb" stop-opacity=".22"/><stop offset="1" stop-color="#f7e8bb" stop-opacity="0"/></radialGradient>
<linearGradient id="aurora"><stop stop-color="#7acbb6" stop-opacity="0"/><stop offset=".5" stop-color="#93d3ba" stop-opacity=".11"/><stop offset="1" stop-color="#b8a5d0" stop-opacity="0"/></linearGradient>
<g id="pine"><path d="M-8 0h16v-60H-8" fill="#534a43"/><path d="m0-260-45 85h19l-51 89h30l-56 73q101 37 206 0L47-86h30l-51-89h19Z" fill="currentColor"/><path d="m0-260-36 70 36-13 32 13Zm-27 102-35 60 61-16 58 16-35-60 4 30H-8Zm-22 92-37 48 85-16 82 17-39-50 5 28-63-11Z" fill="#c4dcde"/></g>
<g id="cabin"><path d="M0 0h230v-150L115-220 0-150Z" fill="#855a50"/><path d="m-26-145 140-104 143 105-19 21-124-85-124 85Z" fill="#e5eeeb"/><path d="M15-131h202M15-102h202M15-72h202M15-43h202M15-14h202" stroke="#664e49" stroke-width="5"/><path d="M160-220v-58h35v80" fill="#afc5c9"/><path d="M71 0v-95h71V0" fill="#473e43"/><path d="M81-84h50v64H81" fill="#f6cc80"/><path d="M20-117h45v44H20m132-44h45v44h-45" fill="#f7d594"/><path d="M42-117v44m132-44v44M20-96h45m87 0h45" stroke="#9c6e56" stroke-width="5"/><path d="M-13 0q128-20 256 0v15H-13Z" fill="#e5eeeb"/></g>'''
village=rect(0,0,1920,1080,'url(#sky)')+stars
village+=path('M0 263q390-215 870 41T1920 169v-93q-477 171-944 6T0 182Z','url(#aurora)')
village+=ellipse(1395,236,226,226,'url(#halo)')+ellipse(1395,236,64,64,'#f6efd6')
village+=ellipse(1372,217,13,10,'#e3dfcb')+ellipse(1417,262,18,13,'#e3dfcb')
village+=path('M0 567 199 329 338 464 589 273 827 526 1002 379 1227 554 1509 356 1920 573V856H0Z','#3c6179')
village+=path('m136 405 63-76 139 135-85-39-49-49-18 43-23-15-50 27m407-96 46-36 88 94-75-45-23 27-6-29-45 28m916 124 50-77 93 90-81-38-22 23-6-31-49 33','#9ab9c5')
for x in range(-30,2020,42):
    village+=f'<use href="#pine" transform="translate({x} {rng.randrange(665,705)}) scale({rng.uniform(.45,.88):.2f})" color="#284e61"/>'
village+=path('M0 689q358-89 751-9t1169-17v417H0Z','#b6d0d7')
for x,y,s in [(235,650,.73),(1320,662,.9),(1570,678,.62)]:
    village+=f'<use href="#cabin" transform="translate({x} {y}) scale({s})"/>'
village+=path('M1393 661q-100 48 123 121t-164 298h323q240-197-39-287t-155-132Z','#dce8e6')
for x,y,s in [(50,803,1.43),(210,814,1.1),(420,738,.77),(1780,829,1.45),(1925,812,1.72),(1675,738,.95),(1220,702,.66),(1110,710,.5)]:
    village+=f'<use href="#pine" transform="translate({x} {y}) scale({s})" color="#214b54"/>'
# A village Christmas tree and tiny lights in the distance.
village+='<use href="#pine" transform="translate(1000 695) scale(.88)" color="#1c5b5d"/>'
for x,y in [(994,513),(976,552),(1023,565),(965,605),(1005,621),(1034,643),(962,660),(1007,673)]:
    village+=ellipse(x,y,4,4,'#f3c77a')+ellipse(x,y,10,10,'#f3c77a20')
village+=path('m1000 453 5 12 14 2-10 10 2 13-11-6-12 6 3-13-10-10 13-2Z','#ffe0a3')
village+=path('M0 851q402-125 825-33t1095-25v287H0Z','url(#snow)')
village+=path('M0 990q431-87 731-8t1189-33v131H0Z','#d3e3e4')
village+=path('M0 1013q378-55 647-5M1139 907q389-104 781-50M86 881q145-28 294-8','none','#f1f3e9',3)
save('winter-village',village,'0 0 1920 1080',defs)

cover=path('M0 0h83l29 658L67 1000H0Z','#183b46')
cover+=path('M47 90 211 19 130 133 318 63 191 201 376 160 208 286 399 290 194 391 406 429 172 486 336 582 105 551 70 814 0 790V58Z','#24525a')
cover+=path('m66 150 125-88-65 82 169-53-116 88 169 0-155 46 120-11-130 55M58 351l133-97-60 87 193-19-142 63 162 29-177 9M49 509l119-63-56 56 183 48-203-10','none','#bfd8d8',12)
save('winter-cover',cover,'0 0 440 1000')

# Crisp, original snow and ribbon impact. Both remain decorative, outside the QR.
puff=''
for i in range(34):
    x,y=rng.randrange(90,920),rng.randrange(70,940)
    puff+=ellipse(x,y,rng.randrange(7,32),rng.randrange(6,27),rng.choice(['#fffbed','#d9eff3','#c5e0ed']))
for x,y in [(100,310),(820,205),(465,92),(850,730),(210,815),(590,876)]:puff+=snowflake(x,y,2.1,'#f5f9ef')
for d in ['M160 230q-100 100 40 200t-10 180','M791 301q107 46-7 151t97 215','M376 160q122-87 190 38']:
    puff+=path(d,'none','#e9bd68',13)
save('snow-burst',puff)
save('snowflake',snowflake(50,50,3,'#c9e6df'),'0 0 100 100')

print('Built 8 Christmas SVG assets.')
