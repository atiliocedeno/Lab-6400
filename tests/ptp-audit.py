import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('ptp_audit', Path(__file__).resolve().parents[1] / 'scripts/ptp_audit.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
CONFIG = '/main/other/d240\nLabel: Creative Style\nReadonly: 0\nType: RADIO\nCurrent: Standard\nChoice: 0 Standard\nChoice: 1 Vivid\nEND\n/main/status/battery\nLabel: Battery\nReadonly: 1\nCurrent: 100\n'
class AuditTests(unittest.TestCase):
    def run_audit(self, detection='Sony ILCE-6400 (PC Control) usb:001,002', fail=None, config=CONFIG):
        calls=[]
        def run(args):
            calls.append(args)
            output={'--version':'gphoto2 test', '--auto-detect':detection, '--summary':'Sony ILCE-6400', '--list-all-config':config}[args[-1]]
            return {'args':args,'exitCode':1 if args[-1]==fail else 0,'stdout':output,'stderr':'failed' if args[-1]==fail else ''}
        return m.audit(run),calls
    def test_success_only_read_commands(self):
        r,calls=self.run_audit()
        self.assertTrue(r['complete']);self.assertEqual(len(calls),4)
        self.assertEqual([c[-1] for c in calls],['--version','--auto-detect','--summary','--list-all-config'])
        self.assertEqual(calls[2][0:4],['--camera','Sony ILCE-6400 (PC Control)','--port','usb:001,002'])
        self.assertEqual(r['recipeCandidates'][0]['readonly'],'0')
        self.assertEqual(len(r['recipeCandidates'][0]['choices']),2)
    def test_missing_other_or_multiple_cameras(self):
        for text in ['', 'Sony ILCE-7M4 usb:001,002', 'Sony ILCE-6400 (MTP) usb:001,002', 'Sony ILCE-6400 (PC Control) usb:001,002\nSony ILCE-6400 (PC Control) usb:001,003']:
            r,calls=self.run_audit(text);self.assertFalse(r['complete']);self.assertEqual(len(calls),2)
    def test_6400a(self):
        self.assertTrue(self.run_audit('Sony ILCE-6400A (PC Control) usb:001,004')[0]['complete'])
    def test_each_failure_stops_preserving_output(self):
        for i,flag in enumerate(['--version','--auto-detect','--summary','--list-all-config']):
            r,calls=self.run_audit(fail=flag);self.assertFalse(r['complete']);self.assertEqual(len(calls),i+1);self.assertTrue(r['commands'][-1]['stdout'])
    def test_empty_or_unrecognized_config_is_not_success(self):
        for raw in ['', 'garbage']:
            r,_=self.run_audit(config=raw);self.assertFalse(r['complete']);self.assertEqual(r['commands'][-1]['stdout'],raw)
    def test_no_inferred_write_permission(self):
        self.assertNotIn('readonly',m.parse_config('/main/other/d240\nLabel: Unknown')[0])
    def test_missing_executable(self):
        with patch.object(m.subprocess,'run',side_effect=FileNotFoundError()):
            self.assertIsNone(m.execute(['--version'])['exitCode'])
    def test_timeout_preserves_partial_bytes(self):
        with patch.object(m.subprocess,'run',side_effect=subprocess.TimeoutExpired('gphoto2',90,output=b'partial',stderr=b'busy')):
            r=m.execute(['--summary']);self.assertEqual(r['stdout'],'partial');self.assertIn('90',r['error'])
if __name__ == '__main__':unittest.main()
