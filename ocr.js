// ======================================================
// OMI EXPENSES - OCR SCONTRINI
// ======================================================


// Manteniamo il worker in memoria.
// In questo modo dalla seconda scansione in poi
// non dobbiamo inizializzare Tesseract da zero.

let ocrWorkerPromise = null;


// ======================================================
// FUNZIONE PRINCIPALE
// ======================================================

async function readReceipt() {

    const fileInput =
        document.getElementById(
            "receipt"
        );


    const file =
        fileInput.files[0];


    const ocrButton =
        document.getElementById(
            "ocrButton"
        );


    // ----------------------------------------------
    // CONTROLLI
    // ----------------------------------------------

    if (!file) {

        alert(
            "Seleziona o fotografa prima uno scontrino."
        );

        return;
    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        alert(
            "Il file selezionato non è un'immagine."
        );

        return;
    }


    if (
        typeof Tesseract ===
        "undefined"
    ) {

        alert(
            "Tesseract non è stato caricato correttamente."
        );

        return;
    }


    try {

        ocrButton.disabled =
            true;


        resetOcrUi();


        setOcrStatus(
            "Preparazione immagine..."
        );


        // ------------------------------------------
        // MIGLIORA FOTO
        // ------------------------------------------

        const processedImage =
            await preprocessReceipt(
                file
            );


        // ------------------------------------------
        // CREA / RECUPERA WORKER
        // ------------------------------------------

        const worker =
            await getOcrWorker();


        setOcrStatus(
            "Lettura dello scontrino..."
        );


        // ------------------------------------------
        // OCR
        // ------------------------------------------

        const result =
            await worker.recognize(
                processedImage
            );


        const text =
            result.data.text
                .trim();


        const confidence =
            result.data.confidence;


        console.log(
            "TESTO OCR:"
        );

        console.log(
            text
        );


        if (!text) {

            throw new Error(
                "Non è stato riconosciuto alcun testo."
            );
        }


        // ------------------------------------------
        // MOSTRA TESTO OCR
        // ------------------------------------------

        showOcrText(
            text
        );


        // ------------------------------------------
        // ESTRAZIONE DATI
        // ------------------------------------------

        const detectedDate =
            extractReceiptDate(
                text
            );


        const detectedAmount =
            extractReceiptAmount(
                text
            );


        const detectedCategory =
            detectExpenseCategory(
                text
            );


        // ------------------------------------------
        // COMPILA DATA
        // ------------------------------------------

        if (detectedDate) {

            document
                .getElementById(
                    "date"
                )
                .value =
                detectedDate;
        }


        // ------------------------------------------
        // COMPILA IMPORTO
        // ------------------------------------------

        if (
            detectedAmount !==
            null
        ) {

            document
                .getElementById(
                    "amount"
                )
                .value =
                detectedAmount
                    .toFixed(2);
        }


        // ------------------------------------------
        // COMPILA CATEGORIA
        // ------------------------------------------

        if (
            detectedCategory
        ) {

            document
                .getElementById(
                    "category"
                )
                .value =
                detectedCategory;
        }


        // ------------------------------------------
        // RISULTATO
        // ------------------------------------------

        const found = [];

        const missing = [];


        if (detectedDate) {

            found.push(
                "data"
            );

        } else {

            missing.push(
                "data"
            );
        }


        if (
            detectedAmount !==
            null
        ) {

            found.push(
                "importo"
            );

        } else {

            missing.push(
                "importo"
            );
        }


        if (
            detectedCategory
        ) {

            found.push(
                "categoria"
            );

        } else {

            missing.push(
                "categoria"
            );
        }


        let message =
            "OCR completato";


        if (
            Number.isFinite(
                confidence
            )
        ) {

            message +=
                ` · qualità ${Math.round(
                    confidence
                )}%`;
        }


        if (
            found.length > 0
        ) {

            message +=
                ` · trovato: ${found.join(
                    ", "
                )}`;
        }


        if (
            missing.length > 0
        ) {

            message +=
                ` · controlla manualmente: ${missing.join(
                    ", "
                )}`;
        }


        setOcrStatus(
            message
        );

    }

    catch (error) {

        console.error(
            "Errore OCR:",
            error
        );


        setOcrStatus(
            "Errore OCR: " +
            error.message,
            true
        );


        alert(
            "Non sono riuscito a leggere lo scontrino.\n\n" +
            "Prova a fotografarlo più vicino, " +
            "ben illuminato e senza riflessi."
        );

    }

    finally {

        ocrButton.disabled =
            false;
    }
}


// ======================================================
// CREA WORKER TESSERACT
// ======================================================

