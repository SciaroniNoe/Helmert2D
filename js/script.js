const developer_mode = false

// Popoliamo automaticamente i campi se siamo in modalità sviluppatore
if (false) {
  document.getElementById("local").value =
    "A,0.0000,10.0000,0.0,10\n" +
    "B,20.0000,10.0000,0.0,10\n" +
    "C,20.0000,0.0000,0.0,10\n" +
    "D,0.0000,0.0000,0.0,10\n" +
    "E,5.0000,2.5000,0.0,10";

  document.getElementById("global").value =
    "A,43.2596,33.9952,0.0,10\n" +
    "B,69.2404,48.9952,0.0,10\n" +
    "C,76.7404,36.0048,0.0,10\n" +
    "D,50.7596,21.0048,0.0,10";
}

if (developer_mode) {
  document.getElementById("local").value =
    "32418,696159.450,107260.114,0,8\n" +
    "32419,696165.098,107247.402,0,8\n" +
    "32420,696162.473,107249.711,0,8\n" +
    "32421,696169.782,107244.807,0,8\n" +
    "32422,696131.724,107294.783,0,8\n" +
    "32423,696160.036,107310.526,0,8";
}




// Funzioni ausiliarie
function distanceAB(E1, N1, E2, N2) {
  return Math.sqrt((E2 - E1) ** 2 + (N2 - N1) ** 2);
}

function gisementAB(E1, N1, E2, N2) {
  // ritorna angolo in gon (400 gon = 360°)
  let angle_rad = Math.atan2(E2 - E1, N2 - N1); // atan2(dx, dy) -> 0 gon = Nord
  let angle_gon = angle_rad * 200 / Math.PI;
  if (angle_gon < 0) angle_gon += 400;
  return angle_gon;
}

// Calcolo parametri Helmert con media seno/coseno
function calculParamTransfHelmert(dictPtsGlobal, dictPtsLocal, noPtsFixes, calcScale = true) {
  let somme_E = 0, somme_N = 0, somme_y = 0, somme_x = 0;
  let nb_pts = noPtsFixes.length;

  for (let no of noPtsFixes) {
    const { E: Ei, N: Ni } = dictPtsGlobal[no];
    const { E: yi, N: xi } = dictPtsLocal[no];
    somme_E += Ei; somme_N += Ni; somme_y += yi; somme_x += xi;
  }

  const EG = somme_E / nb_pts;
  const NG = somme_N / nb_pts;
  const yG = somme_y / nb_pts;
  const xG = somme_x / nb_pts;

  let lamda_moyen = 1.0; // default
  let alpha_moyen = 0;
  let cos_list = [];
  let sin_list = [];

  if (calcScale) {
    let somme_lamda = 0;
    for (let no of noPtsFixes) {
      const { E: Ei, N: Ni } = dictPtsGlobal[no];
      const { E: yi, N: xi } = dictPtsLocal[no];

      const dGi_global = distanceAB(EG, NG, Ei, Ni);
      const dGi_local = distanceAB(yG, xG, yi, xi);
      somme_lamda += dGi_global / dGi_local;

      let alpha_i = gisementAB(EG, NG, Ei, Ni) - gisementAB(yG, xG, yi, xi);
      // differenza in rad
      let alpha_rad = alpha_i * Math.PI / 200;
      cos_list.push(Math.cos(alpha_rad));
      sin_list.push(Math.sin(alpha_rad));
    }
    lamda_moyen = somme_lamda / nb_pts;
    const mean_cos = cos_list.reduce((a, b) => a + b, 0) / cos_list.length;
    const mean_sin = sin_list.reduce((a, b) => a + b, 0) / sin_list.length;
    const alpha_rad_moyen = Math.atan2(mean_sin, mean_cos);
    alpha_moyen = alpha_rad_moyen * 200 / Math.PI;
    if (alpha_moyen < 0) alpha_moyen += 400;
  }

  const alpha_moyen_rad = alpha_moyen * Math.PI / 200;

  // Trasformazione punti local => global
  const dictPtsGlobalTransf = {};
  for (let no of Object.keys(dictPtsLocal)) {
    const { E: yi, N: xi } = dictPtsLocal[no];
    const Ei = EG + lamda_moyen * Math.cos(alpha_moyen_rad) * (yi - yG) +
      lamda_moyen * Math.sin(alpha_moyen_rad) * (xi - xG);
    const Ni = NG - lamda_moyen * Math.sin(alpha_moyen_rad) * (yi - yG) +
      lamda_moyen * Math.cos(alpha_moyen_rad) * (xi - xG);
    dictPtsGlobalTransf[no] = { E: Ei, N: Ni };
  }

  return {
    dictPtsGlobal, dictPtsLocal, noPtsFixes,
    alpha_moyen, lamda_moyen, EG, NG, yG, xG,
    dictPtsGlobalTransf
  };
}





