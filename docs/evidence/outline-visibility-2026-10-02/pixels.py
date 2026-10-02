import json,struct,zlib
from pathlib import Path
def png(path):
    b=Path(path).read_bytes(); i=8; parts=[]
    while i<len(b):
        n=struct.unpack_from('>I',b,i)[0];kind=b[i+4:i+8];d=b[i+8:i+8+n];i+=n+12
        if kind==b'IHDR':w,h,depth,colour,*_=struct.unpack('>IIBBBBB',d)
        elif kind==b'IDAT':parts.append(d)
    assert depth==8 and colour in (2,6)
    channels=3 if colour==2 else 4;size=w*channels;raw=zlib.decompress(b''.join(parts));out=bytearray();previous=bytearray(size);pos=0
    for y in range(h):
        filter=raw[pos];pos+=1;row=bytearray(raw[pos:pos+size]);pos+=size
        for x in range(size):
            a=row[x-channels] if x>=channels else 0;b=previous[x];c=previous[x-channels] if x>=channels else 0
            if filter==1:value=a
            elif filter==2:value=b
            elif filter==3:value=(a+b)//2
            elif filter==4:
                p=a+b-c;da,db,dc=abs(p-a),abs(p-b),abs(p-c);value=a if da<=db and da<=dc else b if db<=dc else c
            else:assert filter==0;value=0
            row[x]=(row[x]+value)%256
        out.extend(row);previous=row
    return w,h,channels,out
reports=[]
for engine in ['webkit','chromium']:
    for version in ['before','after']:
        w,h,c,on=png(f'.cache/outline-phone/{version}-{engine}-on.png');wo,ho,co,off=png(f'.cache/outline-phone/{version}-{engine}-off.png');assert (w,h,c)==(wo,ho,co)
        values=[max(abs(on[i+j]-off[i+j]) for j in range(3)) for i in range(0,len(on),c)]
        changed=[x for x in values if x>0]
        reports.append(dict(engine=engine,version=version,width=w,height=h,changedPixels=len(changed),pixelsAtLeast20Levels=sum(x>=20 for x in values),meanChangedPixelDifference=sum(changed)/len(changed),maximumDifference=max(values)))
Path('.cache/outline-phone/pixels.json').write_text(json.dumps(reports,indent=2)+'\n');print(json.dumps(reports,indent=2))
