"""
BID WARS: add photos to the auction deck.

Run this on a computer with internet, in the same folder as BID_WARS_Auction.pptx:
    python add_photos.py
Run it again any time: people who already have a photo in the "photos" folder are skipped,
so only the missing ones are retried.

It downloads each person's photo from Wikipedia / Wikidata / Wikimedia Commons, crops it to fit the photo box on
their slide, and saves BID_WARS_Auction_with_photos.pptx next to the original.

Want a different picture for someone? Put your own file in the "photos" folder,
named exactly like the person on the slide (for example "Thalapathy Vijay.jpg"),
and run the script again. Your own files always win.

Only Python 3 is needed (python.org or the Microsoft Store). No extra packages.
"""
import io, json, os, re, struct, sys, time, urllib.error, urllib.parse, urllib.request, zipfile

DECK = 'BID_WARS_Auction.pptx'
OUT = 'BID_WARS_Auction_with_photos.pptx'
PHOTO_DIR = 'photos'
FRAME_ASPECT = 4.7 / 6.1          # width / height of the photo box on the slides
FACE_BIAS = 0.15                  # when cropping tall photos, keep more of the top (faces)
UA = 'BIDWarsPhotoHelper/1.2 (one-off script that adds photos to an office-event slide deck) Python-urllib'

# Name on the slide -> Wikipedia article title
WIKI = {
    "Thalapathy Vijay": "Vijay (actor)",
    "Thala Ajith": "Ajith Kumar",
    "Rajinikanth": "Rajinikanth",
    "Allu Arjun": "Allu Arjun",
    "Prabhas": "Prabhas",
    "Atharvaa": "Atharvaa",
    "Kamal Haasan": "Kamal Haasan",
    "Hrithik Roshan": "Hrithik Roshan",
    "Yash": "Yash (actor)",
    "Shah Rukh Khan": "Shah Rukh Khan",
    "Nani": "Nani (actor)",
    "Suriya": "Suriya",
    "Ram Charan": "Ram Charan",
    "Nayanthara": "Nayanthara",
    "Mrunal Thakur": "Mrunal Thakur",
    "Trisha": "Trisha Krishnan",
    "Janhvi Kapoor": "Janhvi Kapoor",
    "Chris Evans": "Chris Evans (actor)",
    "Tom Holland": "Tom Holland",
    "Robert Downey Jr.": "Robert Downey Jr.",
    "Mohanlal": "Mohanlal",
    "Vijay Sethupathi": "Vijay Sethupathi",
    "NTR Jr.": "N. T. Rama Rao Jr.",
    "Dhanush": "Dhanush",
    "Dulquer Salmaan": "Dulquer Salmaan",
    "Fahadh Faasil": "Fahadh Faasil",
    "Deepika Padukone": "Deepika Padukone",
    "Ranbir Kapoor": "Ranbir Kapoor",
    "Samantha Ruth Prabhu": "Samantha Ruth Prabhu",
    "Sai Pallavi": "Sai Pallavi",
    "Keanu Reeves": "Keanu Reeves",
    "Jacob Duffy": "Jacob Duffy",
    "Bhuvneshwar Kumar": "Bhuvneshwar Kumar",
    "Harshit Rana": "Harshit Rana",
    "Varun Chakravarthy": "Varun Chakravarthy",
    "Jasprit Bumrah": "Jasprit Bumrah",
    "Sanju Samson": "Sanju Samson",
    "Rajat Patidar": "Rajat Patidar",
    "Phil Salt": "Phil Salt",
    "Ajinkya Rahane": "Ajinkya Rahane",
    "Rovman Powell": "Rovman Powell",
    "Shreyas Iyer": "Shreyas Iyer",
    "Priyansh Arya": "Priyansh Arya",
    "MS Dhoni": "MS Dhoni",
    "Rohit Sharma": "Rohit Sharma",
    "Virat Kohli": "Virat Kohli",
    "Ruturaj Gaikwad": "Ruturaj Gaikwad",
    "Venkatesh Iyer": "Venkatesh Iyer",
    "Krunal Pandya": "Krunal Pandya",
    "Romario Shepherd": "Romario Shepherd",
    "Hardik Pandya": "Hardik Pandya",
    "Jamie Overton": "Jamie Overton",
    "Shivam Dube": "Shivam Dube",
    "Suryakumar Yadav": "Suryakumar Yadav",
    "Shubman Gill": "Shubman Gill",
    "Rishabh Pant": "Rishabh Pant",
    "Yashasvi Jaiswal": "Yashasvi Jaiswal",
    "Abhishek Sharma": "Abhishek Sharma (cricketer)",
    "Ravindra Jadeja": "Ravindra Jadeja",
    "Rashid Khan": "Rashid Khan",
    "Mohammed Siraj": "Mohammed Siraj",
    "Yuvan Shankar Raja": "Yuvan Shankar Raja",
    "Santhosh Narayanan": "Santhosh Narayanan",
    "M.S. Viswanathan": "M. S. Viswanathan",
    "Ilaiyaraaja": "Ilaiyaraaja",
    "Sai Abhyankkar": "Sai Abhyankkar",
    "Harris Jayaraj": "Harris Jayaraj",
    "G.V. Prakash Kumar": "G. V. Prakash Kumar",
    "Anirudh Ravichander": "Anirudh Ravichander",
    "A.R. Rahman": "A. R. Rahman",
    "Devi Sri Prasad": "Devi Sri Prasad",
    "Mani Sharma": "Mani Sharma",
    "Shreya Ghoshal": "Shreya Ghoshal",
    "M.M. Keeravani": "M. M. Keeravani",
    "Thaman S": "Thaman S",
    "Ravi Basrur": "Ravi Basrur",
    "Naushad Ali": "Naushad",
    "S.P. Balasubrahmanyam": "S. P. Balasubrahmanyam",
    "S. Janaki": "S. Janaki",
    "K.S. Chithra": "K. S. Chithra",
    "M.S. Subbulakshmi": "M. S. Subbulakshmi",
    "Karthik": "Karthik (singer)",
    "Sid Sriram": "Sid Sriram",
    "Arijit Singh": "Arijit Singh",
    "Vijay Antony": "Vijay Antony",
    "D. Imman": "D. Imman",
    "K.J. Yesudas": "K. J. Yesudas",
    "Hariharan": "Hariharan (singer)",
    "Shankar Mahadevan": "Shankar Mahadevan",
    "Sonu Nigam": "Sonu Nigam",
    "Chinmayi": "Chinmayi",
    "Shaan": "Shaan (singer)",
}