function parseCoordinates(text) {
  // Questa funzione prende il testo contenente righe di coordinate con formato:
  // "Nome,Est,Nord[,H[,Codice]]" (separatore virgola), ignora righe vuote e
  // restituisce un oggetto { Nome: { E, N, H?, Code? } } con E/N come float.
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  const coords = {};
  for (let line of lines) {
    const parts = line.split(",");
    if (parts.length >= 3) {
      const no = parts[0].trim();
      const obj = {
        E: parseFloat(parts[1]), // Est
        N: parseFloat(parts[2])  // Nord
      };
      // Aggiungi H solo se presente e non vuoto
      if (parts[3] !== undefined && parts[3].trim() !== "") {
        obj.H = parseFloat(parts[3]);
      }
      // Aggiungi Code solo se presente e non vuoto
      if (parts[4] !== undefined && parts[4].trim() !== "") {
        obj.Code = parts[4].trim();
      }
      coords[no] = obj;
    }
  }
  return coords;
}




document.getElementById("loadFile").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt,.coo";

  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

      // Lettura punti locali attuali
      const localCoords = parseCoordinates(document.getElementById("local").value);

      console.log(localCoords)

      const globalCoords = [];



      // Processa ogni riga del file, estraendo nome, E, N. Aggiungi solo se il punto esiste nel sys locale
      for (let line of lines) {
        const parts = line.split(/\s+/); // separatore spazio
        const name = parts[0];          // primo campo come nome
        const E = parseFloat(parts[2]); // coordinate E
        const N = parseFloat(parts[3]); // coordinate N

        // Se il punto esiste nella lista locale, aggiungilo alla textarea globale
        if (localCoords[name]) {
          const local = localCoords[name];
          // Costruisci dinamicamente i campi separati da virgola evitando virgole vuote
          const fields = [name, E.toFixed(3), N.toFixed(3)];
          if (Object.prototype.hasOwnProperty.call(local, "H")) {
            // manteniamo il formato numerico originale (senza trailing zeros forzati)
            fields.push(Number.isFinite(local.H) ? local.H : local.H);
          }
          if (Object.prototype.hasOwnProperty.call(local, "Code")) {
            fields.push(local.Code);
          }
          globalCoords.push(fields.join(","));
        }
      }
      document.getElementById("global").value = globalCoords.join("\n");
    };

    reader.readAsText(file);
  };

  input.click();
});



