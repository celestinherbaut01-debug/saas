"""Generate an exact, silent explanatory animation, not a recording of live data.
Requires Pillow, DejaVu fonts and ffmpeg. Run from webapp/.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess

OUT = Path('public/demo')
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 960, 756, 24
font_root = Path('/usr/share/fonts/truetype/dejavu')
def font(size, bold=False):
    return ImageFont.truetype(str(font_root/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')), size)
slides = [
  ('AGENCE WEB', 'Trouver des clients', 'pour créer leur site.',
   'VOTRE OFFRE', 'Création de sites internet',
   [('CIBLES', 'Commerces et artisans de votre zone'), ('SIGNAL', 'Sans site renseigné sur Google'), ('À CONFIRMER', 'Absence réelle de site et besoin du client')], '#eaf2dc'),
  ('NETTOYAGE', 'Choisir les locaux', 'adaptés à votre offre.',
   'VOTRE OFFRE', 'Nettoyage de bureaux',
   [('CIBLES', 'Cabinets et gestionnaires de locaux'), ('CRITÈRE', 'Activité compatible avec la prestation'), ('À QUALIFIER', 'Surface, fréquence et contrat actuel')], '#e8f2ec'),
  ('GARAGE', 'Organiser l’atelier.', 'Suivre vos clients.',
   'VOTRE PRIORITÉ', 'La gestion métier',
   [('CLIENTS', 'Fiches clients et véhicules'), ('ATELIER', 'Rendez-vous et interventions'), ('SI C’EST VOTRE OFFRE', 'Prospection B2B pour l’entretien de flottes')], '#f5ece1'),
]
frames=[]
for ix,(tag,title1,title2,label,offer,rows,tint) in enumerate(slides):
    im=Image.new('RGB',(W,H),'#fafbf8');d=ImageDraw.Draw(im)
    d.rounded_rectangle((24,24,W-24,H-24),radius=20,fill=tint,outline='#d9e4d3',width=2)
    d.text((60,49),'ProspectFlow',font=font(22,True),fill='#213d33')
    d.text((690,52),'PARCOURS ILLUSTRATIF',font=font(12,True),fill='#61795d')
    d.rounded_rectangle((60,105,315,139),radius=16,fill='#203d33')
    d.text((77,113),tag,font=font(13,True),fill='#e0efb6')
    d.text((60,171),title1,font=font(39,True),fill='#213d33')
    d.text((60,222),title2,font=font(39,True),fill='#507858')
    d.text((60,300),label,font=font(12,True),fill='#6e8465')
    d.text((60,327),offer,font=font(22,True),fill='#213d33')
    for i,(key,value) in enumerate(rows):
        y=385+i*81
        d.rounded_rectangle((60,y,900,y+67),radius=9,fill='#ffffff',outline='#d7e0d0')
        d.ellipse((77,y+18,106,y+47),fill='#e8efd9')
        d.text((85,y+25),str(i+1),font=font(12,True),fill='#54714c')
        d.text((123,y+12),key,font=font(10,True),fill='#79906c')
        d.text((123,y+31),value,font=font(17),fill='#294132')
    d.text((60,654),'Votre offre détermine les critères. Le besoin reste à vérifier.',font=font(15),fill='#5e7359')
    d.text((60,694),'Explication du fonctionnement · aucune recherche réelle',font=font(12),fill='#7c8d73')
    frames.append(im)
frames[0].save(OUT/'poster.jpg',quality=91)
cmd=['ffmpeg','-y','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'parcours-metiers.mp4')]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for i,base in enumerate(frames):
    for n in range(6*FPS):
        im=base.copy();d=ImageDraw.Draw(im)
        for j in range(3):
            x=630+j*90;d.rounded_rectangle((x,704,x+70,709),radius=2,fill='#d0ddc7')
            if j<i: d.rounded_rectangle((x,704,x+70,709),radius=2,fill='#466e4d')
            if j==i: d.rounded_rectangle((x,704,x+max(1,70*(n+1)/(6*FPS)),709),radius=2,fill='#466e4d')
        p.stdin.write(im.tobytes())
p.stdin.close()
assert p.wait()==0
print('Created 18-second explainer and poster.')