async function getOcrWorker() {

    if (
        ocrWorkerPromise
    ) {

        return ocrWorkerPromise;
    }


    setOcrStatus(
        "Inizializzazione OCR..."
    );


    ocrWorkerPromise =
        Tesseract.createWorker(
            [
                "ita",
                "eng"
            ],
            1,
            {
                logger:
                    handleOcrProgress
            }
        )
        .catch(
            error => {

                ocrWorkerPromise =
                    null;

                throw error;
            }
        );


    return ocrWorkerPromise;
}


// ======================================================
// PROGRESSO OCR
// ======================================================

function handleOcrProgress(
    message
) {

    if (!message) {
        return;
    }


    const status =
        message.status || "";


    const progress =
        Number(
            message.progress
        );


    if (
        status ===
        "recognizing text" &&
        Number.isFinite(
            progress
        )
    ) {

        const percentage =
            Math.round(
                progress * 100
            );


        setOcrStatus(
            `Lettura scontrino: ${percentage}%`
        );

        return;
    }


    const translations = {

        "loading tesseract core":
            "Caricamento motore OCR...",

        "initializing tesseract":
            "Inizializzazione OCR...",

        "loading language traineddata":
            "Caricamento lingua OCR...",

        "initializing api":
            "Preparazione riconoscimento..."
    };


    if (
        translations[
            status
        ]
    ) {

        setOcrStatus(
            translations[
                status
            ]
        );
    }
}


// ======================================================
// PRE-PROCESSA FOTO
// ======================================================

async function preprocessReceipt(
    file
) {

    const image =
        await loadImageFile(
            file
        );


    const originalWidth =
        image.naturalWidth;


    const originalHeight =
        image.naturalHeight;


    if (
        !originalWidth ||
        !originalHeight
    ) {

        throw new Error(
            "Immagine non valida."
        );
    }


    // ----------------------------------------------
    // RIDIMENSIONAMENTO
    // ----------------------------------------------

    const MIN_WIDTH =
        1600;


    const MAX_WIDTH =
        2400;


    const MAX_PIXELS =
        12_000_000;


    let scale = 1;


    if (
        originalWidth <
        MIN_WIDTH
    ) {

        scale =
            MIN_WIDTH /
            originalWidth;
    }


    if (
        originalWidth >
        MAX_WIDTH
    ) {

        scale =
            MAX_WIDTH /
            originalWidth;
    }


    let targetWidth =
        Math.round(
            originalWidth *
            scale
        );


    let targetHeight =
        Math.round(
            originalHeight *
            scale
        );


    const totalPixels =
        targetWidth *
        targetHeight;


    if (
        totalPixels >
        MAX_PIXELS
    ) {

        const reduction =
            Math.sqrt(
                MAX_PIXELS /
                totalPixels
            );


        targetWidth =
            Math.round(
                targetWidth *
                reduction
            );


        targetHeight =
            Math.round(
                targetHeight *
                reduction
            );
    }


    // ----------------------------------------------
    // CANVAS
    // ----------------------------------------------

    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        targetWidth;


    canvas.height =
        targetHeight;


    const context =
        canvas.getContext(
            "2d",
            {
                willReadFrequently:
                    true
            }
        );


    // Sfondo bianco
    context.fillStyle =
        "#ffffff";


    context.fillRect(
        0,
        0,
        targetWidth,
        targetHeight
    );


    context.drawImage(
        image,
        0,
        0,
        targetWidth,
        targetHeight
    );


    // ----------------------------------------------
    // BIANCO/NERO + CONTRASTO
    // ----------------------------------------------

    const imageData =
        context.getImageData(
            0,
            0,
            targetWidth,
            targetHeight
        );


    const pixels =
        imageData.data;


    const CONTRAST =
        1.35;


    for (
        let i = 0;
        i < pixels.length;
        i += 4
    ) {

        const red =
            pixels[i];


        const green =
            pixels[i + 1];


        const blue =
            pixels[i + 2];


        // Luminanza
        let gray =
            (
                red * 0.299 +
                green * 0.587 +
                blue * 0.114
            );


        // Contrasto
        gray =
            (
                gray - 128
            ) *
            CONTRAST +
            128;


        gray =
            Math.max(
                0,
                Math.min(
                    255,
                    gray
                )
            );


        pixels[i] =
            gray;

        pixels[i + 1] =
            gray;

        pixels[i + 2] =
            gray;
    }


    context.putImageData(
        imageData,
        0,
        0
    );


    return canvas;
}


// ======================================================
// CARICA FILE COME IMMAGINE
// ======================================================