class FetchError(Exception):
    pass


def http_get(url, tries=4):
    """GET with polite retries. Wikimedia answers 429/503 when asked too fast."""
    last = None
    for n in range(tries):
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = f'HTTP {e.code}'
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(3 * (2 ** n))
                continue
            raise FetchError(last)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = f'network: {getattr(e, "reason", e)}'
            time.sleep(2 * (n + 1))
    raise FetchError(last or 'unknown error')


def api(host, **params):
    params.setdefault('format', 'json')
    return json.loads(http_get(f'https://{host}/w/api.php?' + urllib.parse.urlencode(params)))


def wp_page(title):
    """(lead image file name, wikidata id, real title) for an English Wikipedia article."""
    d = api('en.wikipedia.org', action='query', titles=title, prop='pageimages|pageprops', piprop='name', redirects=1)
    for p in d.get('query', {}).get('pages', {}).values():
        if 'missing' in p:
            continue
        return p.get('pageimage'), p.get('pageprops', {}).get('wikibase_item'), p.get('title', title)
    return None, None, None


def wd_image(qid):
    d = api('www.wikidata.org', action='wbgetclaims', entity=qid, property='P18')
    for c in d.get('claims', {}).get('P18', []):
        v = c.get('mainsnak', {}).get('datavalue', {}).get('value')
        if v:
            return v
    return None


def wp_search(q, n=3):
    d = api('en.wikipedia.org', action='query', list='search', srsearch=q, srlimit=n)
    return [h['title'] for h in d.get('query', {}).get('search', [])]


def commons_search(q, n=6):
    d = api('commons.wikimedia.org', action='query', list='search', srsearch=q, srnamespace=6, srlimit=n)
    return [h['title'].split(':', 1)[1] for h in d.get('query', {}).get('search', [])]


