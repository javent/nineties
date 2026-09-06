"""Extract the 15 connected band-logo stickers from the supplied cutting-mat photo.
The Foo Fighters, Radiohead and Nirvana emblems/wordmarks share a backing and
remain one sticker each. Requires Pillow, NumPy and OpenCV. Masters ship ready.
"""
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageFilter, ImageDraw

ROOT=Path(__file__).resolve().parent.parent
PHOTO=ROOT.parent/'uploads'/'90s-bands-sticker-pack.jpg'
OUT=ROOT/'artwork'/'stickers';PUBLIC=ROOT/'public'/'assets';QA=ROOT/'qa'/'bands'
for p in [OUT,PUBLIC,QA]:p.mkdir(parents=True,exist_ok=True)
BOXES={
 'weezer':(31,49,361,234),
 'soundgarden':(359,29,696,139),
 'alice-in-chains':(328,128,665,251),
 'foo-fighters':(651,28,992,244),
 'red-hot-chili-peppers':(94,232,367,494),
 'radiohead':(348,239,643,460),
 'smashing-pumpkins':(644,230,950,510),
 'stone-temple-pilots':(43,489,342,701),
 'oasis':(332,453,685,620),
 'rage-against-the-machine':(687,505,943,712),
 'nirvana':(375,614,612,889),
 'the-offspring':(51,699,389,791),
 'pearl-jam':(637,705,984,819),
 'rem':(55,785,391,941),
 'nine-inch-nails':(633,812,970,960),
}

def extract(crop):
 rgb=np.asarray(crop.convert('RGB')).copy()
 # The white vinyl outline is continuous; its enclosed black/red/blue print is kept.
 white=(np.min(rgb,axis=2)>180).astype('uint8')*255
 white=cv2.morphologyEx(white,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
 contours,_=cv2.findContours(white,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 usable=[]
 for contour in contours:
  x,y,w,h=cv2.boundingRect(contour)
  if x>0 and y>0 and x+w<rgb.shape[1] and y+h<rgb.shape[0]:usable.append(contour)
 if not usable:usable=contours
 main=max(usable,key=cv2.contourArea)
 alpha=np.zeros(white.shape,np.uint8);cv2.drawContours(alpha,[main],-1,255,-1)
 alpha=cv2.GaussianBlur(alpha,(3,3),.42)
 return Image.fromarray(np.dstack([rgb,alpha]),'RGBA')

if __name__=='__main__':
 photo=Image.open(PHOTO).convert('RGB');results=[]
 for name,box in BOXES.items():
  if name=='nine-inch-nails':
   image=photo.crop((642,820,961,951)).convert('RGBA');alpha=Image.new('L',image.size,0);ImageDraw.Draw(alpha).rounded_rectangle((0,0,image.width-1,image.height-1),radius=5,fill=255);image.putalpha(alpha)
  else:image=extract(photo.crop(box))
  image=image.crop(image.getchannel('A').getbbox())
  scale=600/max(image.size);image=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
  color=image.convert('RGB').filter(ImageFilter.UnsharpMask(radius=.6,percent=50,threshold=3));color.putalpha(image.getchannel('A'))
  master=Image.new('RGBA',(image.width+16,image.height+16),(243,241,231,0));master.alpha_composite(color,(8,8))
  master.save(OUT/f'sticker-band-{name}.png',optimize=True)
  master.save(PUBLIC/f'sticker-band-{name}.webp',format='WEBP',quality=94,method=6,exact=True)
  results.append((name,master));print(name,master.size)
 page=Image.new('RGB',(1250,780),'#30261c');d=ImageDraw.Draw(page)
 for i,(name,im) in enumerate(results):
  im=im.copy();im.thumbnail((222,215));x=i%5*250+(250-im.width)//2;y=i//5*260+8+(217-im.height)//2
  page.paste(im,(x,y),im.getchannel('A'));d.text((i%5*250+8,i//5*260+235),name,fill='#e5d5b4')
 page.save(QA/'cutouts.jpg',quality=94)