function loadImageFile(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const objectUrl =
                URL.createObjectURL(
                    file
                );


            const image =
                new Image();


            image.onload =
                () => {

                    URL.revokeObjectURL(
                        objectUrl
                    );

                    resolve(
                        image
                    );
                };


            image.onerror =
                () => {

                    URL.revokeObjectURL(
                        objectUrl
                    );

                    reject(
                        new Error(
                            "Il browser non riesce a leggere questa immagine."
                        )
                    );
                };


            image.src =
                objectUrl;
        }
    );
}


// ======================================================
// ESTRAZIONE DATA
// ======================================================

function extractReceiptDate(
    text
) {

    const lines =
        text
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    const candidates = [];


    for (
        const line of lines
    ) {

        const matches =
            line.match(
                /\b\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{1,4}\b/g
            );


        if (!matches) {
            continue;
        }


        for (
            const match of matches
        ) {

            const parsed =
                parseDateToken(
                    match
                );


            if (!parsed) {
                continue;
            }


            let score = 0;


            const upper =
                normalizeText(
                    line
                );


            if (
                upper.includes(
                    "DATA"
                ) ||
                upper.includes(
                    "DATE"
                )
            ) {

                score += 20;
            }


            if (
                upper.includes(
                    "DOCUMENTO"
                ) ||
                upper.includes(
                    "RICEVUTA"
                ) ||
                upper.includes(
                    "SCONTRINO"
                )
            ) {

                score += 5;
            }


            const currentYear =
                new Date()
                    .getFullYear();


            if (
                Math.abs(
                    parsed.year -
                    currentYear
                ) <= 1
            ) {

                score += 10;
            }


            candidates.push({
                value:
                    parsed.inputValue,

                score:
                    score
            });
        }
    }


    if (
        candidates.length ===
        0
    ) {

        return null;
    }


    candidates.sort(
        (
            a,
            b
        ) =>
            b.score -
            a.score
    );


    return candidates[0].value;
}


// ======================================================
// CONVERTE DATA OCR IN YYYY-MM-DD
// ======================================================

function parseDateToken(
    token
) {

    const parts =
        token.split(
            /[\/.\-]/
        );


    if (
        parts.length !== 3
    ) {

        return null;
    }


    let year;
    let month;
    let day;


    if (
        parts[0].length === 4
    ) {

        year =
            Number(
                parts[0]
            );

        month =
            Number(
                parts[1]
            );

        day =
            Number(
                parts[2]
            );

    } else {

        day =
            Number(
                parts[0]
            );

        month =
            Number(
                parts[1]
            );

        year =
            Number(
                parts[2]
            );


        if (
            year < 100
        ) {

            year += 2000;
        }
    }


    if (
        year < 2000 ||
        year > 2099
    ) {

        return null;
    }


    if (
        month < 1 ||
        month > 12
    ) {

        return null;
    }


    if (
        day < 1 ||
        day > 31
    ) {

        return null;
    }


    const testDate =
        new Date(
            year,
            month - 1,
            day
        );


    if (
        testDate.getFullYear() !==
            year ||

        testDate.getMonth() !==
            month - 1 ||

        testDate.getDate() !==
            day
    ) {

        return null;
    }


    return {

        year,
        month,
        day,

        inputValue:
            `${year}-` +
            `${String(month).padStart(
                2,
                "0"
            )}-` +
            `${String(day).padStart(
                2,
                "0"
            )}`
    };
}


// ======================================================
// ESTRAZIONE IMPORTO
// ======================================================

