const genderNames = { m: "Мужской (m)", f: "Женский (f)", n: "Средний (n)" };

const genitiveOverrides = {
  "os, oris n": "ōris", "os, ossis n": "ossis",
  mons: "montis", cor: "cordis", pes: "pedis", pars: "partis", frons: "frontis",
  lens: "lentis", vas: "vasis", dens: "dentis", pons: "pontis",
  crus: "cruris", splen: "splenis", lien: "liēnis", ren: "renis", hepar: "hepătis",
  apex: "apĭcis", cortex: "cortĭcis", index: "indĭcis",
  pollex: "pollĭcis", vertex: "vertĭcis",
  meninx: "meningis", phalanx: "phalangis", pharynx: "pharyngis", larynx: "laryngis",
  simplex: "simplĭcis", teres: "terĕtis",
  "major, jus": "majoris", "minor, ius": "minoris"
};

const nounDeclensions = {
  ae: ["I", 1, "ae"],
  i: ["II", 2, "i"],
  us: ["IV", 2, "ūs"],
  "ēi": ["V", 2, "ēi"],
  es: ["I (греческий тип)", 1, "es"]
};

const thirdDeclensionCuts = {
  "ōnis": 1, "ĭnis": 2, "ĭtis": 2, "ŏris": 2, "ōris": 2, "ātis": 2,
  "ĕtis": 2, "ēris": 2, "ĕris": 2, ntris: 4, tris: 3, "ĕdis": 2,
  "ĭcis": 2, "īcis": 2, "ŭcis": 2, "ācis": 2, "tĭdis": 3,
  "ĭdis": 2, "ūdis": 2, "ȳgis": 2, "ătis": 1, antis: 2,
  "cipĭtis": 4, ntis: 2
};

const phrases = {
  "planum coronale": ["planum, i n", "plani coronalis"],
  "planum frontale": ["planum, i n", "plani frontalis"],
  "planum sagittale": ["planum, i n", "plani sagittalis"],
  "membrum superius": ["membrum, i n", "membri superioris"],
  "membrum inferius": ["membrum, i n", "membri inferioris"],
  "linea axillaris": ["linea, ae f", "lineae axillaris"],
  "columna vertebralis": ["columna, ae f", "columnae vertebralis"],
  "os metacarpi": ["os, ossis n", "ossis metacarpi"],
  "cavitas tympani": ["cavĭtas, ātis f", "cavitātis tympani"],
  "os ischii": ["os, ossis n", "ossis ischii"],
  "macula lutea": ["macula, ae f", "maculae luteae"],
  "os sacrum": ["os, ossis n", "ossis sacri"],
  "arcus pedis": ["arcus, us m", "arcūs pedis"],
  "dorsum pedis": ["dorsum, i n", "dorsi pedis"],
  "pia mater": ["mater, tris f", "piae matris"],
  "dura mater": ["mater, tris f", "durae matris"],
  "arachnoidea mater": ["mater, tris f", "arachnoideae matris"],
  "mons pubis": ["mons, montis m", "montis pubis"],
  "os pubis": ["os, ossis n", "ossis pubis"],
  "pelvis renalis": ["pelvis, is f", "pelvis renalis"],
  "pars petrosa": ["pars, partis f", "partis petrosae"],
  "os coccygis": ["os, ossis n", "ossis coccygis"],
  "os temporale": ["os, ossis n", "ossis temporalis"],
  "os femoris": ["os, ossis n", "ossis femoris"],
  "os zygomaticum": ["os, ossis n", "ossis zygomatici"],
  "os occipitale": ["os, ossis n", "ossis occipitalis"]
};

function thirdGenitive(word, suffix, term) {
  const override = genitiveOverrides[term] || genitiveOverrides[word];
  if (override) return override;
  if (suffix === "is") return word.replace(/(?:is|es|e)$/, "") + "is";
  if (suffix === "ĭnis" && word.endsWith("o")) return word.slice(0, -1) + suffix;
  if (word === "pancreas") return word.slice(0, -2) + suffix;
  const cut = thirdDeclensionCuts[suffix];
  return cut ? word.slice(0, -cut) + suffix : null;
}

function describeLatin(term) {
  if (Object.hasOwn(phrases, term)) {
    const [head, genitive] = phrases[term];
    return { ...describeLatin(head), part: "Словосочетание", head: head.split(", ")[0], genitive };
  }
  const [word, ending, neuter] = term.split(", ");
  if (!ending) return { part: "Союз", gender: "—", declension: "Не склоняется", stem: "—", genitive: "—" };

  const noun = ending.match(/^(\S+) ([mfn])$/);
  if (noun) {
    const [, suffix, gender] = noun;
    const pattern = nounDeclensions[suffix];
    let declension = "III", genitive;
    if (pattern) {
      const [label, cut, fullEnding] = pattern;
      declension = label;
      const stem = word.slice(0, suffix === "us" && word.endsWith("u") ? -1 : -cut);
      genitive = stem + fullEnding;
    } else {
      genitive = thirdGenitive(word, suffix, term);
    }
    if (!genitive) return null;
    const stem = genitive.slice(0, pattern?.[2] === "i" ? -1 : -2);
    return { part: "Существительное", gender: genderNames[gender], declension, stem, genitive };
  }

  const ordinal = /^(primus|secundus|tertius|quartus|quintus)$/.test(word);
  const participle = ending === "ntis";
  const comparative = ending === "ius" || ending === "jus";
  const part = ordinal ? "Порядковое числительное" : participle ? "Причастие настоящего времени"
    : comparative ? "Прилагательное в сравнительной степени" : "Прилагательное";
  const gender = "Мужской, женский и средний (m, f, n)";
  if (neuter) {
    const practicalStem = ending === "a" ? word.slice(0, -2) : {
      asper: "aspĕr", liber: "libĕr", dexter: "dextr", sinister: "sinistr",
      niger: "nigr", ruber: "rubr", sacer: "sacr"
    }[word];
    return { part, gender, declension: "I–II", stem: practicalStem,
      genitive: practicalStem + "i (m, n), " + practicalStem + "ae (f)" };
  }
  const genitive = ending === "e" ? word : comparative
    ? genitiveOverrides[term] || word + "is" : thirdGenitive(word, ending, term);
  return genitive ? { part, gender, declension: "III", stem: genitive.slice(0, -2), genitive } : null;
}

function showWordAnalysis(term) {
  const panel = document.getElementById("word-analysis");
  const content = document.getElementById("analysis-content");
  panel.open = false;
  content.replaceChildren();
  if (!term) {
    panel.hidden = true;
    return;
  }
  const data = describeLatin(term);
  panel.hidden = !data;
  if (!data) return;
  const title = document.createElement("p");
  title.className = "analysis-term";
  title.textContent = term;
  content.append(title);
  const list = document.createElement("dl");
  const rows = [["Часть речи", data.part]];
  if (data.head) rows.push(["Главное слово", data.head]);
  rows.push(["Род", data.gender], ["Склонение", data.declension],
    [data.head ? "Основа главного слова" : "Основа", data.stem === "—" ? "—" : data.stem + "-"],
    ["Родительный падеж (ед. ч.)", data.genitive]);
  for (const [label, value] of rows) {
    const name = document.createElement("dt");
    const entry = document.createElement("dd");
    name.textContent = label;
    entry.textContent = value;
    list.append(name, entry);
  }
  content.append(list);
}