def file_urls(filename):
    """Commons gives a ready-made 960px copy (thumburl) plus the original (url)."""
    d = api('commons.wikimedia.org', action='query', titles='File:' + filename, prop='imageinfo', iiprop='url|mime', iiurlwidth=960)
    for p in d.get('query', {}).get('pages', {}).values():
        for ii in p.get('imageinfo', []):
            if ii.get('mime') in ('image/jpeg', 'image/png'):
                return [u for u in (ii.get('thumburl'), ii.get('url')) if u], ii.get('descriptionurl')
    return [], None


SKIP = re.compile(r'(logo|signature|autograph|poster|\.svg$|\.gif$|\.webm$|\.ogv$|\.pdf$|\.tif)', re.I)


def image_size(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', data[16:24]), 'png'
    if data[:2] == b'\xff\xd8':
        i = 2
        while i < len(data):
            if data[i] != 0xFF:
                i += 1; continue
            marker = data[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                i += 2; continue
            seg = struct.unpack('>H', data[i + 2:i + 4])[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack('>HH', data[i + 5:i + 9])
                return (w, h), 'jpeg'
            i += 2 + seg
    return None, None


def local_photo(name):
    if not os.path.isdir(PHOTO_DIR):
        return None
    for f in os.listdir(PHOTO_DIR):
        stem, ext = os.path.splitext(f)
        if stem.lower() == name.lower() and ext.lower() in ('.jpg', '.jpeg', '.png'):
            return open(os.path.join(PHOTO_DIR, f), 'rb').read()
    return None


def get_photo(name, offline=False):
    """Returns (bytes, source) or (None, reason)."""
    data = local_photo(name)
    if data:
        return data, 'your photos folder'
    if offline:
        return None, 'no local file'
    title = WIKI.get(name, name)
    query = re.sub(r'[()]', ' ', title)
    tried, last_err = [], None

    def candidates():
        file, qid, real = wp_page(title)                 # 1. the article's main photo
        yield file
        if qid:
            yield wd_image(qid)                           # 2. Wikidata's photo of the person
        for t in wp_search(query):                         # 3. close matches on Wikipedia
            if t != real:
                f, q2, _ = wp_page(t)
                yield f
                if q2:
                    yield wd_image(q2)
        for f in commons_search(query):                    # 4. Wikimedia Commons photo search
            yield f

    try:
        for f in candidates():
            if not f or f in tried or SKIP.search(f):
                continue
            tried.append(f)
            urls, page = file_urls(f)
            for u in urls:
                try:
                    data = http_get(u)
                except FetchError as e:
                    last_err = str(e)
                    continue
                if image_size(data)[0]:
                    os.makedirs(PHOTO_DIR, exist_ok=True)
                    ext = '.png' if data[:4] == b'\x89PNG' else '.jpg'
                    with open(os.path.join(PHOTO_DIR, name + ext), 'wb') as fh:   # cached, and easy to replace
                        fh.write(data)
                    time.sleep(1)                                                  # be polite to Wikimedia
                    return data, page or u
    except FetchError as e:
        last_err = str(e)
    except Exception as e:
        last_err = f'{e.__class__.__name__}: {e}'
    if last_err:
        return None, f'download failed ({last_err})'
    return None, 'no usable photo found'


def crop_rect(w, h):
    """srcRect (thousandths of a percent) that fills the frame without stretching."""
    if w / h > FRAME_ASPECT:                       # too wide: trim the sides equally
        cut = 1 - (h * FRAME_ASPECT) / w
        side = int(cut / 2 * 100000)
        return side, 0, side, 0
    cut = 1 - (w / FRAME_ASPECT) / h               # too tall: trim mostly from the bottom
    top = int(cut * FACE_BIAS * 100000)
    return 0, top, 0, int(cut * 100000) - top


def slide_title(xml):
    m = re.search(r'<p:sp>(?:(?!</p:sp>).)*?<p:ph[^>]*type="title"[^>]*/>(?:(?!</p:sp>).)*?</p:sp>', xml, re.S)
    if not m:
        return None
    return ''.join(re.findall(r'<a:t>([^<]*)</a:t>', m.group(0))).replace('&amp;', '&').strip()


def main():
    offline = '--offline' in sys.argv
    deck = next((a for a in sys.argv[1:] if a.endswith('.pptx')), DECK)
    out = OUT if deck == DECK else deck.replace('.pptx', '_with_photos.pptx')
    if not os.path.exists(deck):
        print(f'Could not find {deck}. Put this script in the same folder as the deck.')
        return
    zin = zipfile.ZipFile(deck)
    files = {n: zin.read(n) for n in zin.namelist()}
    infos = {n: zin.getinfo(n) for n in zin.namelist()}
    zin.close()

    slides = sorted((n for n in files if re.match(r'ppt/slides/slide\d+\.xml$', n)), key=lambda n: int(re.findall(r'\d+', n)[-1]))
    cache, report, media_no = {}, [], 0
    for sn in slides:
        xml = files[sn].decode('utf8')
        pos = xml.find('type="pic"')
        if pos < 0:
            continue
        name = slide_title(xml)
        if not name:
            continue
        if name not in cache:
            data, src = get_photo(name, offline)
            size, kind = image_size(data) if data else (None, None)
            if data and not size:
                data, src = None, 'unreadable image file'
            if data:
                media_no += 1
                media = f'ppt/media/bw_photo_{media_no}.{"png" if kind == "png" else "jpeg"}'
                files[media] = data
                cache[name] = (media, size)
            else:
                cache[name] = None
            report.append((name, src))
            print(('  ok   ' if data else '  --   ') + name + ('' if data else f'   ({src})'))
        hit = cache[name]
        if not hit:
            continue
        media, (w, h) = hit
        # relationship
        rels_name = sn.replace('slides/', 'slides/_rels/') + '.rels'
        rels = files[rels_name].decode('utf8')
        ids = [int(x) for x in re.findall(r'Id="rId(\d+)"', rels)] or [0]
        rid = f'rId{max(ids) + 1}'
        rels = rels.replace('</Relationships>', f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/{media.split("/")[-1]}"/></Relationships>')
        files[rels_name] = rels.encode('utf8')
        # swap the empty picture placeholder for a picture inside it
        start = xml.rfind('<p:sp>', 0, pos)
        end = xml.find('</p:sp>', pos) + len('</p:sp>')
        sp = xml[start:end]
        ph = re.search(r'<p:ph[^>]*type="pic"[^>]*/>', sp).group(0)
        xfrm = re.search(r'<a:xfrm>.*?</a:xfrm>', sp, re.S)
        ids_used = [int(x) for x in re.findall(r'<p:cNvPr id="(\d+)"', xml)]
        l, t, r, b = crop_rect(w, h)
        safe = name.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')
        pic = (f'<p:pic><p:nvPicPr><p:cNvPr id="{max(ids_used) + 1}" name="Photo" descr="{safe}"/>'
               f'<p:cNvPicPr><a:picLocks noGrp="1" noChangeAspect="1"/></p:cNvPicPr><p:nvPr>{ph}</p:nvPr></p:nvPicPr>'
               f'<p:blipFill><a:blip r:embed="{rid}"/><a:srcRect l="{l}" t="{t}" r="{r}" b="{b}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
               f'<p:spPr>{xfrm.group(0) if xfrm else ""}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>')
        files[sn] = (xml[:start] + pic + xml[end:]).encode('utf8')

    ct = files['[Content_Types].xml'].decode('utf8')
    for ext, mime in (('jpeg', 'image/jpeg'), ('png', 'image/png')):
        if f'Extension="{ext}"' not in ct:
            ct = ct.replace('<Default ', f'<Default Extension="{ext}" ContentType="{mime}"/><Default ', 1)
    files['[Content_Types].xml'] = ct.encode('utf8')

    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, data in files.items():
            info = infos.get(n) or zipfile.ZipInfo(n)
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
    with open('photo_credits.txt', 'w', encoding='utf8') as f:
        f.write('Photo sources (Wikipedia / Wikimedia Commons; each photo\'s licence is on its page)\n\n')
        for n, s in report:
            f.write(f'{n}: {s}\n')
    got = sum(1 for v in cache.values() if v)
    print(f'\nAdded photos for {got} of {len(cache)} people. Saved {out}.')
    missing = [n for n, v in cache.items() if not v]
    if missing:
        print('No photo for: ' + ', '.join(missing))
        print(f'Add your own picture for them to the "{PHOTO_DIR}" folder (named like the slide) and run again.')


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    main()
    if os.name == 'nt' and sys.stdin and sys.stdin.isatty():
        input('\nPress Enter to close.')