function extractReceiptAmount(
    text
) {

    const lines =
        text
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    const candidates = [];


    for (
        const line of lines
    ) {

        const moneyMatches =
            line.match(
                /(?:(?:€|EUR)\s*)?\d{1,3}(?:[.\s]\d{3})*[,.]\d{2}(?:\s*(?:€|EUR))?|(?:(?:€|EUR)\s*)?\d+[,.]\d{2}(?:\s*(?:€|EUR))?/gi
            );


        if (
            !moneyMatches
        ) {

            continue;
        }


        const normalizedLine =
            normalizeText(
                line
            );


        for (
            const moneyText of
            moneyMatches
        ) {

            const value =
                parseMoneyValue(
                    moneyText
                );


            if (
                value === null ||
                value <= 0 ||
                value > 100000
            ) {

                continue;
            }


            let score = 0;


            // --------------------------------------
            // PAROLE MOLTO IMPORTANTI
            // --------------------------------------

            if (
                normalizedLine.includes(
                    "TOTALE"
                ) ||
                normalizedLine.includes(
                    "TOTAL"
                )
            ) {

                score += 100;
            }


            if (
                normalizedLine.includes(
                    "IMPORTO"
                ) ||
                normalizedLine.includes(
                    "AMOUNT"
                )
            ) {

                score += 80;
            }


            if (
                normalizedLine.includes(
                    "DA PAGARE"
                ) ||
                normalizedLine.includes(
                    "PAGATO"
                ) ||
                normalizedLine.includes(
                    "PAYMENT"
                )
            ) {

                score += 70;
            }


            if (
                normalizedLine.includes(
                    "CARTA"
                ) ||
                normalizedLine.includes(
                    "BANCOMAT"
                )
            ) {

                score += 20;
            }


            if (
                normalizedLine.includes(
                    "EUR"
                ) ||
                normalizedLine.includes(
                    "€"
                )
            ) {

                score += 10;
            }


            // --------------------------------------
            // VALORI DA PENALIZZARE
            // --------------------------------------

            if (
                normalizedLine.includes(
                    "SUBTOTALE"
                ) ||
                normalizedLine.includes(
                    "SUBTOTAL"
                )
            ) {

                score -= 70;
            }


            if (
                normalizedLine.includes(
                    "IVA"
                ) ||
                normalizedLine.includes(
                    "VAT"
                ) ||
                normalizedLine.includes(
                    "IMPOSTA"
                )
            ) {

                score -= 80;
            }


            if (
                normalizedLine.includes(
                    "RESTO"
                ) ||
                normalizedLine.includes(
                    "CHANGE"
                )
            ) {

                score -= 80;
            }


            if (
                normalizedLine.includes(
                    "SCONTO"
                ) ||
                normalizedLine.includes(
                    "DISCOUNT"
                )
            ) {

                score -= 60;
            }


            if (
                normalizedLine.includes(
                    "IMPONIBILE"
                )
            ) {

                score -= 60;
            }


            // A parità di punteggio
            // preferiamo leggermente
            // l'importo più alto.

            score +=
                Math.min(
                    value,
                    10000
                ) /
                10000;


            candidates.push({
                value,
                score
            });
        }
    }


    if (
        candidates.length ===
        0
    ) {

        return null;
    }


    candidates.sort(
        (
            a,
            b
        ) => {

            if (
                b.score !==
                a.score
            ) {

                return (
                    b.score -
                    a.score
                );
            }


            return (
                b.value -
                a.value
            );
        }
    );


    return candidates[0].value;
}


// ======================================================
// CONVERTE € OCR IN NUMBER
// ======================================================

function parseMoneyValue(
    rawValue
) {

    let value =
        rawValue
            .toUpperCase()
            .replace(
                /EUR/g,
                ""
            )
            .replace(
                /€/g,
                ""
            )
            .replace(
                /\s/g,
                ""
            );


    const lastComma =
        value.lastIndexOf(
            ","
        );


    const lastDot =
        value.lastIndexOf(
            "."
        );


    // Esempio:
    // 1.234,56

    if (
        lastComma !== -1 &&
        lastDot !== -1
    ) {

        if (
            lastComma >
            lastDot
        ) {

            value =
                value
                    .replace(
                        /\./g,
                        ""
                    )
                    .replace(
                        ",",
                        "."
                    );

        } else {

            value =
                value
                    .replace(
                        /,/g,
                        ""
                    );
        }

    } else if (
        lastComma !== -1
    ) {

        value =
            value.replace(
                ",",
                "."
            );
    }


    const number =
        Number(value);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;
    }


    return number;
}


// ======================================================
// RICONOSCIMENTO CATEGORIA
// ======================================================

