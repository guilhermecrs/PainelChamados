const $ = (s) => document.querySelector(s);
const N = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const msg = (t) => {
  $("#msg").textContent = t;
};
const PAL = [
  "#2f6fb5",
  "#1f9d8b",
  "#f0b429",
  "#8b6fd0",
  "#e0698a",
  "#4cb6d6",
  "#8fbf4a",
  "#e88a3c",
];
const SC = {
  Entregue: "#1f9d8b",
  "Em andamento": "#f0b429",
  Cancelado: "#e0698a",
  Suspenso: "#8b6fd0",
  Alta: "#e0698a",
  Média: "#f0b429",
  Baixa: "#1f9d8b",
  "Não definida": "#9fb2c2",
};
const col = (l, i) => SC[l] || PAL[i % PAL.length];
let R = [],
  CH = {};
const mk = (id, c) => {
  CH[id]?.destroy();
  CH[id] = new Chart($("#" + id), c);
};
const cnt = (k) => {
  const o = {};
  R.forEach((r) => (o[r[k]] = (o[r[k]] || 0) + 1));
  return Object.entries(o).sort((a, b) => b[1] - a[1]);
};

let INST = "Relatório importado",
  META = null; // atualizados a cada importação

/*PARSE*/
// Tipos conhecidos (stem sem acento -> nome exibido). O início da linha do item é sempre o Tipo de Atendimento.
const TIPOS = [
  ["desen", "Desenvolvimento"],
  ["acompan", "Acompanhamento"],
  ["auditor", "Auditoria"],
  ["implan", "Implantação"],
  ["configur", "Configuração / Parâmetros"],
  ["treinam", "Treinamento remoto"],
  ["falha", "Falha no sistema"],
  ["criarus", "Criar usuário"],
];
const TIPO_RE =
  /^(Criar\s*Usuario\s*TS\s*\/?\s*Outros|Acompan\w*(?:\s*\(\s*utiliz\w*\s*do\s*sis\w*)?|Treinam\w*(?:\s*Remoto)?|Falha\s*no\s*Sistema|Configur\w*\s*\/?\s*Parametros|Desenv\w*|Auditor\w*|Implan\w*)\s*/i;
// O Menu Item vem logo depois do Módulo: serve de marcador para achar onde o Módulo termina (qualquer módulo novo é aceito).
const MENU_RE =
  /\b(Nao\s*Obrigatorio|Relatorio|Cadastro|Movimentacao|Utilitario|Outros|Complet\w|Parametros|Consulta|Processo)\b/i;
const KNOWN_MOD =
  /^(Assist\S*\s*Social|Presta\S*\s*[CG]ontas|Documentos\s*Fiscais|Contabilidade|Financeiro|Estoque|Compras|Escolar)/i; // plano B se o Menu Item não for lido
const MODS = [
  [/^intern\S*\s*\(?diversos\)?$/i, "Interno (Diversos)"],
  [/^assist\S*\s*social$/i, "Assistência Social"],
  [/^presta\S*\s*(de\s*)?[cg]ontas$/i, "Prestação de Contas"],
  [/^documentos?\s*fiscais$/i, "Documentos Fiscais"],
  [/^or[cç]amentari\S*$/i, "Orçamentário"],
  [/^nao\s*obrigatorio$/i, ""],
];
const ACC = {
  associacao: "Associação",
  criancas: "Crianças",
  cancer: "Câncer",
  fundacao: "Fundação",
  saude: "Saúde",
  educacao: "Educação",
  assistencia: "Assistência",
  comunitaria: "Comunitária",
  misericordia: "Misericórdia",
  filantropica: "Filantrópica",
  protecao: "Proteção",
  acao: "Ação",
  uniao: "União",
  esperanca: "Esperança",
  sao: "São",
  jose: "José",
  joao: "João",
  conceicao: "Conceição",
  municipio: "Município",
  beneficencia: "Beneficência",
  avancados: "Avançados",
  promocao: "Promoção",
  servico: "Serviço",
  servicos: "Serviços",
  tecnologia: "Tecnologia",
  orcamentario: "Orçamentário",
};
const MIN = [
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "com",
  "para",
  "em",
  "a",
  "o",
];
const titulo = (s) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (w, i) =>
        ACC[w] ||
        (i && MIN.includes(w) ? w : w.replace(/^./, (c) => c.toUpperCase())),
    )
    .join(" ");
