// UK Crime Atlas — approximate data model.
// Rates are modelled from published annual police recorded crime rates (ONS / data.police.uk, excl. ASB & fraud),
// split into months with a seasonal profile. Figures are indicative, not official statistics.
(function () {
  const R = (p, a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(p + String(i).padStart(6, '0')); return o; };
  const L = (p, ...n) => n.map(i => p + String(i).padStart(6, '0'));

  // id, name, short, population (000s), annual crimes per 1,000, hex [col,row], LAD codes, profile
  const F = [
    ['avon-somerset','Avon and Somerset','A&S',1780,82,[2,7],[...L('E06',22,23,24,25),...L('E07',187,188,189,246)]],
    ['bedfordshire','Bedfordshire','BED',700,90,[5,6],L('E06',32,55,56)],
    ['cambridgeshire','Cambridgeshire','CAM',900,80,[6,5],[...L('E06',31),...R('E07',8,12)]],
    ['cheshire','Cheshire','CHE',1090,78,[2,4],L('E06',6,7,49,50)],
    ['city-of-london','City of London','COL',8.6,780,[6,7],L('E09',1),'city'],
    ['cleveland','Cleveland','CLE',570,135,[5,1],R('E06',1,4)],
    ['cumbria','Cumbria','CUM',500,72,[3,1],R('E07',26,31),'rural'],
    ['derbyshire','Derbyshire','DER',1060,78,[4,4],[...L('E06',15),...R('E07',32,39)]],
    ['devon-cornwall','Devon and Cornwall','D&C',1810,66,[1,8],[...L('E06',26,27,52,53),...R('E07',40,47)],'rural'],
    ['dorset','Dorset','DOR',780,72,[2,8],L('E06',58,59)],
    ['durham','Durham','DUR',640,100,[4,1],L('E06',5,47)],
    ['dyfed-powys','Dyfed-Powys','D-P',520,55,[1,5],L('W06',8,9,10,23),'rural'],
    ['essex','Essex','ESX',1880,88,[7,6],[...L('E06',33,34),...R('E07',66,77)]],
    ['gloucestershire','Gloucestershire','GLO',650,72,[3,6],R('E07',78,83)],
    ['greater-manchester','Greater Manchester','GMP',2870,118,[3,3],R('E08',1,10),'metro'],
    ['gwent','Gwent','GWE',600,95,[2,6],L('W06',18,19,20,21,22)],
    ['hampshire','Hampshire and Isle of Wight','HAM',2030,85,[3,8],[...L('E06',44,45,46),...R('E07',84,94)]],
    ['hertfordshire','Hertfordshire','HER',1200,75,[6,6],[...L('E07',95,96,98,99,102,103),...R('E07',240,243)]],
    ['humberside','Humberside','HUM',940,105,[5,2],R('E06',10,13)],
    ['kent','Kent','KEN',1880,100,[7,7],[...L('E06',35),...R('E07',105,116)]],
    ['lancashire','Lancashire','LAN',1540,95,[3,2],[...L('E06',8,9),...R('E07',117,128)]],
    ['leicestershire','Leicestershire','LEI',1100,80,[4,5],[...L('E06',16,17),...R('E07',129,135)]],
    ['lincolnshire','Lincolnshire','LIN',770,68,[6,4],R('E07',136,142),'rural'],
    ['merseyside','Merseyside','MER',1430,100,[2,3],R('E08',11,15),'metro'],
    ['metropolitan','Metropolitan Police','MPS',8870,100,[5,7],R('E09',2,33),'london'],
    ['norfolk','Norfolk','NOR',920,70,[7,4],R('E07',143,149),'rural'],
    ['north-wales','North Wales','N-W',690,78,[1,4],R('W06',1,6)],
    ['north-yorkshire','North Yorkshire','N-Y',830,60,[4,2],[...L('E06',14),...R('E07',163,169)],'rural'],
    ['northamptonshire','Northamptonshire','NTH',790,85,[5,5],L('E06',61,62)],
    ['northumbria','Northumbria','NUM',1470,105,[4,0],[...L('E06',57),...R('E08',21,24),...L('E08',37)],'metro'],
    ['nottinghamshire','Nottinghamshire','NOT',1170,90,[5,4],[...L('E06',18),...R('E07',170,176)]],
    ['south-wales','South Wales','S-W',1340,90,[1,6],[...R('W06',11,16),...L('W06',24)]],
    ['south-yorkshire','South Yorkshire','S-Y',1380,110,[5,3],R('E08',16,19),'metro'],
    ['staffordshire','Staffordshire','STA',1140,88,[3,4],[...L('E06',21),...R('E07',192,199)]],
    ['suffolk','Suffolk','SUF',770,68,[7,5],L('E07',200,202,203,244,245),'rural'],
    ['surrey','Surrey','SUR',1210,58,[4,8],R('E07',207,217)],
    ['sussex','Sussex','SUS',1720,80,[5,8],[...L('E06',43),...R('E07',61,65),...R('E07',223,229)]],
    ['thames-valley','Thames Valley','T-V',2460,76,[4,7],[...R('E06',36,42),...L('E06',60),...R('E07',177,181)]],
    ['warwickshire','Warwickshire','WAR',600,75,[4,6],R('E07',218,222)],
    ['west-mercia','West Mercia','W-M',1310,75,[2,5],[...L('E06',19,20,51),...R('E07',234,239)]],
    ['west-midlands','West Midlands','WMP',2950,115,[3,5],R('E08',25,31),'metro'],
    ['west-yorkshire','West Yorkshire','WYP',2350,125,[4,3],R('E08',32,36),'metro'],
    ['wiltshire','Wiltshire','WIL',730,62,[3,7],L('E06',30,54),'rural'],
  ];
  const forces = F.map(([id, name, short, pop, annual, hex, lads, profile]) => ({ id, name, short, pop: pop * 1000, annual, hex, lads, profile: profile || 'mixed' }));

  const categories = [
    ['violence', 'Violence and sexual offences', .36],
    ['shoplifting', 'Shoplifting', .09],
    ['damage', 'Criminal damage and arson', .09],
    ['public-order', 'Public order', .09],
    ['other-theft', 'Other theft', .08],
    ['vehicle', 'Vehicle crime', .07],
    ['burglary', 'Burglary', .05],
    ['drugs', 'Drugs', .03],
    ['other', 'Other crime', .03],
    ['theft-person', 'Theft from the person', .02],
    ['robbery', 'Robbery', .013],
    ['bicycle', 'Bicycle theft', .012],
    ['weapons', 'Possession of weapons', .01],
  ].map(([id, name, share]) => ({ id, name, share }));

  const profiles = {
    london: { 'theft-person': 3, robbery: 2.5, 'other-theft': 1.3, violence: .85, bicycle: 1.6 },
    city: { 'theft-person': 5, 'other-theft': 2.4, shoplifting: 1.4, violence: .6, bicycle: 2 },
    rural: { vehicle: .7, shoplifting: .9, violence: 1.05, robbery: .5, 'theft-person': .5 },
    metro: { burglary: 1.2, vehicle: 1.2, robbery: 1.3, weapons: 1.2 },
    mixed: {},
  };

  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  const season = [1.03, 1.0, 1.01, .97, .92, .94, .88, .98, .97, 1.04, 1.05, 1.08];
  const monthLabel = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const monthShort = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' });

  // Simulated gap: latest month not yet published by one force.
  const missing = { 'greater-manchester': [11] };

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

  const mixCache = {};
  function mix(f) {
    if (mixCache[f.id]) return mixCache[f.id];
    const p = profiles[f.profile];
    const raw = categories.map(c => c.share * (p[c.id] || 1) * (0.88 + hash(f.id + c.id) * 0.24));
    const sum = raw.reduce((a, b) => a + b, 0);
    return (mixCache[f.id] = raw.map(v => v / sum));
  }

  function forceMonth(id, mi) {
    const f = forces.find(x => x.id === id);
    if (missing[id] && missing[id].includes(mi)) return { force: f, missing: true };
    const noise = 0.95 + hash(id + months[mi]) * 0.1;
    const trend = 1 - (mi - 6) * 0.003;
    const total = Math.round((f.annual / 12) * season[mi] * noise * trend * f.pop / 1000);
    const m = mix(f);
    const cats = categories.map((c, i) => ({ ...c, count: Math.round(total * m[i] * (0.96 + hash(id + c.id + mi) * 0.08)) }));
    const t = cats.reduce((a, c) => a + c.count, 0);
    return { force: f, missing: false, total: t, rate: t / f.pop * 1000, cats };
  }

  function nationalMonth(mi) {
    const rows = forces.map(f => forceMonth(f.id, mi));
    const ok = rows.filter(r => !r.missing);
    const pop = ok.reduce((a, r) => a + r.force.pop, 0);
    const total = ok.reduce((a, r) => a + r.total, 0);
    const cats = categories.map((c, i) => ({ ...c, count: ok.reduce((a, r) => a + r.cats[i].count, 0) }));
    const ranked = ok.slice().sort((a, b) => b.rate - a.rate);
    return { rows, ok, pop, total, rate: total / pop * 1000, cats, ranked, reporting: ok.length, missing: rows.filter(r => r.missing).map(r => r.force) };
  }

  window.CRIME = { forces, categories, months, monthLabel, monthShort, forceMonth, nationalMonth,
    thresholds: [5.5, 6.5, 7.5, 8.5, 9.5, 10.5] };
})();
