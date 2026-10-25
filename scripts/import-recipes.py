import re,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
s=(root/'vendor/Recipes.java').read_text()
const={k:int(v) for k,v in re.findall(r'\b([A-Z][A-Z_0-9]*)\s*=\s*(-?\d+)',s)}
groups=re.findall(r'"([^"]+)"',re.search(r'String\[\] GROUPS = \{(.*?)\}',s).group(1))
styles=re.findall(r'"([^"]+)"',re.search(r'String\[\] STYLE_LABEL = \{(.*?)\}',s).group(1))
rows=[]
for group,name,tail in re.findall(r'new Recipe\((\w+),\s*"([^"]+)"\s*,([^\n]+?)\),',s):
 vals=[const[v.strip()] if v.strip() in const else int(v.strip()) for v in tail.split(',')]
 if len(vals)==8: vals += [0,0,6]
 if len(vals)==11: vals += [0]
 assert len(vals)==12
 r=dict(zip(['style','sat','con','sharp','wbMode','kelvin','ab','gm','pe','ev','dro','sub'],vals))
 r.update(id=re.sub('[^a-z0-9]+','-',name.lower()).strip('-'),name=name,brand=groups[const[group]],styleName=styles[r['style']])
 rows.append(r)
assert len(rows)==77 and len({r['id'] for r in rows})==77
(root/'src/recipes.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(f'Imported {len(rows)} entries; {sum(r["pe"]!=0 for r in rows)} effect-based.')