// Verifica se sono presenti punti in comune, popola tabella e gestisci stato bottone.
document.getElementById("findCommon").addEventListener("click", () => {
  const localCoords = parseCoordinates(document.getElementById("local").value);
  const globalCoords = parseCoordinates(document.getElementById("global").value);

  const commonKeys = Object.keys(localCoords).filter(k => globalCoords[k]);

  const tbody = document.getElementById("commonPoints");
  tbody.innerHTML = "";
  commonKeys.forEach((key, i) => {
    const row = `<tr>
      <td>${i + 1}</td>
      <td>${key}</td>
      <td><input type="checkbox" checked></td>
    </tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });

  // Mostriamo la sezione dei punti in comune
  document.getElementById("commonPointsSection").style.display = "block";

  // Controllo numero punti e messaggio
  const msgDiv = document.getElementById("commonPointsMsg");
  const numPoints = commonKeys.length;
  if (numPoints >= 2 || developer_mode) {
    msgDiv.textContent = `${numPoints} punti in comune (minimo 2)`;
    msgDiv.style.color = "green";
    document.getElementById("transform").disabled = false;
  } else {
    msgDiv.textContent = `${numPoints} punti in comune (minimo 2)`;
    msgDiv.style.color = "red";
    document.getElementById("transform").disabled = true;
  }

  // Mostriamo il bottone (anche se disabilitato)
  document.getElementById("transform").style.display = "inline-block";
  // Aggiorniamo il messaggio se l'utente deseleziona punti
  const checkboxes = tbody.querySelectorAll("input[type=checkbox]");
  checkboxes.forEach(cb => {
    cb.addEventListener("change", () => {
      const checkedCount = Array.from(checkboxes).filter(c => c.checked).length;
      if (checkedCount >= 2) {
        msgDiv.textContent = `${checkedCount} punti in comune (minimo 2)`;
        msgDiv.style.color = "green";
        document.getElementById("transform").disabled = false;
      } else {
        msgDiv.textContent = `${checkedCount} punti in comune (minimo 2)`;
        msgDiv.style.color = "red";
        document.getElementById("transform").disabled = true;
      }
      // chart will be rendered after transformation; do not render here
    });
  });
});


document.getElementById("transform").addEventListener("click", () => {
  const localCoords = parseCoordinates(document.getElementById("local").value);
  const globalCoords = parseCoordinates(document.getElementById("global").value);

  const calcScale = document.getElementById("calcScale").checked;

  const noPtsFixes = Array.from(document.querySelectorAll("#commonPoints input[type=checkbox]"))
    .map((cb, i) => cb.checked ? Object.keys(localCoords)[i] : null)
    .filter(v => v);

  const helm = calculParamTransfHelmert(globalCoords, localCoords, noPtsFixes, calcScale);

  // Popola tabella parametri di trasformazione
  const tbodyParams = document.getElementById("params");
  tbodyParams.innerHTML = "";
  const params = [
    ["Fattore scala ", helm.lamda_moyen.toFixed(4)],
    ["Rotazione [gon]", helm.alpha_moyen.toFixed(4)],
    ["Traslazione Est [m]", helm.EG.toFixed(3)],
    ["Traslazione Nord [m]", helm.NG.toFixed(3)]
  ];
  params.forEach(p => tbodyParams.insertAdjacentHTML("beforeend", `<tr><td>${p[0]}</td><td>${p[1]}</td></tr>`));

  // Popola tabella residui sui punti in comune
  const tbodyTrans = document.getElementById("transformed");
  tbodyTrans.innerHTML = "";

  // Prepara array con residui e indice
  let residuals = noPtsFixes.map((no, idx) => {
    const deltaE = helm.dictPtsGlobalTransf[no].E - globalCoords[no].E;
    const deltaN = helm.dictPtsGlobalTransf[no].N - globalCoords[no].N;
    const norma = Math.sqrt(deltaE * deltaE + deltaN * deltaN);
    return {
      num: idx + 1,          // N. progressivo
      punto: no,             // nome del punto
      deltaE: deltaE,
      deltaN: deltaN,
      norma: norma
    };
  });

  // Ordina in ordine decrescente di norma
  residuals.sort((a, b) => b.norma - a.norma);

  // Inserisci in tabella
  residuals.forEach(r => {
    tbodyTrans.insertAdjacentHTML("beforeend",
      `<tr>
       <td>${r.num}</td>
       <td>${r.punto}</td>
       <td>${r.deltaE.toFixed(3)}</td>
       <td>${r.deltaN.toFixed(3)}</td>
       <td>${r.norma.toFixed(3)}</td>
     </tr>`
    );
  });



  // Trova i punti locali che NON sono presenti nel sistema globale
  const newPts = Object.keys(helm.dictPtsLocal).filter(p => !Object.keys(helm.dictPtsGlobal).includes(p));

  document.getElementById("newPoints").value = newPts.map(p => {
    const pt = helm.dictPtsGlobalTransf[p]; 
    return `${p},${pt.E.toFixed(3)},${pt.N.toFixed(3)}`;
  }).join("\n");


  document.getElementById("results").style.display = "block";
  // render chart showing points used in the transformation and the new points
  renderExportChart(noPtsFixes);
});
















// Gestione stato del bottone Export e regole di esclusione tra Report e le altre tre opzioni
(function setupExportControls() {
  const cbLocal = document.getElementById("expLocal");
  const cbGlobal = document.getElementById("expGlobal");
  const cbNuovi = document.getElementById("expNuovi");
  const cbReport = document.getElementById("expReport");
  const btnExport = document.getElementById("export");

  function updateExportEnabled() {
    btnExport.disabled = !(cbLocal.checked || cbGlobal.checked || cbNuovi.checked || cbReport.checked);
  }

  // Selezionando il report deseleziona le prime tre; se selezioni una delle prime tre deseleziona il report
  function onOtherChanged() {
    if (cbLocal.checked || cbGlobal.checked || cbNuovi.checked) {
      cbReport.checked = false;
    }
    updateExportEnabled();
  }
  function onReportChanged() {
    if (cbReport.checked) {
      cbLocal.checked = cbGlobal.checked = cbNuovi.checked = false;
    }
    updateExportEnabled();
  }

  cbLocal.addEventListener("change", onOtherChanged);
  cbGlobal.addEventListener("change", onOtherChanged);
  cbNuovi.addEventListener("change", onOtherChanged);
  cbReport.addEventListener("change", onReportChanged);

  // inizializza stato
  updateExportEnabled();
})();

// Helper per costruire contenuto .coo con H = 0.0 se mancante
function buildCooContent(includeLocal, includeGlobal, includeNuovi) {
  const lines = [];
  if (includeLocal) {
    lines.push("#Coordinate sistema locale");
    const txt = document.getElementById("local").value || "";
    const inputLines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    for (let l of inputLines) {
      const parts = l.split(",").map(p => p.trim());
      const no = parts[0] || "";
      const E = parts[1] ? parseFloat(parts[1]).toFixed(3) : "0.000";
      const N = parts[2] ? parseFloat(parts[2]).toFixed(3) : "0.000";
      const H = (parts[3] !== undefined && parts[3].trim() !== "") ? parseFloat(parts[3]).toFixed(3) : "0.000";
      lines.push(`${no},${E},${N},${H}`);
    }
    lines.push(""); // linea vuota separatrice
  }

  if (includeGlobal) {
    lines.push("#Coordinate sistema globale");
    const txt = document.getElementById("global").value || "";
    const inputLines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    for (let l of inputLines) {
      const parts = l.split(",").map(p => p.trim());
      const no = parts[0] || "";
      const E = parts[1] ? parseFloat(parts[1]).toFixed(3) : "0.000";
      const N = parts[2] ? parseFloat(parts[2]).toFixed(3) : "0.000";
      const H = (parts[3] !== undefined && parts[3].trim() !== "") ? parseFloat(parts[3]).toFixed(3) : "0.000";
      lines.push(`${no},${E},${N},${H}`);
    }
    lines.push("");
  }

  if (includeNuovi) {
    lines.push("#Coordinate nuovi punti nel sistema globale");
    const txt = document.getElementById("newPoints").value || "";
    const inputLines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    for (let l of inputLines) {
      // se già formattato come CSV lo usiamo; altrimenti proviamo a normalizzare
      if (l.includes(",")) {
        const parts = l.split(",").map(p => p.trim());
        const no = parts[0] || "";
        const E = parts[1] ? parseFloat(parts[1]).toFixed(3) : "0.000";
        const N = parts[2] ? parseFloat(parts[2]).toFixed(3) : "0.000";
        const H = (parts[3] !== undefined && parts[3].trim() !== "") ? parseFloat(parts[3]).toFixed(3) : "0.000";
        lines.push(`${no},${E},${N},${H}`);
      } else {
        // linea non CSV -> aggiungila così com'è
        lines.push(l);
      }
    }
    lines.push("");
  }

  return lines.join("\r\n");
}





// ...existing code...
// Genera PDF semplice con sezioni e tabelle (testo formattato)
async function buildPdfAndDownload(filename) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const leftMargin = 15;
  const pageWidth = 210;
  const rightLimit = pageWidth - 15;
  const lineHeight = 7;
  let y = 20;

  function ensurePageSpace(h) {
    if (y + h > 280) { doc.addPage(); y = 20; }
  }

  function addTitle(text) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor("#0091d8");
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
    doc.setTextColor(0, 0, 0);
    y += lineHeight + 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  }

  function addSubtitleLeft(text) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor("#0091d8");
    doc.text(text, leftMargin, y);
    doc.setTextColor(0, 0, 0);
    //y += lineHeight;
    y += 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  }

  // table: headerCols array, rows array-of-arrays (each row = array of cell strings), colWidths array (mm)
function drawTable(headerCols, rows, colWidths) {
  const rowH = 5;                    // altezza riga (header compreso)
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const x0 = leftMargin;

  // Assicura spazio prima di disegnare (header + almeno una riga)
  ensurePageSpace(rowH * (1 + Math.min(rows.length, 3)));

  doc.setLineWidth(0.2);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");

  // Header: usa la stessa "griglia" delle righe
  const headerTop = y;
  const headerBottom = y + rowH;
  const headerTextY = headerTop + rowH / 2 + 1; // aggiusta +1 se vuoi spostare verticalmente

  // linea orizzontale superiore dell'header
  doc.line(x0, headerTop, x0 + tableWidth, headerTop);

  // disegna header e separatori verticali limitati all'altezza dell'header
  let cx = x0;
  for (let i = 0; i < headerCols.length; i++) {
    const cw = colWidths[i];
    const txt = String(headerCols[i]);
    const tw = doc.getTextWidth(txt);
    doc.text(txt, cx + (cw / 2) - (tw / 2), headerTextY);
    cx += cw;
    // separatore verticale solo per altezza header
    doc.line(cx, headerTop, cx, headerBottom);
  }

  // linea inferiore dell'header e bordi esterni (segmenti)
  doc.line(x0, headerBottom, x0 + tableWidth, headerBottom);
  doc.line(x0, headerTop, x0, headerBottom);
  doc.line(x0 + tableWidth, headerTop, x0 + tableWidth, headerBottom);

  // sposta cursore alla prima riga
  y = headerBottom;

  // righe: coerenti con header (rowTop = y, rowBottom = y + rowH)
  doc.setFont("helvetica", "normal");
  for (const r of rows) {
    ensurePageSpace(rowH + 2);

    const rowTop = y;
    const rowBottom = y + rowH;
    const rowTextY = rowTop + rowH / 2 + 1;

    // bordi esterni segmento riga
    doc.line(x0, rowTop, x0, rowBottom);
    doc.line(x0 + tableWidth, rowTop, x0 + tableWidth, rowBottom);

    // celle e separatori verticali limitati a questa riga
    let cx2 = x0;
    for (let i = 0; i < colWidths.length; i++) {
      const cw = colWidths[i];
      const cell = r[i] !== undefined ? String(r[i]) : "";
      if (i === 0) {
        doc.text(cell, cx2 + 2, rowTextY);
      } else if (!isNaN(parseFloat(cell)) && cell.trim() !== "") {
        const tw = doc.getTextWidth(cell);
        doc.text(cell, cx2 + cw - 2 - tw, rowTextY);
      } else {
        doc.text(cell, cx2 + 2, rowTextY);
      }
      cx2 += cw;
      // separatore verticale per questo segmento di riga
      doc.line(cx2, rowTop, cx2, rowBottom);
    }

    // linea orizzontale sotto la riga
    doc.line(x0, rowBottom, x0 + tableWidth, rowBottom);

    // avanza alla riga successiva
    y = rowBottom;
  }

  // piccolo spazio dopo la tabella
  y += 4;
}


  // Titolo principale
  addTitle("Trasformazione Helmert 2D");

  // Sempre: Coordinate sistema locale (tabella)
  addSubtitleLeft("Coordinate sistema locale");
  {
    const txt = document.getElementById("local").value || "";
    const rows = (txt.split(/\r?\n/).map(l => l.trim()).filter(l => l)).map((l, idx) => {
      const p = l.split(",").map(x => x.trim());
      const no = p[0] || "";
      const E = p[1] ? parseFloat(p[1]).toFixed(3) : "0.000";
      const N = p[2] ? parseFloat(p[2]).toFixed(3) : "0.000";
      const H = (p[3] !== undefined && p[3].trim() !== "") ? parseFloat(p[3]).toFixed(3) : "0.000";
      return [String(idx + 1), no, E, N, H];
    });
    if (rows.length === 0) rows.push(["--", "--", "--", "--", "--"]);
    drawTable(["N.", "Punto", "E [m]", "N [m]", "H [m]"], rows, [12, 30, 30, 30, 30]);
  }

  // Sempre: Coordinate sistema globale (tabella)
  addSubtitleLeft("Coordinate sistema globale");
  {
    const txt = document.getElementById("global").value || "";
    const rows = (txt.split(/\r?\n/).map(l => l.trim()).filter(l => l)).map((l, idx) => {
      const p = l.split(",").map(x => x.trim());
      const no = p[0] || "";
      const E = p[1] ? parseFloat(p[1]).toFixed(3) : "0.000";
      const N = p[2] ? parseFloat(p[2]).toFixed(3) : "0.000";
      const H = (p[3] !== undefined && p[3].trim() !== "") ? parseFloat(p[3]).toFixed(3) : "0.000";
      return [String(idx + 1), no, E, N, H];
    });
    if (rows.length === 0) rows.push(["--", "--", "--", "--", "--"]);
    drawTable(["N.", "Punto", "E [m]", "N [m]", "H [m]"], rows, [12, 30, 30, 30, 30]);
  }

  // Tabella punti in comune con stato "Usato" (Sì/No)
  addSubtitleLeft("Punti in comune");
  {
    const rows = [];
    const tbody = document.getElementById("commonPoints");
    tbody.querySelectorAll("tr").forEach(tr => {
      const tds = tr.querySelectorAll("td");
      const idx = tds[0] ? tds[0].textContent.trim() : "";
      const key = tds[1] ? tds[1].textContent.trim() : "";
      const cb = tr.querySelector("input[type=checkbox]");
      const used = cb ? (cb.checked ? "Sì" : "No") : "--";
      rows.push([idx, key, used]);
    });
    if (rows.length === 0) rows.push(["--", "--", "--"]);
    drawTable(["N.", "Punto", "Usato"], rows, [12, 30, 20]);
  }

  // Parametri di trasformazione (sempre stampati)
  addSubtitleLeft("Parametri di trasformazione");
  const paramsRows = [];
  document.querySelectorAll("#params tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");
    if (tds.length >= 2) paramsRows.push([tds[0].textContent.trim(), tds[1].textContent.trim()]);
  });
  if (paramsRows.length === 0) paramsRows.push(["--", "--"]);
  drawTable(["Parametro", "Valore"], paramsRows, [60, 30]);

  // Residui sui punti in comune (sempre stampati)
  addSubtitleLeft("Residui sui punti in comune");
  const residRows = [];
  document.querySelectorAll("#transformed tr").forEach(tr => {
    const tds = Array.from(tr.querySelectorAll("td")).map(td => td.textContent.trim());
    if (tds.length) {
      const de = isNaN(Number(tds[2])) ? tds[2] : Number(tds[2]).toFixed(3);
      const dn = isNaN(Number(tds[3])) ? tds[3] : Number(tds[3]).toFixed(3);
      const nm = isNaN(Number(tds[4])) ? tds[4] : Number(tds[4]).toFixed(3);
      residRows.push([tds[0], tds[1], de, dn, nm]);
    }
  });
  if (residRows.length === 0) residRows.push(["--", "--", "--", "--", "--"]);
  drawTable(["N.", "Punto", "dE [m]", "dN [m]", "Norma [m]"], residRows, [12, 30, 30, 30, 30]);

  // Coordinate nuovi punti nel sistema globale (sempre stampate)
  addSubtitleLeft("Coordinate nuovi punti nel sistema globale");
  const newTxt = document.getElementById("newPoints").value || "";
  const newRows = (newTxt.split(/\r?\n/).map(l => l.trim()).filter(l => l)).map((l, idx) => {
    const p = l.split(",").map(x => x.trim());
    const no = p[0] || "";
    const E = p[1] ? parseFloat(p[1]).toFixed(3) : "0.000";
    const N = p[2] ? parseFloat(p[2]).toFixed(3) : "0.000";
    const H = (p[3] !== undefined && p[3].trim() !== "") ? parseFloat(p[3]).toFixed(3) : "0.000";
    return [String(idx + 1), no, E, N, H];
  });
  if (newRows.length === 0) newRows.push(["--", "--", "--", "--"]);
  drawTable(["N.", "Punto", "E [m]", "N [m]", "H [m]"], newRows, [12, 30, 30, 30, 30]);

  // Footer: data/ora a sinistra e numero pagina a destra su ogni pagina
  const totalPages = doc.getNumberOfPages();
  const now = new Date();
  const dateStr = now.toLocaleString();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(dateStr, 15, 290);
    const pageText = `Pagina ${i} / ${totalPages}`;
    const pw = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - 15 - pw, 290);
  }

  // download
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
// ...existing code...





// Export click handler aggiornato
document.getElementById("export").addEventListener("click", async () => {
  const cbLocal = document.getElementById("expLocal").checked;
  const cbGlobal = document.getElementById("expGlobal").checked;
  const cbNuovi = document.getElementById("expNuovi").checked;
  const cbReport = document.getElementById("expReport").checked;

  if (cbReport) {
    // genera PDF
    await buildPdfAndDownload("Trasformazione_Helmert_2D_Report.pdf");
    return;
  }

  // Costruisci .coo con le sezioni richieste
  const content = buildCooContent(cbLocal, cbGlobal, cbNuovi);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "coordinate.coo";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});







// Convex hull (Monotonic chain) su array di punti {E, N, name}
function convexHull(points) {
  if (points.length <= 1) return points.slice();
  const pts = points.slice().sort((a, b) => a.E === b.E ? a.N - b.N : a.E - b.E);
  const cross = (o, a, b) => (a.E - o.E) * (b.N - o.N) - (a.N - o.N) * (b.E - o.E);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function getPointsFromTextarea(id) {
  const txt = document.getElementById(id).value || "";
  const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  return lines.map(l => {
    const p = l.split(",").map(x => x.trim());
    return { name: p[0] || "", E: parseFloat(p[1] || "0"), N: parseFloat(p[2] || "0") };
  });
}

function drawTriangle(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.lineTo(x + size, y + size);
  ctx.closePath();
  ctx.fill();
}

function renderExportChart(usedNames = null) {
  const canvas = document.getElementById("exportChart");
  const section = document.getElementById("exportChartSection");
  const ctx = canvas.getContext("2d");

  // Base set of global points (from textarea)
  let globalPts = getPointsFromTextarea("global");

  // If the caller provided the list of used point names (from the transformation), use that
  if (usedNames && Array.isArray(usedNames) && usedNames.length > 0) {
    globalPts = globalPts.filter(p => usedNames.includes(p.name));
  } else {
    // fallback: if there are checkboxes, use checked ones
    const checkboxes = document.querySelectorAll("#commonPoints input[type=checkbox]");
    if (checkboxes.length) {
      const commonPoints = Array.from(checkboxes).map(cb => {
        const td = cb.parentElement.previousElementSibling; // cell with name
        return td ? td.textContent.trim() : "";
      });
      const checkedPoints = Array.from(checkboxes)
        .map((cb, i) => cb.checked ? commonPoints[i] : null)
        .filter(p => p);
      globalPts = globalPts.filter(p => checkedPoints.includes(p.name));
    }
  }

  const newPts = getPointsFromTextarea("newPoints");

  if (globalPts.length === 0 && newPts.length === 0) {
    section.style.display = "none";
    return;
  }

  // mostra canvas
  section.style.display = "block";
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // bounding box
  const all = globalPts.concat(newPts);
  const minE = Math.min(...all.map(p => p.E));
  const maxE = Math.max(...all.map(p => p.E));
  const minN = Math.min(...all.map(p => p.N));
  const maxN = Math.max(...all.map(p => p.N));
  let dx = maxE - minE || 1;
  let dy = maxN - minN || 1;

  // area utile con padding
  const pad = 40;
  const W = canvas.width, H = canvas.height;
  const usableW = W - 2 * pad;
  const usableH = H - 2 * pad;

  // scale uguali
  const scale = Math.min(usableW / dx, usableH / dy);
  const extraX = (usableW - dx * scale) / 2;
  const extraY = (usableH - dy * scale) / 2;

  const mapX = E => pad + extraX + (E - minE) * scale;
  const mapY = N => H - (pad + extraY + (N - minN) * scale); // Y invertita

  // disegna assi (leggeri)
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  // axis frame removed (no border requested) — keep drawing area without a stroked rectangle

  // disegna inviluppo convesso dei punti globali
  if (globalPts.length >= 3) {
    const hull = convexHull(globalPts);
    ctx.strokeStyle = "rgba(0,150,255,0.9)";
    ctx.fillStyle = "rgba(0,150,255,0.08)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < hull.length; i++) {
      const p = hull[i];
      const x = mapX(p.E), y = mapY(p.N);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // disegna punti globali come triangoli blu
  for (const p of globalPts) {
    const x = mapX(p.E), y = mapY(p.N);
    drawTriangle(ctx, x, y, 6, "#0b63c6");
    // label
    ctx.fillStyle = "#0b63c6";
    ctx.font = "10px sans-serif";
    ctx.fillText(p.name, x + 8, y + 4);
  }

  // disegna nuovi punti come cerchi rossi
  for (const p of newPts) {
    const x = mapX(p.E), y = mapY(p.N);
    ctx.fillStyle = "#d9534f";
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9534f";
    ctx.fillText(p.name, x + 8, y + 4);
  }

  // legenda
  const lx = W - pad - 140, ly = pad;
  ctx.fillStyle = "#fff";
  // legend background without border
  ctx.fillRect(lx - 6, ly - 6, 140, 52);
  // global
  drawTriangle(ctx, lx + 12, ly + 12, 6, "#0b63c6");
  ctx.fillStyle = "#000";
  ctx.font = "11px sans-serif";
  ctx.fillText("Punti usati per il calcolo", lx + 28, ly + 16);
  // new
  ctx.fillStyle = "#d9534f";
  ctx.beginPath();
  ctx.arc(lx + 12, ly + 34, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.fillText("Nuovi punti", lx + 28, ly + 38);
}

// chiama il render al termine dell'export (mostra grafico nella pagina)
(function hookExportChart() {
  const exportBtn = document.getElementById("export");
  if (!exportBtn) return;
  const originalHandler = exportBtn.onclick; // non presente normalmente; comunque non usato
  // aggiungi call finale dopo l'attuale listener completato: usa event listener separato
  exportBtn.addEventListener("click", () => {
    // piccola attesa per assicurare che i dati siano scritti nelle textarea prima del render
    setTimeout(() => renderExportChart(), 200);
  });
})();
