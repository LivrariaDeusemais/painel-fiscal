import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src/conferencia'))
from parser import money
class MoneyTests(unittest.TestCase):
 def test_account_nature_and_parenthesis(self):
  self.assertEqual(money('1.234,56D'),123456)
  self.assertEqual(money('1.234,56C'),-123456)
  self.assertEqual(money('(1.234,56)'),-123456)
  self.assertEqual(money('0,00'),0)
if __name__=='__main__': unittest.main()