function nomeInst(emp, cli) {
  // o nome do campo "Empresa" pode vir cortado no relatório; usa o mais completo
  const sp = (b) => {
    const p = (b || "").split(/\s+[-–—]+\s+/);
    return p.length > 1 && p[0].length <= 12 && !/\s/.test(p[0])
      ? [p[0].toUpperCase(), p.slice(1).join(" - ")]
      : ["", b || ""];
  };
  const [s1, n1] = sp(emp),
    [s2, n2] = sp(cli),
    sig = s1 || s2,
    nome = n2.length > n1.length ? n2 : n1;
  return nome ? (sig ? sig + " – " : "") + titulo(nome) : null;
}
const semAcento = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const situacao = (t) => {
  const k = N(t);
  return k.includes("entreg")
    ? "Entregue"
    : k.includes("andament")
      ? "Em andamento"
      : k.includes("cancel")
        ? "Cancelado"
        : k.includes("suspens")
          ? "Suspenso"
          : k.includes("pendent")
            ? "Pendente"
            : titulo(
                t
                  .split(/[:;]/)
                  .pop()
                  .replace(/^[\W_]+/, "")
                  .trim(),
              ) || "Em andamento";
};
function parseLines(L) {
  const out = [];
  let cur = null,
    total = null,
    per = null,
    emp = null,
    cli = null;
  for (let l of L) {
    l = semAcento(l).trim();
    if (!l) continue;
    let m = l.match(/Numero\s*[:;.]?\s*([\dOo]{4,6})\b(.*)$/i);
    if (m) {
      const n = m[1].replace(/[Oo]/g, "0").padStart(6, "0");
      cur = out.find((r) => r.n === n);
      if (!cur) {
        cur = {
          n,
          d: null,
          s: situacao(m[2]),
          t: "Não informado",
          m: "Não informado",
          p: "Não definida",
          x: "",
        };
        out.push(cur);
      }
      continue;
    }
    if (!emp && (m = l.match(/^Empresa\s*[:;]?\s*\d+\W*\s*(.+)$/i)))
      emp = m[1].replace(/[-–—\s]*\d{3,}\s*$/, "").trim();
    if (!cli && (m = l.match(/^Cliente\s*[:;]?\s*\d+\W*\s*(.+)$/i)))
      cli = m[1].trim();
    if ((m = l.match(/Total\s+de\s+Solic\D*(\d+)/i))) {
      total = +m[1];
      continue;
    }
    if (
      (m = l.match(
        /Periodo de\s+(\d\d\/\d\d\/\d{4})\s+a\s+(\d\d\/\d\d\/\d{4})/i,
      ))
    )
      per = m[1] + " a " + m[2];
    m = l.match(/^\W*([0O]{2}[\dlI])\s+(\d\d)\/(\d\d)\/(\d\d)\s+(.+)$/);
    if (m && cur && !cur.d) {
      // o primeiro item do chamado (normalmente 001) define data/tipo/módulo/prioridade do chamado
      cur.d = new Date(2000 + +m[4], +m[3] - 1, +m[2]);
      const tm = m[5].match(TIPO_RE);
      let tipo, r2;
      if (tm) {
        tipo = tm[1];
        r2 = m[5].slice(tm[0].length);
      } else {
        const w = m[5].split(/\s+/);
        tipo = w[0];
        r2 = w.slice(1).join(" ");
      }
      const k = N(tipo),
        hit = TIPOS.find(([a]) => k.includes(a));
      cur.t = hit ? hit[1] : titulo(tipo) || "Não informado";
      const mn = r2.match(MENU_RE),
        km = mn ? null : r2.match(KNOWN_MOD);
      {
        const raw = (mn ? r2.slice(0, mn.index) : km ? km[0] : "")
            .replace(/[|_]+/g, " ")
            .trim(),
          h = MODS.find(([re]) => re.test(raw)),
          fim = mn ? mn.index + mn[0].length : km ? km[0].length : 0;
        cur.m =
          raw && raw.length <= 28
            ? h
              ? h[1]
              : raw
                  .split(/\s+/)
                  .map((w) => ACC[N(w)] || w)
                  .join(" ")
            : "";
        if (!cur.m) cur.m = "Não informado";
        const pm = r2.slice(fim).match(/\b(Alta|Media|Baixa)\b/);
        if (pm) cur.p = { Alta: "Alta", Media: "Média", Baixa: "Baixa" }[pm[1]];
      }
    }
  }
  return {
    rows: out.sort((a, b) => a.n.localeCompare(b.n)),
    total,
    per,
    inst: nomeInst(emp, cli),
  };
}
/*ENDPARSE*/

