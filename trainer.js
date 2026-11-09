const $ = id => document.getElementById(id);
const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
const all = [...new Map(vocabulary.flat().map(card => [card[0], card])).values()];
const key = "latin-trainer-progress-v1";
const norm = value => value.toLowerCase().normalize("NFD")
  .replace(/\p{M}/gu, "").replace(/[^\p{L}]+/gu, " ").trim();
const deck = $("deck");
const mode = $("mode");
const question = $("question");
const actions = $("actions");
let progress = {};
let saved = true;
try { progress = JSON.parse(localStorage.getItem(key)) || {}; }
catch { saved = false; }
let pool = [], queue = [], current, type, turn = 0, resolved = false;
const history = card => progress[card[0]] || { score: 0, missed: false };

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function stats() {
  const known = pool.filter(card => history(card).score >= 2).length;
  $("total").textContent = pool.length;
  $("mastered").textContent = known;
  $("mistakes").textContent = pool.filter(card => history(card).missed).length;
  $("bar").style.width = (100 * known / (pool.length || 1)) + "%";
}

function button(label, callback, parent = actions, style = "") {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  el.className = style;
  el.addEventListener("click", callback);
  parent.append(el);
  return el;
}

function start(focus = true) {
  pool = deck.value === "all" ? all : vocabulary[Number(deck.value)];
  const candidates = mode.value === "review" ? pool.filter(card => history(card).missed) : pool;
  queue = shuffle(candidates).sort((a, b) => Number(history(b).missed) - Number(history(a).missed)
    || history(a).score - history(b).score);
  turn = 0;
  next(focus);
}

function distractors(card) {
  const [term, ru] = card;
  const noun = term.match(/^(.*), (\S+) ([mfn])$/);
  const alternatives = [];
  if (noun) {
    const [, stem, ending, gender] = noun;
    for (const other of "mfn") {
      if (other !== gender) alternatives.push(stem + ", " + ending + " " + other);
    }
    const wrongEnd = shuffle(["ae", "i", "is", "us", "ōnis", "ātis"]
      .filter(end => norm(end) !== norm(ending)))[0];
    alternatives.push(stem + ", " + wrongEnd + " " + gender);
  } else {
    const sameMeaning = candidate => candidate[1].split(",").some(part =>
      ru.split(",").some(meaning => norm(meaning) === norm(part)));
    const candidates = shuffle(pool).concat(shuffle(all));
    for (const candidate of candidates) {
      if (candidate[0] !== term && !sameMeaning(candidate) && !alternatives.includes(candidate[0])) {
        alternatives.push(candidate[0]);
      }
      if (alternatives.length === 3) break;
    }
  }
  return shuffle([term, ...alternatives]);
}

