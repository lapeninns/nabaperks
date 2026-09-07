#!/usr/bin/env python3
"""Build a Docker-load archive from pinned public GHCR images, with resumable pulls."""
import argparse
import concurrent.futures
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile
import time
import urllib.request

CHUNK = 2 * 1024 * 1024
ACCEPT = 'application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'


def digest(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def checked_digest(value):
    if not isinstance(value, str) or not re.fullmatch(r'sha256:[a-f0-9]{64}', value):
        raise ValueError('invalid sha256 digest')
    return value.split(':')[1]


def file_digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(CHUNK):
            result.update(block)
    return 'sha256:' + result.hexdigest()


def token_for(repo):
    with urllib.request.urlopen('https://ghcr.io/token?scope=repository:' + repo + ':pull', timeout=45) as response:
        return json.load(response)['token']


def request(repo, suffix, token, headers=None):
    return urllib.request.Request('https://ghcr.io/v2/' + repo + '/' + suffix,
        headers={'Authorization': 'Bearer ' + token, **(headers or {})})


def image_manifest(image):
    ref = image['tag']
    if not re.fullmatch(r'ghcr.io/supabase/[a-z0-9-]+:[A-Za-z0-9_.-]+', ref):
        raise ValueError('only pinned public Supabase images are accepted')
    repo = ref.removeprefix('ghcr.io/').split(':')[0]
    checked_digest(image['digest'])
    with urllib.request.urlopen(request(repo, 'manifests/' + image['digest'], token_for(repo), {'Accept': ACCEPT}), timeout=45) as response:
        raw = response.read()
    if digest(raw) != image['digest']:
        raise ValueError('manifest digest mismatch: ' + ref)
    manifest = json.loads(raw)
    if manifest['config']['digest'] != image['configDigest']:
        raise ValueError('config digest mismatch: ' + ref)
    return repo, manifest


def download_blob(repo, descriptor, folder):
    expected = descriptor['digest']
    filename = checked_digest(expected)
    size = descriptor['size']
    if not isinstance(size, int) or size <= 0:
        raise ValueError('invalid blob size')
    target = folder / filename
    if target.exists() and target.stat().st_size == size and file_digest(target) == expected:
        return target
    partial = folder / (filename + '.part')
    if partial.exists() and partial.stat().st_size > size:
        partial.unlink()
    position = partial.stat().st_size if partial.exists() else 0
    token = token_for(repo)
    while position < size:
        end = min(position + CHUNK, size) - 1
        for attempt in range(6):
            try:
                req = request(repo, 'blobs/' + expected, token, {'Range': f'bytes={position}-{end}'})
                with urllib.request.urlopen(req, timeout=60) as response:
                    if response.status == 206:
                        if response.headers.get('Content-Range') != f'bytes {position}-{end}/{size}':
                            raise ValueError('incorrect Content-Range')
                    elif not (response.status == 200 and position == 0 and end == size - 1):
                        raise ValueError('registry did not honour byte range')
                    block = response.read(end - position + 2)
                if len(block) != end - position + 1:
                    raise ValueError('incomplete range')
                with partial.open('ab') as stream:
                    stream.write(block)
                position += len(block)
                break
            except Exception as error:
                if attempt == 5:
                    raise RuntimeError('blob download failed: ' + expected) from error
                time.sleep(min(2 ** attempt, 10))
                token = token_for(repo)
    if file_digest(partial) != expected:
        partial.unlink()
        raise ValueError('blob digest mismatch: ' + expected)
    partial.replace(target)
    print('verified', filename[:12], size, flush=True)
    return target


def build_archive(manifest, folder, archive):
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        resolved = list(pool.map(image_manifest, manifest['images']))
    blobs = {}
    for repo, image in resolved:
        for desc in [image['config'], *image['layers']]:
            blobs.setdefault(desc['digest'], (repo, desc))
    print('downloading', len(blobs), 'unique blobs;', sum(d['size'] for _, d in blobs.values()), 'bytes', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda item: download_blob(*item, folder), blobs.values()))
    entries = []
    members = {}
    for pin, (_, image) in zip(manifest['images'], resolved):
        config_name = checked_digest(image['config']['digest'])
        config = json.loads((folder / config_name).read_bytes())
        if config['architecture'] != 'arm64' or config['os'] != 'linux':
            raise ValueError('wrong image platform')
        diff_ids = config['rootfs']['diff_ids']
        if len(diff_ids) != len(image['layers']):
            raise ValueError('layer count mismatch')
        members[config_name + '.json'] = folder / config_name
        layers = []
        for desc, diff_id in zip(image['layers'], diff_ids):
            raw_name = checked_digest(diff_id) + '.tar'
            raw_path = folder / raw_name
            if not raw_path.exists() or file_digest(raw_path) != diff_id:
                blob = folder / checked_digest(desc['digest'])
                opener = gzip.open if desc['mediaType'].endswith(('gzip', '+gzip')) else open
                with opener(blob, 'rb') as source, raw_path.open('wb') as output:
                    while block := source.read(CHUNK):
                        output.write(block)
                if file_digest(raw_path) != diff_id:
                    raw_path.unlink()
                    raise ValueError('uncompressed layer digest mismatch')
            layers.append(raw_name)
            members[raw_name] = raw_path
        entries.append({'Config': config_name + '.json', 'RepoTags': [pin['tag']], 'Layers': layers})
    temporary = archive.with_suffix('.partial')
    with tarfile.open(temporary, 'w', format=tarfile.USTAR_FORMAT) as output:
        for name, path in sorted(members.items()):
            info = tarfile.TarInfo(name)
            info.size = path.stat().st_size
            info.mode = 0o444
            with path.open('rb') as source:
                output.addfile(info, source)
        raw = json.dumps(entries, separators=(',', ':')).encode()
        info = tarfile.TarInfo('manifest.json')
        info.size = len(raw)
        info.mode = 0o444
        output.addfile(info, io.BytesIO(raw))
    temporary.replace(archive)
    pin = {'archiveSha256': file_digest(archive).split(':')[1],
        'manifestSha256': hashlib.sha256(json.dumps(manifest, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()}
    archive.with_suffix('.json').write_text(json.dumps(pin, indent=2) + '\n')
    print('archive complete', json.dumps(pin), flush=True)


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--manifest', required=True, type=Path)
    args.add_argument('--output', required=True, type=Path)
    options = args.parse_args()
    options.output.mkdir(parents=True, exist_ok=True)
    blobs = options.output / 'blobs'
    blobs.mkdir(exist_ok=True)
    build_archive(json.loads(options.manifest.read_text()), blobs, options.output / 'supabase-images.tar')


if __name__ == '__main__':
    main()