// ---------- Importador de PDF ----------
const CDN = {
  pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  wk: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  tess: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  lang: [
    null,
    "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0",
    "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int",
  ],
}; // null = endereço padrão do próprio Tesseract.js;
const load = (u) =>
  new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = u;
    s.onload = ok;
    s.onerror = () => no(new Error("Não foi possível carregar " + u));
    document.head.append(s);
  });
const prog = (v, t) => {
  const p = $("#pg");
  p.hidden = v == null;
  if (v != null) p.value = v;
  if (t) msg(t);
};
let SCH = null,
  NW = 2,
  busy = false,
  ETAPA = "";
const errMsg = (e) =>
  (e &&
    (e.message ||
      e.reason ||
      (e.type ? 'evento "' + e.type + '" sem detalhes' : ""))) ||
  (typeof e === "string" ? e : "") ||
  "erro sem detalhes";
const limite = (p, ms, t) =>
  Promise.race([
    p,
    new Promise((_, no) => setTimeout(() => no(new Error(t)), ms)),
  ]);

async function pageLinesFromText(page) {
  // PDFs com camada de texto (sem OCR)
  const vp = page.getViewport({ scale: 1 }),
    tc = await page.getTextContent(),
    rows = [];
  for (const it of tc.items) {
    if (!it.str.trim()) continue;
    const t = pdfjsLib.Util.transform(vp.transform, it.transform);
    if (Math.abs(t[1]) > 0.5 || Math.abs(t[2]) > 0.5) return null; // texto girado: usa OCR
    const y = Math.round(t[5] / 3);
    (rows[y] = rows[y] || []).push([t[4], it.str]);
  }
  return rows.filter(Boolean).map((r) =>
    r
      .sort((a, b) => a[0] - b[0])
      .map((x) => x[1])
      .join(" "),
  );
}
async function ocrPage(page, rot) {
  const vp = page.getViewport({ scale: 3 }),
    c = document.createElement("canvas");
  c.width = vp.width;
  c.height = vp.height;
  await page.render({ canvasContext: c.getContext("2d"), viewport: vp })
    .promise;
  let o = c;
  if (rot) {
    o = document.createElement("canvas");
    const sw = rot !== 180;
    o.width = sw ? c.height : c.width;
    o.height = sw ? c.width : c.height;
    const x = o.getContext("2d");
    x.translate(o.width / 2, o.height / 2);
    x.rotate((rot * Math.PI) / 180);
    x.drawImage(c, -c.width / 2, -c.height / 2);
  }
  const x = o.getContext("2d"),
    d = x.getImageData(0, 0, o.width, o.height),
    p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const g = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
    p[i] = p[i + 1] = p[i + 2] = g < 150 ? 0 : 255;
    p[i + 3] = 255;
  } // some o cinza das faixas
  x.putImageData(d, 0, 0);
  const t = (await SCH.addJob("recognize", o)).data.text.split("\n");
  c.width = c.height = o.width = o.height = 0;
  return t;
}
async function importPDF(file) {
  if (busy) return;
  busy = true;
  $("#imp").disabled = true;
  try {
    ETAPA = "baixar o leitor de PDF (cdnjs.cloudflare.com)";
    prog(0, "Carregando leitor de PDF…");
    if (!window.pdfjsLib) {
      await load(CDN.pdf);
      await load(CDN.wk);
      pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.wk;
    }
    ETAPA = "abrir o arquivo PDF";
    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      }).promise,
      n = pdf.numPages;
    const lines = new Array(n),
      pend = new Set();
    let rot = null,
      ocr = false,
      feitas = 0;
    const feito = () => {
      feitas++;
      prog(
        (feitas / n) * 100,
        `${ocr ? "Lendo (OCR)" : "Lendo"} página ${feitas} de ${n}…`,
      );
    };
    for (let i = 1; i <= n; i++) {
      ETAPA = "ler a página " + i;
      const page = await pdf.getPage(i);
      const L = await pageLinesFromText(page);
      if (L && L.join(" ").length >= 200) {
        lines[i - 1] = L;
        feito();
        continue;
      }
      if (!SCH) {
        prog(0, "Carregando OCR (primeira vez demora um pouco)…");
        ETAPA = "baixar o OCR (cdn.jsdelivr.net)";
        if (!window.Tesseract)
          await limite(load(CDN.tess), 60000, "tempo esgotado ao baixar o OCR");
        ETAPA = "iniciar o OCR (worker e idioma)";
        NW = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 1));
        const novoW = (lp) =>
          Tesseract.createWorker("eng", 1, {
            ...(lp ? { langPath: lp } : {}),
            cacheMethod: "none",
          });
        let w0 = null,
          lp = null;
        const erros = [];
        for (const c of CDN.lang) {
          // testa os endereços do idioma até um funcionar
          try {
            w0 = await limite(
              novoW(c),
              120000,
              "tempo esgotado ao iniciar o OCR — o ambiente pode estar bloqueando downloads ou workers",
            );
            lp = c;
            break;
          } catch (e) {
            erros.push(errMsg(e));
          }
        }
        if (!w0)
          throw new Error(
            "não consegui baixar o idioma do OCR. Tentativas: " +
              erros.join(" | "),
          );
        const ws = [
          w0,
          ...(await limite(
            Promise.all(Array.from({ length: NW - 1 }, () => novoW(lp))),
            120000,
            "tempo esgotado ao iniciar o OCR",
          )),
        ];
        SCH = Tesseract.createScheduler();
        for (const w of ws) {
          await w.setParameters({ tessedit_pageseg_mode: "4" });
          SCH.addWorker(w);
        }
        ETAPA = "ler a página " + i;
      }
      ocr = true;
      if (rot == null) {
        // descobre a orientação na 1ª página
        const w = page.getViewport({ scale: 1 });
        let T = null;
        for (const r of w.width > w.height ? [0] : [90, 270]) {
          T = await ocrPage(page, r);
          if (/Numero|Solicita|Item\s+Data/i.test(semAcento(T.join("\n")))) {
            rot = r;
            break;
          }
        }
        if (rot == null)
          throw new Error("Não reconheci o layout do relatório (página 1).");
        lines[i - 1] = T;
        feito();
      } else {
        // demais páginas: OCR em paralelo
        while (pend.size >= NW * 2) await Promise.race(pend);
        const job = ocrPage(page, rot)
          .then((T) => {
            lines[i - 1] = T;
            feito();
          })
          .finally(() => pend.delete(job));
        pend.add(job);
      }
    }
    await Promise.all(pend);
    const res = parseLines(lines.flat());
    if (!res.rows.length)
      throw new Error(
        'Nenhum chamado encontrado. Confira se é o relatório "Acompanhamento das Solicitações".',
      );
    R = res.rows;
    INST = res.inst || "Relatório importado";
    META = {
      per: res.per,
      file: file.name,
      at: new Date().toISOString(),
      total: res.total,
    };
    saveRows();
    render();
    const sem = R.filter((r) => !r.d).length;
    msg(
      `Dashboard atualizado: ${INST} — ${R.length} chamados importados de "${file.name}".` +
        (res.total != null && res.total !== R.length
          ? ` ⚠ O relatório informa ${res.total}; confira se alguma página foi mal lida.`
          : " Total confere com o relatório.") +
        (sem ? ` ${sem} sem data legível.` : ""),
    );
  } catch (e) {
    if (SCH) {
      try {
        SCH.terminate();
      } catch (x) {}
      SCH = null;
    }
    msg(
      `Erro ao ${ETAPA}: ${errMsg(e)}. Se a falha foi ao baixar/iniciar o OCR, o ambiente onde a página está aberta pode estar bloqueando downloads ou workers: abra o index.html direto no computador (duplo clique) ou hospede no seu servidor.`,
    );
  } finally {
    prog(null);
    busy = false;
    $("#imp").disabled = false;
    $("#f").value = "";
  }
}
const KEY = "painel_chamados_v1";
function saveRows() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        inst: INST,
        meta: META,
        rows: R.map((r) => ({ ...r, d: r.d ? r.d.toISOString() : null })),
      }),
    );
  } catch (e) {}
}
function loadSaved() {
  try {
    let j = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(j)) j = { rows: j };
    if (j?.rows?.length) {
      R = j.rows.map((r) => ({ ...r, d: r.d ? new Date(r.d) : null }));
      INST = j.inst || "Relatório importado";
      META = j.meta || null;
      return true;
    }
  } catch (e) {}
  return false;
}