function next(focus = true) {
  current = queue.shift();
  showWordAnalysis(current?.[0]);
  resolved = false;
  question.replaceChildren();
  actions.replaceChildren();
  $("feedback").replaceChildren();
  stats();
  if (!current) {
    $("kind").textContent = "Итоги";
    $("prompt").textContent = mode.value === "review" && !turn ? "Ошибок для повторения пока нет" : "Раунд завершён";
    button("Начать новый раунд", () => start(), actions, "primary");
    if (focus) $("prompt").focus();
    return;
  }
  type = mode.value;
  if (type === "learn") {
    type = history(current).missed || history(current).score === 1
      ? "write" : ["choice", "choice", "write", "translate"][turn % 4];
  }
  if (type === "review") type = "write";
  turn++;
  const [la, ru] = current;
  $("kind").textContent = "Вопрос " + turn + " · " + ({
    choice:"Выбери словарную форму", write:"Введи словарную форму",
    translate:"Введи перевод", flash:"Вспомни перевод"
  })[type];
  $("prompt").textContent = type === "translate" || type === "flash" ? la : ru;
  if (type === "choice") {
    const options = document.createElement("div");
    options.className = "options";
    question.append(options);
    distractors(current).forEach((option, index) => {
      const el = button(option, () => {
        if (resolved) return;
        for (const item of options.children) {
          item.disabled = true;
          if (item.dataset.answer === la) item.classList.add("good");
        }
        if (option !== la) el.classList.add("bad");
        finish(option === la, option);
      }, options, "option");
      el.dataset.answer = option;
      const number = document.createElement("span");
      number.textContent = index + 1 + ".";
      el.prepend(number);
    });
  } else if (type === "flash") {
    button("Показать перевод", () => {
      question.replaceChildren();
      $("feedback").textContent = ru;
      actions.replaceChildren();
      button("Нужно повторить", () => finish(false));
      button("Знаю", () => finish(true), actions, "primary").focus();
    }, question, "primary");
  } else {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.setAttribute("aria-label", type === "write" ? "Словарная форма" : "Русский перевод");
    input.placeholder = type === "write" ? "Например, bifurcatio, ōnis f" : "Напиши перевод";
    input.autocomplete = "off";
    input.spellcheck = false;
    if (type === "write") {
      input.setAttribute("autocorrect", "off");
      input.setAttribute("autocapitalize", "none");
      input.lang = "la";
    }
    input.required = true;
    form.append(input);
    const check = button("Проверить", () => {}, form, "primary");
    check.type = "submit";
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (resolved || !input.value.trim()) return;
      const entered = norm(input.value);
      const alternatives = type === "translate" ? ru.split(/[,;]/).concat(ru) : [la];
      const correct = alternatives.some(value => entered === norm(value)) ||
        (type === "write" && acceptedGenitive(la, entered));
      input.disabled = check.disabled = true;
      finish(correct, input.value);
    });
    question.append(form);
  }
  if (type !== "flash") button("Показать ответ", () => finish(false));
  if (focus) (question.querySelector("input") || $("prompt")).focus();
}

function acceptedGenitive(term, answer) {
  const endings = {
    "os, oris n":"oris", "pes, pedis m":"pedis", "cor, cordis n":"cordis",
    "os, ossis n":"ossis", "pars, partis f":"partis", "frons, frontis f":"frontis",
    "lens, lentis f":"lentis", "vas, vasis n":"vasis", "dens, dentis m":"dentis",
    "pons, pontis m":"pontis"
  };
  if (!endings[term]) return false;
  return answer === norm(term.replace(/, \S+ /, ", " + endings[term] + " "));
}

function finish(correct, answer) {
  if (resolved) return;
  resolved = true;
  const record = history(current);
  if (!correct) {
    record.score = 0;
    record.missed = true;
    queue.splice(Math.min(queue.length, 3), 0, current);
  } else if (type === "write" || type === "translate") {
    record.score = Math.min(2, record.score + 1);
    record.missed = false;
  } else {
    record.score = Math.max(1, record.score);
  }
  progress[current[0]] = record;
  try { localStorage.setItem(key, JSON.stringify(progress)); }
  catch { saved = false; }
  if (!saved) $("storage").textContent = "В этом браузере сохранение недоступно. Прогресс действует до закрытия страницы.";
  for (const el of question.querySelectorAll("button,input")) el.disabled = true;
  const [la, ru] = current;
  const expected = type === "translate" || type === "flash" ? ru : la;
  let note = "";
  const noun = norm(la).match(/^(\S+) (\S+) ([mfn])$/);
  if (!correct && answer && type !== "translate" && noun) {
    const entered = norm(answer).split(" ");
    if (entered[0] === noun[1]) {
      const problems = [];
      if (entered[1] !== noun[2]) problems.push("окончание родительного падежа");
      if (entered[2] !== noun[3]) problems.push("род");
      if (problems.length) note = " Проверь: " + problems.join(" и ") + ".";
    }
  }
  $("feedback").className = "feedback " + (correct ? "good" : "bad");
  $("feedback").textContent = (correct ? "Верно. " : "На повторение. ") + expected + note;
  actions.replaceChildren();
  stats();
  button("Дальше", () => next(), actions, "primary").focus();
}

deck.add(new Option("Все минимумы", "all"));
roman.forEach((label, i) => deck.add(new Option("Минимум " + label + " · " + vocabulary[i].length, i)));
deck.value = "7";
deck.addEventListener("change", () => start());
mode.addEventListener("change", () => start());
document.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.target.matches("input,select,textarea") || resolved || type !== "choice") return;
  if (/^[1-4]$/.test(event.key)) question.querySelectorAll("button")[Number(event.key) - 1]?.click();
});
start(false);
