const developer_mode = true

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
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  const coords = {};
  for (let line of lines) {
    const parts = line.split(",");
    if (parts.length >= 3) {
      const no = parts[0].trim();
      coords[no] = {
        E: parseFloat(parts[1]), // Est
        N: parseFloat(parts[2]), // Nord
        H: parts[3] ? parseFloat(parts[3]) : 0.0, // opzionale
        Code: parts[4] ? parts[4].trim() : ""
      };
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

      for (let line of lines) {
        const parts = line.split(/\s+/); // separatore spazio
        const name = parts[0];          // primo campo come nome
        const E = parseFloat(parts[2]); // coordinate E
        const N = parseFloat(parts[3]); // coordinate N

        // Se il punto esiste nella lista locale, aggiungilo alla textarea globale
        if (localCoords[name]) {
          const codiceLocale = localCoords[name].Code;
          globalCoords.push(`${name},${E.toFixed(4)},${N.toFixed(4)},0.0,${codiceLocale}`);
        }
      }

      document.getElementById("global").value = globalCoords.join("\n");
    };

    reader.readAsText(file);
  };

  input.click();
});




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
  if (numPoints >= 2) {
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

  // Aggiorniamo il messaggio se l’utente deseleziona punti
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
    ["Fattore scala ", helm.lamda_moyen.toFixed(5)],
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
    const pt = helm.dictPtsGlobalTransf[p]; // useremo le coordinate locali, se vuoi trasformate puoi usare dictPtsGlobalTransf[p]
    return `${p},${pt.E.toFixed(3)},${pt.N.toFixed(3)},0.0,10`;
  }).join("\n");


  document.getElementById("results").style.display = "block";
});


document.getElementById("export").addEventListener("click", () => {
  const parts = [];
  if (document.getElementById("expLocal").checked) parts.push("Lista punti locali");
  if (document.getElementById("expGlobal").checked) parts.push("Lista punti globali");
  if (document.getElementById("expTransformed").checked) parts.push("Residui sui punti in comune");
  alert("Esportazione simulata:\n" + parts.join("\n"));
});