function loadData() {
  if (loadSaved())
    msg(`Exibindo ${R.length} chamados da última importação deste navegador.`);
  else msg("Importe o PDF do relatório para ver as informações.");
  render();
}

function render() {
  const cs = getComputedStyle(document.documentElement);
  Chart.defaults.color = cs.getPropertyValue("--mu").trim();
  Chart.defaults.borderColor = cs.getPropertyValue("--bd").trim();
  Chart.defaults.font.family = "Nunito,system-ui,sans-serif";
  const has = R.length > 0;
  document.body.classList.toggle("vazio", !has);
  if (!has) {
    $("#sub").textContent = "Nenhum relatório importado";
    $("#meta").textContent = "";
    document.title = "Painel de Chamados";
    return;
  }
  $("#sub").textContent = INST;
  document.title = "Painel de Chamados – " + INST;
  $("#meta").textContent = META
    ? `Relatório${META.per ? " de " + META.per : ""} · arquivo ${META.file} · importado em ${new Date(META.at).toLocaleString("pt-BR")}`
    : "";
  const T = R.length,
    sts = cnt("s"),
    E = (sts.find((x) => x[0] == "Entregue") || [0, 0])[1];
  $("#hero").innerHTML =
    `<p class="big"><b>${E}</b> de ${T} solicitações já foram entregues</p>
<div class="bar">${sts.map(([s, n]) => `<i style="width:${(n / T) * 100}\%;background:${col(s, 0)}" title="${esc(s)}:${n}"></i>`).join("")}</div>
<p class="lg">${sts.map(([s, n]) => `<span><span class="dot" style="background:${col(s, 0)}"></span>${esc(s)}:${n}</span>`).join("")}</p>`;
  const dn = (id, a) =>
    mk(id, {
      type: "doughnut",
      data: {
        labels: a.map((x) => x[0]),
        datasets: [
          {
            data: a.map((x) => x[1]),
            backgroundColor: a.map((x, i) => col(x[0], i)),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "right" } },
      },
    });
  const hb = (id, a) =>
    mk(id, {
      type: "bar",
      data: {
        labels: a.map((x) => x[0]),
        datasets: [
          {
            data: a.map((x) => x[1]),
            backgroundColor: PAL[0],
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { ticks: { precision: 0 } } },
        plugins: { legend: { display: false } },
      },
    });
  dn("c5", cnt("s"));
  hb("c3", cnt("t").slice(0, 8));
  hb("c4", cnt("m").slice(0, 8));
  const ds = R.filter((r) => r.d).map(
      (r) => r.d.getFullYear() * 12 + r.d.getMonth(),
    ),
    ms = [];
  for (let k = Math.min(...ds); k <= Math.max(...ds); k++) ms.push(k);
  mk("c2", {
    type: "bar",
    data: {
      labels: ms.map(
        (k) =>
          String((k % 12) + 1).padStart(2, "0") +
          "/" +
          String(Math.floor(k / 12)).slice(2),
      ),
      datasets: sts.map(([s], i) => ({
        label: s,
        backgroundColor: col(s, i),
        data: ms.map(
          (k) =>
            R.filter(
              (r) =>
                r.s == s && r.d && r.d.getFullYear() * 12 + r.d.getMonth() == k,
            ).length,
        ),
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, ticks: { precision: 0 } },
      },
      plugins: { legend: { position: "bottom" } },
    },
  });

  const and = (sts.find((x) => x[0] == "Em andamento") || [0, 0])[1],
    alta = R.filter((r) => r.p == "Alta").length,
    mod = cnt("m").find((x) => x[0] != "Não informado"),
    tp = cnt("t")[0],
    ult = ds.length
      ? new Date(Math.max(...R.filter((r) => r.d).map((r) => +r.d)))
      : null;
  const kp = [
    [T, "Total de chamados"],
    [`${E} (${T ? Math.round((E / T) * 100) : 0}%)`, "Entregues"],
    [and, "Em andamento"],
    [alta, "Prioridade alta"],
    [mod ? `${mod[0]} (${mod[1]})` : "—", "Módulo com mais chamados"],
    [ult ? ult.toLocaleDateString("pt-BR") : "—", "Chamado mais recente"],
  ];
  $("#kpis").innerHTML = kp
    .map(([v, l]) => `<div class="k"><b>${esc(v)}</b><span>${l}</span></div>`)
    .join("");

  // Filtro de Situações
  const valAtual = $("#fs").value;
  const listaPadrao = ["Em andamento", "Entregue", "Cancelado", "Suspenso"];
  const todasSituacoes = [...new Set([...listaPadrao, ...sts.map(([s]) => s)])];
  $("#fs").innerHTML =
    '<option value="">Todas as situações</option>' +
    todasSituacoes
      .map((s) => `<option value="${esc(s)}">${esc(s)}</option>`)
      .join("");
  $("#fs").value = valAtual;

  // Filtro de Tipos
  const valAtualT = $("#ft").value;
  const todosTipos = [...new Set(R.map((r) => r.t))].filter(Boolean).sort();
  $("#ft").innerHTML =
    '<option value="">Todos os tipos</option>' +
    todosTipos
      .map((t) => `<option value="${esc(t)}">${esc(t)}</option>`)
      .join("");
  $("#ft").value = valAtualT;

  list();
}

function list() {
  const q = N($("#q").value),
    f = $("#fs").value,
    ft = $("#ft").value,
    hx = R.some((r) => r.x);
  const a = R.filter(
    (r) =>
      (!f || r.s == f) &&
      (!ft || r.t == ft) &&
      (!q || N(Object.values(r).join(" ")).includes(q)),
  )
    .sort((x, y) => (y.d || 0) - (x.d || 0) || y.n.localeCompare(x.n))
    .slice(0, 300);
  $("#t").innerHTML =
    "<tr><th>Nº<th>Data<th>Tipo<th>Módulo<th>Prioridade<th>Situação" +
    (hx ? "<th>Descrição" : "") +
    "</tr>" +
    a
      .map(
        (r) =>
          `<tr><td>${esc(r.n)}<td>${r.d ? r.d.toLocaleDateString("pt-BR") : ""}<td>${esc(r.t)}<td>${esc(r.m)}<td>${esc(r.p)}<td><span class="b" style="background:${col(r.s, 0)}">${esc(r.s)}</span>${hx ? `<td class="d">${esc(r.x.slice(0, 160))}` : ""}</tr>`,
      )
      .join("");
}

$("#q").oninput = list;
$("#fs").onchange = list;
$("#ft").onchange = list;
$("#imp").onclick = () => $("#f").click();
$("#f").onchange = (e) => e.target.files[0] && importPDF(e.target.files[0]);
$("#rst").onclick = () => {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
  R = [];
  META = null;
  msg("Dados removidos. Importe um PDF para começar.");
  render();
};
$("#imp2").onclick = () => $("#f").click();
addEventListener("dragover", (e) => {
  e.preventDefault();
  document.body.classList.add("drag");
});
addEventListener("dragleave", (e) => {
  if (!e.relatedTarget) document.body.classList.remove("drag");
});
addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.classList.remove("drag");
  const f = e.dataTransfer.files[0];
  if (f && /pdf/i.test(f.type + f.name)) importPDF(f);
});
matchMedia("(prefers-color-scheme:dark)").onchange = () => R.length && render();
loadData();
