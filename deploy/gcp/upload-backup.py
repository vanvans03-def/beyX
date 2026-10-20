#!/usr/bin/env python3
"""Upload a private logical backup with the VM identity, never a static key."""
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import quote
from urllib.request import Request, urlopen

root = Path('/opt/beyx/backups/daily').resolve()
file = Path(sys.argv[1]).resolve()
if file.parent != root or file.suffix != '.dump' or not file.is_file():
    raise SystemExit('Refusing a file outside the dedicated daily backup folder.')
data = file.read_bytes()
if len(data) < 5:
    raise SystemExit('Refusing an empty dump.')
token_request = Request('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', headers={'Metadata-Flavor': 'Google'})
with urlopen(token_request, timeout=15) as response:
    token = json.load(response)['access_token']
bucket = 'beyx-production-20261020-backups'
name = 'daily/' + file.name
url = f'https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=media&ifGenerationMatch=0&name={quote(name, safe="")}'
request = Request(url, data=data, method='POST', headers={
    'Authorization': 'Bearer ' + token, 'Content-Type': 'application/octet-stream',
})
with urlopen(request, timeout=120) as response:
    uploaded = json.load(response)
if int(uploaded['size']) != len(data):
    raise SystemExit('Uploaded object size differs from local dump.')
print(json.dumps({'backup': f'gs://{bucket}/{name}', 'bytes': len(data),
                  'sha256': hashlib.sha256(data).hexdigest(), 'generation': uploaded['generation']}))
