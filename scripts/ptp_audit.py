#!/usr/bin/env python3
"""Inventory A6400 USB configuration via gphoto2; never request setting writes."""
import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def execute(args):
    try:
        p = subprocess.run(['gphoto2', *args], capture_output=True, text=True,
                           timeout=90, env={**os.environ, 'LC_ALL': 'C', 'LANG': 'C'})
        return {'args': args, 'exitCode': p.returncode, 'stdout': p.stdout, 'stderr': p.stderr}
    except FileNotFoundError:
        return {'args': args, 'exitCode': None, 'stdout': '', 'stderr': 'Falta gphoto2. Instala con brew install gphoto2.'}
    except subprocess.TimeoutExpired as e:
        def decode(value):
            return value.decode('utf-8', errors='replace') if isinstance(value, bytes) else value or ''
        return {'args': args, 'exitCode': None, 'stdout': decode(e.stdout),
                'stderr': decode(e.stderr), 'error': 'Tiempo agotado (90 segundos).'}


def parse_config(text):
    items = []
    item = None
    for line in text.splitlines():
        if line.startswith('/main/'):
            item = {'path': line.strip(), 'choices': []}
            items.append(item)
        elif item is not None and ': ' in line:
            key, value = line.split(': ', 1)
            if key == 'Choice':
                item['choices'].append(value)
            elif key in ('Label', 'Readonly', 'Type', 'Current', 'Bottom', 'Top', 'Step'):
                item[key.lower()] = value
    return items


def audit(run=execute):
    report = {'schemaVersion': 1, 'transport': 'USB/PTP via gphoto2',
              'time': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'complete': False, 'commands': [], 'controls': [],
              'scope': 'Lectura de configuración expuesta por gphoto2. Readonly=0 no verifica escrituras. Ausencia no demuestra imposibilidad con otro controlador.'}
    def call(args):
        result = run(args)
        report['commands'].append(result)
        if result['exitCode'] != 0:
            raise RuntimeError(result.get('error') or result['stderr'] or 'gphoto2 falló.')
        return result['stdout']
    try:
        call(['--version'])
        detection = call(['--auto-detect'])
        cameras = re.findall(r'^(Sony ILCE-6400A? \(PC Control\))\s+(usb:\d+,\d+)\s*$', detection, re.M)
        if len(cameras) != 1:
            raise RuntimeError('Se necesita exactamente una A6400 en PC Control por USB; no se ejecutó el inventario.')
        model, port = cameras[0]
        report['model'] = model
        prefix = ['--camera', model, '--port', port]
        call([*prefix, '--summary'])
        raw = call([*prefix, '--list-all-config'])
        report['controls'] = parse_config(raw)
        if not report['controls']:
            raise RuntimeError('No se pudo interpretar la configuración. Se conserva la respuesta original.')
        report['recipeCandidates'] = [c for c in report['controls'] if re.search(
            r'creative|contrast|saturat|sharp|white.?balance|colortemp|d.?range|dro|picture.?effect|abfilter|ccfilter|d201|d20f|d210|d21b|d21c|d240',
            c['path']+' '+c.get('label', ''), re.I)]
        report['complete'] = True
    except RuntimeError as e:
        report['error'] = str(e)
    return report


def main():
    report = audit()
    filename = Path('sony-ptp-diagnostico-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json')
    with filename.open('x', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print('Informe guardado: '+str(filename.resolve()))
    print('Inventario terminado; no se enviaron ajustes.' if report['complete'] else report['error'])
    return 0 if report['complete'] else 1


if __name__ == '__main__':
    sys.exit(main())