function detectExpenseCategory(
    text
) {

    const normalized =
        normalizeText(
            text
        );


    // ----------------------------------------------
    // HOTEL
    // ----------------------------------------------

    if (
        containsAny(
            normalized,
            [
                "HOTEL",
                "ALBERGO",
                "BED AND BREAKFAST",
                "B&B",
                "ROOM",
                "PERNOTTAMENTO"
            ]
        )
    ) {

        return "HOTEL";
    }


    // ----------------------------------------------
    // BENZINA / CARBURANTE
    // ----------------------------------------------

    if (
        containsAny(
            normalized,
            [
                "CARBURANTE",
                "BENZINA",
                "GASOLIO",
                "DIESEL",
                "FUEL",
                "BENZINAIO",
                "STAZIONE DI SERVIZIO",
                "ENI",
                "Q8",
                "TAMOIL",
                "ESSO",
                "SHELL"
            ]
        )
    ) {

        return "GASOLINE";
    }


    // ----------------------------------------------
    // PARCHEGGIO
    // ----------------------------------------------

    if (
        containsAny(
            normalized,
            [
                "PARCHEGGIO",
                "PARKING",
                "AUTORIMESSA",
                "SOSTA",
                "EASYPARK"
            ]
        )
    ) {

        return "PARKING";
    }


    // ----------------------------------------------
    // TAXI
    // ----------------------------------------------

    if (
        containsAny(
            normalized,
            [
                "TAXI",
                "UBER",
                "FREE NOW",
                "FREENOW",
                "NCC"
            ]
        )
    ) {

        return "TAXI";
    }


    // ----------------------------------------------
    // COLAZIONE
    // ----------------------------------------------

    if (
        containsAny(
            normalized,
            [
                "COLAZIONE",
                "BREAKFAST"
            ]
        )
    ) {

        return "BREAKFAST";
    }


    // ----------------------------------------------
    // PRANZO
    // ----------------------------------------------

    if (
        containsAny(
            normalized,
            [
                "PRANZO",
                "LUNCH"
            ]
        )
    ) {

        return "LUNCH";
    }


    // ----------------------------------------------
    // CENA
    // ----------------------------------------------

    if (
        containsAny(
            normalized,
            [
                "CENA",
                "DINNER"
            ]
        )
    ) {

        return "DINNER";
    }


    // ----------------------------------------------
    // BAR / RISTORANTE
    // ----------------------------------------------

    const isRestaurant =
        containsAny(
            normalized,
            [
                "RISTORANTE",
                "TRATTORIA",
                "PIZZERIA",
                "OSTERIA",
                "RESTAURANT",
                "AUTOGRILL",
                "RISTORAZIONE",
                "FOOD"
            ]
        );


    const isBar =
        containsAny(
            normalized,
            [
                "CAFFE",
                "CAFFETTERIA",
                "CAPPUCCINO",
                "PASTICCERIA",
                "BAKERY",
                "BAR"
            ]
        );


    const time =
        extractReceiptTime(
            text
        );


    if (
        isBar &&
        time !== null &&
        time < 11
    ) {

        return "BREAKFAST";
    }


    if (
        isRestaurant &&
        time !== null
    ) {

        if (
            time >= 17
        ) {

            return "DINNER";
        }


        if (
            time >= 11
        ) {

            return "LUNCH";
        }
    }


    if (
        isBar &&
        time !== null
    ) {

        if (
            time >= 17
        ) {

            return "DINNER";
        }


        if (
            time >= 11
        ) {

            return "LUNCH";
        }
    }


    // Se non siamo sicuri,
    // NON cambiamo la categoria.

    return null;
}


// ======================================================
// ESTRAE ORARIO
// ======================================================

function extractReceiptTime(
    text
) {

    const matches =
        text.match(
            /\b([01]?\d|2[0-3])[:.](\d{2})\b/g
        );


    if (
        !matches ||
        matches.length === 0
    ) {

        return null;
    }


    // Di solito il primo orario trovato
    // è quello della transazione.

    const parts =
        matches[0]
            .split(
                /[:.]/
            );


    const hour =
        Number(
            parts[0]
        );


    if (
        !Number.isFinite(
            hour
        )
    ) {

        return null;
    }


    return hour;
}


// ======================================================
// NORMALIZZAZIONE TESTO
// ======================================================

function normalizeText(
    text
) {

    return String(
        text || ""
    )
        .normalize(
            "NFD"
        )
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toUpperCase();
}


// ======================================================
// CERCA PAROLE
// ======================================================

function containsAny(
    text,
    words
) {

    return words.some(
        word =>
            text.includes(
                word
            )
    );
}


// ======================================================
// MOSTRA TESTO OCR
// ======================================================

function showOcrText(
    text
) {

    const details =
        document.getElementById(
            "ocrDetails"
        );


    const pre =
        document.getElementById(
            "ocrText"
        );


    pre.textContent =
        text;


    details.hidden =
        false;
}


// ======================================================
// STATO OCR
// ======================================================

function setOcrStatus(
    message,
    isError = false
) {

    const element =
        document.getElementById(
            "ocrStatus"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.dataset.state =
        isError
            ? "error"
            : "normal";
}


// ======================================================
// RESET INTERFACCIA OCR
// ======================================================

function resetOcrUi() {

    const status =
        document.getElementById(
            "ocrStatus"
        );


    const details =
        document.getElementById(
            "ocrDetails"
        );


    const text =
        document.getElementById(
            "ocrText"
        );


    if (status) {

        status.textContent =
            "";
    }


    if (details) {

        details.hidden =
            true;
    }


    if (text) {

        text.textContent =
            "";
    }
}